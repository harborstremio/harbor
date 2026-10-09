use super::*;
use std::{cell::Cell, fs, path::PathBuf};

fn key() -> Key {
    Key {
        kind: 0xd5f0f921,
        group: 0x80000000,
        instance: 0x9183aa5df1dd0f5c,
    }
}
fn fixture(keys: &[Key]) -> Vec<u8> {
    let table1 = 44 + keys.len() as u32 * 16;
    let header = [
        0x424e444c,
        3,
        0,
        0,
        1,
        table1,
        table1 + 32,
        40,
        1,
        table1 + 8,
    ];
    let mut data = vec![];
    for n in [1u32, 0, 0].into_iter().chain(header) {
        data.extend(n.to_le_bytes());
    }
    data.extend((keys.len() as u32).to_le_bytes());
    for k in keys {
        data.extend(k.kind.to_le_bytes());
        data.extend(k.group.to_le_bytes());
        data.extend(k.instance.to_le_bytes());
    }
    data.resize(12 + table1 as usize + 32, 0);
    data
}
fn put(data: &mut [u8], at: usize, value: u32) {
    data[at..at + 4].copy_from_slice(&value.to_le_bytes());
}
#[test]
fn nulls_and_duplicates_are_removed_without_discarding_known_groups() {
    let mut other = key();
    other.group = 0;
    let null = Key {
        kind: 0,
        group: 0,
        instance: 0,
    };
    let keys = read(&fixture(&[null, key(), key(), other]), &|| Ok(()))
        .unwrap()
        .unwrap();
    assert_eq!(keys, BTreeSet::from([key(), other]));
}
#[test]
fn unfamiliar_versions_stay_unread_and_magic_is_not_searched() {
    let base = fixture(&[key()]);
    for (at, value) in [(0, 2), (8, 1), (12, 123), (16, 4), (20, 1), (24, 1)] {
        let mut data = base.clone();
        put(&mut data, at, value);
        assert_eq!(read(&data, &|| Ok(())).unwrap(), None, "offset {at}");
    }
    assert_eq!(read(&[], &|| Ok(())).unwrap(), None);
    let mut shifted = base[..12].to_vec();
    shifted.extend([0u8; 4]);
    shifted.extend(&base[12..]);
    assert_eq!(read(&shifted, &|| Ok(())).unwrap(), None);
}
#[test]
fn truncation_and_inconsistent_bundle_offsets_cannot_yield_keys() {
    let base = fixture(&[key()]);
    for len in 4..base.len() {
        assert_eq!(
            read(&base[..len], &|| Ok(())).unwrap_err(),
            FORMAT,
            "length {len}"
        );
    }
    for (at, value) in [
        (32, 43),
        (32, u32::MAX),
        (36, 4),
        (36, u32::MAX),
        (40, 0),
        (40, 44),
        (44, 2),
        (48, 61),
        (52, 2),
    ] {
        let mut data = base.clone();
        put(&mut data, at, value);
        assert_eq!(read(&data, &|| Ok(())).unwrap_err(), FORMAT, "offset {at}");
    }
}
#[test]
fn counts_are_capped_and_partial_null_keys_are_rejected() {
    let base = fixture(&[key()]);
    for at in [4, 28, 52] {
        let mut data = base.clone();
        put(&mut data, at, u32::MAX);
        assert_eq!(read(&data, &|| Ok(())).unwrap_err(), "sims_limit");
    }
    for invalid in [
        Key { kind: 0, ..key() },
        Key {
            instance: 0,
            ..key()
        },
    ] {
        assert_eq!(read(&fixture(&[invalid]), &|| Ok(())).unwrap_err(), FORMAT);
    }
}
#[test]
fn cancellation_is_checked_before_and_during_resource_iteration() {
    let data = fixture(&vec![key(); 800]);
    let calls = Cell::new(0);
    let check = || {
        calls.set(calls.get() + 1);
        if calls.get() == 3 {
            Err("sims_cancelled")
        } else {
            Ok(())
        }
    };
    assert_eq!(read(&data, &check).unwrap_err(), "sims_cancelled");
    assert_eq!(calls.get(), 3);
    assert_eq!(
        read(&[], &|| Err("sims_cancelled")).unwrap_err(),
        "sims_cancelled"
    );
}
#[test]
#[ignore = "Requires four downloaded original lot exports and independent probe goldens"]
fn all_original_lot_keys_match_the_independent_decoder_and_production_reader() {
    let root =
        PathBuf::from(std::env::var("HARBOR_SIMS_CC_FIXTURES").unwrap()).join("architecture-proof");
    for (name, id, count, nonzero_groups) in [
        ("starter", 0x0bb3161fc8b031f4, 37, 0),
        ("bedroom", 0x0e1404d56509006f, 14, 2),
        ("diner", 0x06d803db012a009a, 38, 7),
        ("diner-no-cc", 0x0f9c03e0a48f01c0, 37, 1),
    ] {
        let path = root.join(name);
        let architecture = fs::read(path.join("architecture.bin")).unwrap();
        let keys = read(&architecture, &|| Ok(())).unwrap().unwrap();
        assert_eq!(keys.len(), count, "{name}");
        assert_eq!(keys.iter().filter(|k| k.group != 0).count(), nonzero_groups);
        let expected = fs::read_to_string(path.join("keys.tsv")).unwrap();
        let actual = keys
            .iter()
            .map(|k| format!("{:08x}\t{:08x}\t{:016x}", k.kind, k.group, k.instance))
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(
            actual.lines().collect::<Vec<_>>(),
            expected.lines().collect::<Vec<_>>(),
            "{name}"
        );
        let data = fs::read(path.join("content.bin")).unwrap();
        let meta = fs::read(path.join("metadata.bin")).unwrap();
        assert_eq!(
            super::super::expand(&data[8..], &|| Ok(())).unwrap(),
            fs::read(path.join("expanded.bin")).unwrap()
        );
        let build =
            super::super::read(&data, &meta, id, super::super::Kind::Lot, &|| Ok(())).unwrap();
        assert_eq!(build.declared, keys);
        assert_eq!(build.architecture_bytes, architecture.len());
        assert!(build.object_attributes);
    }
}
