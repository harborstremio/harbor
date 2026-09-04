#[cfg(windows)]
mod win {
    use std::sync::OnceLock;
    use tauri::{AppHandle, Emitter, Manager};
    use windows::core::HSTRING;
    use windows::Foundation::TypedEventHandler;
    use windows::Media::{
        MediaPlaybackStatus, MediaPlaybackType, SystemMediaTransportControls,
        SystemMediaTransportControlsButton, SystemMediaTransportControlsButtonPressedEventArgs,
    };
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::ISystemMediaTransportControlsInterop;

    struct Holder(SystemMediaTransportControls);
    unsafe impl Send for Holder {}
    unsafe impl Sync for Holder {}

    static SMTC: OnceLock<Option<Holder>> = OnceLock::new();

    fn controls() -> Option<&'static SystemMediaTransportControls> {
        SMTC.get().and_then(|h| h.as_ref()).map(|h| &h.0)
    }

    pub fn init(app: &AppHandle) {
        let created = SMTC.get_or_init(|| match build(app) {
            Ok(smtc) => Some(Holder(smtc)),
            Err(e) => {
                eprintln!("[harbor::media] SMTC init failed: {e:?}");
                None
            }
        });
        if created.is_some() {
            eprintln!("[harbor::media] SMTC session registered");
        }
    }

    fn build(app: &AppHandle) -> windows::core::Result<SystemMediaTransportControls> {
        let window = app
            .get_webview_window("main")
            .ok_or_else(windows::core::Error::empty)?;
        let raw = window.hwnd().map_err(|_| windows::core::Error::empty())?;
        let hwnd = HWND(raw.0 as *mut _);
        let interop = windows::core::factory::<
            SystemMediaTransportControls,
            ISystemMediaTransportControlsInterop,
        >()?;
        let smtc: SystemMediaTransportControls = unsafe { interop.GetForWindow(hwnd)? };
        smtc.SetIsPlayEnabled(true)?;
        smtc.SetIsPauseEnabled(true)?;
        smtc.SetIsNextEnabled(true)?;
        smtc.SetIsPreviousEnabled(true)?;
        smtc.SetIsStopEnabled(true)?;
        smtc.SetIsEnabled(false)?;
        let handle = app.clone();
        smtc.ButtonPressed(&TypedEventHandler::new(
            move |_,
                  args: windows::core::Ref<
                '_,
                SystemMediaTransportControlsButtonPressedEventArgs,
            >| {
                if let Some(a) = args.as_ref() {
                    let name = match a.Button()? {
                        SystemMediaTransportControlsButton::Play => "play",
                        SystemMediaTransportControlsButton::Pause => "pause",
                        SystemMediaTransportControlsButton::Next => "next",
                        SystemMediaTransportControlsButton::Previous => "previous",
                        SystemMediaTransportControlsButton::Stop => "stop",
                        _ => return Ok(()),
                    };
                    let _ = handle.emit("harbor://media-key", name);
                }
                Ok(())
            },
        ))?;
        Ok(smtc)
    }

    pub fn update(playing: bool, title: &str, subtitle: &str) {
        let Some(smtc) = controls() else { return };
        let _ = smtc.SetIsEnabled(true);
        let _ = smtc.SetPlaybackStatus(if playing {
            MediaPlaybackStatus::Playing
        } else {
            MediaPlaybackStatus::Paused
        });
        if let Ok(du) = smtc.DisplayUpdater() {
            let _ = du.SetType(MediaPlaybackType::Video);
            if let Ok(vp) = du.VideoProperties() {
                let _ = vp.SetTitle(&HSTRING::from(title));
                let _ = vp.SetSubtitle(&HSTRING::from(subtitle));
            }
            let _ = du.Update();
        }
    }

    pub fn clear() {
        let Some(smtc) = controls() else { return };
        let _ = smtc.SetPlaybackStatus(MediaPlaybackStatus::Closed);
        if let Ok(du) = smtc.DisplayUpdater() {
            let _ = du.ClearAll();
            let _ = du.Update();
        }
        let _ = smtc.SetIsEnabled(false);
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use std::collections::HashMap;
    use std::sync::{Arc, OnceLock};
    use tauri::{AppHandle, Emitter, Manager};
    use tokio::sync::Mutex;
    use zbus::zvariant::{ObjectPath, Value};
    use zbus::{interface, connection::Connection};

    #[derive(Clone)]
    pub struct PlaybackState {
        pub playing: bool,
        pub title: String,
        pub subtitle: String,
        pub art_url: Option<String>,
        pub duration_us: i64,
        pub position_us: i64,
        pub updated_at: std::time::Instant,
    }

    impl Default for PlaybackState {
        fn default() -> Self {
            Self {
                playing: false,
                title: String::new(),
                subtitle: String::new(),
                art_url: None,
                duration_us: 0,
                position_us: 0,
                updated_at: std::time::Instant::now(),
            }
        }
    }

    pub struct MprisHandle {
        connection: Connection,
        state: Arc<Mutex<PlaybackState>>,
    }

    static MPRIS: OnceLock<Option<MprisHandle>> = OnceLock::new();

    struct MprisRoot {
        app: AppHandle,
    }

    #[interface(name = "org.mpris.MediaPlayer2")]
    impl MprisRoot {
        async fn raise(&self) {
            if let Some(window) = self.app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }

        async fn quit(&self) {
            self.app.exit(0);
        }

        #[zbus(property)]
        fn can_quit(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn can_raise(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn has_track_list(&self) -> bool {
            false
        }

        #[zbus(property)]
        fn identity(&self) -> &str {
            "Harbor"
        }

        #[zbus(property)]
        fn desktop_entry(&self) -> &str {
            "site.harbor.Harbor"
        }

        #[zbus(property)]
        fn supported_uri_schemes(&self) -> Vec<&str> {
            vec!["http", "https", "file"]
        }

        #[zbus(property)]
        fn supported_mime_types(&self) -> Vec<&str> {
            vec!["video/*", "audio/*"]
        }
    }

    struct MprisPlayer {
        app: AppHandle,
        state: Arc<Mutex<PlaybackState>>,
    }

    #[interface(name = "org.mpris.MediaPlayer2.Player")]
    impl MprisPlayer {
        async fn next(&self) {
            let _ = self.app.emit("harbor://media-key", "next");
        }

        async fn previous(&self) {
            let _ = self.app.emit("harbor://media-key", "previous");
        }

        async fn pause(&self) {
            let _ = self.app.emit("harbor://media-key", "pause");
        }

        async fn play_pause(&self) {
            let _ = self.app.emit("harbor://media-key", "playpause");
        }

        async fn stop(&self) {
            let _ = self.app.emit("harbor://media-key", "stop");
        }

        async fn play(&self) {
            let _ = self.app.emit("harbor://media-key", "play");
        }

        async fn seek(&self, offset_us: i64) {
            let offset_sec = offset_us as f64 / 1_000_000.0;
            let _ = self.app.emit("harbor://media-seek-relative", offset_sec);
            let mut s = self.state.lock().await;
            let current = if s.playing {
                s.position_us + s.updated_at.elapsed().as_micros() as i64
            } else {
                s.position_us
            };
            let new_pos = (current + offset_us).max(0);
            let new_pos = if s.duration_us > 0 { new_pos.min(s.duration_us) } else { new_pos };
            s.position_us = new_pos;
            s.updated_at = std::time::Instant::now();
        }

        async fn set_position(&self, _track_id: ObjectPath<'_>, position_us: i64) {
            let pos_sec = position_us as f64 / 1_000_000.0;
            let _ = self.app.emit("harbor://media-seek-absolute", pos_sec);
            let mut s = self.state.lock().await;
            s.position_us = position_us.max(0);
            s.updated_at = std::time::Instant::now();
        }

        #[zbus(signal)]
        async fn seeked(emitter: &zbus::object_server::SignalEmitter<'_>, position_us: i64) -> zbus::Result<()>;

        #[zbus(property)]
        async fn playback_status(&self) -> String {
            let s = self.state.lock().await;
            if s.title.is_empty() {
                "Stopped".to_string()
            } else if s.playing {
                "Playing".to_string()
            } else {
                "Paused".to_string()
            }
        }

        #[zbus(property)]
        fn loop_status(&self) -> &str {
            "None"
        }

        #[zbus(property)]
        fn set_loop_status(&self, _status: &str) -> zbus::Result<()> {
            Ok(())
        }

        #[zbus(property)]
        fn rate(&self) -> f64 {
            1.0
        }

        #[zbus(property)]
        fn set_rate(&self, _rate: f64) -> zbus::Result<()> {
            Ok(())
        }

        #[zbus(property)]
        fn shuffle(&self) -> bool {
            false
        }

        #[zbus(property)]
        fn set_shuffle(&self, _shuffle: bool) -> zbus::Result<()> {
            Ok(())
        }

        #[zbus(property)]
        fn volume(&self) -> f64 {
            1.0
        }

        #[zbus(property)]
        fn set_volume(&self, _vol: f64) -> zbus::Result<()> {
            Ok(())
        }

        #[zbus(property)]
        async fn position(&self) -> i64 {
            let s = self.state.lock().await;
            if s.playing {
                let elapsed = s.updated_at.elapsed().as_micros() as i64;
                let cur = s.position_us + elapsed;
                if s.duration_us > 0 {
                    cur.min(s.duration_us)
                } else {
                    cur
                }
            } else {
                s.position_us
            }
        }

        #[zbus(property)]
        fn minimum_rate(&self) -> f64 {
            1.0
        }

        #[zbus(property)]
        fn maximum_rate(&self) -> f64 {
            1.0
        }

        #[zbus(property)]
        fn can_control(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn can_play(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn can_pause(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn can_seek(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn can_go_next(&self) -> bool {
            true
        }

        #[zbus(property)]
        fn can_go_previous(&self) -> bool {
            true
        }

        #[zbus(property)]
        async fn metadata(&self) -> HashMap<String, Value<'static>> {
            let s = self.state.lock().await;
            let mut meta = HashMap::new();
            let track_id = ObjectPath::try_from("/org/mpris/MediaPlayer2/track/0")
                .unwrap_or_else(|_| ObjectPath::from_static_str_unchecked("/org/mpris/MediaPlayer2/TrackList/NoTrack"));
            meta.insert("mpris:trackid".to_string(), Value::from(track_id));

            if !s.title.is_empty() {
                meta.insert("xesam:title".to_string(), Value::from(s.title.clone()));
            }
            if !s.subtitle.is_empty() {
                meta.insert("xesam:album".to_string(), Value::from(s.subtitle.clone()));
            }
            if let Some(art) = &s.art_url {
                if !art.is_empty() {
                    meta.insert("mpris:artUrl".to_string(), Value::from(art.clone()));
                }
            }
            if s.duration_us > 0 {
                meta.insert("mpris:length".to_string(), Value::from(s.duration_us));
            }
            meta
        }
    }

    pub fn init(app: &AppHandle) {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let state = Arc::new(Mutex::new(PlaybackState::default()));
            let root = MprisRoot {
                app: app_handle.clone(),
            };
            let player = MprisPlayer {
                app: app_handle.clone(),
                state: state.clone(),
            };

            let primary_name = "org.mpris.MediaPlayer2.harbor";
            let fallback_name = format!("org.mpris.MediaPlayer2.harbor.instance{}", std::process::id());

            let build_result = match zbus::connection::Builder::session() {
                Ok(builder) => builder
                    .name(primary_name)
                    .and_then(|b| b.serve_at("/org/mpris/MediaPlayer2", root))
                    .and_then(|b| b.serve_at("/org/mpris/MediaPlayer2", player)),
                Err(e) => {
                    eprintln!("[harbor::mpris] Session bus unavailable: {e:?}");
                    return;
                }
            };

            let conn = match build_result {
                Ok(builder) => match builder.build().await {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("[harbor::mpris] Primary bus name '{primary_name}' failed ({e:?}), retrying with '{fallback_name}'");
                        // If primary name failed, retry with fallback instance name
                        let root = MprisRoot {
                            app: app_handle.clone(),
                        };
                        let player = MprisPlayer {
                            app: app_handle.clone(),
                            state: state.clone(),
                        };
                        match zbus::connection::Builder::session()
                            .and_then(|b| b.name(fallback_name.as_str()))
                            .and_then(|b| b.serve_at("/org/mpris/MediaPlayer2", root))
                            .and_then(|b| b.serve_at("/org/mpris/MediaPlayer2", player))
                        {
                            Ok(builder) => match builder.build().await {
                                Ok(c) => c,
                                Err(e) => {
                                    eprintln!("[harbor::mpris] Fallback bus name also failed: {e:?}");
                                    return;
                                }
                            },
                            Err(e) => {
                                eprintln!("[harbor::mpris] Fallback builder error: {e:?}");
                                return;
                            }
                        }
                    }
                },
                Err(e) => {
                    eprintln!("[harbor::mpris] Failed to configure MPRIS server: {e:?}");
                    return;
                }
            };

            let _ = MPRIS.set(Some(MprisHandle {
                connection: conn,
                state,
            }));
            eprintln!("[harbor::mpris] Registered D-Bus interface org.mpris.MediaPlayer2");
        });
    }

    pub fn update(
        playing: bool,
        title: &str,
        subtitle: &str,
        art_url: Option<&str>,
        duration_sec: Option<f64>,
        position_sec: Option<f64>,
    ) {
        let Some(Some(handle)) = MPRIS.get() else { return };
        let state = handle.state.clone();
        let conn = handle.connection.clone();
        let title = title.to_string();
        let subtitle = subtitle.to_string();
        let art_url = art_url.map(|s| s.to_string());
        let duration_us = duration_sec
            .filter(|d| d.is_finite() && *d > 0.0)
            .map(|d| (d * 1_000_000.0) as i64)
            .unwrap_or(0);
        let position_us = position_sec
            .filter(|p| p.is_finite() && *p >= 0.0)
            .map(|p| (p * 1_000_000.0) as i64)
            .unwrap_or(0);

        tauri::async_runtime::spawn(async move {
            {
                let mut s = state.lock().await;
                s.playing = playing;
                s.title = title;
                s.subtitle = subtitle;
                s.art_url = art_url;
                s.duration_us = duration_us;
                s.position_us = position_us;
                s.updated_at = std::time::Instant::now();
            }

            if let Ok(iface) = conn.object_server().interface::<_, MprisPlayer>("/org/mpris/MediaPlayer2").await {
                let player = iface.get().await;
                let _ = MprisPlayer::playback_status_changed(&*player, iface.signal_emitter()).await;
                let _ = MprisPlayer::metadata_changed(&*player, iface.signal_emitter()).await;
            }
        });
    }

    pub fn clear() {
        let Some(Some(handle)) = MPRIS.get() else { return };
        let state = handle.state.clone();
        let conn = handle.connection.clone();

        tauri::async_runtime::spawn(async move {
            {
                let mut s = state.lock().await;
                s.playing = false;
                s.title.clear();
                s.subtitle.clear();
                s.art_url = None;
                s.duration_us = 0;
                s.position_us = 0;
                s.updated_at = std::time::Instant::now();
            }

            if let Ok(iface) = conn.object_server().interface::<_, MprisPlayer>("/org/mpris/MediaPlayer2").await {
                let player = iface.get().await;
                let _ = MprisPlayer::playback_status_changed(&*player, iface.signal_emitter()).await;
                let _ = MprisPlayer::metadata_changed(&*player, iface.signal_emitter()).await;
            }
        });
    }
}

pub fn ensure_started_on_setup(app: &tauri::AppHandle) {
    #[cfg(windows)]
    win::init(app);
    #[cfg(target_os = "linux")]
    linux::init(app);
    #[cfg(not(any(windows, target_os = "linux")))]
    let _ = app;
}

#[tauri::command]
pub fn media_controls_update(
    playing: bool,
    title: String,
    subtitle: String,
    art_url: Option<String>,
    duration_sec: Option<f64>,
    position_sec: Option<f64>,
) {
    #[cfg(windows)]
    win::update(playing, &title, &subtitle);
    #[cfg(target_os = "linux")]
    linux::update(
        playing,
        &title,
        &subtitle,
        art_url.as_deref(),
        duration_sec,
        position_sec,
    );
    #[cfg(not(any(windows, target_os = "linux")))]
    let _ = (playing, title, subtitle, art_url, duration_sec, position_sec);
}

#[tauri::command]
pub fn media_controls_clear() {
    #[cfg(windows)]
    win::clear();
    #[cfg(target_os = "linux")]
    linux::clear();
}
