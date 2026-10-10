use super::*;
use std::{cell::Cell, fs, path::PathBuf};
fn vint(mut n: u64) -> Vec<u8> {
    let mut b = Vec::new();
    loop {
        let v = (n & 127) as u8;
        n >>= 7;
        b.push(v | if n > 0 { 128 } else { 0 });
        if n == 0 {
            return b;
        }
    }
}
fn number(n: u32, v: u64) -> Vec<u8> {
    [vint(u64::from(n) << 3), vint(v)].concat()
}
fn bytes(n: u32, v: &[u8]) -> Vec<u8> {
    [
        vint((u64::from(n) << 3) | 2),
        vint(v.len() as u64),
        v.to_vec(),
    ]
    .concat()
}
fn framed_bytes(v: u32, b: &[u8]) -> Vec<u8> {
    [
        v.to_le_bytes().to_vec(),
        (b.len() as u32).to_le_bytes().to_vec(),
        b.to_vec(),
    ]
    .concat()
}
fn literal(data: &[u8]) -> Vec<u8> {
    let mut out = vint(data.len() as u64);
    if data.len() <= 60 {
        out.push(((data.len() - 1) << 2) as u8)
    } else {
        out.push(0xfc);
        out.extend_from_slice(&((data.len() - 1) as u32).to_le_bytes())
    }
    out.extend_from_slice(data);
    out
}
fn metadata(id: u64, kind: Kind) -> Vec<u8> {
    framed_bytes(
        0,
        &[
            number(1, id),
            number(2, if kind == Kind::Lot { 2 } else { 3 }),
            bytes(4, b"Original creation"),
            bytes(
                10,
                &bytes(if kind == Kind::Lot { 1 } else { 7 }, &number(2, 6)),
            ),
        ]
        .concat(),
    )
}
fn object(id: u64, definition: u64) -> Vec<u8> {
    [number(1, id), number(15, definition)].concat()
}
fn lot(objects: &[Vec<u8>]) -> Vec<u8> {
    let data = objects.iter().flat_map(|o| bytes(2, o)).collect::<Vec<_>>();
    let body = [
        0xfea1_baadu32.to_le_bytes().to_vec(),
        2u32.to_le_bytes().to_vec(),
        (data.len() as u32).to_le_bytes().to_vec(),
        data,
        vec![7, 8, 9],
    ]
    .concat();
    framed_bytes(1, &literal(&body))
}
fn root() -> PathBuf {
    PathBuf::from(
        std::env::var("HARBOR_SIMS_LOT_FIXTURES").expect("Set original-creator fixture directory"),
    )
}

#[test]
fn overlapping_copies_accept_all_three_snappy_offset_encodings() {
    for body in [
        vec![5, 0, b'a', 1, 1],
        vec![5, 0, b'a', 14, 1, 0],
        vec![5, 0, b'a', 15, 1, 0, 0, 0],
    ] {
        assert_eq!(expand(&body, &|| Ok(())).unwrap(), b"aaaaa")
    }
    for size in [1, 59, 60, 61, 255, 256, 1024, 70001] {
        let data = (0..size).map(|n| (n % 251) as u8).collect::<Vec<_>>();
        assert_eq!(expand(&literal(&data), &|| Ok(())).unwrap(), data)
    }
}
#[test]
fn invalid_copy_bounds_truncated_literals_and_inexact_lengths_fail() {
    for data in [
        vec![],
        vec![5, 14, 1, 0],
        vec![5, 0, b'a', 14, 0, 0],
        vec![5, 0, b'a', 14, 2, 0],
        vec![5, 0, b'a', 18, 1, 0],
        vec![4, 0, b'a'],
        vec![1, 4, b'a'],
        vec![1, 0, b'a', 0, b'b'],
        vec![5, 0xfc, 1, 2],
        vec![128, 128, 128, 128, 16],
    ] {
        assert_eq!(expand(&data, &|| Ok(())).unwrap_err(), FORMAT, "{data:?}")
    }
    assert_eq!(
        expand(&vint(MAX_EXPANDED as u64 + 1), &|| Ok(())).unwrap_err(),
        "sims_limit"
    );
}
#[test]
fn cancellation_interrupts_large_literal_and_copy_expansion() {
    let input = literal(&vec![1; 300_000]);
    let calls = Cell::new(0);
    let check = || {
        calls.set(calls.get() + 1);
        if calls.get() > 3 {
            Err("sims_cancelled")
        } else {
            Ok(())
        }
    };
    assert_eq!(expand(&input, &check).unwrap_err(), "sims_cancelled");
    let mut input = vint(1 + 64 * 2000);
    input.extend([0, b'a']);
    for _ in 0..2000 {
        input.extend([254, 1, 0])
    }
    calls.set(0);
    assert_eq!(expand(&input, &check).unwrap_err(), "sims_cancelled");
}
#[test]
fn metadata_identity_and_creation_type_must_match() {
    let data = lot(&[object(8, 99)]);
    assert_eq!(
        read(&data, &metadata(123, Kind::Lot), 124, Kind::Lot, &|| Ok(())).unwrap_err(),
        "sims_tray_set"
    );
    assert_eq!(
        read(
            &data,
            &metadata(123, Kind::Room),
            123,
            Kind::Lot,
            &|| Ok(())
        )
        .unwrap_err(),
        "sims_tray_set"
    );
    let valid = read(&data, &metadata(123, Kind::Lot), 123, Kind::Lot, &|| Ok(())).unwrap();
    assert_eq!(valid.objects[0].definition, 99);
    assert_eq!(valid.architecture_bytes, 3);
    let mut wrong = data.clone();
    wrong[4] = 0;
    assert_eq!(
        read(
            &wrong,
            &metadata(123, Kind::Lot),
            123,
            Kind::Lot,
            &|| Ok(())
        )
        .unwrap_err(),
        FORMAT
    );
}
#[test]
fn duplicate_objects_missing_definitions_and_ambiguous_guid_fail() {
    let meta = metadata(123, Kind::Lot);
    assert_eq!(
        read(
            &lot(&[object(8, 99), object(8, 100)]),
            &meta,
            123,
            Kind::Lot,
            &|| Ok(())
        )
        .unwrap_err(),
        "sims_tray_set"
    );
    for obj in [
        number(1, 8),
        [object(8, 99), number(15, 100)].concat(),
        [object(8, 99), number(4, 100)].concat(),
        [number(1, 8), number(4, u64::from(u32::MAX) + 1)].concat(),
    ] {
        assert_eq!(
            read(&lot(&[obj]), &meta, 123, Kind::Lot, &|| Ok(())).unwrap_err(),
            FORMAT
        )
    }
    let old = read(
        &lot(&[[number(1, 8), number(4, 77)].concat()]),
        &meta,
        123,
        Kind::Lot,
        &|| Ok(()),
    )
    .unwrap();
    assert_eq!(old.objects[0].definition, 77);
}
#[test]
fn model_resource_keys_preserve_group_and_unknown_content_stays_visible() {
    let model = [
        number(1, 0x01661233),
        number(2, 0x80000000),
        number(3, 0xabcdef0123456789),
    ]
    .concat();
    let obj = [
        object(8, 99),
        bytes(17, &model),
        bytes(21, b"opaque attributes"),
        number(25, 123),
    ]
    .concat();
    let result = read(
        &lot(&[obj]),
        &metadata(123, Kind::Lot),
        123,
        Kind::Lot,
        &|| Ok(()),
    )
    .unwrap();
    assert_eq!(
        result.objects[0].model,
        Some(Key {
            kind: 0x01661233,
            group: 0x80000000,
            instance: 0xabcdef0123456789
        })
    );
    assert!(result.object_attributes && result.other_fields);
    assert!(result.declared.is_empty());
    let invalid = [object(8, 99), bytes(17, &[model, number(4, 1)].concat())].concat();
    assert_eq!(
        read(
            &lot(&[invalid]),
            &metadata(123, Kind::Lot),
            123,
            Kind::Lot,
            &|| Ok(())
        )
        .unwrap_err(),
        FORMAT
    );
    let no_group = [
        object(8, 99),
        bytes(17, &[number(1, 55), number(3, 123)].concat()),
    ]
    .concat();
    let value = read(
        &lot(&[no_group]),
        &metadata(123, Kind::Lot),
        123,
        Kind::Lot,
        &|| Ok(()),
    )
    .unwrap();
    assert_eq!(value.objects[0].model.unwrap().group, 0);
    let wide_group = [
        object(8, 99),
        bytes(
            17,
            &[
                number(1, 55),
                number(2, u64::from(u32::MAX) + 1),
                number(3, 123),
            ]
            .concat(),
        ),
    ]
    .concat();
    assert_eq!(
        read(
            &lot(&[wide_group]),
            &metadata(123, Kind::Lot),
            123,
            Kind::Lot,
            &|| Ok(())
        )
        .unwrap_err(),
        FORMAT
    );
}
#[test]
fn unsupported_inner_versions_and_wrong_record_sizes_are_rejected() {
    let source = lot(&[object(8, 99)]);
    let original = expand(&source[8..], &|| Ok(())).unwrap();
    for offset in [0, 4, 8] {
        let mut body = original.clone();
        body[offset] = 255;
        let data = framed_bytes(1, &literal(&body));
        assert_eq!(
            read(&data, &metadata(123, Kind::Lot), 123, Kind::Lot, &|| Ok(())).unwrap_err(),
            FORMAT
        )
    }
}
#[test]
#[ignore = "Requires downloaded original creator fixtures"]
fn all_original_objects_agree_with_independent_python_and_snappy_decoder() {
    for (name, id, kind, count, defs, declared, architecture) in [
        (
            "starter",
            0x0bb3161fc8b031f4,
            Kind::Lot,
            138,
            64,
            37,
            193586,
        ),
        (
            "bedroom",
            0x0e1404d56509006f,
            Kind::Lot,
            218,
            171,
            14,
            74220,
        ),
        (
            "kitchen",
            0x032804e024f30051,
            Kind::Room,
            236,
            190,
            193,
            4570,
        ),
    ] {
        let path = root().join(name);
        let data = fs::read(path.join("content.bin")).unwrap();
        let meta = fs::read(path.join("metadata.bin")).unwrap();
        assert_eq!(
            expand(&data[8..], &|| Ok(())).unwrap(),
            fs::read(path.join("expanded.bin")).unwrap(),
            "{name} independent Snappy output"
        );
        let read = read(&data, &meta, id, kind, &|| Ok(())).unwrap();
        assert_eq!(read.objects.len(), count);
        assert_eq!(read.architecture_bytes, architecture);
        assert!(read.object_attributes);
        assert!(!read.other_fields);
        let definitions = read
            .objects
            .iter()
            .map(|o| o.definition)
            .collect::<BTreeSet<_>>();
        assert_eq!(definitions.len(), defs);
        let expected = fs::read_to_string(path.join("objects.tsv")).unwrap();
        let actual = read
            .objects
            .iter()
            .map(|o| format!("{:016x}\t{:016x}", o.id, o.definition))
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(
            actual.lines().collect::<Vec<_>>(),
            expected.lines().collect::<Vec<_>>(),
            "{name} all object identities"
        );
        let keys_path = if kind == Kind::Lot {
            root()
                .parent()
                .unwrap()
                .join("architecture-proof")
                .join(name)
        } else {
            path.clone()
        };
        let expected = fs::read_to_string(keys_path.join("keys.tsv")).unwrap();
        let actual = read
            .declared
            .iter()
            .map(|k| format!("{:08x}\t{:08x}\t{:016x}", k.kind, k.group, k.instance))
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(
            actual.lines().collect::<Vec<_>>(),
            expected.lines().collect::<Vec<_>>()
        );
        assert_eq!(read.declared.len(), declared);
        if kind == Kind::Room {
            assert_eq!(
                definitions,
                read.declared
                    .iter()
                    .filter(|k| k.kind == 0x319e4f1d)
                    .map(|k| k.instance)
                    .collect::<BTreeSet<_>>()
            );
            assert_eq!(
                read.declared
                    .iter()
                    .filter(|k| k.kind == 0xd5f0f921)
                    .count(),
                1
            );
            assert_eq!(
                read.declared
                    .iter()
                    .filter(|k| k.kind == 0xb4f762c9)
                    .count(),
                2
            )
        }
    }
}
#[test]
#[ignore = "Requires downloaded original creator fixtures"]
fn room_key_table_versions_and_inner_object_header_are_validated() {
    let path = root().join("kitchen");
    let data = fs::read(path.join("content.bin")).unwrap();
    let meta = fs::read(path.join("metadata.bin")).unwrap();
    let original = expand(&data[8..], &|| Ok(())).unwrap();
    for offset in [0, 4, 4075, 4079] {
        let mut body = original.clone();
        body[offset] = 255;
        let data = framed_bytes(1, &literal(&body));
        assert_eq!(
            read(&data, &meta, 0x032804e024f30051, Kind::Room, &|| Ok(())).unwrap_err(),
            FORMAT
        )
    }
    let calls = Cell::new(0);
    let check = || {
        calls.set(calls.get() + 1);
        if calls.get() > 6 {
            Err("sims_cancelled")
        } else {
            Ok(())
        }
    };
    assert_eq!(
        read(&data, &meta, 0x032804e024f30051, Kind::Room, &check).unwrap_err(),
        "sims_cancelled"
    );
}
