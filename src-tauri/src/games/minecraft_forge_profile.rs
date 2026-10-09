use super::{
    minecraft_forge_data::{self as forge, Setup},
    minecraft_instances::Result,
    minecraft_runtime_data::{self as data, File, Runtime},
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

// A child profile replaces the matching artifact, not other classifiers such
// as OS-specific natives. Comparing file names would retain older versions.
fn identity(name: &str) -> Result<String> {
    forge::coordinate(name)?;
    let (name, extension) = name.split_once('@').unwrap_or((name, "jar"));
    let parts: Vec<_> = name.split(':').collect();
    Ok(format!(
        "{}:{}:{}@{}",
        parts[0],
        parts[1],
        parts.get(3).unwrap_or(&""),
        extension
    ))
}

pub fn apply(
    runtime: &mut Runtime,
    vanilla: &Value,
    setup: &Setup,
    os: &str,
    arch: &str,
    os_version: &str,
) -> Result<Vec<File>> {
    let expected = match runtime.loader.as_str() {
        "forge" => format!("{}-forge-{}", runtime.game, runtime.loader_version),
        "neoforge" => format!("neoforge-{}", runtime.loader_version),
        _ => return Err("runtime_loader"),
    };
    let profile = &setup.launch;
    if data::text(profile, "id")? != expected
        || data::text(profile, "inheritsFrom")? != runtime.game
        || data::text(vanilla, "id")? != runtime.game
    {
        return Err("instance_loader_version");
    }
    let main = data::text(profile, "mainClass")?;
    if ![
        "cpw.mods.bootstraplauncher.BootstrapLauncher",
        "cpw.mods.modlauncher.Launcher",
    ]
    .contains(&main)
    {
        return Err("runtime_loader");
    }
    let mut children = HashMap::new();
    let mut classpath = Vec::new();
    for library in profile["libraries"].as_array().ok_or("runtime_metadata")? {
        if !data::allowed(library, os, arch, os_version)? {
            continue;
        }
        let name = data::text(library, "name")?;
        let path = format!("libraries/{}", forge::coordinate(name)?);
        if children.insert(identity(name)?, path.clone()).is_some()
            || !setup.files.iter().any(|file| file.path == path)
        {
            return Err("runtime_metadata");
        }
        classpath.push(path);
    }
    let mut replaced = HashSet::new();
    for library in vanilla["libraries"].as_array().ok_or("runtime_metadata")? {
        if !data::allowed(library, os, arch, os_version)? {
            continue;
        }
        if children.contains_key(&identity(data::text(library, "name")?)?) {
            if let Some(path) = library["downloads"]["artifact"]["path"].as_str() {
                replaced.insert(format!("libraries/{path}"));
            }
        }
    }
    classpath.extend(
        runtime
            .classpath
            .iter()
            .filter(|path| !replaced.contains(*path))
            .cloned(),
    );
    let mut unique = HashSet::new();
    classpath.retain(|path| unique.insert(path.clone()));

    let mut jvm = data::arguments(&profile["arguments"]["jvm"], os, arch, os_version)?;
    for argument in &mut jvm {
        // Official launchers name the vanilla JAR after the version. Harbor's
        // verified input is client.jar; BootstrapLauncher must ignore it too.
        if argument.starts_with("-DignoreList=") {
            *argument = argument.replace("${version_name}.jar", "client.jar");
        }
    }
    if let Some(required) = profile.get("javaVersion") {
        let major = required["majorVersion"]
            .as_u64()
            .filter(|n| (8..=40).contains(n))
            .ok_or("runtime_metadata")?;
        runtime.java = runtime.java.max(major as u32);
    }
    let mut inputs = setup.files.clone();
    inputs.push(setup.installer.clone());
    inputs.push(
        runtime
            .files
            .iter()
            .find(|file| file.path == "client.jar")
            .cloned()
            .ok_or("runtime_metadata")?,
    );
    if let Some(path) = &setup.mappings {
        inputs.push(data::file(
            &vanilla["downloads"]["client_mappings"],
            path.clone(),
        )?);
    }
    runtime.files.extend(inputs.iter().cloned());
    runtime.classpath = classpath;
    runtime.version = expected;
    runtime.main = main.into();
    runtime.jvm.extend(jvm);
    runtime.args.extend(data::arguments(
        &profile["arguments"]["game"],
        os,
        arch,
        os_version,
    )?);
    data::validate(runtime)?;
    Ok(inputs)
}

#[cfg(test)]
mod tests {
    use super::super::{minecraft_instances::Instance, minecraft_launch_data as launch};
    use super::*;
    use std::{
        fs,
        path::{Path, PathBuf},
    };

    #[test]
    fn minecraft_forge_profile_override_identity_keeps_native_classifiers() {
        assert_eq!(
            identity("org.lwjgl:lwjgl:3.3.3").unwrap(),
            identity("org.lwjgl:lwjgl:3.3.4").unwrap()
        );
        assert_ne!(
            identity("org.lwjgl:lwjgl:3.3.4").unwrap(),
            identity("org.lwjgl:lwjgl:3.3.4:natives-windows").unwrap()
        );
        assert_ne!(
            identity("org.lwjgl:lwjgl:3.3.4").unwrap(),
            identity("org.lwjgl:lwjgl:3.3.4@zip").unwrap()
        );
        assert!(identity("org.lwjgl:../outside:3.3.4").is_err());
    }

    #[test]
    #[ignore = "Explicit opt-in: validates official installer and vanilla manifests without launching a game"]
    fn minecraft_forge_profiles_build_complete_launch_arguments_from_actual_manifests() {
        let root = PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_FIXTURES").unwrap());
        for (kind, game, version) in [
            ("forge", "1.20.1", "47.4.23"),
            ("neoforge", "1.21.1", "21.1.252"),
        ] {
            let metadata: Value = serde_json::from_slice(
                &fs::read(root.join(format!("{kind}-receipt.json"))).unwrap(),
            )
            .unwrap();
            let installer = File {
                path: format!("forge-installers/{kind}-{game}-{version}.jar"),
                url: metadata["url"].as_str().unwrap().into(),
                sha1: metadata["sha1"].as_str().unwrap().into(),
                size: metadata["size"].as_u64().unwrap(),
            };
            let setup = forge::parse(
                &fs::read(root.join(format!("{kind}-installer.jar"))).unwrap(),
                installer,
                game,
                kind,
                version,
            )
            .unwrap();
            let vanilla: Value = serde_json::from_slice(
                &fs::read(root.join(format!("{kind}-minecraft-version.json"))).unwrap(),
            )
            .unwrap();
            let instance = Instance {
                schema: 1,
                id: uuid::Uuid::new_v4().to_string(),
                owner: "test".into(),
                name: "Fixture".into(),
                game_version: game.into(),
                loader: kind.into(),
                loader_version: version.into(),
                created_at: 0,
                pack: None,
                files: 0,
                bytes: 0,
            };
            let mut runtime =
                data::base(&vanilla, &instance, "windows", "amd64", "10.0.26100").unwrap();
            let inputs = apply(
                &mut runtime,
                &vanilla,
                &setup,
                "windows",
                "amd64",
                "10.0.26100",
            )
            .unwrap();
            assert_eq!(runtime.main, "cpw.mods.bootstraplauncher.BootstrapLauncher");
            assert_eq!(inputs.iter().filter(|f| f.path == "client.jar").count(), 1);
            assert!(inputs.iter().all(|file| !file.path.starts_with("assets/")));
            assert!(setup
                .outputs
                .iter()
                .all(|output| !inputs.iter().any(|file| file.path == output.path)));
            assert!(runtime
                .jvm
                .iter()
                .any(|arg| arg.starts_with("-DignoreList=") && arg.contains("client.jar")));
            for library in setup.launch["libraries"].as_array().unwrap() {
                let child = format!(
                    "libraries/{}",
                    forge::coordinate(library["name"].as_str().unwrap()).unwrap()
                );
                assert_eq!(runtime.classpath.iter().filter(|p| **p == child).count(), 1);
                for parent in vanilla["libraries"].as_array().unwrap() {
                    if identity(parent["name"].as_str().unwrap()).unwrap()
                        == identity(library["name"].as_str().unwrap()).unwrap()
                    {
                        if let Some(path) = parent["downloads"]["artifact"]["path"].as_str() {
                            let inherited = format!("libraries/{path}");
                            if inherited != child {
                                assert!(!runtime.classpath.contains(&inherited));
                            }
                        }
                    }
                }
            }
            // A changed inherited version must be replaced, while similarly
            // prefixed group directories remain independent artifacts.
            if kind == "neoforge" {
                let mut older = vanilla.clone();
                let gson = older["libraries"]
                    .as_array_mut()
                    .unwrap()
                    .iter_mut()
                    .find(|lib| {
                        lib["name"]
                            .as_str()
                            .unwrap()
                            .starts_with("com.google.code.gson:gson:")
                    })
                    .unwrap();
                let older_name = "com.google.code.gson:gson:0.0.1";
                let older_path = forge::coordinate(older_name).unwrap();
                gson["name"] = Value::String(older_name.into());
                gson["downloads"]["artifact"]["path"] = Value::String(older_path.clone());
                gson["downloads"]["artifact"]["url"] =
                    Value::String(format!("https://libraries.minecraft.net/{older_path}"));
                let mut changed =
                    data::base(&older, &instance, "windows", "amd64", "10.0.26100").unwrap();
                let natives = changed.natives.clone();
                apply(
                    &mut changed,
                    &older,
                    &setup,
                    "windows",
                    "amd64",
                    "10.0.26100",
                )
                .unwrap();
                assert!(!changed
                    .classpath
                    .contains(&format!("libraries/{older_path}")));
                assert_eq!(changed.natives, natives);
            }
            let account = launch::Credentials {
                name: "TestPlayer".into(),
                uuid: uuid::Uuid::nil().to_string(),
                access: "argument-test-only".into(),
                client: uuid::Uuid::nil().to_string(),
                xuid: "0".into(),
            };
            let args = launch::arguments(
                &runtime,
                Path::new("fixture/game"),
                &uuid::Uuid::new_v4().to_string(),
                4096,
                &account,
            )
            .unwrap();
            assert!(args
                .jvm
                .iter()
                .chain(&args.game)
                .all(|arg| !arg.contains("${")));
            assert!(args
                .game
                .windows(2)
                .any(|pair| pair == ["--launchTarget", "forgeclient"]));
            assert!(args
                .jvm
                .iter()
                .any(|arg| arg == "-DlibraryDirectory=../.runtime/libraries"));
            let modules = args.jvm.windows(2).find(|pair| pair[0] == "-p").unwrap();
            for path in std::env::split_paths(&modules[1]) {
                let path = path.to_str().unwrap().strip_prefix("../.runtime/").unwrap();
                assert!(
                    runtime.files.iter().any(|file| file.path == path),
                    "Missing module {path}"
                );
            }
            let mut wrong = runtime.clone();
            wrong.loader_version = "0.0.0".into();
            assert!(apply(
                &mut wrong,
                &vanilla,
                &setup,
                "windows",
                "amd64",
                "10.0.26100"
            )
            .is_err());
        }
    }
}
