use super::minecraft_instances::Result;
use std::path::Path;

pub fn recycle(path: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        let path = path.to_path_buf();
        // A dedicated apartment avoids inheriting an unrelated COM mode from the async pool.
        std::thread::spawn(move || windows_recycle(&path)).join().map_err(|_| "instance_trash")?
    }
    #[cfg(not(any(windows, target_os = "android", target_os = "ios")))]
    { trash::delete(path).map_err(|_| "instance_trash") }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    { let _ = path; Err("instance_trash") }
}

#[cfg(windows)]
fn windows_recycle(path: &Path) -> Result<()> {
    use windows::{core::HSTRING, Win32::{System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED}, UI::Shell::{SHCreateItemFromParsingName, SHGetKnownFolderItem, IShellItem, ITransferSource, BHID_Transfer, FOLDERID_RecycleBinFolder, KF_FLAG_DEFAULT, TSF_NORMAL}}};
    struct Apartment;
    impl Drop for Apartment { fn drop(&mut self) { unsafe { CoUninitialize(); } } }
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().map_err(|_| "instance_trash")?;
        let _apartment = Apartment;
        let path = path.to_str().ok_or("instance_folder")?;
        let parsing_name = if let Some(unc) = path.strip_prefix(r"\\?\UNC\") { format!(r"\\{unc}") } else { path.strip_prefix(r"\\?\").unwrap_or(path).to_owned() };
        let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(parsing_name), None).map_err(|_| "instance_trash")?;
        let parent = item.GetParent().map_err(|_| "instance_trash")?;
        let source: ITransferSource = parent.BindToHandler(None, &BHID_Transfer).map_err(|_| "instance_trash")?;
        let bin: IShellItem = SHGetKnownFolderItem(&FOLDERID_RecycleBinFolder, KF_FLAG_DEFAULT, None).map_err(|_| "instance_trash")?;
        // RecycleItem has a separate contract from RemoveItem: no permanent-delete fallback
        // and no IFileOperation "Delete Folder" confirmation if recycling is unavailable.
        let _recycled = source.RecycleItem(&item, &bin, TSF_NORMAL.0 as u32).map_err(|_| "instance_trash")?;
    }
    Ok(())
}
