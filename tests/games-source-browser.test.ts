import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBrowserHost,sourceBrowserError} from '../src/lib/games/source-browser';
import {sourcePublicHost} from '../src/lib/games/source-public-files';

test('DataNodes, 1fichier and both Buzzheavier link generations default to direct download',()=>{
 const cases={datanodes:['https://datanodes.to/r9s07mymkzbt','https://datanodes.to/r9s07mymkzbt/Project%20archive.rar','https://www.datanodes.to/r9s07mymkzbt/'],fichier:['https://1fichier.com/?b7ltalh4x9cn68f0grn1','https://www.1fichier.com/?abc123&af=123'],buzzheavier:['https://buzzheavier.com/abcdefghijkl','https://buzzheavier.com/f/GX6BS_mf0AA','https://dd.buzzheavier.com/f/GKSs0wSQIAA=','https://bzzhr.co/abcdefghijkl/','https://bzzhr.to/abcdefghijkl']};
 for(const [host,urls] of Object.entries(cases))for(const url of urls){assert.equal(sourceBrowserHost(url),host,url);assert.equal(sourcePublicHost(url),null)}
 for(const url of ['https://pixeldrain.com/u/aB12cD34','https://pixeldrain.com/l/aB12cD34','https://www.pixeldrain.com/api/file/aB12cD34?download','https://pixeldrain.com/l/aB12cD34#item=2'])assert.equal(sourcePublicHost(url),'pixeldrain',url);
});

// Any public page can be opened in the hand-off, so the rule is no longer "unknown is refused".
// What must still hold is that a destination on the viewer's own network, carrying credentials,
// or walking the path is refused outright.
test('Private, credentialed and path-walking destinations are refused on every host',()=>{
 for(const url of ['http://gofile.io/d/a1B2c3','https://user@gofile.io/d/a1B2c3','https://user@1fichier.com/?abc123','https://gofile.io/a/../d/a1B2c3','https://gofile.io/%2e%2e/d/a1B2c3','https://buzzheavier.com/f/GX6BS_mf0AA/../x','https://datanodes.to/r9s07mymkzbt/file%0a.rar','https://127.0.0.1/a.zip','https://192.168.1.10/a.zip','https://localhost/a.zip','https://router.lan/a.zip','https://files.internal/a.zip','https://nas.home/a.zip','https://host/a.zip'])assert.equal(sourceBrowserHost(url),null,url);
});

// Provider identity gates which cookies a capture may carry, so a lookalike must never claim it.
test('A lookalike domain never inherits the real provider identity',()=>{
 for(const [url,provider] of [['https://gofile.io.evil.test/d/a1B2c3','gofile'],['https://datanodes.to.evil/r9s07mymkzbt','datanodes'],['https://dd.buzzheavier.com.evil/f/GX6BS_mf0AA','buzzheavier'],['https://vikingfile.com.evil/f/TPRSfLvcIu','vikingfile'],['https://vik1ngfile.site.evil/f/PPOab9zWW1','vikingfile'],['https://fuckingfast.co.evil/ab12cd34ef56','fuckingfast'],['https://megadb.net.evil/ab12cd34ef56','megadb'],['https://filekeeper.net.evil/ab12cd34ef56/archive.zip','filekeeper'],['https://akirabox.com.evil/abx7k2m9/file','akirabox'],['https://rootz.so.evil/download/c94e7e05-ef53-4f40-a0a8-9bfada05f120','rootz']] as const)assert.notEqual(sourceBrowserHost(url),provider,url);
});

test('Gofile public pages get the direct browser route without changing public API hosts',()=>{
 for(const url of ['https://gofile.io/d/a1B2c3','https://www.gofile.io/d/Ab12Cd34/','https://gofile.io/d/8b9c0d1e-2f3a-4b4c-ad5e-6f7a8b9c0d1e'])assert.equal(sourceBrowserHost(url),'gofile');
 for(const url of ['https://gofile.io/d/abc','https://gofile.io/d/Ab12%2F34'])assert.equal(sourceBrowserHost(url),null,url);
 assert.equal(sourcePublicHost('https://pixeldrain.com/u/abc'),'pixeldrain');
 assert.notEqual(sourceBrowserHost('https://pixeldrain.com/u/abc'),'gofile');
});

test('Cancellation is quiet; outdated native builds and timeouts have actionable messages',()=>{
 assert.equal(sourceBrowserError('public_browser_canceled'),null);
 assert.equal(sourceBrowserError('public_browser_timeout'),'games.sources.browser.timeout');
 assert.equal(sourceBrowserError('Command games_source_browser_choose not found'),'games.sources.browser.restart');
 assert.equal(sourceBrowserError(new Error('sensitive host response')),'games.sources.browser.failed');
});

test('FuckingFast file pages use visible browser handoff and tolerate only filename fragments',()=>{
 for(const url of ['https://fuckingfast.co/ab12cd34ef56','https://fuckingfast.co/ab12cd34ef56#Project%20archive.zip'])assert.equal(sourceBrowserHost(url),'fuckingfast');
 for(const url of ['https://fuckingfast.co/login','https://fuckingfast.co/ab12cd34ef56/','https://fuckingfast.co/AB12cd34ef56','https://fuckingfast.co/dl/'+ 'x'.repeat(100),'https://fuckingfast.co/ab12cd34ef56?password=x','https://fuckingfast.co/ab12cd34ef56#%0a','https://fuckingfast.co/ab12cd34ef56#%2Fsecret','https://fuckingfast.co/ab12cd34ef56#%FF','https://fuckingfast.co/ab12cd34ef56#'+ '日'.repeat(334)])assert.notEqual(sourceBrowserHost(url),'fuckingfast',url);
 for(const url of ['https://user@fuckingfast.co/ab12cd34ef56','https://fuckingfast.co/a/../ab12cd34ef56'])assert.equal(sourceBrowserHost(url),null,url);
 assert.equal(sourcePublicHost('https://fuckingfast.co/ab12cd34ef56'),null);
});

test('VikingFile and Fileditch route to built-in selection without a debrid key',()=>{
 for(const url of ['https://vikingfile.com/f/TPRSfLvcIu','https://vikingfile.com/f/TPRSfLvcIu/archive.zip'])assert.equal(sourceBrowserHost(url),'vikingfile');
 for(const domain of ['fileditchfiles.st','fileditchfiles.me'])assert.equal(sourceBrowserHost(`https://${domain}/alpha27/a3f9c1b2d4e5f6071829/yourfile.zip`),'fileditch');
 for(const url of ['https://vikingfile.com/login','https://vikingfile.com/f/TPRSfLvcIu?redirect=x'])assert.notEqual(sourceBrowserHost(url),'vikingfile',url);
 for(const url of ['https://fileditchfiles.st/alpha27/a3f9c1b2d4e5f6071829/file%2fother.zip','https://fileditchfiles.st/api/alpha27/a3f9c1b2d4e5f6071829/a.zip'])assert.notEqual(sourceBrowserHost(url),'fileditch',url);
});

test('MegaDB does not offer the unsupported direct browser flow',()=>{
 for(const url of ['https://megadb.net/ab12cd34ef56','https://www.megadb.net/ab12cd34ef56.html','https://megadb.net/ab12cd34ef56/archive.zip','https://megadb.net/login','https://megadb.net/ab12cd34ef56/file%2fother.zip','https://megadb.net/ab12cd34ef56?redirect=x'])assert.equal(sourceBrowserHost(url),null,url);
 assert.equal(sourceBrowserHost('https://user@megadb.net/ab12cd34ef56'),null);
});

test('FileKeeper, AkiraBox and Rootz select the built-in host flow',()=>{
 const cases={filekeeper:'https://filekeeper.net/ab12cd34ef56/archive.zip',akirabox:'https://akirabox.com/abx7k2m9/file',rootz:'https://rootz.so/download/c94e7e05-ef53-4f40-a0a8-9bfada05f120'};
 for(const [host,url] of Object.entries(cases))assert.equal(sourceBrowserHost(url),host);
 assert.equal(sourceBrowserHost('https://www.rootz.so/d/Abc123xy'),'rootz');
 for(const [url,provider] of [['https://filekeeper.net/login','filekeeper'],['https://akirabox.com/developers','akirabox'],['https://rootz.so/dashboard','rootz'],['https://rootz.so/download/not-a-uuid','rootz'],['https://akirabox.com/abx7k2m9/file?redirect=x','akirabox']] as const)assert.notEqual(sourceBrowserHost(url),provider,url);
});

test('VikingFile verified redirect alias keeps the built-in route',()=>{
 assert.equal(sourceBrowserHost('https://vik1ngfile.site/f/PPOab9zWW1'),'vikingfile');
});

test('Any other public page is offered as a generic site hand-off',()=>{
 for(const url of ['https://romsfun.com/roms/pokemon-firered','https://example.org/download/file','https://node43.datanodes.to:8443/d/abcdef/a.rar'])assert.equal(sourceBrowserHost(url),'generic',url);
});
