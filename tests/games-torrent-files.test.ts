import assert from 'node:assert/strict';
import test from 'node:test';
import {torrentTree,visibleTorrentTree,toggleTorrentFiles} from '../src/lib/games/torrent-files.ts';
import type {TorrentFile} from '../src/lib/games/torrents.ts';
const files:TorrentFile[]=[{index:7,path:'setup.exe',bytes:20},{index:2,path:'data/part2.bin',bytes:200},{index:5,path:'data/part10.bin',bytes:100},{index:9,path:'checks/md5/list.txt',bytes:5},{index:11,path:'.pad/0',bytes:32,padding:true}];
test('folders retain real indices, natural sorting, byte totals, and omit padding',()=>{
 const tree=torrentTree(files);assert.deepEqual(tree.map(n=>n.name),['checks','data','setup.exe']);
 const data=tree[1];assert.deepEqual(data.files.map(f=>f.index),[2,5]);assert.equal(data.bytes,300);assert.deepEqual(data.children.map(n=>n.name),['part2.bin','part10.bin']);
 assert.ok(!JSON.stringify(tree).includes('.pad'));
});
test('collapsed folders hide descendants; search temporarily reveals matching nested paths',()=>{
 const tree=torrentTree(files),collapsed=new Set(['folder:checks','folder:data']);
 assert.equal(visibleTorrentTree(tree,collapsed,'').length,3);
 assert.deepEqual(visibleTorrentTree(tree,collapsed,'list').map(r=>[r.node.name,r.depth]),[['checks',0],['md5',1],['list.txt',2]]);
 assert.equal(visibleTorrentTree(tree,collapsed,'missing').length,0);
 assert.equal(visibleTorrentTree(tree,collapsed,'').length,3);
});
test('folder toggles select partial folders and clear full folders without changing other selections',()=>{
 const folder=torrentTree(files)[1];const old=new Set([7,2]);const next=toggleTorrentFiles(old,folder.files);
 assert.deepEqual([...old],[7,2]);assert.deepEqual([...next],[7,2,5]);assert.deepEqual([...toggleTorrentFiles(next,folder.files)],[7]);
});
