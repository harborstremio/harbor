use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use gilrs::{Axis, Button, Event, EventType, GamepadId, Gilrs};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const EVENT_NAME: &str = "gamepad://event";
const DPAD_THRESHOLD: f32 = 0.5;

static GAMEPAD_ENABLED: AtomicBool = AtomicBool::new(true);
static WINDOW_FOCUSED: AtomicBool = AtomicBool::new(true);
static BACKGROUND_INPUT: AtomicBool = AtomicBool::new(false);
static GAMEPADS: OnceLock<Mutex<Vec<GamepadInfo>>> = OnceLock::new();

fn gamepads() -> &'static Mutex<Vec<GamepadInfo>> {
    GAMEPADS.get_or_init(|| Mutex::new(Vec::new()))
}

#[derive(Clone, Serialize)]
pub struct GamepadInfo {
    pub id: u32,
    pub name: String,
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum GamepadEventPayload {
    Connected { id: u32, name: String },
    Disconnected { id: u32 },
    Button { id: u32, button: &'static str, pressed: bool },
    Axis { id: u32, axis: &'static str, value: f32 },
}

#[derive(Default, Clone, Copy)]
struct DpadLatch {
    x: i8,
    y: i8,
}

fn numeric_id(id: GamepadId) -> u32 {
    usize::from(id) as u32
}

fn map_button(b: Button) -> Option<&'static str> {
    use Button::*;
    Some(match b {
        South => "south",
        East => "east",
        North => "north",
        West => "west",
        LeftTrigger => "lb",
        RightTrigger => "rb",
        LeftTrigger2 => "lt",
        RightTrigger2 => "rt",
        Start => "start",
        Select => "back",
        Mode => "guide",
        LeftThumb => "lstick",
        RightThumb => "rstick",
        DPadUp => "dup",
        DPadDown => "ddown",
        DPadLeft => "dleft",
        DPadRight => "dright",
        _ => return None,
    })
}

fn map_axis(a: Axis) -> Option<&'static str> {
    use Axis::*;
    Some(match a {
        LeftStickX => "lx",
        LeftStickY => "ly",
        RightStickX => "rx",
        RightStickY => "ry",
        _ => return None,
    })
}

fn frontend_axis_value(axis: &str, value: f32) -> f32 {
    // gilrs treats up as positive, while the browser Gamepad API and Harbor's
    // frontend mapping treat up as negative.
    match axis {
        "ly" | "ry" => -value,
        _ => value,
    }
}

const EV_KEY: u32 = 1;
const EV_ABS: u32 = 3;

fn evdev_button(raw: u32) -> Option<&'static str> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    map_button_code(raw)
}

fn evdev_axis(raw: u32) -> Option<&'static str> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    map_axis_code(raw)
}

fn evdev_hat(raw: u32) -> Option<u8> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    hat_axis_code(raw)
}

fn map_button_code(raw: u32) -> Option<&'static str> {
    if raw >> 16 != EV_KEY {
        return None;
    }
    Some(match raw & 0xFFFF {
        0x130 => "south",
        0x131 => "east",
        0x133 => "north",
        0x134 => "west",
        0x136 => "lb",
        0x137 => "rb",
        0x138 => "lt",
        0x139 => "rt",
        0x13a => "back",
        0x13b => "start",
        0x13c => "guide",
        0x13d => "lstick",
        0x13e => "rstick",
        0x220 => "dup",
        0x221 => "ddown",
        0x222 => "dleft",
        0x223 => "dright",
        _ => return None,
    })
}

fn map_axis_code(raw: u32) -> Option<&'static str> {
    if raw >> 16 != EV_ABS {
        return None;
    }
    Some(match raw & 0xFFFF {
        0x00 => "lx",
        0x01 => "ly",
        0x03 => "rx",
        0x04 => "ry",
        _ => return None,
    })
}

fn hat_axis_code(raw: u32) -> Option<u8> {
    if raw >> 16 != EV_ABS {
        return None;
    }
    match raw & 0xFFFF {
        0x10 => Some(0),
        0x11 => Some(1),
        _ => None,
    }
}


fn emit(app: &AppHandle, payload: GamepadEventPayload) {
    let _ = app.emit(EVENT_NAME, payload);
}

fn input_allowed() -> bool {
    if !GAMEPAD_ENABLED.load(Ordering::Relaxed) {
        return false;
    }
    BACKGROUND_INPUT.load(Ordering::Relaxed) || WINDOW_FOCUSED.load(Ordering::Relaxed)
}

fn emit_input(app: &AppHandle, payload: GamepadEventPayload) {
    if input_allowed() {
        let _ = app.emit(EVENT_NAME, payload);
    }
}

fn upsert(id: u32, name: &str) {
    let mut list = gamepads().lock().unwrap();
    if let Some(entry) = list.iter_mut().find(|g| g.id == id) {
        entry.name = name.to_string();
    } else {
        list.push(GamepadInfo { id, name: name.to_string() });
    }
}

fn remove(id: u32) {
    gamepads().lock().unwrap().retain(|g| g.id != id);
}

fn axis_direction(value: f32) -> i8 {
    if value > DPAD_THRESHOLD {
        1
    } else if value < -DPAD_THRESHOLD {
        -1
    } else {
        0
    }
}

fn dpad_x(app: &AppHandle, id: u32, value: f32, dpad: &mut HashMap<u32, DpadLatch>) {
    let latch = dpad.entry(id).or_default();
    let want = axis_direction(value);
    if want == latch.x {
        return;
    }
    match latch.x {
        1 => emit_input(app, GamepadEventPayload::Button { id, button: "dright", pressed: false }),
        -1 => emit_input(app, GamepadEventPayload::Button { id, button: "dleft", pressed: false }),
        _ => {}
    }
    match want {
        1 => emit_input(app, GamepadEventPayload::Button { id, button: "dright", pressed: true }),
        -1 => emit_input(app, GamepadEventPayload::Button { id, button: "dleft", pressed: true }),
        _ => {}
    }
    latch.x = want;
}

fn dpad_y(app: &AppHandle, id: u32, value: f32, dpad: &mut HashMap<u32, DpadLatch>) {
    let latch = dpad.entry(id).or_default();
    let want = axis_direction(value);
    if want == latch.y {
        return;
    }
    match latch.y {
        1 => emit_input(app, GamepadEventPayload::Button { id, button: "dup", pressed: false }),
        -1 => emit_input(app, GamepadEventPayload::Button { id, button: "ddown", pressed: false }),
        _ => {}
    }
    match want {
        1 => emit_input(app, GamepadEventPayload::Button { id, button: "dup", pressed: true }),
        -1 => emit_input(app, GamepadEventPayload::Button { id, button: "ddown", pressed: true }),
        _ => {}
    }
    latch.y = want;
}

fn handle_event(
    app: &AppHandle,
    gilrs: &Gilrs,
    id: GamepadId,
    event: EventType,
    dpad: &mut HashMap<u32, DpadLatch>,
) {
    let gid = numeric_id(id);
    match event {
        EventType::Connected => {
            let name = gilrs.gamepad(id).name().to_string();
            upsert(gid, &name);
            emit(app, GamepadEventPayload::Connected { id: gid, name });
        }
        EventType::Disconnected => {
            remove(gid);
            dpad.remove(&gid);
            emit(app, GamepadEventPayload::Disconnected { id: gid });
        }
        EventType::ButtonPressed(btn, code) => {
            if let Some(button) = map_button(btn).or_else(|| evdev_button(code.into_u32())) {
                emit_input(app, GamepadEventPayload::Button { id: gid, button, pressed: true });
            }
        }
        EventType::ButtonReleased(btn, code) => {
            if let Some(button) = map_button(btn).or_else(|| evdev_button(code.into_u32())) {
                emit_input(app, GamepadEventPayload::Button { id: gid, button, pressed: false });
            }
        }
        EventType::AxisChanged(axis, value, code) => match axis {
            Axis::DPadX => dpad_x(app, gid, value, dpad),
            Axis::DPadY => dpad_y(app, gid, value, dpad),
            other => {
                if let Some(axis) = map_axis(other) {
                    let value = frontend_axis_value(axis, value);
                    emit_input(app, GamepadEventPayload::Axis { id: gid, axis, value });
                    return;
                }
                let raw = code.into_u32();
                match evdev_hat(raw) {
                    Some(0) => dpad_x(app, gid, value, dpad),
                    Some(_) => dpad_y(app, gid, value, dpad),
                    None => {
                        if let Some(axis) = evdev_axis(raw) {
                            emit_input(app, GamepadEventPayload::Axis { id: gid, axis, value });
                        }
                    }
                }
            }
        },
        _ => {}
    }
}

fn seed(gilrs: &Gilrs) {
    let mut list = gamepads().lock().unwrap();
    list.clear();
    for (id, pad) in gilrs.gamepads() {
        list.push(GamepadInfo { id: numeric_id(id), name: pad.name().to_string() });
    }
}

fn run(app: AppHandle) {
    let mut gilrs = match Gilrs::new() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("[harbor::gamepad] init failed: {e}");
            return;
        }
    };
    seed(&gilrs);
    let mut dpad: HashMap<u32, DpadLatch> = HashMap::new();
    loop {
        while let Some(Event { id, event, .. }) = gilrs.next_event() {
            handle_event(&app, &gilrs, id, event, &mut dpad);
        }
        std::thread::sleep(Duration::from_millis(8));
    }
}

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || run(app));
}

#[tauri::command]
pub fn gamepad_list() -> Vec<GamepadInfo> {
    gamepads().lock().map(|g| g.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn gamepad_set_enabled(enabled: bool) {
    GAMEPAD_ENABLED.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
pub fn gamepad_set_background_input(allowed: bool) {
    BACKGROUND_INPUT.store(allowed, Ordering::SeqCst);
}

pub fn set_window_focused(focused: bool) {
    WINDOW_FOCUSED.store(focused, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::{
        frontend_axis_value, hat_axis_code, map_axis_code, map_button_code, EV_ABS, EV_KEY,
    };

    fn key(code: u32) -> u32 {
        (EV_KEY << 16) | code
    }

    fn abs(code: u32) -> u32 {
        (EV_ABS << 16) | code
    }

    #[test]
    fn maps_standard_evdev_face_and_shoulder_buttons() {
        assert_eq!(map_button_code(key(0x130)), Some("south"));
        assert_eq!(map_button_code(key(0x131)), Some("east"));
        assert_eq!(map_button_code(key(0x133)), Some("north"));
        assert_eq!(map_button_code(key(0x134)), Some("west"));
        assert_eq!(map_button_code(key(0x136)), Some("lb"));
        assert_eq!(map_button_code(key(0x137)), Some("rb"));
        assert_eq!(map_button_code(key(0x13a)), Some("back"));
        assert_eq!(map_button_code(key(0x13b)), Some("start"));
        assert_eq!(map_button_code(key(0x13c)), Some("guide"));
    }

    #[test]
    fn maps_evdev_dpad_buttons() {
        assert_eq!(map_button_code(key(0x220)), Some("dup"));
        assert_eq!(map_button_code(key(0x221)), Some("ddown"));
        assert_eq!(map_button_code(key(0x222)), Some("dleft"));
        assert_eq!(map_button_code(key(0x223)), Some("dright"));
    }

    #[test]
    fn maps_evdev_sticks_and_hats() {
        assert_eq!(map_axis_code(abs(0x00)), Some("lx"));
        assert_eq!(map_axis_code(abs(0x01)), Some("ly"));
        assert_eq!(map_axis_code(abs(0x03)), Some("rx"));
        assert_eq!(map_axis_code(abs(0x04)), Some("ry"));
        assert_eq!(hat_axis_code(abs(0x10)), Some(0));
        assert_eq!(hat_axis_code(abs(0x11)), Some(1));
    }

    #[test]
    fn normalizes_native_stick_y_to_frontend_coordinates() {
        assert_eq!(frontend_axis_value("ly", 0.75), -0.75);
        assert_eq!(frontend_axis_value("ry", -0.5), 0.5);
        assert_eq!(frontend_axis_value("lx", 0.75), 0.75);
        assert_eq!(frontend_axis_value("rx", -0.5), -0.5);
    }

    #[test]
    fn triggers_do_not_leak_into_stick_axes() {
        assert_eq!(map_axis_code(abs(0x02)), None);
        assert_eq!(map_axis_code(abs(0x05)), None);
    }

    #[test]
    fn ignores_codes_from_other_event_kinds() {
        assert_eq!(map_button_code(abs(0x130)), None);
        assert_eq!(map_axis_code(key(0x00)), None);
        assert_eq!(hat_axis_code(key(0x10)), None);
    }

    #[test]
    fn ignores_bare_xinput_style_codes() {
        for raw in 0u32..=255 {
            assert_eq!(map_button_code(raw), None, "raw {raw} must not map");
            assert_eq!(map_axis_code(raw), None, "raw {raw} must not map");
            assert_eq!(hat_axis_code(raw), None, "raw {raw} must not map");
        }
    }
}
