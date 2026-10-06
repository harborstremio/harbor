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
        let Some(cls) = AnyClass::get(c"NSProcessInfo") else { return };
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
            .call("Inhibit", &("JL Media Vision", "JL Media Vision playback"))
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
            (true, Some(token)) => *guard = Some(token),
            (false, Some(token)) => linux::end(token).await,
            (false, None) => {}
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = on;
    }
}
