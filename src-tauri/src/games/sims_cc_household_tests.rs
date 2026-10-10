use super::*;
use std::{
    cell::Cell,
    io::{Cursor, Read},
    path::PathBuf,
};

fn var(mut n: u64) -> Vec<u8> {
    let mut v = vec![];
    loop {
        let b = (n & 127) as u8;
        n >>= 7;
        v.push(b | if n == 0 { 0 } else { 128 });
        if n == 0 {
            return v;
        }
    }
}
fn field(n: u32, wire: u8, v: &[u8]) -> Vec<u8> {
    let mut out = var(u64::from(n) << 3 | u64::from(wire));
    if wire == 2 {
        out.extend(var(v.len() as u64));
    }
    out.extend(v);
    out
}
fn uint(n: u32, v: u64) -> Vec<u8> {
    field(n, 0, &var(v))
}
fn msg(n: u32, v: &[u8]) -> Vec<u8> {
    field(n, 2, v)
}
fn fixed(n: u32, v: u64) -> Vec<u8> {
    field(n, 1, &v.to_le_bytes())
}
fn parts(ids: &[u64]) -> Vec<u8> {
    let ids: Vec<_> = ids.iter().flat_map(|n| n.to_le_bytes()).collect();
    msg(1, &msg(5, &msg(1, &ids)))
}
fn modifier(id: u64, amount: Option<f32>) -> Vec<u8> {
    let mut v = uint(1, id);
    if let Some(amount) = amount {
        v.extend(field(2, 5, &amount.to_bits().to_le_bytes()));
    }
    msg(2, &v)
}
fn framed_fixture(kind: u32, data: &[u8]) -> Vec<u8> {
    [
        kind.to_le_bytes().as_slice(),
        (data.len() as u32).to_le_bytes().as_slice(),
        data,
    ]
    .concat()
}
fn fixture(extra: &[u8]) -> (Vec<u8>, Vec<u8>) {
    let sim = [fixed(1, 42), msg(5, b"Mina"), extra.to_vec()].concat();
    let family = msg(1, &[uint(1, 1), uint(2, 77), msg(6, &sim)].concat());
    let metadata = [
        uint(1, 77),
        uint(2, 1),
        msg(10, &msg(2, &[uint(1, 1), msg(2, &uint(5, 42))].concat())),
    ]
    .concat();
    (framed_fixture(1, &family), framed_fixture(0, &metadata))
}
fn parse(extra: &[u8]) -> Household {
    let (data, meta) = fixture(extra);
    read(&data, &meta, 77, &|| Ok(())).unwrap()
}
fn resources(value: &Household) -> BTreeMap<Resource, BTreeSet<Use>> {
    value.sims[0]
        .references
        .iter()
        .map(|r| (r.resource, r.uses.clone()))
        .collect()
}
fn key(kind: u32, instance: u64) -> Resource {
    Resource { kind, instance }
}

#[test]
fn resolves_fixed_outfits_and_variable_traits_without_js_precision_loss() {
    let big = u64::MAX - 5;
    let traits = [var(111), var(big)].concat();
    let parsed = parse(
        &[
            msg(21, &parts(&[big, 91, 91, 0])),
            msg(30, &msg(10, &msg(1, &traits))),
            uint(10, 12),
        ]
        .concat(),
    );
    let values = resources(&parsed);
    assert_eq!(values.len(), 5);
    assert!(values[&key(CAS_PART, big)].contains(&Use::Outfit));
    assert!(values[&key(TRAIT, big)].contains(&Use::Trait));
    let json = serde_json::to_string(&parsed).unwrap();
    assert!(json.contains("fffffffffffffffa"));
    assert!(!json.contains("18446744073709551610"));
}
#[test]
fn keeps_genetic_and_occult_associations_even_when_resource_already_exists() {
    let face = modifier(999, Some(0.25));
    let genetic = [
        msg(1, &face),
        msg(5, &msg(1, &uint(1, 1001))),
        msg(6, &msg(1, &uint(1, 1002))),
    ]
    .concat();
    let form = [
        msg(12, &face),
        uint(16, 1003),
        msg(17, &genetic),
        msg(21, &parts(&[1004])),
    ]
    .concat();
    let parsed = parse(
        &[
            msg(18, &face),
            msg(28, &genetic),
            msg(30, &msg(17, &msg(3, &form))),
        ]
        .concat(),
    );
    let values = resources(&parsed);
    assert_eq!(
        values[&key(MODIFIER, 999)],
        BTreeSet::from([Use::Slider, Use::Genetic, Use::Occult])
    );
    assert_eq!(
        values[&key(CAS_PART, 1001)],
        BTreeSet::from([Use::Genetic, Use::Occult])
    );
    assert!(values[&key(CAS_PART, 1002)].contains(&Use::Genetic));
    assert!(values[&key(CAS_PART, 1004)].contains(&Use::Occult));
}
#[test]
fn zero_and_unspecified_modifiers_are_not_claimed_active() {
    let face = [
        modifier(1, Some(0.0)),
        modifier(2, Some(-0.0)),
        modifier(3, None),
        modifier(4, Some(-0.15)),
        msg(3, &field(2, 5, &0.1f32.to_bits().to_le_bytes())),
    ]
    .concat();
    let value = parse(&msg(18, &face));
    assert_eq!(
        resources(&value).keys().copied().collect::<Vec<_>>(),
        vec![key(MODIFIER, 4)]
    );
    assert!(value.sims[0].gaps.contains(&Gap::ModifierWithoutAmount));
    assert!(value.sims[0].gaps.contains(&Gap::ModifierWithoutKey));
}
#[test]
fn nonfinite_weights_and_malformed_known_wires_are_rejected() {
    for extra in [
        msg(18, &modifier(1, Some(f32::NAN))),
        msg(18, &modifier(1, Some(f32::INFINITY))),
        uint(21, 1),
        msg(21, &msg(1, &msg(5, &uint(1, 99)))),
        msg(30, &msg(10, &fixed(1, 99))),
        msg(21, &msg(1, &msg(5, &msg(1, &[1, 2, 3])))),
    ] {
        let (data, meta) = fixture(&extra);
        assert_eq!(read(&data, &meta, 77, &|| Ok(())).unwrap_err(), FORMAT);
    }
}
#[test]
fn duplicate_singletons_and_wrong_identity_are_rejected() {
    for extra in [
        fixed(1, 43),
        msg(5, b"Second"),
        [uint(10, 1), uint(10, 2)].concat(),
        [msg(21, &parts(&[1])), msg(21, &parts(&[2]))].concat(),
    ] {
        let (data, meta) = fixture(&extra);
        assert!(read(&data, &meta, 77, &|| Ok(())).is_err());
    }
    let (data, meta) = fixture(&[]);
    assert_eq!(
        read(&data, &meta, 78, &|| Ok(())).unwrap_err(),
        "sims_tray_set"
    );
    let wrong_meta = framed_fixture(
        0,
        &[
            uint(1, 77),
            uint(2, 1),
            msg(10, &msg(2, &msg(2, &uint(5, 43)))),
        ]
        .concat(),
    );
    assert_eq!(
        read(&data, &wrong_meta, 77, &|| Ok(())).unwrap_err(),
        "sims_tray_set"
    );
}
#[test]
fn unknown_data_is_exposed_as_coverage_gap() {
    let parsed = parse(
        &[
            uint(80, 1),
            msg(18, &uint(6, 111)),
            uint(62, 20),
            msg(30, &msg(1, &[])),
        ]
        .concat(),
    );
    assert_eq!(
        parsed.sims[0].gaps,
        BTreeSet::from([Gap::FutureFields, Gap::OtherSimData, Gap::DynamicTextures])
    );
}
#[test]
fn rejects_unknown_wrappers_truncation_and_unbounded_values() {
    let (data, meta) = fixture(&msg(21, &parts(&[42])));
    for end in 0..data.len() {
        assert!(read(&data[..end], &meta, 77, &|| Ok(())).is_err());
    }
    let mut wrong = data.clone();
    wrong[0] = 2;
    assert!(read(&wrong, &meta, 77, &|| Ok(())).is_err());
    let mut wrong = data.clone();
    wrong.extend([7, 0, 0, 0, 0]);
    assert!(read(&wrong, &meta, 77, &|| Ok(())).is_err());
    let mut known = data;
    known.extend([1, 0, 0, 0, 0]);
    assert!(read(&known, &meta, 77, &|| Ok(())).is_ok());
    let (data, meta) = fixture(&msg(21, &parts(&vec![9; 200_001])));
    assert_eq!(
        read(&data, &meta, 77, &|| Ok(())).unwrap_err(),
        "sims_limit"
    );
}
#[test]
fn cancellation_interrupts_large_packed_lists() {
    let (data, meta) = fixture(&msg(21, &parts(&vec![9; 50_000])));
    let calls = Cell::new(0);
    let result = read(&data, &meta, 77, &|| {
        let n = calls.get() + 1;
        calls.set(n);
        if n > 18 {
            Err("sims_cancelled")
        } else {
            Ok(())
        }
    });
    assert_eq!(result.unwrap_err(), "sims_cancelled");
    assert_eq!(calls.get(), 19);
}
fn public_zip(name: &str) -> zip::ZipArchive<Cursor<Vec<u8>>> {
    let base = PathBuf::from(
        std::env::var("HARBOR_SIMS_CC_FIXTURES")
            .expect("Explicit public creator fixture directory is required"),
    );
    zip::ZipArchive::new(Cursor::new(std::fs::read(base.join(name)).unwrap())).unwrap()
}
fn zip_file(zip: &mut zip::ZipArchive<Cursor<Vec<u8>>>, ext: &str) -> Vec<u8> {
    let name = zip
        .file_names()
        .find(|n| n.ends_with(ext))
        .unwrap()
        .to_owned();
    let mut bytes = Vec::new();
    zip.by_name(&name).unwrap().read_to_end(&mut bytes).unwrap();
    bytes
}
#[test]
#[ignore = "requires original public creator archives via HARBOR_SIMS_CC_FIXTURES"]
fn real_echron_export_matches_original_shoulder_slider_by_resource_identity() {
    let mut zip = public_zip("../tray-images/echron.zip");
    let data = zip_file(&mut zip, ".householdbinary");
    let metadata = zip_file(&mut zip, ".trayitem");
    let report = read(&data, &metadata, 0x00540d73e95605a8, &|| Ok(())).unwrap();
    assert_eq!(report.sims.len(), 4);
    assert_eq!(
        report
            .sims
            .iter()
            .map(|s| s.name.split(' ').next().unwrap())
            .collect::<Vec<_>>(),
        ["Vixie", "Deirdre", "Teresa", "Demid"]
    );
    let parts: BTreeSet<_> = report
        .sims
        .iter()
        .flat_map(|s| &s.references)
        .filter(|r| r.resource.kind == CAS_PART && r.uses.contains(&Use::Outfit))
        .map(|r| r.resource)
        .collect();
    assert_eq!(parts.len(), 141);
    let mut zip = public_zip("cc-HFO-shoulder-fixed.zip");
    let package = zip_file(&mut zip, ".package");
    let mut keys = BTreeSet::new();
    super::super::super::sims_package::inspect_resources(
        &package,
        false,
        &|| Ok(()),
        &mut |(kind, group, instance), _, _, _, _| {
            keys.insert((kind, group, instance));
            Ok(())
        },
    )
    .unwrap();
    assert_eq!(keys.len(), 20);
    let matches: Vec<_> = report
        .sims
        .iter()
        .map(|s| {
            s.references
                .iter()
                .filter(|r| {
                    keys.iter()
                        .any(|(kind, _, id)| *kind == r.resource.kind && *id == r.resource.instance)
                })
                .count()
        })
        .collect();
    // The original face-only probe found no matching active slider in Demid.
    // His genetic blob retains three, independently confirmed by the Python
    // probe. Do not discard these inherited-content references.
    assert_eq!(matches, [3, 3, 3, 3]);
    let demid: Vec<_> = report.sims[3]
        .references
        .iter()
        .filter(|r| {
            keys.iter()
                .any(|(kind, _, id)| *kind == r.resource.kind && *id == r.resource.instance)
        })
        .collect();
    assert!(demid.iter().all(|r| r.uses.contains(&Use::Genetic)));
    let base = PathBuf::from(std::env::var("HARBOR_SIMS_CC_FIXTURES").unwrap());
    std::fs::write(
        base.join("cc-household-native-report.json"),
        serde_json::to_vec_pretty(&report).unwrap(),
    )
    .unwrap();
}
