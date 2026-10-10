use super::steam_shortcuts::Shortcut;
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::PathBuf,
};

pub fn candidates(game: &Shortcut) -> Vec<(PathBuf, i32)> {
    let value = game.icon.trim();
    let (value, index) = value
        .rsplit_once(',')
        .and_then(|(path, index)| index.trim().parse::<i32>().ok().map(|index| (path, index)))
        .unwrap_or((value, 0));
    let value = value.trim().trim_matches('"');
    let path = PathBuf::from(value);
    let mut paths = Vec::new();
    if path.is_absolute() && !value.contains('"') && !value.chars().any(char::is_control) {
        paths.push((path, index));
    }
    if let Some(path) = game.executable_path() {
        if !paths.contains(&(path.clone(), 0)) {
            paths.push((path, 0));
        }
    }
    paths
}

/// File versions keep a replaced/missing icon from sticking in the frontend cache.
pub fn key(game: &Shortcut) -> String {
    let mut key = DefaultHasher::new();
    game.id().hash(&mut key);
    for (path, index) in candidates(game) {
        path.hash(&mut key);
        index.hash(&mut key);
        if let Ok(metadata) = fs::metadata(&path) {
            metadata.len().hash(&mut key);
            metadata.modified().ok().hash(&mut key);
        }
    }
    format!("{:016x}", key.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn game() -> Shortcut {
        Shortcut {
            account_id: 123,
            app_id: 0x87654321,
            name: "Test".into(),
            executable: format!("\"{}\"", std::env::current_exe().unwrap().display()),
            start_directory: String::new(),
            launch_options: String::new(),
            icon: String::new(),
            hidden: false,
            last_played: 0,
            tags: Vec::new(),
        }
    }
    #[test]
    fn original_resource_index_and_executable_fallback_are_distinct() {
        let mut game = game();
        let executable = game.executable_path().unwrap();
        game.icon = format!("\"{}\",-42", executable.display());
        assert_eq!(
            candidates(&game),
            vec![(executable.clone(), -42), (executable.clone(), 0)]
        );
        let indexed = key(&game);
        game.icon = format!("\"{}\",0", executable.display());
        assert_eq!(candidates(&game), vec![(executable, 0)]);
        assert_ne!(indexed, key(&game));
        game.icon = "https://example.com/icon.ico".into();
        assert_eq!(candidates(&game).len(), 1);
        game.icon = "relative.ico".into();
        assert_eq!(candidates(&game).len(), 1);
    }
    #[test]
    fn file_replacement_changes_key_even_for_a_previous_miss() {
        let path =
            std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir)
                .join(format!("shortcut-icon-{}-test.ico", std::process::id()));
        let mut game = game();
        game.icon = path.to_string_lossy().into_owned();
        let absent = key(&game);
        fs::write(&path, b"first").unwrap();
        let first = key(&game);
        fs::write(&path, b"replacement").unwrap();
        assert_ne!(first, key(&game));
        assert_ne!(absent, first);
        fs::remove_file(path).unwrap();
        assert_eq!(absent, key(&game));
    }
}
