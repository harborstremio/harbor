// Fail before the expensive native build if any Windows release inputs are absent.
import { createHash } from "node:crypto";
import { globSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tauriRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src-tauri");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));

export function checkJlBundle(root = tauriRoot) {
  const base = json(resolve(root, "tauri.conf.json")).bundle;
  const windows = json(resolve(root, "tauri.windows.conf.json")).bundle;
  const jl = json(resolve(root, "tauri.jl-dev.conf.json")).bundle;
  const resources = { ...base.resources, ...windows.resources, ...jl.resources };
  const nsis = { ...base.windows.nsis, ...windows.windows?.nsis, ...jl.windows.nsis };
  const required = [
    ...Object.keys(resources),
    ...base.externalBin.map((name) => `${name}-x86_64-pc-windows-msvc.exe`),
    ...jl.icon,
    jl.licenseFile,
    nsis.installerHooks,
    nsis.installerIcon,
    nsis.headerImage,
    nsis.sidebarImage,
    // License files also match fonts/*, so require the actual subtitle fonts.
    ...["NotoSansJP-Regular.otf", "NotoSansJP-Bold.otf", "Inter-Variable.ttf", "Fredoka-Variable.ttf", "Vazirmatn-Variable.ttf"].map((name) => `fonts/${name}`),
    "resources/pokemon-engine/Harbor.PokemonEngine.exe",
    "resources/pokemon-engine/Harbor.PokemonEngine.dll",
    "resources/pokemon-engine/Harbor.PokemonEngine.runtimeconfig.json",
    "resources/pokemon-engine/sources/README.md",
    "resources/pokemon-engine/sources/LICENSE",
    ...["pkforge", "pkhex", "automod"].map((name) => `resources/pokemon-engine/sources/${name}.zip`),
  ];
  const missing = required.filter((pattern) => {
    const files = globSync(pattern.endsWith("/") ? `${pattern}**/*` : pattern, { cwd: root });
    return !files.some((file) => {
      const stat = statSync(resolve(root, file));
      return stat.isFile() && stat.size > 0;
    });
  });
  if (missing.length) throw new Error(`Missing Windows bundle inputs:\n${missing.join("\n")}`);

  const engineRoot = resolve(root, "resources/pokemon-engine");
  const manifest = json(resolve(engineRoot, "engine.json"));
  const lock = json(resolve(engineRoot, "sources/upstream.json"));
  const digest = createHash("sha256").update(readFileSync(resolve(engineRoot, "Harbor.PokemonEngine.exe"))).digest("hex");
  if (manifest.protocol !== 1 || manifest.rid !== "win-x64" || manifest.revision !== lock.pkforge.commit || manifest.sha256 !== digest) {
    throw new Error("Pokémon engine manifest does not match the Windows executable and pinned source");
  }
  return required.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Verified ${checkJlBundle()} Windows bundle inputs and the Pokémon engine manifest.`);
}
