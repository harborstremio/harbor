import assert from 'node:assert/strict';
import test from 'node:test';
import {artworkChoice,validateArtworkLottie} from '../src/lib/custom-artwork-data.ts';
const animation = (extra = {}) => ({v:'5.7.0',w:256,h:256,fr:30,ip:0,op:90,layers:[{ty:4,shapes:[]}],...extra});
test('accepts self-contained animations and strips expressions',()=>{
  const data=animation({assets:[{id:'img',p:'data:image/png;base64,aA==',u:'ignored'}],layers:[{ty:4,ks:{x:'fetch("external")'}}]});
  const result=validateArtworkLottie(data);
  assert.equal((result.assets as any[])[0].u,''); assert.equal((result.layers as any[])[0].ks.x,undefined);
});
test('rejects external media, scripts in image URLs and external fonts',()=>{
  for(const extra of [{assets:[{p:'https://example.test/a.png'}]},{assets:[{p:'data:image/svg+xml;base64,aA=='}]},{fonts:{list:[{fPath:'https://example.test/font.woff'}]}},{layers:[{ty:6}]}])assert.throws(()=>validateArtworkLottie(animation(extra)),/external/);
});
test('rejects malformed, oversized and cyclic animations before rendering',()=>{
  for(const input of [null,{},animation({w:5000}),animation({fr:0}),animation({op:Infinity}),animation({layers:[]}),animation({assets:[{id:'a',layers:[{refId:'b'}]},{id:'b',layers:[{refId:'a'}]}]})])assert.throws(()=>validateArtworkLottie(input));
});
test('only restores bounded PNG posters with valid asset identities',()=>{
  const choice={id:'saved-1',name:'boat.gif',kind:'image',poster:'data:image/png;base64,aA=='};
  assert.deepEqual(artworkChoice(choice),choice);
  for(const patch of [{id:'../../escape'},{kind:'video'},{poster:'javascript:alert(1)'},{poster:'data:image/svg+xml;base64,aA=='},{name:'x'.repeat(201)}])assert.equal(artworkChoice({...choice,...patch}),null);
});
