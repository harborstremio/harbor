use super::*;
fn content(declared: &[build::Key], definition: u64) -> build::Content {
    build::Content {
        objects: vec![build::Object {
            id: 7,
            definition,
            model: None,
        }],
        declared: declared.iter().copied().collect(),
        architecture_bytes: 12,
        object_attributes: false,
        other_fields: false,
    }
}
fn key(kind: u32, group: u32, instance: u64) -> build::Key {
    build::Key {
        kind,
        group,
        instance,
    }
}
fn entry(key: build::Key) -> index::Entry {
    index::Entry {
        resource: Resource {
            kind: key.kind,
            instance: key.instance,
        },
        group: key.group,
        compression: 0,
    }
}
#[test]
fn explicit_room_groups_are_distinct_and_do_not_accept_wrong_group_or_kind() {
    let query = Query::build(content(
        &[key(0x319e4f1d, 0, 123), key(0x319e4f1d, 8, 123)],
        123,
    ));
    assert_eq!(query.references.len(), 2);
    assert!(query.other_data);
    for group in [0, 8] {
        assert_eq!(
            query.matching(&entry(key(0x319e4f1d, group, 123))).count(),
            1
        );
    }
    assert_eq!(query.matching(&entry(key(0x319e4f1d, 7, 123))).count(), 0);
    assert_eq!(query.matching(&entry(key(0xc0db5ae7, 0, 123))).count(), 0);
    assert_eq!(query.matching(&entry(key(0x319e4f1d, 0, 124))).count(), 0);
}
#[test]
fn lot_definition_group_is_unknown_and_model_group_is_exact() {
    let mut value = content(&[], 123);
    value.objects[0].model = Some(key(0x01661233, 8, 456));
    let query = Query::build(value);
    assert_eq!(query.references.len(), 2);
    for group in [0, 8, 0x80000000] {
        assert_eq!(
            query.matching(&entry(key(0xc0db5ae7, group, 123))).count(),
            1
        );
    }
    assert_eq!(query.matching(&entry(key(0x01661233, 8, 456))).count(), 1);
    assert_eq!(query.matching(&entry(key(0x01661233, 0, 456))).count(), 0);
}
#[test]
#[ignore = "requires original creator package"]
fn real_creator_furniture_has_matching_catalog_and_object_definition_identities() {
    let bytes = std::fs::read(std::env::var("HARBOR_SIMS_OBJECT_FIXTURE").unwrap()).unwrap();
    // Actual MIT-licensed Caerfinon JacAudacityOfBacon furniture package.
    // These controlled creation references test matching, not an original lot.
    let definition = 0xae0bbb021ff73759;
    for query in [
        Query::build(content(&[], definition)),
        Query::build(content(
            &[key(0x319e4f1d, 0x80000000, definition)],
            definition,
        )),
    ] {
        let index = index::read_with_budget(
            &mut std::io::Cursor::new(&bytes),
            &query.wanted(),
            &mut 1_000_000,
            &|| Ok(()),
        )
        .unwrap();
        assert_eq!(index.records, 29);
        assert_eq!(index.matches.len(), 1);
        assert_eq!(query.matching(&index.matches[0]).count(), 1);
        assert_eq!(index.matches[0].group, 0x80000000);
    }
}
