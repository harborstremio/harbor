/// Optional developer build: separate application storage and temporary files,
/// without changing production command or file-access semantics.
fn is_review_identity(identifier: &str) -> bool {
    const BASE: &str = "app.harbor.context-review";
    identifier == BASE
        || identifier
            .strip_prefix(&format!("{BASE}."))
            .is_some_and(|suffix| {
                !suffix.is_empty()
                    && suffix.bytes().all(|byte| {
                        byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'
                    })
            })
}

pub fn prepare(config: &tauri::Config) -> Result<(), String> {
    if !cfg!(feature = "context-review") {
        return Ok(());
    }
    if !is_review_identity(&config.identifier)
        || config.product_name.as_deref() != Some("Harbor Context Review")
    {
        return Err("context-review requires tauri.context-review.conf.json".into());
    }
    let temp = std::env::temp_dir().join(&config.identifier);
    std::fs::create_dir_all(&temp)
        .map_err(|error| format!("Could not create review temporary directory: {error}"))?;
    for variable in ["TEMP", "TMP", "TMPDIR"] {
        std::env::set_var(variable, &temp);
    }
    Ok(())
}

pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("context-review")
        .js_init_script("Object.defineProperty(window, '__HARBOR_CONTEXT_REVIEW__', { value: true, writable: false, configurable: false });")
        .build()
}

#[cfg(test)]
mod tests {
    #[test]
    fn independent_review_runs_use_distinct_storage_without_production_identity() {
        for identifier in [
            "app.harbor.context-review",
            "app.harbor.context-review.run-1",
        ] {
            assert!(super::is_review_identity(identifier));
        }
        for identifier in [
            "app.harbor",
            "app.harbor.context-review.",
            "app.harbor.context-review/../harbor",
            "app.harbor.context-review.other/path",
        ] {
            assert!(!super::is_review_identity(identifier));
        }
    }

    #[test]
    fn review_build_cannot_use_production_identity() {
        if cfg!(feature = "context-review") {
            assert!(super::prepare(&tauri::Config::default()).is_err());
        }
    }
}
