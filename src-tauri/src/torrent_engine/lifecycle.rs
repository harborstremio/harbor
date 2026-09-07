use std::future::Future;
use std::sync::Mutex;

use tokio::sync::{Mutex as AsyncMutex, MutexGuard};
use tokio_util::sync::CancellationToken;

pub const DISABLED: &str = "torrents disabled in settings";
pub const STOPPED: &str = "torrent engine stopped";

#[derive(Clone, Copy)]
pub struct Change {
    revision: u64,
    enabled: bool,
}

struct Policy {
    enabled: bool,
    desired: bool,
    revision: u64,
    cancellation: CancellationToken,
}

pub struct Lifecycle {
    policy: Mutex<Policy>,
    transition: AsyncMutex<()>,
}

impl Lifecycle {
    pub fn new(enabled: bool) -> Self {
        let cancellation = CancellationToken::new();
        if !enabled {
            cancellation.cancel();
        }
        Self {
            policy: Mutex::new(Policy {
                enabled,
                desired: enabled,
                revision: 0,
                cancellation,
            }),
            transition: AsyncMutex::new(()),
        }
    }

    pub async fn lock(&self) -> MutexGuard<'_, ()> {
        self.transition.lock().await
    }

    pub fn is_enabled(&self) -> bool {
        self.policy.lock().unwrap().enabled
    }

    pub fn request(&self, enabled: bool) -> Change {
        let mut policy = self.policy.lock().unwrap();
        policy.revision += 1;
        policy.desired = enabled;
        if !enabled {
            policy.enabled = false;
            policy.cancellation.cancel();
        }
        Change {
            revision: policy.revision,
            enabled,
        }
    }

    pub fn is_current(&self, change: Change) -> bool {
        let policy = self.policy.lock().unwrap();
        policy.revision == change.revision && policy.desired == change.enabled
    }

    pub fn enable(&self, change: Change) -> bool {
        let mut policy = self.policy.lock().unwrap();
        if !change.enabled || policy.revision != change.revision || !policy.desired {
            return false;
        }
        if !policy.enabled {
            policy.cancellation = CancellationToken::new();
            policy.enabled = true;
        }
        true
    }

    pub fn token(&self) -> Result<CancellationToken, String> {
        let policy = self.policy.lock().unwrap();
        if !policy.enabled || policy.cancellation.is_cancelled() {
            return Err(DISABLED.to_string());
        }
        Ok(policy.cancellation.clone())
    }
}

pub async fn run<T>(
    cancellation: CancellationToken,
    future: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    tokio::select! {
        biased;
        _ = cancellation.cancelled() => Err(STOPPED.to_string()),
        result = future => {
            if cancellation.is_cancelled() {
                Err(STOPPED.to_string())
            } else {
                result
            }
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::sync::oneshot;
    use tokio::time::{timeout, Duration};

    #[test]
    fn disabled_start_rejects_work_until_explicit_enable() {
        let lifecycle = Lifecycle::new(false);
        assert!(lifecycle.token().is_err());
        let enable = lifecycle.request(true);
        assert!(lifecycle.token().is_err());
        assert!(lifecycle.enable(enable));
        assert!(!lifecycle.token().unwrap().is_cancelled());
    }

    #[test]
    fn repeated_enable_preserves_the_live_generation() {
        let lifecycle = Lifecycle::new(true);
        let token = lifecycle.token().unwrap();
        let child = token.child_token();
        assert!(lifecycle.enable(lifecycle.request(true)));
        assert!(!child.is_cancelled());
        lifecycle.request(false);
        assert!(token.is_cancelled());
        assert!(child.is_cancelled());
    }

    #[test]
    fn reenable_never_revives_old_sessions_or_queued_enable_requests() {
        let lifecycle = Lifecycle::new(true);
        let old = lifecycle.token().unwrap();
        let stale_enable = lifecycle.request(true);
        let disable = lifecycle.request(false);
        assert!(!lifecycle.enable(stale_enable));
        assert!(lifecycle.is_current(disable));
        let enable = lifecycle.request(true);
        assert!(lifecycle.enable(enable));
        assert!(old.is_cancelled());
        assert!(!lifecycle.token().unwrap().is_cancelled());
        assert!(!lifecycle.is_current(disable));
    }

    #[tokio::test]
    async fn disable_cancels_startup_before_waiting_for_its_transition() {
        let lifecycle = Arc::new(Lifecycle::new(true));
        let published = Arc::new(AtomicBool::new(false));
        let (entered, entered_rx) = oneshot::channel();
        let startup = {
            let lifecycle = lifecycle.clone();
            let published = published.clone();
            tokio::spawn(async move {
                let _transition = lifecycle.lock().await;
                let token = lifecycle.token()?;
                let guard = token.child_token().drop_guard();
                entered.send(()).unwrap();
                let result = run(token, async {
                    std::future::pending::<()>().await;
                    published.store(true, Ordering::SeqCst);
                    Ok(())
                })
                .await;
                drop(guard);
                result
            })
        };
        entered_rx.await.unwrap();
        lifecycle.request(false);
        assert!(timeout(Duration::from_secs(1), startup)
            .await
            .unwrap()
            .unwrap()
            .is_err());
        let _transition = timeout(Duration::from_secs(1), lifecycle.lock())
            .await
            .unwrap();
        assert!(!published.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn cancellation_drops_pending_metadata_and_independent_selftest_work() {
        struct Pending(Arc<AtomicUsize>);
        impl Drop for Pending {
            fn drop(&mut self) {
                self.0.fetch_add(1, Ordering::SeqCst);
            }
        }
        let lifecycle = Lifecycle::new(true);
        let token = lifecycle.token().unwrap();
        let dropped = Arc::new(AtomicUsize::new(0));
        let mut tasks = Vec::new();
        for _ in 0..2 {
            let marker = Pending(dropped.clone());
            tasks.push(tokio::spawn(run(token.clone(), async move {
                let _marker = marker;
                std::future::pending::<()>().await;
                Ok(())
            })));
        }
        tokio::task::yield_now().await;
        lifecycle.request(false);
        for task in tasks {
            assert!(timeout(Duration::from_secs(1), task)
                .await
                .unwrap()
                .unwrap()
                .is_err());
        }
        assert_eq!(dropped.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn cancelled_work_is_never_polled() {
        let lifecycle = Lifecycle::new(true);
        let token = lifecycle.token().unwrap();
        let work_polled = AtomicBool::new(false);
        lifecycle.request(false);
        let result = run(token, async {
            work_polled.store(true, Ordering::SeqCst);
            Ok(())
        })
        .await;
        assert!(result.is_err());
        assert!(!work_polled.load(Ordering::SeqCst));
    }
}
