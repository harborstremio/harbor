use super::super::{files, Result, TorrentFile, TorrentRecord};
use librqbit::{ManagedTorrentShared, TorrentMetadata, storage::{BoxStorageFactory, StorageFactory, StorageFactoryExt, TorrentStorage}};
use std::{fs::{self, File}, io::{Read, Seek, SeekFrom}, path::Path, sync::{Arc, Mutex}};

struct HeldFile { file: Mutex<File>, length: u64, modified: Option<std::time::SystemTime> }
enum Entry { Padding(u64), Missing, File(HeldFile) }

#[derive(Clone)]
pub struct ReadOnlyFactory { entries: Arc<Vec<Entry>> }
impl ReadOnlyFactory {
    pub fn open(record: &TorrentRecord, items: &[TorrentFile], piece_length: u32) -> Result<Self> {
        files::verify_destination(record, items)?;
        let root = files::plain_dir(Path::new(&record.destination))?;
        let selected: std::collections::HashSet<_> = record.selected.iter().copied().collect();
        // A completed selection may coexist with other files from the torrent.
        // Open files needed by its pieces, including necessary boundary bytes.
        // Piece advertisement is restricted after hashing, not by failed reads:
        // the engine treats a read failure as damage to the rest of that file.
        let piece = piece_length as u64;
        let mut offset = 0; let mut allowed: Vec<(u64,u64)> = Vec::new();
        for item in items {
            if selected.contains(&item.index) && item.bytes > 0 {
                let start=offset / piece * piece;
                let end=(offset + item.bytes).div_ceil(piece) * piece;
                if let Some(last)=allowed.last_mut().filter(|last| last.1>=start) { last.1=end; }
                else { allowed.push((start,end)); }
            }
            offset += item.bytes;
        }
        let mut offset = 0; let mut range = 0;
        let mut entries = Vec::with_capacity(items.len());
        for item in items {
            let end = offset + item.bytes;
            while range<allowed.len() && allowed[range].1<=offset { range+=1; }
            let needed=allowed.get(range).is_some_and(|(start,_)| *start<end);
            offset=end;
            if !needed && !selected.contains(&item.index) { entries.push(Entry::Missing); continue; }
            if item.padding { entries.push(Entry::Padding(item.bytes)); continue; }
            let path = root.join(&item.path);
            if !path.exists() {
                if selected.contains(&item.index) { return Err("torrent_seed_files"); }
                entries.push(Entry::Missing); continue;
            }
            files::plain_dir(path.parent().ok_or("torrent_destination")?)?;
            let before = fs::symlink_metadata(&path).map_err(|_| "torrent_seed_files")?;
            if !before.is_file() || files::linked(&before) { return Err("torrent_destination"); }
            let mut options = fs::OpenOptions::new(); options.read(true);
            #[cfg(windows)] { use std::os::windows::fs::OpenOptionsExt; options.share_mode(1); }
            let file = options.open(&path).map_err(|_| "torrent_seed_files")?;
            let held = file.metadata().map_err(|_| "torrent_seed_files")?;
            let after = fs::symlink_metadata(&path).map_err(|_| "torrent_seed_files")?;
            if !held.is_file() || files::linked(&after) || held.len() != after.len() || held.modified().ok() != after.modified().ok() {
                return Err("torrent_seed_files");
            }
            if selected.contains(&item.index) && held.len() != item.bytes { return Err("torrent_seed_files"); }
            entries.push(Entry::File(HeldFile { length: held.len(), modified: held.modified().ok(), file: Mutex::new(file) }));
        }
        Ok(Self { entries: Arc::new(entries) })
    }
}
impl StorageFactory for ReadOnlyFactory {
    type Storage = ReadOnlyStorage;
    fn create(&self, _: &ManagedTorrentShared, _: &TorrentMetadata) -> anyhow::Result<Self::Storage> {
        Ok(ReadOnlyStorage { entries: Mutex::new(Some(self.entries.clone())) })
    }
    fn clone_box(&self) -> BoxStorageFactory { self.clone().boxed() }
}
pub struct ReadOnlyStorage { entries: Mutex<Option<Arc<Vec<Entry>>>> }
impl ReadOnlyStorage {
    fn entries(&self) -> anyhow::Result<Arc<Vec<Entry>>> {
        self.entries.lock().map_err(|_| anyhow::anyhow!("torrent_seed_files"))?.clone().ok_or_else(|| anyhow::anyhow!("torrent_seed_files"))
    }
}
impl TorrentStorage for ReadOnlyStorage {
    fn restrict_have_to_selected_files(&self) -> bool { true }
    fn init(&mut self, _: &ManagedTorrentShared, _: &TorrentMetadata) -> anyhow::Result<()> { Ok(()) }
    fn pread_exact(&self, id: usize, offset: u64, buf: &mut [u8]) -> anyhow::Result<()> {
        let entries = self.entries()?;
        match entries.get(id).ok_or_else(|| anyhow::anyhow!("torrent_seed_files"))? {
            Entry::Padding(length) if offset.checked_add(buf.len() as u64).is_some_and(|end| end <= *length) => { buf.fill(0); Ok(()) }
            Entry::File(held) => {
                let mut file = held.file.lock().map_err(|_| anyhow::anyhow!("torrent_seed_files"))?;
                let current = file.metadata()?;
                anyhow::ensure!(current.len() == held.length && current.modified().ok() == held.modified, "torrent_seed_files");
                anyhow::ensure!(offset.checked_add(buf.len() as u64).is_some_and(|end| end <= held.length), "torrent_seed_files");
                file.seek(SeekFrom::Start(offset))?; file.read_exact(buf)?; Ok(())
            }
            _ => anyhow::bail!("torrent_seed_files"),
        }
    }
    fn pwrite_all(&self, _: usize, _: u64, _: &[u8]) -> anyhow::Result<()> { anyhow::bail!("torrent_seed_files") }
    fn remove_file(&self, _: usize, _: &Path) -> anyhow::Result<()> { anyhow::bail!("torrent_seed_files") }
    fn remove_directory_if_empty(&self, _: &Path) -> anyhow::Result<()> { anyhow::bail!("torrent_seed_files") }
    fn ensure_file_length(&self, id: usize, length: u64) -> anyhow::Result<()> {
        let entries = self.entries()?;
        match entries.get(id) {
            Some(Entry::File(file)) if file.length == length => Ok(()),
            Some(Entry::Padding(size)) if *size == length => Ok(()),
            _ => anyhow::bail!("torrent_seed_files"),
        }
    }
    fn take(&self) -> anyhow::Result<Box<dyn TorrentStorage>> {
        let entries = self.entries.lock().map_err(|_| anyhow::anyhow!("torrent_seed_files"))?.take();
        anyhow::ensure!(entries.is_some(), "torrent_seed_files");
        Ok(Box::new(Self { entries: Mutex::new(entries) }))
    }
}
