pub fn is_editing_command(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    matches!(
        name.as_str(),
        "undo"
            | "redo"
            | "cut"
            | "copy"
            | "paste"
            | "pasteandmatchstyle"
            | "pasteasplaintext"
            | "selectall"
            | "delete"
            | "addtodictionary"
            | "ignorespelling"
            | "spellcheck"
            | "writingdirection"
            | "emojis"
            | "emoji"
    ) || name.starts_with("spellingsuggestion")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keeps_editor_commands_but_never_browser_navigation_or_image_commands() {
        for name in [
            "undo",
            "redo",
            "cut",
            "copy",
            "paste",
            "pasteAndMatchStyle",
            "selectAll",
            "spellingSuggestion1",
            "addToDictionary",
        ] {
            assert!(is_editing_command(name), "{name}");
        }
        for name in [
            "back",
            "forward",
            "reload",
            "inspectElement",
            "saveAs",
            "copyImage",
            "searchWeb",
            "share",
            "unknownFutureBrowserAction",
        ] {
            assert!(!is_editing_command(name), "{name}");
        }
    }
}
