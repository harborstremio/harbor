import {createMikuGroove} from "../src/lib/music/miku-motion";
import type {MusicAudioMeterState} from "../src/lib/music/audio-meter";
import assert from "node:assert/strict";
import test from "node:test";

export type Pattern={name:string;bpm:number;kicks:number[];snares:number[];hats:number[];kickDb:number;snareDb:number;vocalDb:number;bedDb:number;swing?:number;secondBpm?:number;noSpectrum?:boolean;hatSpill?:boolean};
export const patterns:Pattern[]=[
 {name:'hardstyle compressed kick',bpm:150,kicks:[0,1,2,3],snares:[1,3],hats:[.5,1.5,2.5,3.5],kickDb:7,snareDb:9,vocalDb:-12,bedDb:-11},
 {name:'happy hardcore under soft vocal',bpm:180,kicks:[0,1,2,3],snares:[1,3],hats:[.5,1.5,2.5,3.5],kickDb:12,snareDb:18,vocalDb:-25,bedDb:-19},
 {name:'nightcore 210',bpm:210,kicks:[0,1,2,3],snares:[1,3],hats:[.5,1.5,2.5,3.5],kickDb:10,snareDb:12,vocalDb:-16,bedDb:-16},
 {name:'country light boom chick',bpm:106,kicks:[0,2],snares:[1,3],hats:[0,1,2,3],kickDb:4,snareDb:10,vocalDb:-15,bedDb:-43},
 {name:'rock over sustained guitar',bpm:138,kicks:[0,2,2.5],snares:[1,3],hats:[0,.5,1,1.5,2,2.5,3,3.5],kickDb:8,snareDb:15,vocalDb:-10,bedDb:-22},
 {name:'reggae one drop',bpm:82,kicks:[2],snares:[2],hats:[0,.5,1,1.5,2,2.5,3,3.5],kickDb:9,snareDb:12,vocalDb:-18,bedDb:-29},
 {name:'reggae low drum beneath bright hi-hat spill',bpm:78,kicks:[2],snares:[2],hats:[0,.5,1,1.5,2,2.5,3,3.5],kickDb:11,snareDb:14,vocalDb:-18,bedDb:-24,hatSpill:true},
 {name:'hip hop sparse 808',bpm:88,kicks:[0,1.75,2.5],snares:[1,3],hats:[0,.25,.5,.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75],kickDb:14,snareDb:15,vocalDb:-12,bedDb:-21},
 {name:'country swing',bpm:112,kicks:[0,2],snares:[1,3],hats:[0,.66,1,1.66,2,2.66,3,3.66],kickDb:7,snareDb:12,vocalDb:-17,bedDb:-35},
 {name:'tempo change 120 to 172',bpm:120,secondBpm:172,kicks:[0,1,2,3],snares:[1,3],hats:[.5,1.5,2.5,3.5],kickDb:12,snareDb:14,vocalDb:-18,bedDb:-24},
 {name:'level-only tap recovery',bpm:126,kicks:[0,1,2,3],snares:[1,3],hats:[],kickDb:12,snareDb:12,vocalDb:-20,bedDb:-28,noSpectrum:true},
];
const envelope=(beat:number,onsets:number[],period:number,decay:number)=>onsets.reduce((m,hit)=>Math.max(m,Math.exp(-(((beat-hit)%4+4)%4)*period/decay)),0);
export function signal(pattern:Pattern,now:number):MusicAudioMeterState{
 const period=60000/(pattern.secondBpm&&now>=16000?pattern.secondBpm:pattern.bpm);
 const beat=(now-(pattern.secondBpm&&now>=16000?16000:0))/period;
 const kick=envelope(beat,pattern.kicks,period,75),snare=envelope(beat,pattern.snares,period,55),hat=envelope(beat,pattern.hats,period,32);
 const vocal=pattern.vocalDb+Math.sin(now/850)*1.8;
 const spectrum=[pattern.bedDb+kick*pattern.kickDb,pattern.bedDb-5+kick*pattern.kickDb,pattern.bedDb-10+kick*pattern.kickDb*.7,
 vocal-4+snare*pattern.snareDb*.5,vocal-8+snare*pattern.snareDb,vocal-14+snare*pattern.snareDb*.9,
 -38+hat*22+snare*7,-44+hat*20];
 if(pattern.hatSpill){spectrum[2]+=hat*3;spectrum[3]+=hat*1.5;spectrum[4]+=hat*5;spectrum[5]+=hat*10;}
 return {status:'ready',data:{trackId:'current',connectorId:'local',active:true,channels:[{rmsDb:-22+kick*4+snare*3,peakDb:-4}],spectrumDb:pattern.noSpectrum?[]:spectrum,outputSampleRateHz:48000,outputChannels:'stereo',outputDevice:null,outputBackend:null}};
}
export function run(pattern:Pattern){
 const groove=createMikuGroove();let next=0,delivery=0;const frames:(ReturnType<ReturnType<typeof createMikuGroove>["advance"]> & {time:number})[]=[];const hits:number[]=[];
 const gaps=[47,63,51,76,58,49,69];
 for(let now=0;now<32000;now+=10){
  if(now>=next){const captured=Math.floor((now+25)/50)*50;if(groove.sample(signal(pattern,captured),'current','local',now))hits.push(now);next=now+gaps[delivery++%gaps.length];}
  const pose=groove.advance(10);frames.push({time:now+10,...pose});
 }
 const settled=frames.filter(f=>f.time>24000);const desired=60000/(pattern.secondBpm??pattern.bpm);
 const peaks=frames.filter((f,i)=>f.time>24000&&i>0&&i<frames.length-1&&f.bob>frames[i-1].bob&&f.bob>=frames[i+1].bob);
 return {name:pattern.name,expected:Math.round(60000/desired),bpm:Math.round(60000/(settled.at(-1)?.period??Infinity)),accurate:Math.round(100*settled.filter(f=>f.locked&&f.period&&Math.abs(f.period-desired)<desired*.09).length/settled.length),nods:peaks.length,expectedNods:Math.round(8000/desired),amplitude:Math.max(...settled.map(f=>f.bob))-Math.min(...settled.map(f=>f.bob)),excitement:settled.at(-1)?.excitement,frames,hits};
}

// These are independent drum arrangements, delivered with the native tap's
// 50 ms windows and uneven IPC timing. Genre labels describe fixtures only;
// the detector receives spectrum/level measurements, never a genre or BPM.
for (const pattern of patterns) {
  test(`measured drums retain their pulse: ${pattern.name}`, () => {
    const result = run(pattern);
    assert.ok(result.accurate >= 90, `${result.accurate}% tempo coverage at ${result.bpm} BPM`);
    assert.ok(Math.abs(result.nods - result.expectedNods) <= 1, `${result.nods} visible nods; expected ${result.expectedNods}`);
    assert.ok(result.amplitude > .4, "The pulse must remain visibly animated");
  });
}
test("quiet country percussion stays lighter than a compressed hardstyle kick under the same vocal level", () => {
  const hard = run({...patterns[0], vocalDb:-15});
  const light = run({...patterns[3], vocalDb:-15});
  assert.ok(hard.amplitude > light.amplitude * 1.15);
});
test("a sparse groove rests on loss of audio and relearns a fast rhythm after a seek", () => {
  const groove = createMikuGroove();
  let pose=groove.advance(0);
  for(let now=0;now<18000;now+=50){groove.sample(signal(patterns[5],now),"current","local",now);pose=groove.advance(50);}
  assert.ok(pose.locked);
  for(let i=0;i<70;i++)pose=groove.advance(50);
  assert.ok(!pose.locked && pose.bob<.02);
  for(let now=22000;now<34000;now+=50){groove.sample(signal(patterns[1],now),"current","local",now);pose=groove.advance(50);}
  assert.ok(pose.locked && Math.abs(60000/pose.period!-180)<8);
});
