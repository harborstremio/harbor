//! User-initiated Windows shortcuts. No shell evaluation, game launch, or existing link replacement.
use super::custom_launch::{self, LaunchConfig};
use serde::Serialize;

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shortcuts {
    pub desktop: Option<String>,
    pub start_menu: Option<String>,
}

pub fn inspect_or_create(
    id: String,
    name: String,
    config: LaunchConfig,
    target: Option<String>,
) -> Result<Shortcuts, &'static str> {
    if uuid::Uuid::parse_str(&id).is_err() || name.trim().is_empty() || name.len() > 640 {
        return Err("shortcut_invalid");
    }
    if target
        .as_deref()
        .is_some_and(|value| !["desktop", "startMenu"].contains(&value))
    {
        return Err("shortcut_invalid");
    }
    let config = custom_launch::validate(config)?;
    #[cfg(windows)]
    {
        windows_links::run(&id, &name, &config, target.as_deref())
    }
    #[cfg(not(windows))]
    {
        let _ = (id, name, config, target);
        Err("shortcut_platform")
    }
}

#[cfg(windows)]
#[path = "game_shortcuts_windows.rs"]
mod windows_links;
