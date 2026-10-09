import type { TorrentFile } from "./torrents";

export type TorrentNode = { key: string; name: string; path: string; files: TorrentFile[]; children: TorrentNode[]; folder: boolean; bytes: number };

/** Keep the engine's file indices; display order and folders never become IDs. */
export function torrentTree(files: TorrentFile[]): TorrentNode[] {
  const roots: TorrentNode[] = [], folders = new Map<string, TorrentNode>();
  for (const file of files) {
    if (file.padding) continue;
    const parts = file.path.split(/[\\/]/).filter(Boolean);
    let children = roots;
    for (let depth = 0; depth < parts.length - 1; depth++) {
      const path = parts.slice(0, depth + 1).join("/");
      let node = folders.get(path);
      if (!node) { node = { key: `folder:${path}`, name: parts[depth], path, files: [], children: [], folder: true, bytes: 0 }; folders.set(path, node); children.push(node); }
      node.files.push(file); node.bytes += file.bytes; children = node.children;
    }
    children.push({ key: `file:${file.index}`, name: parts.at(-1) || file.path, path: file.path, files: [file], children: [], folder: false, bytes: file.bytes });
  }
  const sort = (nodes: TorrentNode[]) => { nodes.sort((a,b) => Number(b.folder)-Number(a.folder) || a.name.localeCompare(b.name, undefined, {numeric:true})); nodes.forEach(node=>sort(node.children)); };
  sort(roots); return roots;
}

export function visibleTorrentTree(nodes: TorrentNode[], collapsed: Set<string>, query: string): { node: TorrentNode; depth: number }[] {
  const result: {node:TorrentNode;depth:number}[] = [], needle = query.trim().toLocaleLowerCase();
  const visit = (nodes: TorrentNode[], depth: number) => nodes.forEach(node => {
    if (needle && !node.files.some(file=>file.path.toLocaleLowerCase().includes(needle))) return;
    result.push({node,depth});
    if (node.folder && (needle || !collapsed.has(node.key))) visit(node.children,depth+1);
  });
  visit(nodes,0); return result;
}

export function toggleTorrentFiles(selected: Set<number>, files: TorrentFile[]): Set<number> {
  const next = new Set(selected), remove = files.every(file=>selected.has(file.index));
  files.forEach(file=>{ if (remove) next.delete(file.index); else next.add(file.index); });
  return next;
}
