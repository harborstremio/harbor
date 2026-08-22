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

    static SMTC: OnceLock<Option<SystemMediaTransportControls>> = OnceLock::new();

    fn controls() -> Option<&'static SystemMediaTransportControls> {
        SMTC.get().and_then(|controls| controls.as_ref())
    }

    pub fn init(app: &AppHandle) {
        let created = SMTC.get_or_init(|| match build(app) {
            Ok(controls) => Some(controls),
            Err(error) => {
                eprintln!("[harbor::media] SMTC init failed: {error:?}");
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
        let controls: SystemMediaTransportControls = unsafe { interop.GetForWindow(hwnd)? };
        controls.SetIsPlayEnabled(true)?;
        controls.SetIsPauseEnabled(true)?;
        controls.SetIsNextEnabled(true)?;
        controls.SetIsPreviousEnabled(true)?;
        controls.SetIsStopEnabled(true)?;
        controls.SetIsEnabled(false)?;

        let handle = app.clone();
        controls.ButtonPressed(&TypedEventHandler::new(
            move |_,
                  args: windows::core::Ref<
                '_,
                SystemMediaTransportControlsButtonPressedEventArgs,
            >| {
                if let Some(args) = args.as_ref() {
                    let action = match args.Button()? {
                        SystemMediaTransportControlsButton::Play => "play",
                        SystemMediaTransportControlsButton::Pause => "pause",
                        SystemMediaTransportControlsButton::Next => "next",
                        SystemMediaTransportControlsButton::Previous => "previous",
                        SystemMediaTransportControlsButton::Stop => "stop",
                        _ => return Ok(()),
                    };
                    let _ = handle.emit("harbor://media-key", action);
                }
                Ok(())
            },
        ))?;
        Ok(controls)
    }

    pub fn update(playing: bool, title: &str, subtitle: &str) {
        let Some(controls) = controls() else {
            return;
        };
        let _ = controls.SetIsEnabled(true);
        let _ = controls.SetPlaybackStatus(if playing {
            MediaPlaybackStatus::Playing
        } else {
            MediaPlaybackStatus::Paused
        });
        if let Ok(updater) = controls.DisplayUpdater() {
            let _ = updater.SetType(MediaPlaybackType::Video);
            if let Ok(video) = updater.VideoProperties() {
                let _ = video.SetTitle(&HSTRING::from(title));
                let _ = video.SetSubtitle(&HSTRING::from(subtitle));
            }
            let _ = updater.Update();
        }
    }

    pub fn clear() {
        let Some(controls) = controls() else {
            return;
        };
        let _ = controls.SetPlaybackStatus(MediaPlaybackStatus::Closed);
        if let Ok(updater) = controls.DisplayUpdater() {
            let _ = updater.ClearAll();
            let _ = updater.Update();
        }
        let _ = controls.SetIsEnabled(false);
    }
}

pub fn ensure_started_on_setup(app: &tauri::AppHandle) {
    #[cfg(windows)]
    win::init(app);
    #[cfg(not(windows))]
    let _ = app;
}

#[tauri::command]
pub fn media_controls_update(playing: bool, title: String, subtitle: String) {
    #[cfg(windows)]
    win::update(playing, &title, &subtitle);
    #[cfg(not(windows))]
    let _ = (playing, title, subtitle);
}

#[tauri::command]
pub fn media_controls_clear() {
    #[cfg(windows)]
    win::clear();
}
