//! Streaming read-only UDF access. Call only inside Harbor's bounded worker.
use std::{
    ffi::{c_char, c_int, c_uint, c_void, CStr, CString},
    io::{self, Read},
    marker::PhantomData,
    path::Path,
};

#[repr(C)]
struct Dirent {
    kind: c_uint,
    name: *const c_char,
}
extern "C" {
    fn udfread_init() -> *mut c_void;
    fn udfread_open(volume: *mut c_void, path: *const c_char) -> c_int;
    fn udfread_close(volume: *mut c_void);
    fn udfread_opendir(volume: *mut c_void, path: *const c_char) -> *mut c_void;
    fn udfread_opendir_at(dir: *mut c_void, path: *const c_char) -> *mut c_void;
    fn udfread_readdir(dir: *mut c_void, entry: *mut Dirent) -> *mut Dirent;
    fn udfread_closedir(dir: *mut c_void);
    fn udfread_file_openat(dir: *mut c_void, path: *const c_char) -> *mut c_void;
    fn udfread_file_read(file: *mut c_void, buffer: *mut c_void, bytes: usize) -> isize;
    fn udfread_file_size(file: *mut c_void) -> i64;
    fn udfread_file_close(file: *mut c_void);
}
fn invalid() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "invalid UDF image")
}
fn name(value: &str) -> io::Result<CString> {
    CString::new(value).map_err(|_| invalid())
}

pub struct Image(*mut c_void);
pub struct Directory<'a> {
    ptr: *mut c_void,
    image: PhantomData<&'a Image>,
}
pub struct File<'a> {
    ptr: *mut c_void,
    image: PhantomData<&'a Image>,
}
pub struct Entry {
    pub name: String,
    pub directory: bool,
}
impl Drop for Image {
    fn drop(&mut self) {
        unsafe {
            udfread_close(self.0);
        }
    }
}
impl Drop for Directory<'_> {
    fn drop(&mut self) {
        unsafe {
            udfread_closedir(self.ptr);
        }
    }
}
impl Drop for File<'_> {
    fn drop(&mut self) {
        unsafe {
            udfread_file_close(self.ptr);
        }
    }
}

impl Image {
    pub fn open(path: &Path) -> io::Result<Self> {
        let path = name(path.to_str().ok_or_else(invalid)?)?;
        let ptr = unsafe { udfread_init() };
        if ptr.is_null() {
            return Err(invalid());
        }
        let image = Self(ptr);
        if unsafe { udfread_open(image.0, path.as_ptr()) } < 0 {
            return Err(invalid());
        }
        Ok(image)
    }
    pub fn root(&self) -> io::Result<Directory<'_>> {
        let path = name("/")?;
        let ptr = unsafe { udfread_opendir(self.0, path.as_ptr()) };
        if ptr.is_null() {
            return Err(invalid());
        }
        Ok(Directory {
            ptr,
            image: PhantomData,
        })
    }
}
impl<'a> Directory<'a> {
    pub fn next_entry(&mut self) -> io::Result<Option<Entry>> {
        let mut entry = Dirent {
            kind: 0,
            name: std::ptr::null(),
        };
        // libudfread validates and caches the complete directory before opening it.
        if unsafe { udfread_readdir(self.ptr, &mut entry) }.is_null() {
            return Ok(None);
        }
        if entry.name.is_null() || ![1, 2].contains(&entry.kind) {
            return Err(invalid());
        }
        let value = unsafe { CStr::from_ptr(entry.name) }
            .to_str()
            .map_err(|_| invalid())?;
        if value.len() > 2048 {
            return Err(invalid());
        }
        Ok(Some(Entry {
            name: value.into(),
            directory: entry.kind == 1,
        }))
    }
    pub fn directory(&self, value: &str) -> io::Result<Directory<'a>> {
        let name = name(value)?;
        let ptr = unsafe { udfread_opendir_at(self.ptr, name.as_ptr()) };
        if ptr.is_null() {
            return Err(invalid());
        }
        Ok(Directory {
            ptr,
            image: PhantomData,
        })
    }
    pub fn file(&self, value: &str) -> io::Result<File<'a>> {
        let name = name(value)?;
        let ptr = unsafe { udfread_file_openat(self.ptr, name.as_ptr()) };
        if ptr.is_null() {
            return Err(invalid());
        }
        Ok(File {
            ptr,
            image: PhantomData,
        })
    }
}
impl File<'_> {
    pub fn size(&self) -> io::Result<u64> {
        u64::try_from(unsafe { udfread_file_size(self.ptr) }).map_err(|_| invalid())
    }
}
impl Read for File<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }
        let count = unsafe {
            udfread_file_read(
                self.ptr,
                buffer.as_mut_ptr().cast(),
                buffer.len().min(256 * 1024),
            )
        };
        if count < 0 || count as usize > buffer.len() {
            return Err(invalid());
        }
        Ok(count as usize)
    }
}
