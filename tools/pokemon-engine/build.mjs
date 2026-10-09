// Build the separately licensed engine from immutable source revisions.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const fetchSource = argument("--fetch-source");
const source = argument("--source") || fetchSource, output = argument("--output"), sdk = argument("--dotnet") || "dotnet";
const rid = argument("--rid") || ({win32:"win",darwin:"osx",linux:"linux"}[process.platform] + "-" + ({x64:"x64",arm64:"arm64"}[process.arch]));
if (!source || !output || !/^(win|linux|osx)-(x64|arm64)$/.test(rid)) throw Error("Use --source <PKForge checkout> --output <engine directory> [--dotnet <SDK executable>] [--rid win-x64|linux-x64|linux-arm64|osx-x64|osx-arm64]");
const lock = JSON.parse(await readFile(resolve(here,"upstream.json"),"utf8"));
function run(command,args,cwd, capture=false) { return new Promise((yes,no) => { const child=spawn(command,args,{cwd,windowsHide:true,stdio: capture ? ["ignore","pipe","inherit"] : "inherit",env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:"1"}});let text="";child.stdout?.on("data",chunk=>text+=chunk);child.on("error",no);child.on("close",code=>code===0?yes(text.trim()):no(Error(`${command} failed (${code})`))); }); }
if (fetchSource) {
 let exists=true;try{await access(source)}catch{exists=false}
 if(!exists){
  await mkdir(source,{recursive:true});
  await run("git",["init"],source);
  await run("git",["remote","add","origin",lock.pkforge.url],source);
  await run("git",["fetch","--depth=1","origin",lock.pkforge.commit],source);
  await run("git",["checkout","--detach","FETCH_HEAD"],source);
  await run("git",["submodule","update","--init","--depth=1"],source);
 }
}
for (const [key, folder] of [["pkforge",""],["pkhex","external/PKHeX"],["automod","external/PKHeX-Plugins"]]) {
 const actual = await run("git",["rev-parse","HEAD"],resolve(source,folder),true);
 if(actual!==lock[key].commit)throw Error(`${key}: expected ${lock[key].commit}, found ${actual}`);
 const dirty=await run("git",["status","--porcelain","--untracked-files=all"],resolve(source,folder),true);if(dirty)throw Error(`${key} source is modified`);
}
await mkdir(output,{recursive:true});
await run(sdk,["publish",resolve(here,"Harbor.PokemonEngine.csproj"),`-p:PKForgeRoot=${resolve(source)}`,"--artifacts-path",resolve(argument("--artifacts") || resolve(output,"../engine-build")),"-r",rid,"--self-contained","true","--source","https://api.nuget.org/v3/index.json","-o",resolve(output),"-v","minimal"],here);
const sources=resolve(output,"sources");await mkdir(sources,{recursive:true});
for(const [key,folder] of [["pkforge",""],["pkhex","external/PKHeX"],["automod","external/PKHeX-Plugins"]])await run("git",["archive","--format=zip","--output",resolve(sources,`${key}.zip`),"HEAD"],resolve(source,folder));
for(const file of ["Program.cs","Harbor.PokemonEngine.csproj","upstream.json","LICENSE","build.mjs","README.md"])await cp(resolve(here,file),resolve(sources,file));
const exe=resolve(output,`Harbor.PokemonEngine${rid.startsWith("win-")?".exe":""}`);
await writeFile(resolve(output,"engine.json"),JSON.stringify({protocol:1,rid,revision:lock.pkforge.commit,sha256:createHash("sha256").update(await readFile(exe)).digest("hex"),source:"sources/",license:"GPL-3.0-or-later"},null,2));
console.log(`Engine and corresponding sources: ${resolve(output)}`);
