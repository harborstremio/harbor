//! A small, explicitly selected starter shelf, not a popularity ranking.
//! A manifest ID can name translations/reuploads too: never infer an original
//! project from the first entry in the dataset's ID index.
use super::{
    stardew_manifest::Result,
    stardew_progress::{Progress, Work},
    stardew_remote as remote,
};
use serde::Serialize;
use serde_json::Value;
use std::{
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

struct Seed {
    id: &'static str,
    page: u64,
}
const SEEDS: &[Seed] = &[
    Seed {
        id: "Annosz.UiInfoSuite2",
        page: 7098,
    },
    Seed {
        id: "Pathoschild.Automate",
        page: 1063,
    },
    Seed {
        id: "Pathoschild.LookupAnything",
        page: 541,
    },
    Seed {
        id: "Bouhm.NPCMapLocations",
        page: 239,
    },
    Seed {
        id: "spacechase0.GenericModConfigMenu",
        page: 5098,
    },
    Seed {
        id: "Pathoschild.ContentPatcher",
        page: 1915,
    },
];
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub url: String,
    pub version: String,
    pub updated: String,
    pub creator: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub projects: Vec<Project>,
    pub snapshot: String,
    pub commit: String,
    pub observed_at: u64,
    pub unavailable: usize,
    pub stale: bool,
}
fn cache() -> &'static Mutex<Option<(Instant, Catalog)>> {
    static CACHE: OnceLock<Mutex<Option<(Instant, Catalog)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}
fn project(seed: &Seed, data: &Value) -> Result<Project> {
    if data["Site"] != "Nexus" || data["Id"].as_u64() != Some(seed.page) {
        return Err("stardew_catalog_response");
    }
    let url = format!("https://www.nexusmods.com/stardewvalley/mods/{}", seed.page);
    if data["PageUrl"] != url {
        return Err("stardew_catalog_response");
    }
    // Only use the description belonging to this exact manifest. File order is
    // not release order (old Android versions also appear as 'Main').
    let mut manifests = Vec::new();
    for file in data["Downloads"]
        .as_array()
        .ok_or("stardew_catalog_response")?
    {
        if let Some(mods) = file["Mods"].as_array() {
            for item in mods {
                if item["Id"]
                    .as_str()
                    .is_some_and(|id| id.eq_ignore_ascii_case(seed.id))
                {
                    if let Ok(description) = remote::text(&item["Manifest"], "Description", 2000) {
                        manifests.push((file["Uploaded"].as_str().unwrap_or(""), description));
                    }
                }
            }
        }
    }
    manifests.sort_by(|a, b| b.0.cmp(a.0));
    let description = manifests
        .into_iter()
        .next()
        .ok_or("stardew_catalog_response")?
        .1;
    Ok(Project {
        id: seed.id.into(),
        name: remote::text(data, "Name", 180)?,
        author: remote::text(data, "Author", 180)?,
        description: description.chars().take(300).collect(),
        url,
        version: remote::text(data, "Version", 80)?,
        updated: remote::text(data, "Updated", 80)?,
        creator: seed.id == "Annosz.UiInfoSuite2",
    })
}
async fn fetch(work: &Work<'_>) -> Result<Catalog> {
    let client = remote::client()?;
    let commit = remote::json(&client, "https://api.github.com/repos/Pathoschild/StardewModDataset/commits?path=dataset&per_page=1", work).await?;
    let commit = commit
        .as_array()
        .and_then(|v| v.first())
        .ok_or("stardew_catalog_response")?;
    let sha = remote::text(commit, "sha", 40)?;
    if sha.len() != 40 || !sha.bytes().all(|v| v.is_ascii_hexdigit()) {
        return Err("stardew_catalog_response");
    }
    let snapshot = remote::text(&commit["commit"]["committer"], "date", 80)?;
    let mut projects = Vec::new();
    for seed in SEEDS {
        work.progress("catalog", projects.len(), SEEDS.len())?;
        let url = format!("https://raw.githubusercontent.com/Pathoschild/StardewModDataset/{sha}/dataset/data/Nexus/{}/{}.json", seed.page / 1000, seed.page);
        match remote::json(&client, &url, work)
            .await
            .and_then(|data| project(seed, &data))
        {
            Ok(value) => projects.push(value),
            Err("stardew_canceled" | "stardew_timeout") => {
                work.check()?;
                return Err("stardew_canceled");
            }
            Err(_) => {}
        }
    }
    work.check()?;
    if projects.is_empty() {
        return Err("stardew_catalog_network");
    }
    Ok(Catalog {
        unavailable: SEEDS.len() - projects.len(),
        projects,
        snapshot,
        commit: sha,
        observed_at: remote::now(),
        stale: false,
    })
}
pub async fn load(
    profile: &str,
    operation: &str,
    refresh: bool,
    emit: &dyn Fn(Progress),
) -> Result<Catalog> {
    let work = Work::start(profile, operation, emit)?;
    work.progress("catalog", 0, SEEDS.len())?;
    let previous = cache().lock().map_err(|_| "stardew_busy")?.clone();
    if !refresh {
        if let Some((since, value)) = &previous {
            if since.elapsed() < Duration::from_secs(6 * 3600) {
                return Ok(value.clone());
            }
        }
    }
    match fetch(&work).await {
        Ok(value) => {
            *cache().lock().map_err(|_| "stardew_busy")? = Some((Instant::now(), value.clone()));
            Ok(value)
        }
        Err(e @ ("stardew_canceled" | "stardew_timeout")) => Err(e),
        Err(e) => {
            if let Some((_, mut value)) = previous {
                value.stale = true;
                Ok(value)
            } else {
                Err(e)
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stardew_catalog_pins_original_and_exact_manifest() {
        let mut data = serde_json::json!({"Site":"Nexus","Id":7098,"Name":"UI Info Suite 2","Author":"Annosz","Version":"2.3.7","Updated":"2024-11-12","PageUrl":"https://www.nexusmods.com/stardewvalley/mods/7098","Downloads":[{"Uploaded":"2026","Mods":[{"Id":"different.translation","Manifest":{"Description":"Wrong description"}}]},{"Uploaded":"2024","Mods":[{"Id":"Annosz.UiInfoSuite2","Manifest":{"Description":"The original description"}}]}]});
        assert_eq!(
            project(&SEEDS[0], &data).unwrap().description,
            "The original description"
        );
        data["Id"] = 13389.into();
        assert!(project(&SEEDS[0], &data).is_err());
        data["Id"] = 7098.into();
        data["PageUrl"] = "https://example.org/".into();
        assert!(project(&SEEDS[0], &data).is_err());
    }
}
