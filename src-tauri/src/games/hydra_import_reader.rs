//! Called only in the bounded migration process, against an owned snapshot.
use super::{model::Report, Result};
use leveldb_sys::*;
use std::{ffi::CString, os::raw::c_char, path::Path, ptr};

struct Database(*mut leveldb_t);
impl Drop for Database {
    fn drop(&mut self) {
        unsafe {
            leveldb_close(self.0);
        }
    }
}
struct Options(*mut leveldb_options_t);
impl Drop for Options {
    fn drop(&mut self) {
        unsafe {
            leveldb_options_destroy(self.0);
        }
    }
}
struct ReadOptions(*mut leveldb_readoptions_t);
impl Drop for ReadOptions {
    fn drop(&mut self) {
        unsafe {
            leveldb_readoptions_destroy(self.0);
        }
    }
}
struct Iter(*mut leveldb_iterator_t);
impl Drop for Iter {
    fn drop(&mut self) {
        unsafe {
            leveldb_iter_destroy(self.0);
        }
    }
}
unsafe fn status(error: *const c_char) -> Result<()> {
    if error.is_null() {
        return Ok(());
    }
    // Native text may contain paths or record contents; only return our stable code.
    leveldb_free(error.cast_mut().cast());
    Err("hydra_database")
}
pub(super) fn read(path: &Path) -> Result<Report> {
    if !path.is_absolute()
        || !path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| uuid::Uuid::parse_str(n).is_ok())
    {
        return Err("hydra_path");
    }
    // LevelDB1.22's Windows file API uses narrow paths. All snapshot members have
    // ASCII names; setting cwd in this isolated process preserves Unicode parents.
    std::env::set_current_dir(path).map_err(|_| "hydra_read")?;
    unsafe {
        let options = Options(leveldb_options_create());
        if options.0.is_null() {
            return Err("hydra_decoder");
        }
        leveldb_options_set_create_if_missing(options.0, 0);
        leveldb_options_set_paranoid_checks(options.0, 1);
        leveldb_options_set_max_open_files(options.0, 32);
        let name = CString::new(".").unwrap();
        let mut error = ptr::null_mut();
        let pointer = leveldb_open(options.0, name.as_ptr(), &mut error);
        status(error)?;
        if pointer.is_null() {
            return Err("hydra_database");
        }
        let database = Database(pointer);
        let options = ReadOptions(leveldb_readoptions_create());
        if options.0.is_null() {
            return Err("hydra_decoder");
        }
        leveldb_readoptions_set_verify_checksums(options.0, 1);
        leveldb_readoptions_set_fill_cache(options.0, 0);
        let mut report = Report::default();
        for (prefix, limit) in [
            (b"!games!".as_slice(), 10_000usize),
            (b"!downloadSources!".as_slice(), 2048),
        ] {
            let iter = Iter(leveldb_create_iterator(database.0, options.0));
            if iter.0.is_null() {
                return Err("hydra_decoder");
            }
            leveldb_iter_seek(iter.0, prefix.as_ptr().cast(), prefix.len());
            let mut count = 0;
            while leveldb_iter_valid(iter.0) != 0 {
                let mut size = 0;
                let key = leveldb_iter_key(iter.0, &mut size);
                if key.is_null() || size > 4096 {
                    return Err("hydra_limit");
                }
                let key = std::slice::from_raw_parts(key.cast::<u8>(), size);
                if !key.starts_with(prefix) {
                    break;
                }
                count += 1;
                if count > limit {
                    return Err("hydra_limit");
                }
                let value = leveldb_iter_value(iter.0, &mut size);
                if value.is_null() || size > 256 * 1024 {
                    return Err("hydra_limit");
                }
                let value = std::slice::from_raw_parts(value.cast::<u8>(), size);
                if prefix == b"!games!" {
                    report.game(key, value);
                } else {
                    report.source(key, value);
                }
                leveldb_iter_next(iter.0);
            }
            let mut error = ptr::null();
            leveldb_iter_get_error(iter.0, &mut error);
            status(error)?; // Never return a partial success after a skipped corrupt block.
        }
        Ok(report)
    }
}
