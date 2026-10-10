use std::ffi::{c_char, c_void};

pub(super) type AudioObjectId = u32;

type OsStatus = i32;
type CfTypeRef = *const c_void;
type CfStringRef = *const c_void;
type CfIndex = isize;

const SYSTEM_OBJECT: AudioObjectId = 1;
const UTF8: u32 = 0x0800_0100;
const UID_CAPACITY: usize = 512;

const fn code(tag: &[u8; 4]) -> u32 {
    u32::from_be_bytes(*tag)
}

const DEVICES: u32 = code(b"dev#");
const SCOPE_GLOBAL: u32 = code(b"glob");
const SCOPE_INPUT: u32 = code(b"inpt");
const SCOPE_OUTPUT: u32 = code(b"outp");
const DEVICE_UID: u32 = code(b"uid ");
const NOMINAL_RATE: u32 = code(b"nsrt");
const STREAMS: u32 = code(b"stm#");
const VIRTUAL_FORMAT: u32 = code(b"sfmt");
const LINEAR_PCM: u32 = code(b"lpcm");
const FLAG_FLOAT: u32 = 1 << 0;

#[repr(C)]
#[derive(Clone, Copy)]
struct PropertyAddress {
    selector: u32,
    scope: u32,
    element: u32,
}

impl PropertyAddress {
    const fn new(selector: u32, scope: u32) -> Self {
        Self {
            selector,
            scope,
            element: 0,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct StreamDescription {
    sample_rate: f64,
    format_id: u32,
    format_flags: u32,
    bytes_per_packet: u32,
    frames_per_packet: u32,
    bytes_per_frame: u32,
    channels_per_frame: u32,
    bits_per_channel: u32,
    reserved: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
extern "C" {
    fn AudioObjectGetPropertyDataSize(
        object: AudioObjectId,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const c_void,
        size: *mut u32,
    ) -> OsStatus;

    fn AudioObjectGetPropertyData(
        object: AudioObjectId,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const c_void,
        size: *mut u32,
        data: *mut c_void,
    ) -> OsStatus;

    fn AudioObjectSetPropertyData(
        object: AudioObjectId,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const c_void,
        size: u32,
        data: *const c_void,
    ) -> OsStatus;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFStringGetCString(
        value: CfStringRef,
        buffer: *mut c_char,
        capacity: CfIndex,
        encoding: u32,
    ) -> u8;
    fn CFRelease(value: CfTypeRef);
}

fn property_size(object: AudioObjectId, address: &PropertyAddress) -> Option<u32> {
    let mut size: u32 = 0;
    let status =
        unsafe { AudioObjectGetPropertyDataSize(object, address, 0, std::ptr::null(), &mut size) };
    (status == 0).then_some(size)
}

fn scalar<T: Copy + Default>(object: AudioObjectId, address: &PropertyAddress) -> Option<T> {
    let mut value = T::default();
    let mut size = std::mem::size_of::<T>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            address,
            0,
            std::ptr::null(),
            &mut size,
            (&mut value as *mut T).cast(),
        )
    };
    (status == 0 && size as usize == std::mem::size_of::<T>()).then_some(value)
}

fn ids(object: AudioObjectId, address: &PropertyAddress) -> Vec<AudioObjectId> {
    let Some(bytes) = property_size(object, address) else {
        return Vec::new();
    };
    let count = bytes as usize / std::mem::size_of::<AudioObjectId>();
    if count == 0 {
        return Vec::new();
    }
    let mut buffer = vec![0u32; count];
    let mut size = bytes;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            address,
            0,
            std::ptr::null(),
            &mut size,
            buffer.as_mut_ptr().cast(),
        )
    };
    if status != 0 {
        return Vec::new();
    }
    buffer.truncate(size as usize / std::mem::size_of::<AudioObjectId>());
    buffer
}

fn text(object: AudioObjectId, address: &PropertyAddress) -> Option<String> {
    let mut value: CfStringRef = std::ptr::null();
    let mut size = std::mem::size_of::<CfStringRef>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            address,
            0,
            std::ptr::null(),
            &mut size,
            (&mut value as *mut CfStringRef).cast(),
        )
    };
    if status != 0 || value.is_null() {
        return None;
    }
    let mut buffer = [0 as c_char; UID_CAPACITY];
    let copied =
        unsafe { CFStringGetCString(value, buffer.as_mut_ptr(), UID_CAPACITY as CfIndex, UTF8) };
    unsafe { CFRelease(value) };
    if copied == 0 {
        return None;
    }
    let bytes: Vec<u8> = buffer
        .iter()
        .take_while(|byte| **byte != 0)
        .map(|byte| *byte as u8)
        .collect();
    String::from_utf8(bytes).ok()
}

#[derive(Debug, Clone)]
pub(super) struct LiveDevice {
    pub id: AudioObjectId,
    pub rate: u32,
    pub channels: u32,
    pub bits: u32,
    pub float: bool,
    pub linear_pcm: bool,
    pub inputs: u32,
    pub outputs: u32,
}

impl LiveDevice {
    pub(super) fn bit_perfect(&self) -> bool {
        self.linear_pcm && self.float && self.bits == 32
    }

    pub(super) fn format_label(&self) -> String {
        if !self.linear_pcm {
            return "unknown".to_string();
        }
        if self.float {
            format!("float{}", self.bits)
        } else {
            format!("int{}", self.bits)
        }
    }
}

fn stream_count(device: AudioObjectId, scope: u32) -> u32 {
    ids(device, &PropertyAddress::new(STREAMS, scope)).len() as u32
}

fn describe(device: AudioObjectId) -> StreamDescription {
    for scope in [SCOPE_INPUT, SCOPE_OUTPUT] {
        let streams = ids(device, &PropertyAddress::new(STREAMS, scope));
        for stream in streams {
            let address = PropertyAddress::new(VIRTUAL_FORMAT, SCOPE_GLOBAL);
            if let Some(found) = scalar::<StreamDescription>(stream, &address) {
                return found;
            }
        }
    }
    StreamDescription::default()
}

pub(super) fn probe(uid: &str) -> Option<LiveDevice> {
    let devices = ids(SYSTEM_OBJECT, &PropertyAddress::new(DEVICES, SCOPE_GLOBAL));
    let address = PropertyAddress::new(DEVICE_UID, SCOPE_GLOBAL);
    let device = devices
        .into_iter()
        .find(|candidate| text(*candidate, &address).as_deref() == Some(uid))?;

    let rate = scalar::<f64>(device, &PropertyAddress::new(NOMINAL_RATE, SCOPE_GLOBAL))
        .unwrap_or_default();
    let format = describe(device);
    Some(LiveDevice {
        id: device,
        rate: rate.round().max(0.0) as u32,
        channels: format.channels_per_frame,
        bits: format.bits_per_channel,
        float: format.format_flags & FLAG_FLOAT != 0,
        linear_pcm: format.format_id == LINEAR_PCM,
        inputs: stream_count(device, SCOPE_INPUT),
        outputs: stream_count(device, SCOPE_OUTPUT),
    })
}

pub(super) fn set_rate(device: AudioObjectId, rate: u32) -> Result<(), String> {
    let address = PropertyAddress::new(NOMINAL_RATE, SCOPE_GLOBAL);
    let value = f64::from(rate);
    let status = unsafe {
        AudioObjectSetPropertyData(
            device,
            &address,
            0,
            std::ptr::null(),
            std::mem::size_of::<f64>() as u32,
            (&value as *const f64).cast(),
        )
    };
    if status == 0 {
        Ok(())
    } else {
        Err(format!("CoreAudio rejected {rate} Hz (status {status})"))
    }
}
