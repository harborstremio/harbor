#![cfg(target_os = "macos")]

// Native CoreAudio output-device enumeration. Mirrors mpv's
// `ca_get_device_list()` (audio/out/ao_coreaudio_utils.c) so the names
// produced here (`coreaudio/<DeviceUID>`) are accepted verbatim by mpv's
// `audio-device` property.
//
// `audio-device-list` is deliberately not read on macOS: reading it makes
// libmpv register `hotplug_cb` against `kAudioObjectSystemObject` with a
// `struct ao *` as the listener context. CoreAudio delivers notifications on
// its own queue, `AudioObjectRemovePropertyListener` does not drain queued
// callbacks, and the delivered callback dereferences `ao->log` with no
// validity check — a use-after-free once the ao is released
// (mpv-player/mpv#18274). Talking to the HAL directly registers no listener,
// so that race cannot exist here.

use std::ffi::c_void;

use core_foundation::base::TCFType;
use core_foundation::string::{CFString, CFStringRef};

use crate::mpv::AudioDevice;

const K_AUDIO_OBJECT_SYSTEM_OBJECT: u32 = 1;
const K_AUDIO_OBJECT_PROPERTY_ELEMENT_MAIN: u32 = 0;

const K_AUDIO_HARDWARE_PROPERTY_DEVICES: u32 = u32::from_be_bytes(*b"dev#");
const K_AUDIO_DEVICE_PROPERTY_DEVICE_UID: u32 = u32::from_be_bytes(*b"uid ");
const K_AUDIO_OBJECT_PROPERTY_NAME: u32 = u32::from_be_bytes(*b"lnam");
const K_AUDIO_DEVICE_PROPERTY_STREAM_CONFIGURATION: u32 = u32::from_be_bytes(*b"slay");

const K_AUDIO_OBJECT_PROPERTY_SCOPE_GLOBAL: u32 = u32::from_be_bytes(*b"glob");
const K_AUDIO_OBJECT_PROPERTY_SCOPE_OUTPUT: u32 = u32::from_be_bytes(*b"outp");

type AudioObjectID = u32;
type OSStatus = i32;

#[repr(C)]
struct AudioObjectPropertyAddress {
    selector: u32,
    scope: u32,
    element: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
extern "C" {
    fn AudioObjectGetPropertyDataSize(
        object_id: AudioObjectID,
        address: *const AudioObjectPropertyAddress,
        qualifier_data_size: u32,
        qualifier_data: *const c_void,
        out_data_size: *mut u32,
    ) -> OSStatus;

    fn AudioObjectGetPropertyData(
        object_id: AudioObjectID,
        address: *const AudioObjectPropertyAddress,
        qualifier_data_size: u32,
        qualifier_data: *const c_void,
        io_data_size: *mut u32,
        out_data: *mut c_void,
    ) -> OSStatus;
}

fn addr(selector: u32, scope: u32) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        selector,
        scope,
        element: K_AUDIO_OBJECT_PROPERTY_ELEMENT_MAIN,
    }
}

fn data_size(object: AudioObjectID, addr: &AudioObjectPropertyAddress) -> Result<u32, OSStatus> {
    let mut size = 0u32;
    let status = unsafe {
        AudioObjectGetPropertyDataSize(object, addr, 0, std::ptr::null(), &mut size)
    };
    if status == 0 {
        Ok(size)
    } else {
        Err(status)
    }
}

unsafe fn get_data(
    object: AudioObjectID,
    addr: &AudioObjectPropertyAddress,
    buf: *mut c_void,
    size: u32,
) -> Result<(), OSStatus> {
    let mut size = size;
    let status = AudioObjectGetPropertyData(object, addr, 0, std::ptr::null(), &mut size, buf);
    if status == 0 {
        Ok(())
    } else {
        Err(status)
    }
}

// CFString properties come back +1 (mpv's ca_get_str does CFRelease), hence
// wrap_under_create_rule.
fn cf_string(object: AudioObjectID, addr: &AudioObjectPropertyAddress) -> Option<CFString> {
    let mut raw: CFStringRef = std::ptr::null();
    unsafe {
        get_data(
            object,
            addr,
            &mut raw as *mut CFStringRef as *mut c_void,
            std::mem::size_of::<CFStringRef>() as u32,
        )
    }
    .ok()?;
    if raw.is_null() {
        return None;
    }
    Some(unsafe { CFString::wrap_under_create_rule(raw) })
}

// Same predicate as mpv's ca_is_output_device: the output-scope stream
// configuration is an AudioBufferList whose first field is mNumberBuffers.
fn is_output_device(dev: AudioObjectID) -> bool {
    let a = addr(
        K_AUDIO_DEVICE_PROPERTY_STREAM_CONFIGURATION,
        K_AUDIO_OBJECT_PROPERTY_SCOPE_OUTPUT,
    );
    let Ok(size) = data_size(dev, &a) else {
        return false;
    };
    if (size as usize) < std::mem::size_of::<u32>() {
        return false;
    }
    let mut buf = vec![0u8; size as usize];
    if unsafe { get_data(dev, &a, buf.as_mut_ptr() as *mut c_void, size) }.is_err() {
        return false;
    }
    u32::from_ne_bytes(buf[..4].try_into().unwrap()) > 0
}

pub fn audio_output_devices() -> Result<Vec<AudioDevice>, String> {
    let a = addr(
        K_AUDIO_HARDWARE_PROPERTY_DEVICES,
        K_AUDIO_OBJECT_PROPERTY_SCOPE_GLOBAL,
    );
    let size = data_size(K_AUDIO_OBJECT_SYSTEM_OBJECT, &a)
        .map_err(|e| format!("AudioObjectGetPropertyDataSize(devices): OSStatus {}", e))?;
    let mut ids = vec![0u32; size as usize / std::mem::size_of::<AudioObjectID>()];
    unsafe {
        get_data(
            K_AUDIO_OBJECT_SYSTEM_OBJECT,
            &a,
            ids.as_mut_ptr() as *mut c_void,
            size,
        )
    }
    .map_err(|e| format!("AudioObjectGetPropertyData(devices): OSStatus {}", e))?;

    let global = K_AUDIO_OBJECT_PROPERTY_SCOPE_GLOBAL;
    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        if !is_output_device(id) {
            continue;
        }
        let Some(uid) = cf_string(id, &addr(K_AUDIO_DEVICE_PROPERTY_DEVICE_UID, global)) else {
            continue;
        };
        let description = cf_string(id, &addr(K_AUDIO_OBJECT_PROPERTY_NAME, global))
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown".into());
        out.push(AudioDevice {
            name: format!("coreaudio/{}", uid),
            description,
        });
    }
    Ok(out)
}
