use std::path::{Path, PathBuf};

pub const VERSION: &str = "4.2.3";

pub fn core(system: u32) -> Option<&'static str> {
    match system {
        24 => Some("mgba"),
        33 | 22 => Some("gambatte"),
        18 => Some("fceumm"),
        19 => Some("snes9x"),
        29 | 64 | 35 => Some("genesis_plus_gx"),
        4 => Some("mupen64plus_next"),
        _ => None,
    }
}

pub fn directory(saves: &Path, profile_hash: &str, rom_hash: &str, core: &str) -> PathBuf {
    saves
        .join(profile_hash)
        .join(rom_hash)
        .join(format!("{core}-{VERSION}"))
}
