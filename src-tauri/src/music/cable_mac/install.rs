use std::path::{Path, PathBuf};

pub(super) const DRIVER_BUNDLE: &str = "HarborVirtualMic.driver";
pub(super) const HAL_DIR: &str = "/Library/Audio/Plug-Ins/HAL";
const VERSION_KEY: &str = "<key>CFBundleShortVersionString</key>";
const DRIVER_ENV: &str = "HARBOR_VIRTUAL_MIC_DRIVER";

pub(super) fn installed_path() -> PathBuf {
    PathBuf::from(format!("{HAL_DIR}/{DRIVER_BUNDLE}"))
}

fn plist_version(bundle: &Path) -> Option<String> {
    let text = std::fs::read_to_string(bundle.join("Contents").join("Info.plist")).ok()?;
    let after = text.split_once(VERSION_KEY)?.1;
    let opened = after.split_once("<string>")?.1;
    let value = opened.split_once("</string>")?.0.trim();
    (!value.is_empty()).then(|| value.to_string())
}

pub(super) fn installed_version() -> Option<String> {
    plist_version(&installed_path())
}

fn candidates() -> Vec<PathBuf> {
    let mut found = Vec::new();
    if let Ok(custom) = std::env::var(DRIVER_ENV) {
        if !custom.trim().is_empty() {
            found.push(PathBuf::from(custom.trim()));
        }
    }
    let Ok(exe) = std::env::current_exe() else {
        return found;
    };
    let Some(dir) = exe.parent() else {
        return found;
    };
    found.push(dir.join(DRIVER_BUNDLE));
    if let Some(contents) = dir.parent() {
        found.push(contents.join("Resources").join(DRIVER_BUNDLE));
    }
    for ancestor in dir.ancestors().take(6) {
        found.push(
            ancestor
                .join("harbor-audio-plugin")
                .join("build")
                .join(DRIVER_BUNDLE),
        );
    }
    found
}

pub(super) fn bundled() -> Option<PathBuf> {
    candidates()
        .into_iter()
        .find(|path| path.join("Contents").join("Info.plist").is_file())
}

pub(super) fn bundled_version() -> Option<String> {
    plist_version(&bundled()?)
}

fn shell_quote(path: &Path) -> Result<String, String> {
    let text = path.to_str().ok_or("music.cable.mac.installMissing")?;
    if text.contains('\'') || text.contains('\n') {
        return Err("music.cable.mac.installMissing".to_string());
    }
    Ok(format!("'{text}'"))
}

fn applescript_quote(command: &str) -> String {
    command.replace('\\', "\\\\").replace('"', "\\\"")
}

pub(super) fn install_command(source: &Path) -> Result<String, String> {
    let from = shell_quote(source)?;
    let to = shell_quote(&installed_path())?;
    Ok(format!(
        "/bin/mkdir -p '{HAL_DIR}' && /bin/rm -rf {to} && /bin/cp -R {from} {to} && \
         /usr/sbin/chown -R root:wheel {to} && /bin/chmod -R go-w {to} && \
         /bin/chmod -R a+rX {to} && (/usr/bin/killall coreaudiod || true)"
    ))
}

pub(super) fn uninstall_command() -> Result<String, String> {
    let to = shell_quote(&installed_path())?;
    Ok(format!(
        "/bin/rm -rf {to} && (/usr/bin/killall coreaudiod || true)"
    ))
}

async fn run_privileged(command: &str, prompt: &str) -> Result<(), String> {
    let script = format!(
        "do shell script \"{}\" with prompt \"{}\" with administrator privileges",
        applescript_quote(command),
        applescript_quote(prompt)
    );
    let output = tokio::process::Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(script)
        .output()
        .await
        .map_err(|error| format!("osascript: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let message = String::from_utf8_lossy(&output.stderr);
    if message.contains("-128") || message.contains("User canceled") {
        return Err("music.cable.mac.installCancelled".to_string());
    }
    let trimmed = message.trim();
    Err(if trimmed.is_empty() {
        "music.cable.mac.installFailed".to_string()
    } else {
        trimmed.to_string()
    })
}

pub(super) async fn install() -> Result<(), String> {
    let source = bundled().ok_or("music.cable.mac.installMissing")?;
    let command = install_command(&source)?;
    run_privileged(
        &command,
        concat!(
            crate::product_name!(),
            " needs administrator access to install its virtual microphone into /Library/Audio/Plug-Ins/HAL and restart Core Audio.",
        ),
    )
    .await
}

pub(super) async fn uninstall() -> Result<(), String> {
    let command = uninstall_command()?;
    run_privileged(
        &command,
        concat!(
            crate::product_name!(),
            " needs administrator access to remove its virtual microphone from /Library/Audio/Plug-Ins/HAL and restart Core Audio.",
        ),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_command_quotes_the_source_and_restarts_core_audio() {
        let command = install_command(Path::new(
            "/Applications/Harbor.app/Contents/Resources/HarborVirtualMic.driver",
        ))
        .expect("quotable path");
        assert!(command
            .contains("'/Applications/Harbor.app/Contents/Resources/HarborVirtualMic.driver'"));
        assert!(command.contains("'/Library/Audio/Plug-Ins/HAL/HarborVirtualMic.driver'"));
        assert!(command.contains("killall coreaudiod"));
    }

    #[test]
    fn a_path_that_could_break_out_of_the_quotes_is_refused() {
        assert!(install_command(Path::new("/tmp/ev'il.driver")).is_err());
    }

    #[test]
    fn applescript_quoting_escapes_backslashes_before_quotes() {
        assert_eq!(applescript_quote("a\\b\"c"), "a\\\\b\\\"c");
    }
}
