import assert from 'node:assert/strict';
import test from 'node:test';
import {createMikuListeningPerformance} from '../src/lib/music/miku-listening';
const input=(time:number,period=500,extra={})=>({beat:time/period,period,locked:true,excitement:.7,bob:.55+.3*Math.cos(time/period*Math.PI*2),sway:.45*Math.sin(time/period*Math.PI),danceFit:.85,...extra});

test('five short reactions keep ordinary listening between gestures',()=>{
  const controller=createMikuListeningPerformance();const events:{name:string,start:number,end:number}[]=[];let last:string|null=null;
  for(let now=0;now<65000;now+=10){const p=controller.advance(10,input(now),true);if(p.reaction&&p.reaction!==last)events.push({name:p.reaction,start:now,end:now});if(p.reaction)events.at(-1)!.end=now;last=p.reaction;}
  assert.equal(new Set(events.map(p=>p.name)).size,5);
  for(let i=0;i<events.length;i++){assert.ok(events[i].end-events[i].start<=2100);if(i)assert.ok(events[i].start-events[i-1].end>=7400);}
});
test('one visible nod remains aligned to each beat from 70 through 200 BPM',()=>{
  for(const bpm of [70,88,106,138,170,200]){
    const period=60000/bpm,controller=createMikuListeningPerformance();const frames=[];
    for(let now=0;now<70000;now+=10)frames.push({now,...controller.advance(10,input(now,period),true)});
    const peaks=frames.filter((p,i)=>i>0&&i<frames.length-1&&p.bob>frames[i-1].bob&&p.bob>=frames[i+1].bob);
    assert.ok(Math.abs(peaks.length-70000/period)<=1,`${bpm}: ${peaks.length} dips`);
    for(const p of peaks)assert.ok(Math.abs(p.now-Math.round(p.now/period)*period)<=20,`${bpm}: peak shift`);
    for(let i=1;i<frames.length;i++)assert.ok(Math.abs(frames[i].sway-frames[i-1].sway)<.08,`${bpm}: abrupt tilt`);
  }
});
test('silent, paused, dancing and broken clocks do not start extra reactions',()=>{
  for(const [engaged,extra] of [[false,{}],[true,{excitement:.15}],[true,{locked:false}]] as const){const c=createMikuListeningPerformance();for(let now=0;now<30000;now+=20)assert.equal(c.advance(20,input(now,500,extra),engaged).reaction,null);}
  const c=createMikuListeningPerformance();for(let now=0;now<8100;now+=10)c.advance(10,input(now),true);
  assert.equal(c.advance(1000,input(300000),true).reaction,null);
  for(let i=0;i<150;i++)c.advance(10,input(300000+i*10,500,{bob:0,sway:0,locked:false}),false);
  const settled=c.advance(10,input(302000,500,{bob:0,sway:0,locked:false}),false);
  assert.equal(settled.bob,0);assert.ok(Math.abs(settled.sway)<.001);
});
test('syncopated rhythms retain accents without playful reply motifs',()=>{
  const c=createMikuListeningPerformance();const names=new Set<string>();
  for(let now=0;now<70000;now+=10){const p=c.advance(10,input(now,500,{danceFit:.3}),true);if(p.reaction)names.add(p.reaction);}
  assert.ok(![...names].some(p=>p.includes('reply')));assert.ok(names.has('center-accent'));
});
test('track reset can preserve and ease the current small lean',()=>{
  const c=createMikuListeningPerformance();let prior;
  for(let now=0;now<=9000;now+=10){
    prior=c.advance(10,input(now,500,{bob:.5,sway:0}),true);
    if(prior.reaction==='lean-left'&&Math.abs(prior.sway)>.15)break;
  }
  assert.ok(prior&&prior.sway<-.15,'Exercise reset during a visible lean, not ordinary listening');
  c.reset(true);
  const quiet=input(0,500,{bob:.5,sway:0,locked:false});
  const immediate=c.advance(0,quiet,true);
  assert.equal(immediate.sway,prior.sway);assert.equal(immediate.bob,prior.bob);
  assert.equal(immediate.reaction,null);
  let previous=immediate;
  for(let i=0;i<70;i++){
    const after=c.advance(10,quiet,true);
    assert.ok(Math.abs(after.sway-previous.sway)<.02,'No snap when the track clock resets');
    assert.ok(after.sway>=previous.sway&&after.sway<=0,'Lean returns without overshoot');
    assert.equal(after.reaction,null);previous=after;
  }
  assert.ok(Math.abs(previous.sway)<.001,'Lean settles after the reset');
  assert.ok(Math.abs(previous.bob-.5)<.001);
  c.reset();assert.equal(c.advance(0,quiet,true).sway,0);
});
