use std::{fs, path::Path};
type Result<T> = std::result::Result<T, &'static str>;
pub(super) fn identity(path: &Path) -> Result<String> {
    let meta = fs::symlink_metadata(path).map_err(|_| "archive_read")?;
    if super::save_files::reparse(&meta) || !(meta.is_file() || meta.is_dir()) {
        return Err("archive_links");
    }
    #[cfg(windows)]
    {
        use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
        use windows::Win32::{
            Foundation::HANDLE,
            Storage::FileSystem::{
                GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS,
            },
        };
        let file = fs::OpenOptions::new()
            .read(true)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0)
            .open(path)
            .map_err(|_| "archive_read")?;
        let mut info = BY_HANDLE_FILE_INFORMATION::default();
        unsafe { GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut info) }
            .map_err(|_| "archive_read")?;
        Ok(format!(
            "w:{}:{}:{}:{}:{}",
            info.dwVolumeSerialNumber,
            info.nFileIndexHigh,
            info.nFileIndexLow,
            info.ftCreationTime.dwHighDateTime,
            info.ftCreationTime.dwLowDateTime
        ))
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let meta = fs::File::open(path)
            .and_then(|v| v.metadata())
            .map_err(|_| "archive_read")?;
        Ok(format!("u:{}:{}", meta.dev(), meta.ino()))
    }
    #[cfg(not(any(windows, unix)))]
    {
        Err("archive_platform")
    }
}
pub(super) fn recycle(path: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        let path = path.to_path_buf();
        std::thread::spawn(move || windows_recycle(&path))
            .join()
            .map_err(|_| "archive_cleanup_recycle")?
    }
    #[cfg(not(any(windows, target_os = "android", target_os = "ios")))]
    {
        trash::delete(path).map_err(|_| "archive_cleanup_recycle")
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = path;
        Err("archive_platform")
    }
}
#[cfg(windows)]
fn windows_recycle(path: &Path) -> Result<()> {
    use windows::{
        core::HSTRING,
        Win32::{
            System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
            UI::Shell::{
                BHID_Transfer, FOLDERID_RecycleBinFolder, IShellItem, ITransferSource,
                SHCreateItemFromParsingName, SHGetKnownFolderItem, KF_FLAG_DEFAULT, TSF_NORMAL,
            },
        },
    };
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|_| "archive_cleanup_recycle")?;
        let _apartment = Apartment;
        let path = path.to_str().ok_or("archive_path")?;
        let name = if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
            format!(r"\\{unc}")
        } else {
            path.strip_prefix(r"\\?\").unwrap_or(path).to_owned()
        };
        let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(name), None)
            .map_err(|_| "archive_cleanup_recycle")?;
        let parent = item.GetParent().map_err(|_| "archive_cleanup_recycle")?;
        let source: ITransferSource = parent
            .BindToHandler(None, &BHID_Transfer)
            .map_err(|_| "archive_cleanup_recycle")?;
        let bin: IShellItem =
            SHGetKnownFolderItem(&FOLDERID_RecycleBinFolder, KF_FLAG_DEFAULT, None)
                .map_err(|_| "archive_cleanup_recycle")?;
        // Explicit recycling has no permanent-delete fallback or native confirmation dialog.
        source
            .RecycleItem(&item, &bin, TSF_NORMAL.0 as u32)
            .map_err(|_| "archive_cleanup_recycle")?;
    }
    Ok(())
}
