import test from "node:test";
import assert from "node:assert/strict";
import { notebookDrafts, purgeGameNotes, emptyNotebook, mergeGameNotes, moveGameNote, notebookKey, noteUrl, parseNotebook, saveNotebook } from "../src/lib/games/game-notes.ts";
const note = (id="a",body="Strategy") => ({id,title:`Note ${id}`,body});
test("notes preserve original identities, order and attribution on serialization",()=>{
 const data={version:1 as const,revision:4,notes:[note('second'),{...note('first'),source:{url:'https://steamcommunity.com/sharedfiles/filedetails/?id=123',author:'Author'}}]};
 assert.deepEqual(parseNotebook(JSON.stringify(data)),data);assert.deepEqual(parseNotebook(null),emptyNotebook());
});
test("unknown or corrupt stores and duplicate IDs fail without silent recovery",()=>{
 for(const value of ['bad','null','{}',JSON.stringify({version:2,revision:0,notes:[]}),JSON.stringify({version:1,revision:-1,notes:[]}),JSON.stringify({...emptyNotebook(),notes:[note(),note()]})])assert.throws(()=>parseNotebook(value));
});
test("count, individual body and UTF8 total bounds are enforced without truncation",()=>{
 assert.throws(()=>parseNotebook(JSON.stringify({...emptyNotebook(),notes:Array.from({length:101},(_,i)=>note(String(i)))})),/limit/);
 assert.throws(()=>parseNotebook(JSON.stringify({...emptyNotebook(),notes:[note('a','x'.repeat(100001))]})),/limit/);
 assert.throws(()=>parseNotebook(JSON.stringify({...emptyNotebook(),notes:Array.from({length:8},(_,i)=>note(String(i),'界'.repeat(100000)))})),/limit/);
 assert.equal(parseNotebook(JSON.stringify({...emptyNotebook(),notes:[note('a','x'.repeat(100000))]})).notes[0].body.length,100000);
});
test("unsafe source URLs, invalid titles and IDs are rejected",()=>{
 for(const value of [{...note(),title:''},{...note(),title:'bad\nname'},{...note(),id:'../escape'},{...note(),body:'bad\0text'},{...note(),source:{url:'javascript:alert(1)',author:'A'}}])assert.throws(()=>parseNotebook(JSON.stringify({...emptyNotebook(),notes:[value]})));
 for(const url of ['javascript:alert(1)','data:text/html,test','file:///secret','https://user:pass@example.com','//example.com'])assert.equal(noteUrl(url),undefined);
 assert.equal(noteUrl('https://example.com/a?x=1'),'https://example.com/a?x=1');
});
test("keys isolate profile and exact game identity including delimiter collisions",()=>{
 assert.notEqual(notebookKey('a:b','c'),notebookKey('a','b:c'));assert.notEqual(notebookKey('a','steam:1'),notebookKey('b','steam:1'));assert.notEqual(notebookKey('a','steam:1'),notebookKey('a','custom:1'));
 assert.throws(()=>notebookKey('a',''));assert.throws(()=>notebookKey('a','bad\0id'));
});
test("reordering retains bodies and IDs and respects ends",()=>{
 const notes=[note('a'),note('b'),note('c')],before=structuredClone(notes);
 assert.deepEqual(moveGameNote(notes,'b',-1).map(n=>n.id),['b','a','c']);assert.deepEqual(moveGameNote(notes,'b',1).map(n=>n.id),['a','c','b']);
 assert.equal(moveGameNote(notes,'a',-1),notes);assert.equal(moveGameNote(notes,'missing',1),notes);assert.deepEqual(notes,before);
});
test("reviewed import appends without duplicate text and repairs conflicting IDs",()=>{
 const old=[note('a','Existing')],incoming=[note('a','New'),note('b',' Existing '),note('c','New')];
 const result=mergeGameNotes(old,incoming,false);assert.equal(result.length,2);assert.equal(result[0].id,'a');assert.notEqual(result[1].id,'a');assert.equal(result[1].body,'New');assert.equal(old.length,1);
 assert.deepEqual(mergeGameNotes(old,[note('b','Replacement')],true),[note('b','Replacement')]);
});
test("atomic saving preserves failed drafts and detects concurrent writers and ABA revisions",async()=>{
 const values=new Map<string,string>();let fail=false;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('quota');values.set(key,value);}}});
 const first=await saveNotebook('test','steam:1',null,[note()]);assert.equal(first.data.revision,1);
 const both=await Promise.allSettled([saveNotebook('test','steam:1',first.raw,[note('b')]),saveNotebook('test','steam:1',first.raw,[note('c')])]);
 assert.equal(both.filter(result=>result.status==='fulfilled').length,1);assert.equal(both.filter(result=>result.status==='rejected').length,1);
 const saved=values.get(notebookKey('test','steam:1'))!;fail=true;await assert.rejects(saveNotebook('test','steam:1',saved,[note('d')]),/saveError/);assert.equal(values.get(notebookKey('test','steam:1')),saved);
 fail=false;await assert.rejects(saveNotebook('test','steam:1',first.raw,[note()]),/conflict/);
 const draft=[note('z')],pending=saveNotebook('test','steam:1',saved,draft);draft[0].body='Mutation after request';const result=await pending;assert.equal(result.data.notes[0].body,'Strategy');
 await saveNotebook('other','steam:1',null,[note('separate')]);assert.equal(values.size,2);
});


test("profile deletion removes only that profile and cancels queued note saves",async()=>{
 const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:(index:number)=>[...values.keys()][index]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
 await saveNotebook('delete','steam:1',null,[note()]);await saveNotebook('delete:other','steam:1',null,[note()]);
 notebookDrafts.set(notebookKey('delete','steam:2'),{raw:null,notes:[note()]});
 const pending=saveNotebook('delete','steam:3',null,[note()]);purgeGameNotes('delete');
 await assert.rejects(pending,/conflict/);assert.equal(values.size,1);assert.ok(values.has(notebookKey('delete:other','steam:1')));assert.equal(notebookDrafts.has(notebookKey('delete','steam:2')),false);
});
