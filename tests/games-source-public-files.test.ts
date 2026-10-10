import test from 'node:test';import assert from 'node:assert/strict';
import {sourcePublicHost,publicFileError,publicFilePage} from '../src/lib/games/source-public-files.ts';

test('public file UI recognizes only supported canonical routes and never passes arbitrary hosts to the adapter',()=>{
 for(const url of ['https://pixeldrain.com/u/FileID','http://www.pixeldrain.com/l/ListID#item=62','https://pixeldrain.com/api/file/FileID?download','https://pixeldrain.com/api/file/FileID/info','https://pixeldrain.com/api/list/ListID'])assert.equal(sourcePublicHost(url),'pixeldrain');
 for(const url of ['https://pixeldrain.com.evil/u/ID','https://evil.invalid/u/ID','file:///u/ID','https://user:pass@pixeldrain.com/u/ID','https://pixeldrain.com:8443/u/ID','https://pixeldrain.com/u/a%2Fb','https://pixeldrain.com/api/user/files','https://pixeldrain.com/u/','https://pixeldrain.com/u/'+ 'a'.repeat(65),'https://pixeldrain.com/u/ab\ncd'])assert.equal(sourcePublicHost(url),null,url);
});
test('Internet Archive item and file routes preserve Unicode and nested filenames without path confusion',()=>{
 for(const route of ['details','metadata','download'])for(const tail of ['', '/'])assert.equal(sourcePublicHost(`https://archive.org/${route}/public-project${tail}`),'archive');
 for(const path of ['Builds/Project%20日本+1.zip','Program.zip'])assert.equal(sourcePublicHost(`https://www.archive.org/download/public-project/${path}`),'archive');
 for(const url of ['https://archive.org.evil/details/public-project','https://user:pass@archive.org/details/public-project','https://archive.org:8443/details/public-project','https://archive.org/details/_invalid','https://archive.org/details/'+ 'a'.repeat(101),'https://archive.org/metadata/public-project/files/0','https://archive.org/download/public-project/../file.zip','https://archive.org/download/public-project/%2e%2e/file.zip','https://archive.org/download/public-project/a%2F..%2Fb.zip','https://archive.org/download/public-project/a%5Cb.zip','https://archive.org/download/public-project/%FF','https://archive.org/download/public-project/a//b.zip','https://archive.org/download/public-project/a%00.zip'])assert.equal(sourcePublicHost(url),null,url);
 assert.equal(publicFilePage('https://archive.org/details/public-project','Builds/Project 日本+1.zip'),'https://archive.org/download/public-project/Builds/Project%20%E6%97%A5%E6%9C%AC%2B1.zip');
 assert.equal(publicFilePage('https://archive.org/details/public-project','../outside'),'https://archive.org/details/public-project');
});
test('MediaFire public file variants do not include folders, download hosts or impostors',()=>{
 for(const url of ['https://mediafire.com/?aB0123','https://www.mediafire.com/file/ABC123','https://mediafire.com/view/ABC123/manual.pdf/file','https://mediafire.com/download/ABC123/game.zip','https://mediafire.com/file/ABC123/Project%20日本.zip/file'])assert.equal(sourcePublicHost(url),'mediafire',url);
 for(const url of ['https://mediafire.com/folder/ABC123','https://download1.mediafire.com/ABC123/game.zip','https://mediafire.com.evil/file/ABC123','https://mediafire.com/file/a_b','https://mediafire.com/?ABC123&other=1','https://mediafire.com/file/ABC123/../other','https://mediafire.com/file/'+ 'a'.repeat(65)])assert.equal(sourcePublicHost(url),null,url);
 const origin='https://mediafire.com/file/ABC123/Project.zip/file';assert.equal(publicFilePage(origin,'ABC123'),origin);
 assert.equal(publicFilePage('https://pixeldrain.com/l/ListID','file64'),'https://pixeldrain.com/u/file64');
});
test('provider limits and restrictions remain distinct without echoing host response text',()=>{
 for(const [code,key] of [['public_review','review'],['public_restricted','restricted'],['public_rate_limit','limited'],['public_missing','missing'],['public_limit','limit'],['public_metadata','invalid'],['public_url','invalid'],['private payload','failed']])assert.equal(publicFileError(Error(code)),'games.sources.public.'+key);
});
