import test from 'node:test';
import assert from 'node:assert/strict';
import {guideCount,parseGuideVideoPage} from '../src/lib/games/guides-data.ts';
import {guideVideoFilter,guideVideoAge} from '../src/lib/games/guide-video-options.ts';
import {parseTwitchGuides,twitchGameSlug} from '../src/lib/games/guide-streams.ts';
test('views retain real zero and compact counts without inventing missing metrics',()=>{
  for(const [source,count] of [[0,0],['1,203 views',1203],['2.4K watching',2400],['1.2M views',1200000],['5B views',5000000000]] as const)assert.equal(guideCount(source),count);
  for(const source of [null,undefined,'No views','-20 views','unavailable',Number.NaN,Number.MAX_SAFE_INTEGER+1])assert.equal(guideCount(source),undefined);
  const page=parseGuideVideoPage({videoRenderer:{videoId:'abcdefghijk',title:{simpleText:'CS2 guide'},viewCountText:{simpleText:'1,203 views'}}},'Counter-Strike 2',false);
  assert.equal(page.items[0].views,1203);assert.equal(page.items[0].viewers,undefined);
});
test('video filters encode source-level date and ranking, with a separate live filter',()=>{
  const bytes=(s:'popular'|'newest'|'relevance',d:'year'|'month'|'week'|'all',l=false)=>[...Buffer.from(guideVideoFilter(s,d,l),'base64')];
  assert.deepEqual(bytes('popular','year'),[8,3,18,4,8,5,16,1]);
  assert.deepEqual(bytes('newest','month'),[8,2,18,4,8,4,16,1]);
  assert.deepEqual(bytes('relevance','week'),[8,0,18,4,8,3,16,1]);
  assert.deepEqual(bytes('popular','all'),[8,3,18,2,16,1]);
  assert.deepEqual(bytes('popular','all',true),[8,3,18,2,64,1]);
});
test('Twitch accepts only live channels from the selected category and preserves its real cursor',()=>{
  const edge=(login:string,extra={})=>({cursor:'NEXT',node:{type:'live',title:'Ranked',viewersCount:4500,previewImageURL:'https://static-cdn.jtvnw.net/previews/img.jpg',broadcaster:{login,displayName:login},...extra}});
  const data={data:{game:{name:'Counter-Strike',streams:{edges:[edge('player'),edge('player'),edge('../../bad'),edge('offline',{type:'rerun'}),edge('safe',{viewersCount:null,previewImageURL:'https://untrusted.example/image'})],pageInfo:{hasNextPage:true}}}}};
  const page=parseTwitchGuides(data,'Counter-Strike 2');
  assert.deepEqual(page.items.map(i=>i.id),['player','safe']);assert.equal(page.items[0].viewers,4500);assert.equal(page.items[1].viewers,undefined);assert.equal(page.items[1].image,'');assert.equal(page.cursor,'NEXT');
  assert.equal(page.items[0].url,'https://www.twitch.tv/player');assert.equal(twitchGameSlug('Counter-Strike 2'),'counter-strike');
  assert.throws(()=>parseTwitchGuides(data,'Valorant'));assert.throws(()=>parseTwitchGuides({errors:[{}]},'Counter-Strike 2'));assert.throws(()=>parseTwitchGuides(null,'Counter-Strike 2'));
  assert.deepEqual(parseTwitchGuides({data:{game:null}},'Unknown game'),{items:[]});
});

test("recent video ordering understands provider ages and leaves unknown dates last",()=>{assert.ok(guideVideoAge("2w ago")<guideVideoAge("1mo ago"));assert.ok(guideVideoAge("Streamed 1 month ago")<guideVideoAge("2 years ago"));assert.equal(guideVideoAge("date unavailable"),Infinity);});
