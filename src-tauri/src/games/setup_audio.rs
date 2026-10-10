//! Silence only audio sessions owned by a future managed installer's verified processes.
//! No endpoint volume, unrelated session, or current pre-existing installer is changed.
use std::collections::{HashMap, HashSet};
use windows::{
    core::Interface,
    Win32::{
        Media::Audio::{
            eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
            ISimpleAudioVolume, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
        },
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
            COINIT_MULTITHREADED,
        },
    },
};

#[derive(Default)]
pub(super) struct Sessions {
    original: HashMap<String, bool>,
}
impl Sessions {
    pub(super) fn quiet(&mut self, pids: &HashSet<u32>) {
        if pids.is_empty() {
            return;
        }
        Self::visit(|id, pid, volume| {
            if !pids.contains(&pid) || self.original.contains_key(&id) || self.original.len() >= 256
            {
                return;
            }
            let Ok(previous) = (unsafe { volume.GetMute() }) else {
                return;
            };
            if previous.as_bool() || unsafe { volume.SetMute(true, std::ptr::null()) }.is_ok() {
                self.original.insert(id, previous.as_bool());
            }
        });
    }

    pub(super) fn restore(&mut self) {
        if self.original.is_empty() {
            return;
        }
        Self::visit(|id, _, volume| {
            if let Some(previous) = self.original.get(&id) {
                // Do not override a user who unmuted this exact session during setup.
                if unsafe { volume.GetMute() }.is_ok_and(|value| value.as_bool()) {
                    let _ = unsafe { volume.SetMute(*previous, std::ptr::null()) };
                }
            }
        });
        self.original.clear();
    }

    fn visit(mut action: impl FnMut(String, u32, &ISimpleAudioVolume)) {
        let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if initialized.is_err() {
            return;
        }
        struct Apartment;
        impl Drop for Apartment {
            fn drop(&mut self) {
                unsafe {
                    CoUninitialize();
                }
            }
        }
        let _apartment = Apartment;
        let Ok(devices) = (unsafe {
            CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
        }) else {
            return;
        };
        let Ok(endpoints) = (unsafe { devices.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) })
        else {
            return;
        };
        for endpoint in 0..unsafe { endpoints.GetCount() }.unwrap_or(0).min(16) {
            let Ok(device) = (unsafe { endpoints.Item(endpoint) }) else {
                continue;
            };
            let Ok(manager) =
                (unsafe { device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) })
            else {
                continue;
            };
            let Ok(sessions) = (unsafe { manager.GetSessionEnumerator() }) else {
                continue;
            };
            for index in 0..unsafe { sessions.GetCount() }.unwrap_or(0).clamp(0, 256) {
                let Ok(session) = (unsafe { sessions.GetSession(index) }) else {
                    continue;
                };
                let Ok(control) = session.cast::<IAudioSessionControl2>() else {
                    continue;
                };
                let mut pid = 0;
                // The typed wrapper treats AUDCLNT_S_NO_SINGLE_PROCESS as success.
                // A shared session could include another app, so accept S_OK only.
                let status = unsafe {
                    (Interface::vtable(&control).GetProcessId)(
                        Interface::as_raw(&control),
                        &mut pid,
                    )
                };
                if status.0 != 0 || pid == 0 {
                    continue;
                }
                let Ok(id) = (unsafe { control.GetSessionInstanceIdentifier() }) else {
                    continue;
                };
                let value = unsafe { id.to_string() };
                unsafe {
                    CoTaskMemFree(Some(id.0 as *const _));
                }
                let Ok(value) = value else {
                    continue;
                };
                let Ok(volume) = session.cast::<ISimpleAudioVolume>() else {
                    continue;
                };
                action(value, pid, &volume);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires a Windows render endpoint; creates only a silent test-owned session"]
    fn quiets_only_selected_session_and_respects_user_unmute() {
        use windows::Win32::Media::Audio::{
            eConsole, IAudioClient, IAudioRenderClient, AUDCLNT_BUFFERFLAGS_SILENT,
            AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_NOPERSIST,
        };
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED).ok().unwrap();
            let devices: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).unwrap();
            let device = devices.GetDefaultAudioEndpoint(eRender, eConsole).unwrap();
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None).unwrap();
            let format = client.GetMixFormat().unwrap();
            let initialized = client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_NOPERSIST,
                1_000_000,
                0,
                format,
                None,
            );
            CoTaskMemFree(Some(format as _));
            initialized.unwrap();
            let frames = client.GetBufferSize().unwrap();
            let renderer: IAudioRenderClient = client.GetService().unwrap();
            renderer.GetBuffer(frames).unwrap();
            renderer
                .ReleaseBuffer(frames, AUDCLNT_BUFFERFLAGS_SILENT.0 as u32)
                .unwrap();
            let volume: ISimpleAudioVolume = client.GetService().unwrap();
            volume.SetMute(false, std::ptr::null()).unwrap();
            client.Start().unwrap();
            let mut sessions = Sessions::default();
            sessions.quiet(&HashSet::new());
            assert!(!volume.GetMute().unwrap().as_bool());
            sessions.quiet(&HashSet::from([std::process::id()]));
            assert!(volume.GetMute().unwrap().as_bool());
            sessions.restore();
            assert!(!volume.GetMute().unwrap().as_bool());
            sessions.quiet(&HashSet::from([std::process::id()]));
            assert!(volume.GetMute().unwrap().as_bool());
            volume.SetMute(false, std::ptr::null()).unwrap();
            sessions.quiet(&HashSet::from([std::process::id()]));
            assert!(!volume.GetMute().unwrap().as_bool());
            sessions.restore();
            assert!(!volume.GetMute().unwrap().as_bool());
            client.Stop().unwrap();
            drop(volume);
            drop(renderer);
            drop(client);
            drop(device);
            drop(devices);
            CoUninitialize();
        }
    }
}
