use super::{minecraft_forge_data as data, minecraft_instances as instances, minecraft_instances::Result, minecraft_loader::Release, minecraft_runtime as runtime, minecraft_runtime_data::File};
use serde::Deserialize;
use serde_json::Value;
use sha1::{Digest,Sha1};
use std::{collections::HashSet, sync::atomic::AtomicBool};

pub fn installer_url(kind:&str,game:&str,version:&str)->Result<String>{
    if !instances::version(game)||!instances::version(version)||game.split('.').count()<2||game.split('.').any(|v|v.is_empty()||!v.bytes().all(|b|b.is_ascii_digit())){return Err("instance_loader_version");}
    order(version)?;
    match kind {
        "forge" => Ok(format!("https://maven.minecraftforge.net/net/minecraftforge/forge/{game}-{version}/forge-{game}-{version}-installer.jar")),
        "neoforge" => Ok(format!("https://maven.neoforged.net/releases/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar")),
        _=>Err("runtime_loader"),
    }
}
fn order(version:&str)->Result<(Vec<u32>,bool,String)>{
    let(core,pre)=version.split_once('-').unwrap_or((version,""));
    let numbers=core.split('.').map(str::parse::<u32>).collect::<std::result::Result<Vec<_>,_>>().map_err(|_|"instance_loader_version")?;
    if !(3..=4).contains(&numbers.len())||version.ends_with('-')||(!pre.is_empty()&&!pre.bytes().all(|c|c.is_ascii_alphanumeric()||b".-".contains(&c))){return Err("instance_loader_version");}
    Ok((numbers,pre.is_empty(),pre.into()))
}
pub fn forge_versions(value:&Value,game:&str)->Result<Vec<Release>>{
    let Some(versions)=value.get(game) else{return Ok(vec![])};
    let prefix=format!("{game}-");
    let values=versions.as_array().filter(|v|v.len()<=5000).ok_or("instance_loader_version")?;
    sorted(values.iter().map(|v|v.as_str().and_then(|v|v.strip_prefix(&prefix)).ok_or("instance_loader_version")).collect::<Result<Vec<_>>>()?)
}
fn sorted(values:Vec<&str>)->Result<Vec<Release>>{
    let mut known=HashSet::new();let mut releases=Vec::new();
    for version in values {if !instances::version(version){return Err("instance_loader_version");}let key=order(version)?;if known.insert(version){releases.push((key,Release{version:version.into(),stable:!version.contains('-')}));}}
    releases.sort_by(|a,b|b.0.cmp(&a.0));Ok(releases.into_iter().map(|(_,release)|release).collect())
}
#[derive(Deserialize)]struct Maven{versioning:MavenVersioning}
#[derive(Deserialize)]struct MavenVersioning{versions:MavenVersions}
#[derive(Deserialize)]struct MavenVersions{#[serde(rename="version")]values:Vec<String>}
pub fn neoforge_versions(xml:&str,game:&str)->Result<Vec<Release>>{
    if xml.len()>2*1024*1024||xml.contains("<!DOCTYPE")||xml.contains("<!ENTITY"){return Err("instance_loader_version");}
    let value:Maven=quick_xml::de::from_str(xml).map_err(|_|"instance_loader_version")?;
    if value.versioning.versions.values.len()>20000{return Err("instance_loader_version");}
    let game=game.strip_prefix("1.").unwrap_or(game);let prefix=if game.contains('.') {format!("{game}.")}else{format!("{game}.0.")};
    sorted(value.versioning.versions.values.iter().filter(|v|v.starts_with(&prefix)).map(String::as_str).collect())
}
pub async fn versions(kind:&str,game:&str,cancel:&AtomicBool)->Result<Vec<Release>>{
    if !instances::version(game){return Err("instance_request");}let client=runtime::client()?;
    match kind{
        "forge"=>{let body=runtime::bytes(&client,"https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json",2*1024*1024,cancel).await?;forge_versions(&serde_json::from_slice(&body).map_err(|_|"instance_loader_version")?,game)},
        "neoforge"=>{let body=runtime::bytes(&client,"https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml",2*1024*1024,cancel).await?;neoforge_versions(std::str::from_utf8(&body).map_err(|_|"instance_loader_version")?,game)},
        _=>Err("runtime_loader"),
    }
}
pub async fn prepare(kind:&str,game:&str,version:&str,cancel:&AtomicBool)->Result<data::Setup>{
    let url=installer_url(kind,game,version)?;let client=runtime::client()?;
    let checksum=runtime::bytes(&client,&format!("{url}.sha1"),256,cancel).await?;
    let checksum=std::str::from_utf8(&checksum).map_err(|_|"runtime_metadata")?.trim().to_lowercase();
    if !super::minecraft_runtime_data::digest(&checksum){return Err("runtime_metadata");}
    let bytes=runtime::bytes(&client,&url,data::MAX_INSTALLER,cancel).await?;
    if format!("{:x}",Sha1::digest(&bytes))!=checksum{return Err("instance_integrity");}
    let installer=File{path:format!("forge-installers/{kind}-{game}-{version}.jar"),url,sha1:checksum,size:bytes.len()as u64};
    data::parse(&bytes,installer,game,kind,version)
}

#[cfg(test)]
#[path="minecraft_forge_tests.rs"]
mod tests;
