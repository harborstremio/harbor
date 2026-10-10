import { safeFetchBytes } from "@/lib/safe-fetch";
import { hackRelease } from "./hack-catalog";
import { hackDriveDownload, hackDriveFile, hackGithubRepository, PPLUS_REPOSITORY, projectDownloadPages, projectPageFiles, projectPlusFiles } from "./hack-files";
import type { SourceFile } from "./sources";

const cache = new Map<string,{at:number;version:string;files:SourceFile[]}>();
async function resolveHostedFiles(files: SourceFile[], signal: AbortSignal) {
  const result = [...files];
  const lookupSignal = AbortSignal.any([signal,AbortSignal.timeout(10_000)]);
  // Read eight bytes only; large patcher bundles stay in the download manager.
  for (let at = 0; at < result.length; at += 2) {
    signal.throwIfAborted();
    if (lookupSignal.aborted) break;
    await Promise.all(result.slice(at,at+2).map(async (file, index) => {
      const url = file.kind === 'page' ? hackDriveDownload(file.url) : undefined;
      if (!url) return;
      try {
        const response = await safeFetchBytes(url,{method:'GET',credentials:'omit',headers:{Range:'bytes=0-7'},signal:lookupSignal},10_000,2048);
        const direct = hackDriveFile(url,response);
        if (direct) result[at+index] = direct;
      } catch { signal.throwIfAborted(); /* Keep the creator's link if public resolution is unavailable. */ }
    }));
  }
  return result;
}
export async function loadHackFiles(game: Parameters<typeof hackRelease>[0], signal: AbortSignal) {
  signal.throwIfAborted();
  const release = hackRelease(game);
  if (!release) return { version: "", files: [] };
  const key = release.page, previous = cache.get(key);
  if (previous && Date.now()-previous.at < 600_000) return previous;
  const repository = game.name === "Project+" ? PPLUS_REPOSITORY : hackGithubRepository(release.page);
  const api = repository ? `https://api.github.com/repos/${repository}/releases/latest` : undefined;
  let result: {version:string;files:SourceFile[]};
  if (release.download) result = { version: "", files: [{ name: game.name, url: release.download, kind: "page" }] };
  else {
    const response = await safeFetchBytes(api ?? release.page, { signal: AbortSignal.any([signal,AbortSignal.timeout(15_000)]) },15_000,2*1024*1024);
    if (!response.ok) throw Error(`Project files ${response.status}`);
    if (api) result = projectPlusFiles(await response.json(), repository);
    else {
      const html = await response.text();
      result = {version:'',files:projectPageFiles(html,release.page)};
      if (!result.files.length) {
        const followups = await Promise.allSettled(projectDownloadPages(html,release.page).map(async page => {
          const repo = hackGithubRepository(page);
          const next = await safeFetchBytes(repo ? `https://api.github.com/repos/${repo}/releases/latest` : page,{signal:AbortSignal.any([signal,AbortSignal.timeout(10_000)])},10_000,2*1024*1024);
          if (!next.ok) throw Error(`Project files ${next.status}`);
          return repo ? projectPlusFiles(await next.json(),repo).files : projectPageFiles(await next.text(),page);
        }));
        signal.throwIfAborted();
        result.files = [...new Map(followups.flatMap(item => item.status === 'fulfilled' ? item.value : []).map(file=>[file.url,file])).values()].slice(0,40);
        if (followups.length && followups.every(item=>item.status==='rejected')) throw Error('Project downloads unavailable');
      }
    }
  }
  result.files = await resolveHostedFiles(result.files,signal);
  signal.throwIfAborted(); cache.set(key,{...result,at:Date.now()}); if (cache.size>40) cache.delete(cache.keys().next().value!);
  return result;
}
