//! Steam client ABI access is confined to a short-lived, supervised Windows x64 child.
//! Interface versions and method slots are pinned; never probe newer layouts by guessing.
use super::{
    achievement_protocol::{Achievement, Client, Result, Snapshot},
    achievement_schema,
};
use std::os::windows::ffi::OsStrExt;
use std::{
    collections::HashSet,
    ffi::{c_char, c_void, CString},
    path::{Path, PathBuf},
    ptr,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
type Ptr = *mut c_void;
#[link(name = "kernel32")]
extern "system" {
    fn LoadLibraryExW(path: *const u16, file: Ptr, flags: u32) -> Ptr;
    fn GetProcAddress(module: Ptr, name: *const u8) -> Ptr;
    fn FreeLibrary(module: Ptr) -> i32;
}
type NextCallback = unsafe extern "C" fn(i32, *mut Callback, *mut i32) -> bool;
type FreeCallback = unsafe extern "C" fn(i32) -> bool;
#[repr(C)]
struct Callback {
    user: i32,
    id: i32,
    data: Ptr,
    size: i32,
}

unsafe fn method<T: Copy>(object: Ptr, slot: usize) -> T {
    let entry = *((*(object as *const *const Ptr)).add(slot));
    // A malformed/incompatible native table terminates only the supervised child.
    assert!(!entry.is_null() && std::mem::size_of::<T>() == std::mem::size_of::<Ptr>());
    std::mem::transmute_copy(&entry)
}
unsafe fn text(pointer: *const c_char, max: usize) -> Result<String> {
    if pointer.is_null() {
        return Ok(String::new());
    }
    let mut bytes = Vec::new();
    for i in 0..max {
        let b = *pointer.add(i) as u8;
        if b == 0 {
            return String::from_utf8(bytes).map_err(|_| "achievement_client_data");
        }
        bytes.push(b);
    }
    Err("achievement_client_data")
}
struct Library(Ptr);
impl Drop for Library {
    fn drop(&mut self) {
        unsafe {
            FreeLibrary(self.0);
        }
    }
}

pub struct SteamClient {
    _library: Library,
    root: PathBuf,
    app_id: u32,
    client: Ptr,
    pipe: i32,
    user: i32,
    account: Ptr,
    stats: Ptr,
    apps: Ptr,
    utils: Ptr,
    next: NextCallback,
    free: FreeCallback,
}
impl Drop for SteamClient {
    fn drop(&mut self) {
        unsafe {
            if self.user != 0 {
                let release: unsafe extern "system" fn(Ptr, i32, i32) = method(self.client, 4);
                release(self.client, self.pipe, self.user);
            }
            if self.pipe != 0 {
                let release: unsafe extern "system" fn(Ptr, i32) -> bool = method(self.client, 1);
                release(self.client, self.pipe);
            }
        }
    }
}
impl SteamClient {
    pub fn connect(root: &Path, app_id: u32) -> Result<Self> {
        if app_id == 0 {
            return Err("achievement_invalid_game");
        }
        let root = root.canonicalize().map_err(|_| "achievement_no_client")?;
        let path = root
            .join("steamclient64.dll")
            .canonicalize()
            .map_err(|_| "achievement_no_client")?;
        if !path.starts_with(&root) {
            return Err("achievement_no_client");
        }
        // The parent never sets app identity. This occurs before loading Steam in the child only.
        std::env::set_var("SteamAppId", app_id.to_string());
        std::env::set_var("SteamGameId", app_id.to_string());
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        unsafe {
            // Search dependencies in the Valve DLL directory and safe system locations, not cwd/PATH.
            let dll = LoadLibraryExW(wide.as_ptr(), ptr::null_mut(), 0x100 | 0x1000);
            if dll.is_null() {
                return Err("achievement_client_load");
            }
            let library = Library(dll);
            let create = GetProcAddress(dll, b"CreateInterface\0".as_ptr());
            let next = GetProcAddress(dll, b"Steam_BGetCallback\0".as_ptr());
            let free = GetProcAddress(dll, b"Steam_FreeLastCallback\0".as_ptr());
            if create.is_null() || next.is_null() || free.is_null() {
                return Err("achievement_client_version");
            }
            let create: unsafe extern "C" fn(*const u8, Ptr) -> Ptr = std::mem::transmute(create);
            let client = create(b"SteamClient018\0".as_ptr(), ptr::null_mut());
            if client.is_null() {
                return Err("achievement_client_version");
            }
            let mut session = Self {
                _library: library,
                root,
                app_id,
                client,
                pipe: 0,
                user: 0,
                account: ptr::null_mut(),
                stats: ptr::null_mut(),
                apps: ptr::null_mut(),
                utils: ptr::null_mut(),
                next: std::mem::transmute(next),
                free: std::mem::transmute(free),
            };
            let create_pipe: unsafe extern "system" fn(Ptr) -> i32 = method(client, 0);
            session.pipe = create_pipe(client);
            if session.pipe == 0 {
                return Err("achievement_client_offline");
            }
            let connect: unsafe extern "system" fn(Ptr, i32) -> i32 = method(client, 2);
            session.user = connect(client, session.pipe);
            if session.user == 0 {
                return Err("achievement_client_offline");
            }
            session.account = session.interface(5, b"SteamUser012\0")?;
            session.stats = session.interface(13, b"STEAMUSERSTATS_INTERFACE_VERSION013\0")?;
            session.apps = session.interface(15, b"STEAMAPPS_INTERFACE_VERSION008\0")?;
            let get_utils: unsafe extern "system" fn(Ptr, i32, *const u8) -> Ptr =
                method(client, 9);
            session.utils = get_utils(client, session.pipe, b"SteamUtils005\0".as_ptr());
            if session.utils.is_null() {
                return Err("achievement_client_version");
            }
            session.identity()?;
            Ok(session)
        }
    }
    unsafe fn interface(&self, slot: usize, version: &[u8]) -> Result<Ptr> {
        let get: unsafe extern "system" fn(Ptr, i32, i32, *const u8) -> Ptr =
            method(self.client, slot);
        let pointer = get(self.client, self.user, self.pipe, version.as_ptr());
        if pointer.is_null() {
            Err("achievement_client_version")
        } else {
            Ok(pointer)
        }
    }
    fn identity(&self) -> Result<u64> {
        unsafe {
            let logged: unsafe extern "system" fn(Ptr) -> bool = method(self.account, 1);
            if !logged(self.account) {
                return Err("achievement_client_offline");
            }
            // CSteamID is a C++ value class returned through the Windows ABI's hidden out pointer.
            let get_id: unsafe extern "system" fn(Ptr, *mut u64) -> Ptr = method(self.account, 2);
            let mut id = 0;
            get_id(self.account, &mut id);
            if id >> 56 != 1 || (id >> 52) & 15 != 1 || id as u32 == 0 {
                return Err("achievement_account_changed");
            }
            let get_app: unsafe extern "system" fn(Ptr) -> u32 = method(self.utils, 9);
            if get_app(self.utils) != self.app_id {
                return Err("achievement_invalid_game");
            }
            let owns: unsafe extern "system" fn(Ptr, u32) -> bool = method(self.apps, 6);
            if !owns(self.apps, self.app_id) {
                return Err("achievement_not_owned");
            }
            Ok(id)
        }
    }
    fn callback(&self, wanted: i32, account: u64, wait: Duration) -> Result<()> {
        let until = Instant::now() + wait;
        while Instant::now() < until {
            if self.identity()? != account {
                return Err("achievement_account_changed");
            }
            unsafe {
                let mut message = Callback {
                    user: 0,
                    id: 0,
                    data: ptr::null_mut(),
                    size: 0,
                };
                let mut call = 0;
                for _ in 0..1024 {
                    if !(self.next)(self.pipe, &mut message, &mut call) {
                        break;
                    }
                    let result = if message.id == wanted
                        && message.user == self.user
                        && !message.data.is_null()
                        && message.size >= if wanted == 1101 { 20 } else { 12 }
                        && message.size <= 64
                    {
                        let bytes = std::slice::from_raw_parts(
                            message.data as *const u8,
                            message.size as usize,
                        );
                        let game = u64::from_le_bytes(bytes[0..8].try_into().unwrap());
                        // Steam_BGetCallback uses packed fields (account at offset 12) with x64 tail padding.
                        let matches = game == self.app_id as u64
                            && (wanted != 1101
                                || u64::from_le_bytes(bytes[12..20].try_into().unwrap())
                                    == account);
                        matches.then(|| i32::from_le_bytes(bytes[8..12].try_into().unwrap()))
                    } else {
                        None
                    };
                    (self.free)(self.pipe);
                    if let Some(code) = result {
                        return if code == 1 {
                            Ok(())
                        } else {
                            Err("achievement_client_rejected")
                        };
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        Err(if wanted == 1102 {
            "achievement_apply_uncertain"
        } else {
            "achievement_stats_timeout"
        })
    }
    fn refresh(&self, id: u64) -> Result<()> {
        unsafe {
            let request: unsafe extern "system" fn(Ptr, u64) -> u64 = method(self.stats, 15);
            if request(self.stats, id) == 0 {
                return Err("achievement_stats_unavailable");
            }
            self.callback(1101, id, Duration::from_secs(10))
        }
    }
    unsafe fn attribute(&self, name: &CString, attribute: &[u8]) -> Result<String> {
        let get: unsafe extern "system" fn(Ptr, *const c_char, *const u8) -> *const c_char =
            method(self.stats, 11);
        text(get(self.stats, name.as_ptr(), attribute.as_ptr()), 8192)
    }
}
impl Client for SteamClient {
    fn snapshot(&mut self) -> Result<Snapshot> {
        let id = self.identity()?;
        self.refresh(id)?;
        // Lack of a readable permission schema never grants edit rights.
        let definitions = achievement_schema::read(&self.root, self.app_id).unwrap_or_default();
        let mut items = Vec::new();
        let mut seen = HashSet::new();
        unsafe {
            let num: unsafe extern "system" fn(Ptr) -> u32 = method(self.stats, 13);
            let name: unsafe extern "system" fn(Ptr, u32) -> *const c_char = method(self.stats, 14);
            let state: unsafe extern "system" fn(Ptr, *const c_char, *mut bool, *mut u32) -> bool =
                method(self.stats, 8);
            let count = num(self.stats);
            if count > 10_000 {
                return Err("achievement_client_data");
            }
            for index in 0..count {
                let key = text(name(self.stats, index), 257)?;
                if key.is_empty() || !seen.insert(key.clone()) {
                    return Err("achievement_client_data");
                }
                let native_key =
                    CString::new(key.as_bytes()).map_err(|_| "achievement_client_data")?;
                let mut unlocked = false;
                let mut unlocked_at = 0;
                if !state(
                    self.stats,
                    native_key.as_ptr(),
                    &mut unlocked,
                    &mut unlocked_at,
                ) {
                    return Err("achievement_stats_unavailable");
                }
                let definition = definitions.get(&key);
                items.push(Achievement {
                    id: key,
                    name: self.attribute(&native_key, b"name\0")?,
                    description: self.attribute(&native_key, b"desc\0")?,
                    hidden: self.attribute(&native_key, b"hidden\0")? == "1",
                    unlocked,
                    unlocked_at,
                    editable: definition.is_some_and(|d| d.editable),
                    icon: definition.map(|d| d.icon.clone()).unwrap_or_default(),
                    locked_icon: definition
                        .map(|d| d.locked_icon.clone())
                        .unwrap_or_default(),
                });
            }
        }
        if self.identity()? != id {
            return Err("achievement_account_changed");
        }
        Ok(Snapshot {
            app_id: self.app_id,
            steam_id: id.to_string(),
            items,
            updated_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        })
    }
    fn same_account(&self, id: &str) -> bool {
        self.identity()
            .ok()
            .is_some_and(|current| current.to_string() == id)
    }
    fn set(&mut self, id: &str, unlocked: bool) -> bool {
        unsafe {
            let Ok(key) = CString::new(id) else {
                return false;
            };
            let set: unsafe extern "system" fn(Ptr, *const c_char) -> bool =
                method(self.stats, if unlocked { 6 } else { 7 });
            set(self.stats, key.as_ptr())
        }
    }
    fn store(&mut self) -> Result<()> {
        unsafe {
            let id = self.identity()?;
            let store: unsafe extern "system" fn(Ptr) -> bool = method(self.stats, 9);
            if !store(self.stats) {
                return Err("achievement_apply_uncertain");
            }
            self.callback(1102, id, Duration::from_secs(10))
        }
    }
}
