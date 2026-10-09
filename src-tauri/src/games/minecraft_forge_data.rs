use super::{minecraft_instances::{self as instances, Result}, minecraft_runtime_data as runtime};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::{collections::{BTreeMap, HashMap, HashSet}, io::{Cursor, Read}, path::Path};

pub const MAX_INSTALLER: usize = 32 * 1024 * 1024;
#[derive(Clone, Debug, PartialEq)]
pub enum Input { Text(String), Path(String) }
#[derive(Clone, Debug)]
pub struct Embedded { pub entry: String, pub path: String, pub sha1: String, pub size: u64 }
#[derive(Clone, Debug)]
pub struct Output { pub path: String, pub sha1: Option<String> }
#[derive(Clone, Debug)]
pub struct Processor { pub jar: String, pub classpath: Vec<String>, pub args: Vec<String>, pub outputs: Vec<Output> }
#[derive(Clone, Debug)]
pub struct Setup {
    pub installer: runtime::File, pub launch: Value, pub files: Vec<runtime::File>, pub embedded: Vec<Embedded>,
    pub inputs: BTreeMap<String, Input>, pub processors: Vec<Processor>, pub outputs: Vec<Output>, pub mappings: Option<String>,
}

pub fn coordinate(value: &str) -> Result<String> {
    let (name, extension) = value.split_once('@').unwrap_or((value, "jar"));
    if !["jar", "zip", "txt", "lzma"].contains(&extension) { return Err("runtime_metadata"); }
    let path = runtime::maven(name)?;
    Ok(format!("{}.{extension}", path.strip_suffix(".jar").ok_or("runtime_metadata")?))
}
fn library(value: &Value) -> Result<runtime::File> {
    let path = coordinate(runtime::text(value, "name")?)?;
    let artifact = &value["downloads"]["artifact"];
    if runtime::text(artifact, "path")? != path { return Err("runtime_metadata"); }
    let url = runtime::text(artifact, "url")?;
    if !["https://maven.minecraftforge.net/", "https://maven.neoforged.net/releases/", "https://libraries.minecraft.net/"].iter().any(|base| url == format!("{base}{path}")) { return Err("runtime_metadata"); }
    runtime::file(artifact, format!("libraries/{path}"))
}
fn entry(archive: &mut zip::ZipArchive<Cursor<&[u8]>>, name: &str, limit: usize) -> Result<Vec<u8>> {
    instances::relative(name)?;
    let mut file = archive.by_name(name).map_err(|_| "runtime_metadata")?;
    if file.is_dir() || file.size() > limit as u64 { return Err("runtime_limit"); }
    let size = file.size(); let mut bytes = Vec::new();
    (&mut file).take(limit as u64 + 1).read_to_end(&mut bytes).map_err(|_| "runtime_metadata")?;
    if bytes.len() as u64 != size { return Err("runtime_metadata"); } Ok(bytes)
}
fn literal(value: &str) -> Result<Input> {
    if value.starts_with('[') && value.ends_with(']') { return Ok(Input::Path(format!("libraries/{}", coordinate(&value[1..value.len()-1])?))); }
    if value.starts_with('\'') && value.ends_with('\'') && value.len() >= 2 {
        let text = &value[1..value.len()-1];
        if text.len() <= 256 && text.bytes().all(|v| v.is_ascii_alphanumeric() || b"._-+".contains(&v)) { return Ok(Input::Text(text.into())); }
    }
    Err("runtime_metadata")
}
pub fn expand(value: &str, inputs: &BTreeMap<String, Input>, root: &Path) -> Result<String> {
    if value.starts_with('[') && value.ends_with(']') {
        let Input::Path(path) = literal(value)? else { return Err("runtime_metadata"); };
        return root.join(instances::relative(&path)?).into_os_string().into_string().map_err(|_| "runtime_metadata");
    }
    if value.len() > 4096 || value.chars().any(char::is_control) { return Err("runtime_metadata"); }
    let mut result = String::new(); let mut tail = value;
    while let Some(start) = tail.find('{') {
        result.push_str(&tail[..start]); tail = &tail[start+1..]; let end = tail.find('}').ok_or("runtime_metadata")?;
        match inputs.get(&tail[..end]).ok_or("runtime_metadata")? {
            Input::Text(text) => result.push_str(text),
            Input::Path(path) => result.push_str(root.join(instances::relative(path)?).to_str().ok_or("runtime_metadata")?),
        }
        tail = &tail[end+1..];
    }
    if tail.contains('}') { return Err("runtime_metadata"); } result.push_str(tail);
    if result.len() > 32 * 1024 { return Err("runtime_limit"); } Ok(result)
}
fn output_path(value: &str, inputs: &BTreeMap<String, Input>) -> Result<String> {
    if value.starts_with('[') && value.ends_with(']') { let Input::Path(path) = literal(value)? else { return Err("runtime_metadata"); }; return Ok(path); }
    let name = value.strip_prefix('{').and_then(|v| v.strip_suffix('}')).ok_or("runtime_metadata")?;
    match inputs.get(name) { Some(Input::Path(path)) if path.starts_with("libraries/") => Ok(path.clone()), _ => Err("runtime_metadata") }
}
fn strings(value: &Value, limit: usize) -> Result<Vec<String>> {
    value.as_array().filter(|v| v.len() <= limit).ok_or("runtime_metadata")?.iter().map(|v| v.as_str().filter(|v| !v.is_empty() && v.len() <= 4096 && !v.chars().any(char::is_control)).map(str::to_owned).ok_or("runtime_metadata")).collect()
}

pub fn parse(bytes: &[u8], installer: runtime::File, game: &str, kind: &str, version: &str) -> Result<Setup> {
    if bytes.len() > MAX_INSTALLER || bytes.len() as u64 != installer.size || format!("{:x}", Sha1::digest(bytes)) != installer.sha1 { return Err("instance_integrity"); }
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "runtime_metadata")?;
    if archive.len() > 20_000 { return Err("runtime_limit"); }
    let mut entries = HashSet::new(); let mut total = 0_u64;
    for index in 0..archive.len() {
        let item = archive.by_index(index).map_err(|_| "runtime_metadata")?;
        let name = item.name().trim_end_matches('/'); instances::relative(name)?;
        if !entries.insert(name.to_ascii_lowercase()) || item.unix_mode().is_some_and(|v| ![0,0o100000,0o040000].contains(&(v & 0o170000))) { return Err("runtime_metadata"); }
        total = total.checked_add(item.size()).ok_or("runtime_limit")?;
        if item.size() > 128 * 1024 * 1024 || total > 256 * 1024 * 1024 { return Err("runtime_limit"); }
    }
    let profile: Value = serde_json::from_slice(&entry(&mut archive, "install_profile.json", 2*1024*1024)?).map_err(|_| "runtime_metadata")?;
    if profile["spec"].as_u64() != Some(1) { return Err("runtime_legacy"); }
    let identity = match kind { "forge" => format!("{game}-forge-{version}"), "neoforge" => format!("neoforge-{version}"), _ => return Err("runtime_loader") };
    if runtime::text(&profile,"minecraft")? != game || runtime::text(&profile,"version")? != identity { return Err("instance_loader_version"); }
    let launch: Value = serde_json::from_slice(&entry(&mut archive, runtime::text(&profile,"json")?.trim_start_matches('/'), 2*1024*1024)?).map_err(|_| "runtime_metadata")?;
    if runtime::text(&launch,"id")? != identity || runtime::text(&launch,"inheritsFrom")? != game || !["cpw.mods.bootstraplauncher.BootstrapLauncher", "cpw.mods.modlauncher.Launcher"].contains(&runtime::text(&launch,"mainClass")?) { return Err("runtime_loader"); }
    let mut files = Vec::new(); let mut known = HashMap::<String,(String,u64)>::new();
    for source in [&profile, &launch] {
        for value in source["libraries"].as_array().filter(|v| v.len()<=512).ok_or("runtime_metadata")? {
            let file = library(value)?; let key = file.path.to_ascii_lowercase();
            if let Some(previous) = known.get(&key) { if previous != &(file.sha1.clone(),file.size) { return Err("runtime_metadata"); } }
            else { known.insert(key,(file.sha1.clone(),file.size)); files.push(file); }
        }
    }
    let mut inputs = BTreeMap::new(); let mut embedded = Vec::new();
    for (key, value) in profile["data"].as_object().filter(|v|v.len()<=128).ok_or("runtime_metadata")? {
        if key.is_empty() || key.len()>64 || !key.bytes().all(|b|b.is_ascii_uppercase() || b.is_ascii_digit() || b==b'_') { return Err("runtime_metadata"); }
        let value = runtime::text(value,"client")?;
        let input = if let Some(name) = value.strip_prefix('/') {
            if !name.starts_with("data/") { return Err("runtime_metadata"); }
            let bytes = entry(&mut archive,name,128*1024*1024)?; let path = format!("forge-data/{name}");
            embedded.push(Embedded {entry:name.into(),path:path.clone(),size:bytes.len() as u64,sha1:format!("{:x}",Sha1::digest(&bytes))}); Input::Path(path)
        } else { literal(value)? };
        inputs.insert(key.clone(),input);
    }
    for (key, value) in [("SIDE",Input::Text("client".into())),("MINECRAFT_VERSION",Input::Text(game.into())),("MINECRAFT_JAR",Input::Path("client.jar".into())),("INSTALLER",Input::Path(installer.path.clone())),("LIBRARY_DIR",Input::Path("libraries".into()))] {
        if inputs.insert(key.into(),value).is_some() { return Err("runtime_metadata"); }
    }
    let mut processors = Vec::new(); let mut outputs = BTreeMap::<String, Option<String>>::new(); let mut mappings = None;
    for value in profile["processors"].as_array().filter(|v|v.len()<=64).ok_or("runtime_metadata")? {
        if let Some(sides)=value.get("sides") { let sides=strings(sides,2)?; if sides.iter().any(|s|s!="client"&&s!="server") { return Err("runtime_metadata"); } if !sides.iter().any(|s|s=="client") { continue; } }
        let jar = format!("libraries/{}",coordinate(runtime::text(value,"jar")?)?);
        let mut classpath = strings(&value["classpath"],128)?.into_iter().map(|name|coordinate(&name).map(|p|format!("libraries/{p}"))).collect::<Result<Vec<_>>>()?;
        classpath.insert(0,jar.clone()); let mut unique=HashSet::new();classpath.retain(|v|unique.insert(v.clone()));
        if classpath.iter().any(|v|!known.contains_key(&v.to_ascii_lowercase())) { return Err("runtime_metadata"); }
        if !jar.starts_with(if kind=="forge" {"libraries/net/minecraftforge/"} else {"libraries/net/neoforged/"}) { return Err("runtime_metadata"); }
        let args = strings(&value["args"],128)?;
        for arg in &args {
            if arg.contains("..") || arg.contains('\\') || arg.contains("://") || arg.starts_with('/') || arg.contains(':') && !arg.starts_with('[') { return Err("runtime_metadata"); }
            let _ = expand(arg,&inputs,Path::new("forge-preview"))?;
        }
        if args.get(0).map(String::as_str)==Some("--task") && args.get(1).map(String::as_str)==Some("DOWNLOAD_MOJMAPS") {
            if args.len()!=8 || args[2]!="--version" || args[3]!=game || args[4]!="--side" || args[5]!="{SIDE}" || args[6]!="--output" || mappings.is_some() { return Err("runtime_metadata"); }
            mappings=Some(output_path(&args[7],&inputs)?);continue;
        }
        let mut declared=BTreeMap::<String,Option<String>>::new();
        for pair in args.windows(2) { if ["--output","--slim","--extra"].contains(&pair[0].as_str()) { declared.insert(output_path(&pair[1],&inputs)?,None); } }
        if let Some(hashes)=value.get("outputs") { for (key,hash) in hashes.as_object().filter(|v|v.len()<=32).ok_or("runtime_metadata")? {
            let path=output_path(key,&inputs)?;let hash=expand(hash.as_str().ok_or("runtime_metadata")?,&inputs,Path::new("forge-preview"))?;
            if !runtime::digest(&hash) || !declared.contains_key(&path) { return Err("runtime_metadata"); }declared.insert(path,Some(hash.to_lowercase()));
        } }
        for (path,hash) in &mut declared {
            if known.contains_key(&path.to_ascii_lowercase()) { return Err("runtime_metadata"); }
            if hash.is_none() { for (key,input) in &inputs { if matches!(input,Input::Path(p) if p==path) { if let Some(Input::Text(checksum))=inputs.get(&format!("{key}_SHA")) { if !runtime::digest(checksum) {return Err("runtime_metadata");} *hash=Some(checksum.to_lowercase()); } } } }
            if let Some(previous)=outputs.insert(path.clone(),hash.clone()) { if previous!=*hash {return Err("runtime_metadata");} }
        }
        if declared.is_empty() { return Err("runtime_metadata"); }
        processors.push(Processor {jar,classpath,args,outputs:declared.into_iter().map(|(path,sha1)|Output{path,sha1}).collect()});
    }
    if processors.is_empty() || !inputs.get("PATCHED").is_some_and(|input|matches!(input,Input::Path(path) if outputs.contains_key(path))) {return Err("runtime_metadata");}
    Ok(Setup{installer,launch,files,embedded,inputs,processors,outputs:outputs.into_iter().map(|(path,sha1)|Output{path,sha1}).collect(),mappings})
}

pub fn embedded_bytes(installer: &[u8], file: &Embedded) -> Result<Vec<u8>> {
    let mut archive=zip::ZipArchive::new(Cursor::new(installer)).map_err(|_|"runtime_metadata")?;
    let bytes=entry(&mut archive,&file.entry,128*1024*1024)?;
    if bytes.len() as u64!=file.size || format!("{:x}",Sha1::digest(&bytes))!=file.sha1{return Err("instance_integrity");}Ok(bytes)
}
