//! The acquisition store is a durable outbox until the preparation store has
//! accepted the same operation. Neither renderer lifetime nor event order owns it.
use super::{
    archives,
    download_preparation::{self, Choice, Engine, Preparations, Status, Target},
    p2p::{TorrentFile, TorrentRecord, Torrents},
    preparation_runtime,
    transfers::{Transfer, Transfers},
};
use serde::Deserialize;
use std::{collections::HashSet, path::Path};

type Result<T> = std::result::Result<T, &'static str>;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    /// Exact filename in this direct request/batch, or selected torrent path.
    pub archive: String,
    pub parent: String,
    pub name: String,
    /// Additional filenames explicitly selected in the same direct batch.
    #[serde(default)]
    pub members: Vec<String>,
}

pub(super) fn belongs_to(choice: &Choice, engine: Engine, profile: &str, id: &str) -> bool {
    download_preparation::valid_choice(choice)
        && choice.status == Status::Waiting
        && choice.target.engine == engine
        && choice.target.profile == profile
        && choice.target.download_id == id
}

pub(super) fn direct(records: &mut [Transfer], draft: Draft) -> Result<()> {
    if draft.members.len() >= 200
        || draft.members.iter().collect::<HashSet<_>>().len() != draft.members.len()
    {
        return Err("archive_parts");
    }
    let index = records
        .iter()
        .position(|record| {
            Path::new(&record.destination)
                .file_name()
                .and_then(|name| name.to_str())
                == Some(draft.archive.as_str())
        })
        .ok_or("archive_path")?;
    let record = &records[index];
    let mut members = Vec::with_capacity(draft.members.len());
    for name in &draft.members {
        let member = records
            .iter()
            .find(|candidate| {
                candidate.profile == record.profile
                    && Path::new(&candidate.destination)
                        .file_name()
                        .and_then(|part| part.to_str())
                        == Some(name.as_str())
            })
            .ok_or("archive_parts")?;
        members.push(member.id.clone());
    }
    let target = Target {
        profile: record.profile.clone(),
        engine: Engine::Direct,
        download_id: record.id.clone(),
        archive: record.destination.clone(),
        members,
    };
    if !download_preparation::valid_target(&target) {
        return Err("archive_parts");
    }
    let source = Path::new(&record.destination);
    if records.iter().any(|part| {
        let path = Path::new(&part.destination);
        part.id != record.id
            && path.parent() == source.parent()
            && archives::preparation_family(
                &draft.archive,
                path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or(""),
            )
            && !target.members.contains(&part.id)
    }) {
        return Err("archive_missing_part");
    }
    let snapshot = preparation_runtime::resolve_direct_with(&target, |profile, id| {
        records
            .iter()
            .find(|record| record.profile == profile && record.id == id)
            .cloned()
            .ok_or("transfer_missing")
    })?;
    let choice = download_preparation::acquisition_choice(
        target,
        draft.parent,
        draft.name,
        snapshot.identity,
    )?;
    let output = Path::new(&choice.parent).join(&choice.name);
    if records
        .iter()
        .any(|record| Path::new(&record.destination) == output)
    {
        return Err("archive_destination");
    }
    records[index].preparation = Some(choice);
    Ok(())
}

pub(super) fn torrent(
    record: &mut TorrentRecord,
    files: &[TorrentFile],
    draft: Draft,
) -> Result<()> {
    if !draft.members.is_empty() {
        return Err("archive_parts");
    }
    let selected = files
        .iter()
        .find(|file| {
            file.path == draft.archive && !file.padding && record.selected.contains(&file.index)
        })
        .ok_or("archive_path")?;
    if !archives::preparation_candidate(selected.path.rsplit('/').next().unwrap_or("")) {
        return Err("archive_path");
    }
    let selected_path = Path::new(&selected.path);
    let selected_name = selected.path.rsplit('/').next().unwrap_or("");
    let selected_ids: HashSet<_> = record.selected.iter().copied().collect();
    if files.iter().any(|part| {
        !part.padding
            && Path::new(&part.path).parent() == selected_path.parent()
            && archives::preparation_family(
                selected_name,
                part.path.rsplit('/').next().unwrap_or(""),
            )
            && !selected_ids.contains(&part.index)
    }) {
        return Err("archive_missing_part");
    }
    let target = Target {
        profile: record.profile.clone(),
        engine: Engine::Torrent,
        download_id: record.id.clone(),
        archive: selected.path.clone(),
        members: Vec::new(),
    };
    let choice = download_preparation::acquisition_choice(
        target,
        draft.parent,
        draft.name,
        preparation_runtime::torrent_identity(record)?,
    )?;
    if Path::new(&choice.parent).join(&choice.name) == Path::new(&record.destination) {
        return Err("archive_destination");
    }
    record.preparation = Some(choice);
    Ok(())
}

pub(super) fn direct_pending(policies: &Preparations, manager: &Transfers) -> Result<()> {
    for choice in manager.preparation_intents()? {
        policies.adopt(choice.clone())?;
        manager.ack_preparation(
            &choice.target.profile,
            &choice.target.download_id,
            &choice.id,
        )?;
    }
    Ok(())
}

pub(super) fn torrent_pending(policies: &Preparations, manager: &Torrents) -> Result<()> {
    for choice in manager.preparation_intents()? {
        policies.adopt(choice.clone())?;
        manager.ack_preparation(
            &choice.target.profile,
            &choice.target.download_id,
            &choice.id,
        )?;
    }
    Ok(())
}
