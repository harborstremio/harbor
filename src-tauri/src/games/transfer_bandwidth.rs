use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;

pub const CHUNK_BYTES: usize = 16 * 1024;
pub const MIN_RATE: u64 = 16 * 1024;
pub const MAX_RATE: u64 = 1024 * 1024 * 1024;

pub fn valid_rate(rate: u64) -> bool {
    rate == 0 || (MIN_RATE..=MAX_RATE).contains(&rate)
}

struct Budget {
    rate: u64,
    gate: tokio::sync::Mutex<Instant>,
    changed: watch::Sender<bool>,
}

#[derive(Default)]
pub struct Bandwidth {
    profiles: Mutex<HashMap<String, Arc<Budget>>>,
}
impl Bandwidth {
    pub fn set(&self, profile: &str, rate: u64) {
        let mut profiles = self
            .profiles
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(old) = profiles.remove(profile) {
            // Wake every reservation, including a switch to unlimited. Changes to a
            // different profile must not delay or re-reserve these bytes.
            old.changed.send_replace(true);
        }
        if rate != 0 {
            let (changed, _) = watch::channel(false);
            profiles.insert(
                profile.into(),
                Arc::new(Budget {
                    rate,
                    gate: tokio::sync::Mutex::new(Instant::now()),
                    changed,
                }),
            );
        }
    }

    pub async fn acquire(
        &self,
        profile: &str,
        bytes: usize,
        cancel: &CancellationToken,
    ) -> Result<(), &'static str> {
        if bytes > CHUNK_BYTES {
            return Err("transfer_length");
        }
        loop {
            if cancel.is_cancelled() {
                return Err("transfer_stopped");
            }
            let budget = {
                let profiles = self
                    .profiles
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                profiles.get(profile).cloned()
            };
            let Some(budget) = budget else {
                return Ok(());
            };
            let mut changed = budget.changed.subscribe();
            if *changed.borrow() { continue; }
            // One payload reservation per profile. FIFO waiters from either
            // engine cannot accumulate future debt or leave it after cancellation.
            let mut permit = tokio::select! {
                biased;
                _ = cancel.cancelled() => return Err("transfer_stopped"),
                _ = changed.changed() => continue,
                permit = budget.gate.lock() => permit,
            };
            if *changed.borrow() { continue; }
            // Carry at most two milliseconds of timer overshoot. Otherwise a
            // 16KiB request and the OS timer tick would impose an accidental
            // throughput ceiling even when the configured limit is much higher.
            let deadline = (*permit).max(Instant::now() - Duration::from_millis(2))
                + Duration::from_secs_f64(bytes as f64 / budget.rate as f64);
            tokio::select! {
                biased;
                _ = cancel.cancelled() => return Err("transfer_stopped"),
                _ = changed.changed() => {},
                _ = tokio::time::sleep_until(deadline.into()) => { *permit = deadline; return Ok(()); },
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn rate_validation_keeps_existing_saved_limits_compatible() {
        assert!(valid_rate(0) && valid_rate(MIN_RATE) && valid_rate(MAX_RATE));
        assert!(!valid_rate(1) && !valid_rate(MAX_RATE + 1));
    }

    #[tokio::test]
    async fn canceled_peer_waiters_leave_no_reserved_future_debt() {
        let limiter = Arc::new(Bandwidth::default());
        limiter.set("one", 64 * 1024);
        let budget = limiter.profiles.lock().unwrap()["one"].clone();
        let held = budget.gate.lock().await;
        let cancel = CancellationToken::new();
        let mut tasks = Vec::new();
        for _ in 0..32 {
            let limiter = limiter.clone();
            let token = cancel.clone();
            tasks.push(tokio::spawn(async move { limiter.acquire("one", CHUNK_BYTES, &token).await }));
        }
        tokio::task::yield_now().await;
        cancel.cancel();
        for task in tasks {
            assert_eq!(tokio::time::timeout(Duration::from_millis(500), task).await.unwrap().unwrap(), Err("transfer_stopped"));
        }
        drop(held);
        tokio::time::timeout(Duration::from_millis(750), limiter.acquire("one", CHUNK_BYTES, &CancellationToken::new())).await.unwrap().unwrap();
    }

    #[tokio::test]
    async fn concurrent_consumers_share_rate_and_live_changes_wake_the_whole_queue() {
        let limiter = Arc::new(Bandwidth::default());
        limiter.set("one", 64 * 1024);
        let start = Instant::now();
        let mut tasks = Vec::new();
        for _ in 0..4 {
            let limiter = limiter.clone();
            tasks.push(tokio::spawn(async move { limiter.acquire("one", CHUNK_BYTES, &CancellationToken::new()).await }));
        }
        for task in tasks { task.await.unwrap().unwrap(); }
        assert!(start.elapsed() >= Duration::from_millis(950), "consumers must not each receive the whole limit");
        limiter.set("one", MIN_RATE);
        let mut tasks = Vec::new();
        for _ in 0..8 {
            let limiter = limiter.clone();
            tasks.push(tokio::spawn(async move { limiter.acquire("one", CHUNK_BYTES, &CancellationToken::new()).await }));
        }
        tokio::task::yield_now().await;
        limiter.set("one", 0);
        for task in tasks { tokio::time::timeout(Duration::from_millis(500), task).await.unwrap().unwrap().unwrap(); }
    }

    #[tokio::test]
    async fn paused_or_canceled_work_does_not_wait_for_the_rate_deadline() {
        let limiter = Arc::new(Bandwidth::default());
        limiter.set("one", MIN_RATE);
        let cancel = CancellationToken::new();
        let (worker, token) = (limiter.clone(), cancel.clone());
        let task = tokio::spawn(async move { worker.acquire("one", CHUNK_BYTES, &token).await });
        tokio::task::yield_now().await;
        cancel.cancel();
        assert_eq!(
            tokio::time::timeout(Duration::from_millis(500), task)
                .await
                .unwrap()
                .unwrap(),
            Err("transfer_stopped")
        );
    }

    #[tokio::test]
    async fn changing_to_unlimited_wakes_waiters_and_profiles_are_independent() {
        let limiter = Arc::new(Bandwidth::default());
        limiter.set("one", MIN_RATE);
        let worker = limiter.clone();
        let task = tokio::spawn(async move {
            worker
                .acquire("one", CHUNK_BYTES, &CancellationToken::new())
                .await
        });
        tokio::task::yield_now().await;
        tokio::time::timeout(
            Duration::from_millis(100),
            limiter.acquire("other", CHUNK_BYTES, &CancellationToken::new()),
        )
        .await
        .unwrap()
        .unwrap();
        limiter.set("one", 0);
        tokio::time::timeout(Duration::from_millis(500), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
    }
}
