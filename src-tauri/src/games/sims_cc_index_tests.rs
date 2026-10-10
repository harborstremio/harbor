use super::*;
use std::{
    cell::Cell,
    io::{self, Cursor},
    path::PathBuf,
};

fn word(v: &mut Vec<u8>, value: u32) {
    v.extend(value.to_le_bytes());
}
fn fixture(flags: u32, entries: &[(u32, u16)], long_offset: bool) -> Vec<u8> {
    let mut bytes = vec![0; 128];
    bytes[..4].copy_from_slice(b"DBPF");
    bytes[4..8].copy_from_slice(&2u32.to_le_bytes());
    bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
    bytes[36..40].copy_from_slice(&(entries.len() as u32).to_le_bytes());
    if long_offset {
        bytes[64..72].copy_from_slice(&128u64.to_le_bytes());
    } else {
        bytes[40..44].copy_from_slice(&128u32.to_le_bytes());
    }
    let mut index = Vec::new();
    word(&mut index, flags);
    for (i, value) in [0xc5f6763e, 7, 0xfefeffff].iter().enumerate() {
        if flags & (1 << i) != 0 {
            word(&mut index, *value);
        }
    }
    for (group, compression) in entries {
        for (i, value) in [0xc5f6763e, *group, 0xfefeffff].iter().enumerate() {
            if flags & (1 << i) == 0 {
                word(&mut index, *value);
            }
        }
        word(&mut index, 123);
        word(&mut index, 96);
        word(&mut index, if *compression == 0 { 4 } else { 0x80000004 });
        word(&mut index, 4);
        if *compression != 0 {
            word(&mut index, u32::from(*compression) | 0x10000);
        }
    }
    bytes[44..48].copy_from_slice(&(index.len() as u32).to_le_bytes());
    bytes.extend(index);
    bytes
}
fn wanted() -> BTreeSet<Resource> {
    BTreeSet::from([Resource {
        kind: 0xc5f6763e,
        instance: 0xfefeffff0000007b,
    }])
}

#[test]
fn all_common_key_variants_and_64bit_offsets_preserve_identity() {
    for flags in 0..8 {
        for long_offset in [false, true] {
            let bytes = fixture(flags, &[(7, 0x5a42)], long_offset);
            let report = read(&mut Cursor::new(bytes), &wanted(), &|| Ok(())).unwrap();
            assert_eq!(report.matches.len(), 1);
            assert_eq!(report.matches[0].resource, *wanted().first().unwrap());
            assert_eq!(report.matches[0].group, 7);
            assert_eq!(report.matches[0].compression, 0x5a42);
        }
    }
}
#[test]
fn deleted_duplicate_and_multiple_group_records_remain_distinct() {
    let bytes = fixture(0, &[(7, 0), (8, 0), (7, 0xffe0)], false);
    let report = read(&mut Cursor::new(bytes), &wanted(), &|| Ok(())).unwrap();
    assert_eq!(report.matches.iter().filter(|e| e.group == 7).count(), 2);
    assert_eq!(
        report
            .matches
            .iter()
            .map(|e| (e.group, e.deleted()))
            .collect::<Vec<_>>(),
        [(7, false), (8, false), (7, true)]
    );
}
#[test]
fn malformed_extents_counts_offsets_and_unknown_flags_fail() {
    let good = fixture(0, &[(7, 0)], false);
    for (offset, value) in [
        (36, 99),
        (40, 97),
        (44, 5),
        (128, 8),
        (148, 130),
        (152, 0x7fffffff),
    ] {
        let mut bytes = good.clone();
        bytes[offset..offset + 4].copy_from_slice(&u32::to_le_bytes(value));
        assert!(
            read(&mut Cursor::new(bytes), &wanted(), &|| Ok(())).is_err(),
            "at {offset}"
        );
    }
    let mut bytes = good.clone();
    bytes[64..72].copy_from_slice(&129u64.to_le_bytes());
    assert!(read(&mut Cursor::new(bytes), &wanted(), &|| Ok(())).is_err());
    for length in 0..good.len() {
        assert!(read(&mut Cursor::new(&good[..length]), &wanted(), &|| Ok(())).is_err());
    }
}
#[test]
fn cancels_mid_index_and_never_allocates_from_untrusted_count() {
    let data = fixture(0, &vec![(7, 0); 2000], false);
    let calls = Cell::new(0);
    let result = read(&mut Cursor::new(data), &wanted(), &|| {
        let n = calls.get() + 1;
        calls.set(n);
        if n > 3 {
            Err("sims_cancelled")
        } else {
            Ok(())
        }
    });
    assert_eq!(result.unwrap_err(), "sims_cancelled");
    let mut data = fixture(0, &[], false);
    data[36..40].copy_from_slice(&u32::MAX.to_le_bytes());
    assert_eq!(
        read(&mut Cursor::new(data), &wanted(), &|| Ok(())).unwrap_err(),
        "sims_limit"
    );
}
struct Sparse {
    header: Vec<u8>,
    index: Vec<u8>,
    index_at: u64,
    position: u64,
    bytes_read: usize,
}
impl Read for Sparse {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        let bytes = if self.position < self.header.len() as u64 {
            &self.header[self.position as usize..]
        } else if self.position >= self.index_at
            && self.position < self.index_at + self.index.len() as u64
        {
            &self.index[(self.position - self.index_at) as usize..]
        } else {
            return Err(io::Error::other("payload bytes must not be read"));
        };
        let length = bytes.len().min(out.len());
        out[..length].copy_from_slice(&bytes[..length]);
        self.position += length as u64;
        self.bytes_read += length;
        Ok(length)
    }
}
impl Seek for Sparse {
    fn seek(&mut self, from: SeekFrom) -> io::Result<u64> {
        self.position = match from {
            SeekFrom::Start(n) => n,
            SeekFrom::End(n) => (self.index_at as i128 + self.index.len() as i128 + i128::from(n))
                .try_into()
                .map_err(|_| io::Error::other("seek"))?,
            SeekFrom::Current(n) => (i128::from(self.position) + i128::from(n))
                .try_into()
                .map_err(|_| io::Error::other("seek"))?,
        };
        Ok(self.position)
    }
}
#[test]
fn reads_only_header_and_index_from_virtual_five_gib_package() {
    let data = fixture(0, &[(7, 0)], true);
    let mut source = Sparse {
        header: data[..96].into(),
        index: data[128..].into(),
        index_at: 5 * 1024 * 1024 * 1024,
        position: 0,
        bytes_read: 0,
    };
    source.header[64..72].copy_from_slice(&source.index_at.to_le_bytes());
    let report = read(&mut source, &wanted(), &|| Ok(())).unwrap();
    assert_eq!(report.matches.len(), 1);
    assert_eq!(source.bytes_read, 96 + source.index.len());
}
#[test]
#[ignore = "requires original public creator archive via HARBOR_SIMS_CC_FIXTURES"]
fn public_creator_package_agrees_with_existing_production_inspector() {
    let base = PathBuf::from(
        std::env::var("HARBOR_SIMS_CC_FIXTURES")
            .expect("Explicit public creator fixture directory is required"),
    );
    let bytes = std::fs::read(base.join("cc-HFO-shoulder-fixed.zip")).unwrap();
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
    let name = zip
        .file_names()
        .find(|n| n.ends_with(".package"))
        .unwrap()
        .to_owned();
    let mut package = Vec::new();
    zip.by_name(&name)
        .unwrap()
        .read_to_end(&mut package)
        .unwrap();
    let mut expected = Vec::new();
    super::super::super::sims_package::inspect_resources(
        &package,
        false,
        &|| Ok(()),
        &mut |(kind, group, instance), _, _, _, compression| {
            expected.push(Entry {
                resource: Resource { kind, instance },
                group,
                compression: compression as u16,
            });
            Ok(())
        },
    )
    .unwrap();
    let wanted = expected.iter().map(|e| e.resource).collect();
    let report = read(&mut Cursor::new(package), &wanted, &|| Ok(())).unwrap();
    assert_eq!(report.records, 20);
    assert_eq!(report.matches, expected);
    assert_eq!(
        report
            .matches
            .iter()
            .map(|e| (e.resource, e.group))
            .collect::<BTreeSet<_>>()
            .len(),
        report.matches.len()
    );
}
