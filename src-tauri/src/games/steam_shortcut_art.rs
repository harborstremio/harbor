//! Index each account's grid once; missing artwork must not cause dozens of file probes per game.
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

#[derive(Default)]
pub struct Grid(BTreeMap<String, PathBuf>);

impl Grid {
    pub fn read(root: &Path, account: u32) -> Self {
        let directory = root.join(format!("userdata/{account}/config/grid"));
        let Ok(entries) = fs::read_dir(directory) else {
            return Self::default();
        };
        let mut images = BTreeMap::new();
        for entry in entries.take(40_000).flatten() {
            let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if name.len() > 40 || !entry.file_type().is_ok_and(|kind| kind.is_file()) {
                continue;
            }
            let Some((stem, extension)) = name.rsplit_once('.') else {
                continue;
            };
            if !["png", "jpg", "jpeg", "webp"].contains(&extension) {
                continue;
            }
            let digits = stem
                .trim_end_matches("_hero")
                .trim_end_matches("_icon")
                .trim_end_matches('p');
            if digits.is_empty() || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
                continue;
            }
            images.entry(name).or_insert_with(|| entry.path());
        }
        Self(images)
    }

    pub fn candidates(&self, app_id: u32, run_id: u64, suffix: &str) -> Vec<PathBuf> {
        [app_id.to_string(), run_id.to_string()]
            .iter()
            .flat_map(|id| {
                ["png", "jpg", "jpeg", "webp"]
                    .iter()
                    .filter_map(move |ext| self.0.get(&format!("{id}{suffix}.{ext}")).cloned())
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    #[test]
    fn exact_account_ids_shapes_and_image_types_only() {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let root = std::env::temp_dir().join(format!(
            "harbor-shortcut-art-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        struct Cleanup(PathBuf);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        let _cleanup = Cleanup(root.clone());
        let folder = root.join("userdata/123/config/grid");
        fs::create_dir_all(&folder).unwrap();
        for name in [
            "2147483649.PNG",
            "2147483649p.jpg",
            "9223372041183297536_hero.webp",
            "2147483649_icon.jpeg",
            "21474836490.png",
            "unrelated.png",
            "2147483649.exe",
            "2147483649_logo.png",
        ] {
            fs::write(folder.join(name), b"fixture").unwrap();
        }
        fs::create_dir(folder.join("2147483649_hero.png")).unwrap();
        let grid = Grid::read(&root, 123);
        assert_eq!(
            grid.candidates(2147483649, 9223372041183297536, "").len(),
            1
        );
        assert!(grid.candidates(2147483649, 9223372041183297536, "")[0].ends_with("2147483649.PNG"));
        assert_eq!(
            grid.candidates(2147483649, 9223372041183297536, "p").len(),
            1
        );
        assert!(grid.candidates(2147483649, 9223372041183297536, "_hero")[0]
            .ends_with("9223372041183297536_hero.webp"));
        assert_eq!(
            grid.candidates(2147483649, 9223372041183297536, "_icon")
                .len(),
            1
        );
        assert!(Grid::read(&root, 456)
            .candidates(2147483649, 9223372041183297536, "")
            .is_empty());
        assert!(grid
            .candidates(2147483648, 9223372041183297535, "")
            .is_empty());
        assert!(grid
            .candidates(2147483649, 9223372041183297536, "_logo")
            .is_empty());
        // Candidate lookups use only the snapshot, even after the source folder disappears.
        fs::remove_dir_all(&folder).unwrap();
        assert_eq!(
            grid.candidates(2147483649, 9223372041183297536, "").len(),
            1
        );
    }
}
