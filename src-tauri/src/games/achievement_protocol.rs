use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub type Result<T> = std::result::Result<T, &'static str>;
pub const MAX_CHANGES: usize = 2000;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub locked_icon: String,
    pub hidden: bool,
    pub unlocked: bool,
    pub unlocked_at: u32,
    pub editable: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub app_id: u32,
    pub steam_id: String,
    pub items: Vec<Achievement>,
    pub updated_at: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Change {
    pub id: String,
    pub unlocked: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExpectedChange {
    pub id: String,
    pub before: bool,
    pub after: bool,
}
#[derive(Serialize, Deserialize)]
#[serde(tag = "operation", rename_all = "camelCase", deny_unknown_fields)]
pub enum Request {
    Read {
        #[serde(rename = "appId")]
        app_id: u32,
    },
    Apply {
        #[serde(rename = "appId")]
        app_id: u32,
        #[serde(rename = "steamId")]
        steam_id: String,
        changes: Vec<ExpectedChange>,
    },
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeResult {
    pub id: String,
    pub requested: bool,
    pub actual: Option<bool>,
    pub verified: bool,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Applied {
    pub snapshot: Option<Snapshot>,
    pub results: Vec<ChangeResult>,
    pub confirmed: bool,
    pub error: Option<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum Response {
    Snapshot(Snapshot),
    Applied(Applied),
    Error(String),
}

/// Turn UI choices into a trusted plan using the server-held snapshot, never supplied before-state.
pub fn plan(snapshot: &Snapshot, choices: Vec<Change>) -> Result<Vec<ExpectedChange>> {
    if choices.is_empty() || choices.len() > MAX_CHANGES {
        return Err("achievement_invalid_changes");
    }
    let mut seen = HashSet::new();
    choices
        .into_iter()
        .map(|choice| {
            if !seen.insert(choice.id.clone()) {
                return Err("achievement_invalid_changes");
            }
            let item = snapshot
                .items
                .iter()
                .find(|item| item.id == choice.id)
                .ok_or("achievement_unknown")?;
            if !item.editable {
                return Err("achievement_protected");
            }
            if item.unlocked == choice.unlocked {
                return Err("achievement_unchanged");
            }
            Ok(ExpectedChange {
                id: item.id.clone(),
                before: item.unlocked,
                after: choice.unlocked,
            })
        })
        .collect()
}
#[cfg(any(all(target_os = "windows", target_arch = "x86_64"), test))]
pub trait Client {
    fn snapshot(&mut self) -> Result<Snapshot>;
    fn same_account(&self, steam_id: &str) -> bool;
    fn set(&mut self, id: &str, unlocked: bool) -> bool;
    fn store(&mut self) -> Result<()>;
}
/// Revalidate the whole plan before the first write. Individual API refusal is reported, never hidden.
#[cfg(any(all(target_os = "windows", target_arch = "x86_64"), test))]
pub fn apply(
    client: &mut impl Client,
    app_id: u32,
    steam_id: &str,
    changes: &[ExpectedChange],
) -> Result<Applied> {
    if changes.is_empty() || changes.len() > MAX_CHANGES {
        return Err("achievement_invalid_changes");
    }
    let fresh = client.snapshot()?;
    if fresh.app_id != app_id || fresh.steam_id != steam_id || !client.same_account(steam_id) {
        return Err("achievement_account_changed");
    }
    let choices = changes
        .iter()
        .map(|c| Change {
            id: c.id.clone(),
            unlocked: c.after,
        })
        .collect();
    let validated = plan(&fresh, choices)?;
    if validated
        .iter()
        .zip(changes)
        .any(|(current, expected)| current.before != expected.before)
    {
        return Err("achievement_state_changed");
    }
    let mut accepted = HashSet::new();
    let mut error = None;
    for change in changes {
        if !client.same_account(steam_id) {
            error = Some("achievement_account_changed");
            break;
        }
        if client.set(&change.id, change.after) {
            accepted.insert(change.id.clone());
        }
    }
    let mut confirmed = false;
    if !accepted.is_empty() && error.is_none() {
        match client.store() {
            Ok(()) => confirmed = true,
            Err(e) => error = Some(e),
        }
    }
    let snapshot = if client.same_account(steam_id) {
        client
            .snapshot()
            .ok()
            .filter(|s| s.steam_id == steam_id && s.app_id == app_id)
    } else {
        None
    };
    if snapshot.is_none() {
        confirmed = false;
        error = Some("achievement_apply_uncertain");
    }
    let results = changes
        .iter()
        .map(|c| {
            let actual = snapshot
                .as_ref()
                .and_then(|s| s.items.iter().find(|i| i.id == c.id))
                .map(|i| i.unlocked);
            ChangeResult {
                id: c.id.clone(),
                requested: c.after,
                actual,
                verified: confirmed && accepted.contains(&c.id) && actual == Some(c.after),
            }
        })
        .collect();
    Ok(Applied {
        snapshot,
        results,
        confirmed,
        error: error.map(str::to_owned),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fake {
        state: Snapshot,
        sets: usize,
        stores: usize,
        refuse: bool,
        lose_callback: bool,
    }
    impl Client for Fake {
        fn snapshot(&mut self) -> Result<Snapshot> {
            Ok(self.state.clone())
        }
        fn same_account(&self, id: &str) -> bool {
            id == self.state.steam_id
        }
        fn set(&mut self, id: &str, value: bool) -> bool {
            self.sets += 1;
            if self.refuse {
                return false;
            }
            self.state
                .items
                .iter_mut()
                .find(|i| i.id == id)
                .unwrap()
                .unlocked = value;
            true
        }
        fn store(&mut self) -> Result<()> {
            self.stores += 1;
            if self.lose_callback {
                Err("achievement_apply_uncertain")
            } else {
                Ok(())
            }
        }
    }
    fn fake() -> Fake {
        Fake {
            state: Snapshot {
                app_id: 123,
                steam_id: "account".into(),
                updated_at: 0,
                items: vec![Achievement {
                    id: "A".into(),
                    name: "A".into(),
                    description: String::new(),
                    icon: String::new(),
                    locked_icon: String::new(),
                    hidden: false,
                    unlocked: false,
                    unlocked_at: 0,
                    editable: true,
                }],
            },
            sets: 0,
            stores: 0,
            refuse: false,
            lose_callback: false,
        }
    }
    fn changes() -> Vec<ExpectedChange> {
        vec![ExpectedChange {
            id: "A".into(),
            before: false,
            after: true,
        }]
    }
    #[test]
    fn wrong_account_game_protected_unknown_and_stale_never_write() {
        let mut f = fake();
        assert!(apply(&mut f, 123, "other", &changes()).is_err());
        assert!(apply(&mut f, 456, "account", &changes()).is_err());
        f.state.items[0].editable = false;
        assert!(apply(&mut f, 123, "account", &changes()).is_err());
        f.state.items[0].editable = true;
        f.state.items[0].unlocked = true;
        assert!(apply(&mut f, 123, "account", &changes()).is_err());
        f.state.items.clear();
        assert!(apply(&mut f, 123, "account", &changes()).is_err());
        assert_eq!(f.sets, 0);
        assert_eq!(f.stores, 0);
    }
    #[test]
    fn duplicate_and_oversized_plans_never_write() {
        let mut f = fake();
        assert!(apply(
            &mut f,
            123,
            "account",
            &[changes()[0].clone(), changes()[0].clone()]
        )
        .is_err());
        assert!(apply(
            &mut f,
            123,
            "account",
            &vec![changes()[0].clone(); MAX_CHANGES + 1]
        )
        .is_err());
        assert_eq!(f.sets, 0);
    }
    #[test]
    fn bulk_commit_revalidates_every_achievement_and_stores_once() {
        let mut f = fake();
        let template = f.state.items[0].clone();
        f.state.items = (0..MAX_CHANGES)
            .map(|i| {
                let mut item = template.clone();
                item.id = format!("A{i}");
                item
            })
            .collect();
        let choices = f
            .state
            .items
            .iter()
            .map(|item| Change {
                id: item.id.clone(),
                unlocked: true,
            })
            .collect();
        let planned = plan(&f.state, choices).unwrap();
        let result = apply(&mut f, 123, "account", &planned).unwrap();
        assert_eq!(f.sets, MAX_CHANGES);
        assert_eq!(f.stores, 1);
        assert_eq!(result.results.len(), MAX_CHANGES);
        assert!(result.results.iter().all(|item| item.verified));
        for item in &mut f.state.items {
            item.unlocked = false;
        }
        f.state.items[MAX_CHANGES - 1].editable = false;
        f.sets = 0;
        f.stores = 0;
        assert!(apply(&mut f, 123, "account", &planned).is_err());
        assert_eq!(f.sets, 0);
        assert_eq!(f.stores, 0);
    }
    #[test]
    fn success_requires_store_confirmation_and_actual_state() {
        let mut f = fake();
        let result = apply(&mut f, 123, "account", &changes()).unwrap();
        assert!(result.results[0].verified);
        assert_eq!(f.stores, 1);
        let mut f = fake();
        f.lose_callback = true;
        let result = apply(&mut f, 123, "account", &changes()).unwrap();
        assert!(!result.confirmed);
        assert!(!result.results[0].verified);
        let mut f = fake();
        f.refuse = true;
        let result = apply(&mut f, 123, "account", &changes()).unwrap();
        assert!(!result.results[0].verified);
        assert_eq!(f.stores, 0);
    }
}
