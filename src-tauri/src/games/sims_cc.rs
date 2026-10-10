//! Read-only associations between a managed creation and current local files.
//! An unmatched reference is unresolved, never automatically "missing CC".
use super::{
    sims_dependencies::PackSelection, sims_files as files, sims_launch_settings as launch,
    sims_package::Result, sims_packs as packs, sims_reviews, sims_store as store,
};
use serde::Serialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime},
};
#[path = "sims_cc_build.rs"]
mod build;
#[path = "sims_cc_household.rs"]
mod household;
#[path = "sims_cc_index.rs"]
mod index;
#[path = "sims_cc_query.rs"]
mod query;
use household::Resource;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Area {
    Mods,
    Disabled,
    Game,
}
#[derive(Debug, Serialize)]
pub struct Sim {
    pub id: String,
    pub name: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub path: String,
    pub area: Area,
    pub title: Option<String>,
    pub pack: Option<String>,
    pub pack_available: Option<bool>,
    pub references: usize,
    pub sims: Vec<String>,
    pub ambiguous: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub sims: Vec<Sim>,
    pub objects: Option<usize>,
    pub matches: Vec<Match>,
    pub references: usize,
    pub unresolved: usize,
    pub checked_files: usize,
    pub indexed_resources: u64,
    pub partial: bool,
    pub other_data: bool,
    pub mods_enabled: Option<bool>,
    pub resource_ready: bool,
    pub game: Option<packs::Report>,
    pub game_error: Option<&'static str>,
    pub checked_at: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Source {
    absolute: PathBuf,
    display: String,
    area: Area,
    title: Option<String>,
    pack: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Snapshot {
    source: Source,
    bytes: u64,
    modified: Option<SystemTime>,
}
fn snapshot(source: Source) -> Result<Snapshot> {
    let value = files::regular(&source.absolute)?;
    Ok(Snapshot {
        source,
        bytes: value.len(),
        modified: value.modified().ok(),
    })
}
fn package(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with(".package")
}
fn pack_code(name: &str) -> Option<String> {
    let b = name.as_bytes();
    (b.len() == 4
        && b"EFGS".contains(&b[0].to_ascii_uppercase())
        && b[1].eq_ignore_ascii_case(&b'P')
        && b[2..].iter().all(u8::is_ascii_digit))
    .then(|| name.to_ascii_uppercase())
}
fn game_files(
    root: &Path,
    report: &packs::Report,
    check: &dyn Fn() -> Result<()>,
) -> Result<(Vec<Snapshot>, bool)> {
    // Discovery scope is stated in the UI. No inference that Resource.cfg or
    // every future game-content location/load-order rule has been understood.
    let mut sources = Vec::new();
    let mut stack = vec![(root.join("Data"), 0, None), (root.join("Delta"), 0, None)];
    for (i, entry) in fs::read_dir(root).map_err(|_| "sims_read")?.enumerate() {
        check()?;
        if i >= 2048 {
            return Err("sims_limit");
        }
        let entry = entry.map_err(|_| "sims_read")?;
        if let Some(code) = entry.file_name().to_str().and_then(pack_code) {
            if report.packs.iter().any(|p| p.code == code) {
                stack.push((entry.path(), 0, Some(code)));
            }
        }
    }
    let mut entries = 0;
    let mut partial = false;
    while let Some((path, depth, code)) = stack.pop() {
        check()?;
        if !path.try_exists().map_err(|_| "sims_read")? {
            continue;
        }
        if files::directory(&path).is_err() {
            partial = true;
            continue;
        }
        let children = match fs::read_dir(&path) {
            Ok(v) => v,
            Err(_) => {
                partial = true;
                continue;
            }
        };
        for child in children {
            check()?;
            entries += 1;
            if entries > 16_000 || sources.len() >= 4096 {
                return Ok((sources, true));
            }
            let child = match child {
                Ok(v) => v,
                Err(_) => {
                    partial = true;
                    continue;
                }
            };
            let path = child.path();
            let name = child.file_name().to_string_lossy().into_owned();
            let meta = match fs::symlink_metadata(&path) {
                Ok(v) => v,
                Err(_) => {
                    partial = true;
                    continue;
                }
            };
            if files::linked(&meta) {
                partial = true;
                continue;
            }
            let code = code.clone().or_else(|| pack_code(&name));
            if meta.is_dir() {
                if depth < 4 {
                    stack.push((path, depth + 1, code));
                } else {
                    partial = true;
                }
            } else if meta.is_file() && package(&name) {
                let display = path
                    .strip_prefix(root)
                    .map_err(|_| "sims_path")?
                    .to_str()
                    .ok_or("sims_path")?
                    .replace('\\', "/");
                files::relative_name(&display)?;
                sources.push(snapshot(Source {
                    absolute: path,
                    display,
                    area: Area::Game,
                    title: None,
                    pack: code,
                })?);
            }
        }
    }
    sources.sort_by(|a, b| a.source.absolute.cmp(&b.source.absolute));
    Ok((sources, partial))
}
fn local_files(
    folder: &files::Folder,
    state: &store::State,
    check: &dyn Fn() -> Result<()>,
) -> Result<Vec<Snapshot>> {
    let root = Path::new(&folder.path);
    let mut values = Vec::new();
    for file in &folder.files {
        check()?;
        if file.kind != "package" {
            continue;
        }
        files::relative_name(&file.path)?;
        let title = state
            .groups
            .iter()
            .find(|g| g.enabled && file.path.starts_with(&format!("Harbor-{}/", g.id)))
            .map(|g| g.title.clone());
        values.push(snapshot(Source {
            absolute: root.join("Mods").join(&file.path),
            display: file.path.clone(),
            area: Area::Mods,
            title,
            pack: None,
        })?);
    }
    for group in state.groups.iter().filter(|g| !g.enabled) {
        for file in group.files.iter().filter(|f| package(&f.name)) {
            check()?;
            if values.len() >= 8192 {
                return Err("sims_limit");
            }
            files::relative_name(&file.name)?;
            values.push(snapshot(Source {
                absolute: root
                    .join(store::STORE)
                    .join("disabled")
                    .join(&group.id)
                    .join(&file.name),
                display: file.name.clone(),
                area: Area::Disabled,
                title: Some(group.title.clone()),
                pack: None,
            })?);
        }
    }
    values.sort_by(|a, b| a.source.absolute.cmp(&b.source.absolute));
    Ok(values)
}
fn creation(
    root: &Path,
    id: &str,
    check: &dyn Fn() -> Result<()>,
) -> Result<(store::tray::Item, Vec<(files::Stamp, Vec<u8>)>)> {
    uuid::Uuid::parse_str(id).map_err(|_| "sims_request")?;
    let item = store::tray::view(root.to_str().ok_or("sims_path")?)?
        .items
        .into_iter()
        .find(|v| v.id == id)
        .ok_or("sims_missing")?;
    let extension = match item.category.as_str() {
        "household" => ".householdbinary",
        "lot" => ".blueprint",
        "room" => ".room",
        _ => return Err("sims_cc_unsupported"),
    };
    let base = if item.installed {
        root.join("Tray")
    } else {
        root.join(store::STORE).join("tray-vault").join(id)
    };
    let mut data = Vec::new();
    for stamp in item.files.iter().filter(|f| {
        let n = f.name.to_ascii_lowercase();
        n.ends_with(".trayitem") || n.ends_with(extension)
    }) {
        let bytes = files::read_checked(&base.join(&stamp.name), 8 * 1024 * 1024, check)?;
        if files::stamp(stamp.name.clone(), &bytes) != *stamp {
            return Err("sims_changed");
        }
        data.push((stamp.clone(), bytes));
    }
    Ok((item, data))
}
pub fn scan(
    profile: &str,
    path: &str,
    id: &str,
    operation: &str,
    selection: Option<&PackSelection>,
    emit: impl Fn(store::progress::Progress),
) -> Result<Report> {
    let mut work = store::progress::Work::start(profile, operation, &emit)?;
    let _parser = sims_reviews::parse_guard()?;
    let report = inspect(path, id, selection, &mut work)?;
    work.done();
    Ok(report)
}
fn inspect(
    path: &str,
    id: &str,
    selection: Option<&PackSelection>,
    work: &mut store::progress::Work<'_>,
) -> Result<Report> {
    let started = Instant::now();
    let cancel = work.cancellation_check();
    let check = || {
        cancel()?;
        if started.elapsed() > Duration::from_secs(60) {
            Err("sims_limit")
        } else {
            Ok(())
        }
    };
    let folder = files::inventory_checked(path, &check)?;
    let (state, recovery) = store::snapshot(&folder.path)?;
    if recovery || folder.save_recovery {
        return Err("sims_recovery");
    }
    let (item, payload) = creation(Path::new(&folder.path), id, &check)?;
    let get = |extension: &str| {
        payload
            .iter()
            .find(|(s, _)| s.name.to_ascii_lowercase().ends_with(extension))
            .ok_or("sims_tray_set")
    };
    let (meta_stamp, metadata) = get(".trayitem")?;
    let identity = store::tray::format::identity(&meta_stamp.name)?;
    let identity = u64::from_str_radix(&identity[2..], 16).map_err(|_| "sims_tray_set")?;
    let query = match item.category.as_str() {
        "household" => query::Query::household(household::read(
            &get(".householdbinary")?.1,
            metadata,
            identity,
            &check,
        )?),
        "lot" | "room" => {
            let (extension, kind) = if item.category == "lot" {
                (".blueprint", build::Kind::Lot)
            } else {
                (".room", build::Kind::Room)
            };
            query::Query::build(build::read(
                &get(extension)?.1,
                metadata,
                identity,
                kind,
                &check,
            )?)
        }
        _ => return Err("sims_cc_unsupported"),
    };
    query.validate()?;
    let wanted = query.wanted();
    let mut report = Report {
        sims: query
            .sims
            .iter()
            .map(|s| Sim {
                id: s.id.clone(),
                name: s.name.clone(),
            })
            .collect(),
        objects: query.objects,
        references: query.references.len(),
        unresolved: query.references.len(),
        matches: vec![],
        checked_files: 0,
        indexed_resources: 0,
        partial: folder.partial,
        other_data: query.other_data,
        mods_enabled: folder.mods_enabled,
        resource_ready: folder.resource_ready,
        game: None,
        game_error: None,
        checked_at: 0,
    };
    let locals = local_files(&folder, &state, &check)?;
    let mut game_sources = Vec::new();
    if let Some(selection) = selection {
        match packs::inspect(
            &selection.path,
            &selection.custom,
            &launch::Environment::current(),
            work,
        ) {
            Ok(game) => {
                let (sources, partial) = game_files(Path::new(&game.path), &game, &check)?;
                game_sources = sources;
                report.partial |= partial || game.partial;
                report.game = Some(game);
            }
            Err(error @ ("sims_canceled" | "sims_limit")) => return Err(error),
            Err(error) => report.game_error = Some(error),
        }
    }
    let mut byte_budget = 256 * 1024 * 1024;
    let mut match_budget = 100_000usize;
    let mut present = BTreeSet::new();
    let mut locations = BTreeMap::<query::Reference, Vec<(usize, u32, bool)>>::new();
    for file in locals.iter().chain(&game_sources) {
        check()?;
        if byte_budget < 96 || report.matches.len() >= 512 || match_budget == 0 {
            report.partial = true;
            break;
        }
        if snapshot(file.source.clone())? != *file {
            return Err("sims_changed");
        }
        work.review_file(file.source.display.rsplit('/').next().ok_or("sims_path")?)?;
        let mut input = fs::File::open(&file.source.absolute).map_err(|_| "sims_read")?;
        let result = index::read_with_budget(&mut input, &wanted, &mut byte_budget, &check);
        check()?;
        let index = match result {
            Ok(v) => v,
            Err(error @ ("sims_canceled" | "sims_changed")) => return Err(error),
            Err(_) => {
                report.partial = true;
                continue;
            }
        };
        report.checked_files += 1;
        report.indexed_resources += u64::from(index.records);
        if index.matches.is_empty() {
            continue;
        }
        if index.matches.len() > match_budget {
            report.partial = true;
            break;
        }
        match_budget -= index.matches.len();
        let position = report.matches.len();
        let mut resources = BTreeSet::new();
        let mut sims = BTreeSet::new();
        let mut matched = false;
        for entry in &index.matches {
            for reference in query.matching(entry) {
                matched = true;
                locations.entry(reference).or_default().push((
                    position,
                    entry.group,
                    entry.deleted(),
                ));
                if entry.deleted() {
                    continue;
                }
                resources.insert(reference);
                sims.extend(query.references[&reference].iter().cloned());
                present.insert(reference);
            }
        }
        if !matched {
            continue;
        }
        report.matches.push(Match {
            path: file.source.display.clone(),
            area: file.source.area,
            title: file.source.title.clone(),
            pack: file.source.pack.clone(),
            pack_available: file
                .source
                .pack
                .as_deref()
                .and_then(|code| report.game.as_ref().and_then(|g| g.availability(code))),
            references: resources.len(),
            sims: sims.into_iter().collect(),
            // Only matching groups participate in priority uncertainty below.
            ambiguous: false,
        });
    }
    for positions in locations
        .values()
        .filter(|values| values.len() > 1 || values.iter().any(|v| v.2))
    {
        for (position, _, _) in positions {
            report.matches[*position].ambiguous = true;
        }
    }
    // Final snapshots include unindexed/skipped files: even an added source can
    // invalidate an earlier absence. No mutation or resource load-order guess.
    let after = files::inventory_checked(path, &check)?;
    let (after_state, recovery) = store::snapshot(&folder.path)?;
    if recovery
        || after_state.revision != state.revision
        || after.game_version != folder.game_version
        || after.mods_enabled != folder.mods_enabled
        || after.resource_ready != folder.resource_ready
        || local_files(&after, &after_state, &check)? != locals
    {
        return Err("sims_changed");
    }
    let (after_item, after_payload) = creation(Path::new(&folder.path), id, &check)?;
    if after_item != item || after_payload != payload {
        return Err("sims_changed");
    }
    if let Some(game) = &report.game {
        let selection = selection.ok_or("sims_changed")?;
        let after_packs = packs::inspect(
            &selection.path,
            &selection.custom,
            &launch::Environment::current(),
            work,
        )
        .map_err(|e| {
            if matches!(e, "sims_canceled" | "sims_limit") {
                e
            } else {
                "sims_changed"
            }
        })?;
        let pack_keys = |report: &packs::Report| {
            report
                .packs
                .iter()
                .map(|p| (p.code.clone(), p.status, p.files.clone()))
                .collect::<Vec<_>>()
        };
        if after_packs.path != game.path
            || after_packs.partial != game.partial
            || pack_keys(&after_packs) != pack_keys(game)
            || after_packs.launch.source != game.launch.source
            || after_packs.launch.state != game.launch.state
            || after_packs.launch.disabled != game.launch.disabled
        {
            return Err("sims_changed");
        }
        let (after, partial) = game_files(Path::new(&game.path), game, &check)?;
        if after != game_sources {
            return Err("sims_changed");
        }
        report.partial |= partial;
    }
    report.partial |= after.partial;
    report.unresolved = query.references.len() - present.len();
    report.checked_at = files::now();
    check()?;
    Ok(report)
}

#[cfg(test)]
#[path = "sims_cc_tests.rs"]
mod tests;
