import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowAddonMedia, wowAddonMediaUrl } from '../src/lib/games/wow-addon-media-data.ts';

const entry = (imageUrl = 'https://cdn-wow.mmoui.com/preview/pvw18868.jpg') => ({ imageUrl, thumbUrl:'https://cdn-wow.mmoui.com/preview/tiny/pvw18868.jpg', description:'BT4 Options Screen' });
const record = (images:unknown[] = [entry()]) => [{id:11190,title:'Bartender4',images}];
test('Addon media requests an individual exact provider identity, never bulk or guessed names', () => {
  assert.equal(wowAddonMediaUrl(11190),'https://api.mmoui.com/v4/game/WOW/filedetails/11190.json');
  for(const id of [0,-1,1.1,NaN,Infinity,2**32]) assert.throws(()=>wowAddonMediaUrl(id));
  for(const raw of [[],{},record().concat(record()),[{...record()[0],id:8092}],[{...record()[0],id:'11190'}]]) assert.throws(()=>parseWowAddonMedia(raw,11190));
});
test('Published full images and thumbnails remain separate and preserve author captions as plain text',()=>{
  const value=parseWowAddonMedia(record(),11190);assert.equal(value.images.length,1);
  assert.equal(value.images[0].image,'https://cdn-wow.mmoui.com/preview/pvw18868.jpg');assert.match(value.images[0].thumbnail,/\/tiny\//);
  assert.equal(value.images[0].description,'BT4 Options Screen');
  const raw=record([{...entry(),description:'<b>Author</b>\u0000caption',thumbUrl:'javascript:alert(1)'}]);
  const image=parseWowAddonMedia(raw,11190).images[0];assert.equal(image.description,'<b>Author</b> caption');assert.equal(image.thumbnail,image.image);
});
test('Artwork host, protocol, path and credentials are restricted before browser rendering',()=>{
  for(const imageUrl of ['http://cdn-wow.mmoui.com/preview/pvw1.png','https://cdn-wow.mmoui.com.evil.test/preview/pvw1.png','https://user@cdn-wow.mmoui.com/preview/pvw1.png','https://cdn-wow.mmoui.com:8443/preview/pvw1.png','https://cdn-wow.mmoui.com/preview/pvw1.svg','https://cdn-wow.mmoui.com/preview/pvw1.png?other=1','file:///C:/private.png','javascript:alert(1)','https://cdn-wow.mmoui.com/other.png']) assert.equal(parseWowAddonMedia(record([entry(imageUrl)]),11190).images.length,0);
});
test('Missing images are a valid empty state, duplicates and oversized galleries stay bounded',()=>{
  assert.deepEqual(parseWowAddonMedia([{id:11190,title:'Bartender4'}],11190).images,[]);
  assert.throws(()=>parseWowAddonMedia([{id:11190,title:'Bartender4',images:'wrong'}],11190));
  assert.equal(parseWowAddonMedia(record([entry(),entry()]),11190).images.length,1);
  assert.equal(parseWowAddonMedia(record(Array.from({length:70},(_,i)=>entry(`https://cdn-wow.mmoui.com/preview/pvw${i}.png`))),11190).images.length,8);
});

test('Author descriptions and changelogs retain useful text, bullets and published metadata',()=>{
  const value=parseWowAddonMedia([{id:11190,title:'Bartender4',author:'Nevcairiel',version:'4.18.2',lastUpdate:1790752343000,
    description:'[B][SIZE="5"]Features[/SIZE][/B]\r\n[LIST][*]Action bars[*]Press &#8594; or &#x2190;[/LIST]\n[INDENT] /bt [/INDENT]',
    changeLog:'[url=https://example.test]4.18.2[/url]\n[color=red]Fix bag padding[/color]'}],11190);
  assert.equal(value.author,'Nevcairiel');assert.equal(value.version,'4.18.2');assert.equal(value.updatedAt,1790752343000);
  assert.match(value.description,/Features\n/);assert.match(value.description,/• Action bars/);assert.match(value.description,/→ or ←/);assert.match(value.description,/\/bt/);
  assert.equal(value.changeLog,'4.18.2\nFix bag padding');assert.equal(value.notesTruncated,false);assert.deepEqual(value.images,[]);
});

test('Author text never supplies markup, embedded requests or executable link destinations',()=>{
  const value=parseWowAddonMedia([{id:11190,title:'Bartender4',description:'<script>secret()</script><b>Hello</b>[img]https://track.test/a.png[/img][url=javascript:bad()]Read[/url]\u202e\u0000 &amp; &#999999999;'}],11190);
  assert.equal(value.description,'Hello Read & &#999999999;');assert.equal(value.changeLog,'');assert.equal(value.updatedAt,null);
});

test('Oversized notes and malformed optional metadata remain bounded and visibly truncated',()=>{
  const value=parseWowAddonMedia([{id:11190,title:'Bartender4',description:'x'.repeat(30000),changeLog:{text:'wrong'},author:5,version:null,lastUpdate:Infinity}],11190);
  assert.equal(value.description.length,16000);assert.equal(value.notesTruncated,true);assert.equal(value.changeLog,'');assert.equal(value.author,'');assert.equal(value.version,'');assert.equal(value.updatedAt,null);
  for(const lastUpdate of [-1,0,1.5,'1790752343000',8.64e15+1])assert.equal(parseWowAddonMedia([{id:11190,title:'Bartender4',lastUpdate}],11190).updatedAt,null);
});
