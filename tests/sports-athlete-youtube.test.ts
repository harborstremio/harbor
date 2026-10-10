import assert from 'node:assert/strict';
import test from 'node:test';
import {parseAthleteYoutubePage,loadAthleteYoutubeVideos} from '../src/lib/sports/athlete-youtube.ts';
const channel={id:'UCB_qr75-ydFVKSF9Dmo6izg',name:'FORMULA 1'};
const video=(id:string,title:string,extra={})=>({videoRenderer:{videoId:id,title:{simpleText:title},ownerText:{runs:[{text:'FORMULA 1',navigationEndpoint:{browseEndpoint:{browseId:channel.id}}}]},lengthText:{simpleText:'9:03'},...extra}});
const page=(items:unknown[],id=channel.id)=>`<script>var ytInitialData = ${JSON.stringify({metadata:{channelMetadataRenderer:{externalId:id}},contents:{items}})};</script>`;
test('athlete archives return real video cards, including career reels without recent dates',()=>{
  const results=parseAthleteYoutubePage(page([video('B4pF4bMwYYI','Top 10 Moments of Max Verstappen Magic in F1'),video('fMzwUd6Oj8Q','Max Verstappen Driving Incredibly for 70 Minutes')]),'Max Verstappen',channel);
  assert.equal(results.length,2);assert.equal(results[0].duration,'9:03');assert.equal(results[0].publisher,'FORMULA 1');assert.match(results[0].embed,/youtube-nocookie.com\/embed\/B4pF4bMwYYI/);
});
test('excludes rival drivers, generic race footage, other channel owners, live and duplicate results',()=>{
  const results=parseAthleteYoutubePage(page([
    video('aaaaaaaaaaa','Max Verstappen highlights'),video('aaaaaaaaaaa','Max Verstappen duplicate'),
    video('bbbbbbbbbbb','Lewis Hamilton highlights'),video('ccccccccccc','Race Highlights | Australian Grand Prix'),
    video('ddddddddddd','Max Verstappen live',{isLiveNow:true}),video('eeeeeeeeeee','Max Verstappen tomorrow',{upcomingEventData:{}}),
    video('fffffffffff','Max Verstappen highlights',{ownerText:{runs:[{text:'Fake',navigationEndpoint:{browseEndpoint:{browseId:'other'}}}]}}),
    video('ggggggggggg','Max Verstappens highlights'),video('invalid','Max Verstappen bad id')
  ]),'Max Verstappen',channel);
  assert.deepEqual(results.map(v=>v.id),['youtube:aaaaaaaaaaa']);
});
test('rejects provider errors and mismatched official-channel identity',()=>{
  assert.deepEqual(parseAthleteYoutubePage('<html>consent</html>','Max Verstappen',channel),[]);
  assert.deepEqual(parseAthleteYoutubePage(page([video('aaaaaaaaaaa','Max Verstappen highlights')],'other'),'Max Verstappen',channel),[]);
});
test('normalizes accents, keeps ranking, and bounds results',()=>{
  const result=parseAthleteYoutubePage(page(Array.from({length:30},(_,i)=>video(String(i).padStart(11,'0'),'Álex Palou best overtakes'))),'Alex Palou');
  assert.equal(result.length,12);assert.equal(result[0].id,'youtube:00000000000');
});
test('cancelled athlete lookup makes no provider request',async()=>{
  await assert.rejects(loadAthleteYoutubeVideos('Max Verstappen','F1',AbortSignal.abort()),{name:'AbortError'});
});
