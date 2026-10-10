use super::{write_metrics::WriteCounter, p2p_space::TorrentSpace};
use librqbit::{ManagedTorrentShared, TorrentMetadata, storage::{
    filesystem::FilesystemStorageFactory, BoxStorageFactory, StorageFactory, StorageFactoryExt, TorrentStorage,
}};
use std::{path::Path, sync::Arc};

#[derive(Clone)]
pub struct MeasuredStorageFactory { pub written: WriteCounter, pub space: Arc<TorrentSpace> }
impl StorageFactory for MeasuredStorageFactory {
    type Storage = MeasuredStorage;
    fn create(&self, shared: &ManagedTorrentShared, metadata: &TorrentMetadata) -> anyhow::Result<Self::Storage> {
        self.space.check().map_err(anyhow::Error::msg)?;
        Ok(MeasuredStorage { inner: Box::new(FilesystemStorageFactory::default().create(shared, metadata)?), written: self.written.clone(), space: Some(self.space.clone()) })
    }
    fn clone_box(&self) -> BoxStorageFactory { self.clone().boxed() }
}

pub struct MeasuredStorage { inner: Box<dyn TorrentStorage>, written: WriteCounter, space: Option<Arc<TorrentSpace>> }
impl TorrentStorage for MeasuredStorage {
    fn init(&mut self, shared: &ManagedTorrentShared, metadata: &TorrentMetadata) -> anyhow::Result<()> {
        if let Some(space) = &self.space { space.check().map_err(anyhow::Error::msg)?; }
        self.inner.init(shared, metadata)
    }
    fn pread_exact(&self, file_id: usize, offset: u64, buf: &mut [u8]) -> anyhow::Result<()> { self.inner.pread_exact(file_id, offset, buf) }
    fn pwrite_all(&self, file_id: usize, offset: u64, buf: &[u8]) -> anyhow::Result<()> {
        // At an exact file boundary the engine emits an empty write to the
        // previous, possibly unselected file before advancing to the next one.
        if buf.is_empty() { return Ok(()); }
        if let Some(space) = &self.space {
            let end = offset.checked_add(buf.len() as u64).ok_or_else(|| anyhow::anyhow!("torrent_destination"))?;
            space.operation(file_id, end, buf.len() as u64, false, || self.inner.pwrite_all(file_id, offset, buf))?;
        } else { self.inner.pwrite_all(file_id, offset, buf)?; }
        self.written.add(buf.len()); Ok(())
    }
    fn remove_file(&self, file_id: usize, filename: &Path) -> anyhow::Result<()> { self.inner.remove_file(file_id, filename) }
    fn remove_directory_if_empty(&self, path: &Path) -> anyhow::Result<()> { self.inner.remove_directory_if_empty(path) }
    fn ensure_file_length(&self, file_id: usize, length: u64) -> anyhow::Result<()> {
        if let Some(space) = &self.space { space.operation(file_id, length, 0, true, || self.inner.ensure_file_length(file_id, length)) }
        else { self.inner.ensure_file_length(file_id, length) }
    }
    fn take(&self) -> anyhow::Result<Box<dyn TorrentStorage>> { Ok(Box::new(Self { inner: self.inner.take()?, written: self.written.clone(), space: self.space.clone() })) }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct TestStorage;
    impl TorrentStorage for TestStorage {
        fn init(&mut self, _: &ManagedTorrentShared, _: &TorrentMetadata) -> anyhow::Result<()> { Ok(()) }
        fn pread_exact(&self, _: usize, _: u64, buf: &mut [u8]) -> anyhow::Result<()> { buf.fill(42); Ok(()) }
        fn pwrite_all(&self, _: usize, offset: u64, _: &[u8]) -> anyhow::Result<()> { if offset == u64::MAX { anyhow::bail!("write failed"); } Ok(()) }
        fn remove_file(&self, _: usize, _: &Path) -> anyhow::Result<()> { Ok(()) }
        fn remove_directory_if_empty(&self, _: &Path) -> anyhow::Result<()> { Ok(()) }
        fn ensure_file_length(&self, _: usize, _: u64) -> anyhow::Result<()> { Ok(()) }
        fn take(&self) -> anyhow::Result<Box<dyn TorrentStorage>> { Ok(Box::new(TestStorage)) }
    }
    #[test]
    fn disk_counter_excludes_reads_allocation_and_failed_writes_and_survives_take() {
        let written = WriteCounter::default();
        let storage = MeasuredStorage { inner: Box::new(TestStorage), written: written.clone(), space: None };
        storage.ensure_file_length(0, 4096).unwrap();
        storage.pread_exact(0, 0, &mut [0; 128]).unwrap();
        storage.pwrite_all(0, u64::MAX, &[]).unwrap();
        assert_eq!(written.bytes(), 0);
        storage.pwrite_all(0, 0, &[1; 512]).unwrap();
        assert_eq!(written.bytes(), 512);
        assert!(storage.pwrite_all(0, u64::MAX, &[1; 100]).is_err());
        assert_eq!(written.bytes(), 512);
        storage.take().unwrap().pwrite_all(0, 512, &[2; 256]).unwrap();
        assert_eq!(written.bytes(), 768);
    }
}
