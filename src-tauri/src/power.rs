#[cfg(windows)]
mod win {
    use std::sync::mpsc::{channel, Sender};
    use std::sync::OnceLock;
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };

    static TX: OnceLock<Sender<bool>> = OnceLock::new();

    fn sender() -> &'static Sender<bool> {
        TX.get_or_init(|| {
            let (tx, rx) = channel::<bool>();
            std::thread::Builder::new()
                .name("harbor-power".into())
                .spawn(move || {
                    let mut held = false;
                    while let Ok(on) = rx.recv() {
                        if on == held {
                            continue;
                        }
                        let flags = if on {
                            ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
                        } else {
                            ES_CONTINUOUS
                        };
                        unsafe { SetThreadExecutionState(flags) };
                        held = on;
                    }
                    unsafe { SetThreadExecutionState(ES_CONTINUOUS) };
                })
                .ok();
            tx
        })
    }

    pub fn set(on: bool) {
        let _ = sender().send(on);
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use objc2::msg_send;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject};
    use objc2_foundation::NSString;

    const IDLE_DISPLAY_SLEEP_DISABLED: u64 = 1 << 40;
    const IDLE_SYSTEM_SLEEP_DISABLED: u64 = 1 << 20;

    pub struct Token(Retained<AnyObject>);
    unsafe impl Send for Token {}

    pub fn begin() -> Option<Token> {
        let cls = AnyClass::get(c"NSProcessInfo")?;
        unsafe {
            let info: *mut AnyObject = msg_send![cls, processInfo];
            let info = info.as_ref()?;
            let reason = NSString::from_str("Harbor playback");
            let opts: u64 = IDLE_DISPLAY_SLEEP_DISABLED | IDLE_SYSTEM_SLEEP_DISABLED;
            let token: Retained<AnyObject> =
                msg_send![info, beginActivityWithOptions: opts, reason: &*reason];
            Some(Token(token))
        }
    }

    pub fn end(token: Token) {
        let Some(cls) = AnyClass::get(c"NSProcessInfo") else {
            return;
        };
        unsafe {
            let info: *mut AnyObject = msg_send![cls, processInfo];
            let Some(info) = info.as_ref() else { return };
            let _: () = msg_send![info, endActivity: &*token.0];
        }
    }
}

#[cfg(target_os = "macos")]
static TOKEN: std::sync::Mutex<Option<mac::Token>> = std::sync::Mutex::new(None);

#[cfg(target_os = "linux")]
mod linux {
    use std::collections::HashMap;

    use zbus::zvariant::{OwnedObjectPath, Value};

    const SCREENSAVER_DESTINATION: &str = "org.freedesktop.ScreenSaver";
    const SCREENSAVER_PATH: &str = "/org/freedesktop/ScreenSaver";
    const SCREENSAVER_INTERFACE: &str = "org.freedesktop.ScreenSaver";
    const PORTAL_DESTINATION: &str = "org.freedesktop.portal.Desktop";
    const PORTAL_PATH: &str = "/org/freedesktop/portal/desktop";
    const PORTAL_INHIBIT_INTERFACE: &str = "org.freedesktop.portal.Inhibit";
    const PORTAL_REQUEST_INTERFACE: &str = "org.freedesktop.portal.Request";
    const INHIBIT_SUSPEND_AND_IDLE: u32 = 4 | 8;

    pub enum Token {
        ScreenSaver {
            connection: zbus::Connection,
            cookie: u32,
        },
        Portal {
            connection: zbus::Connection,
            handle: OwnedObjectPath,
        },
    }

    pub async fn begin() -> Option<Token> {
        let connection = zbus::Connection::session().await.ok()?;

        if let Some(token) = begin_portal(&connection).await {
            return Some(token);
        }

        begin_screensaver(&connection).await
    }

    async fn begin_screensaver(connection: &zbus::Connection) -> Option<Token> {
        let proxy = zbus::Proxy::new(
            connection,
            SCREENSAVER_DESTINATION,
            SCREENSAVER_PATH,
            SCREENSAVER_INTERFACE,
        )
        .await
        .ok()?;
        let cookie = proxy
            .call("Inhibit", &("Harbor", "Harbor playback"))
            .await
            .ok()?;

        Some(Token::ScreenSaver {
            connection: connection.clone(),
            cookie,
        })
    }

    async fn begin_portal(connection: &zbus::Connection) -> Option<Token> {
        let proxy = zbus::Proxy::new(
            connection,
            PORTAL_DESTINATION,
            PORTAL_PATH,
            PORTAL_INHIBIT_INTERFACE,
        )
        .await
        .ok()?;
        let options = HashMap::from([("reason", Value::from("Harbor playback"))]);
        let handle = proxy
            .call("Inhibit", &("", INHIBIT_SUSPEND_AND_IDLE, options))
            .await
            .ok()?;

        Some(Token::Portal {
            connection: connection.clone(),
            handle,
        })
    }

    pub async fn end(token: Token) {
        match token {
            Token::ScreenSaver { connection, cookie } => {
                if let Ok(proxy) = zbus::Proxy::new(
                    &connection,
                    SCREENSAVER_DESTINATION,
                    SCREENSAVER_PATH,
                    SCREENSAVER_INTERFACE,
                )
                .await
                {
                    let _ = proxy.call::<_, _, ()>("UnInhibit", &(cookie,)).await;
                }
            }
            Token::Portal { connection, handle } => {
                if let Ok(proxy) = zbus::Proxy::new(
                    &connection,
                    PORTAL_DESTINATION,
                    handle.as_str(),
                    PORTAL_REQUEST_INTERFACE,
                )
                .await
                {
                    let _ = proxy.call::<_, _, ()>("Close", &()).await;
                }
            }
        }
    }
}

#[cfg(target_os = "linux")]
static TOKEN: tokio::sync::Mutex<Option<linux::Token>> = tokio::sync::Mutex::const_new(None);

#[tauri::command]
pub async fn power_inhibit(on: bool) {
    #[cfg(target_os = "macos")]
    {
        let mut guard = TOKEN.lock().unwrap();
        match (on, guard.take()) {
            (true, None) => *guard = mac::begin(),
            (true, Some(t)) => *guard = Some(t),
            (false, Some(t)) => mac::end(t),
            (false, None) => {}
        }
    }
    #[cfg(target_os = "linux")]
    {
        let mut guard = TOKEN.lock().await;
        match (on, guard.take()) {
            (true, None) => *guard = linux::begin().await,
            (true, Some(t)) => *guard = Some(t),
            (false, Some(t)) => linux::end(t).await,
            (false, None) => {}
        }
    }
    #[cfg(windows)]
    {
        win::set(on);
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
    {
        let _ = on;
    }
}
