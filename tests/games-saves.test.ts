import assert from "node:assert/strict";
import test from "node:test";
import { parseSaveFolders, readSaveFolders, writeSaveFolders, saveFoldersKey, saveErrorKey, filterSaveChanges, saveChangeSide, type SaveRestoreChange } from "../src/lib/games/saves.ts";
test("save folder choices isolate both profiles and game identities and preserve failed writes", () => {
  const values = new Map<string,string>(); let full = false;
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(full)throw Error();values.set(key,value);}} as Storage;
  const folders = {version:1 as const,source:"W:/雨 & dusk/saves",vault:"W:/backups"};
  writeSaveFolders("a/b","steam:10",folders); assert.deepEqual(readSaveFolders("a/b","steam:10"),folders);
  assert.equal(readSaveFolders("a%2Fb","steam:10").source,""); assert.equal(readSaveFolders("a/b","igdb:10").source,"");
  assert.notEqual(saveFoldersKey("a/b","steam:10"),saveFoldersKey("a%2Fb","steam:10"));
  full=true;assert.throws(()=>writeSaveFolders("a/b","steam:10",{...folders,source:"W:/other"}),/save_config_write/);assert.deepEqual(readSaveFolders("a/b","steam:10"),folders);
});
test("corrupt folder settings are explicit errors and untrusted errors do not become UI copy", () => {
  for (const raw of ['broken','{}','{"version":2,"source":"","vault":""}',JSON.stringify({version:1,source:"x\0y",vault:""})]) assert.throws(()=>parseSaveFolders(raw),/save_config/);
  assert.equal(saveErrorKey("save_changed"),"games.backups.save_changed");assert.equal(saveErrorKey("secret/path/here"),"games.backups.failed");
});

const change = (values: Partial<SaveRestoreChange> = {}): SaveRestoreChange => ({ path:"slot/one.sav",status:"replace",directory:false,currentBytes:0,snapshotBytes:20,...values });
test("restore comparison distinguishes an empty file from a missing file or folder", () => {
  assert.deepEqual(saveChangeSide(change(),"current"),{kind:"file",bytes:0});
  assert.deepEqual(saveChangeSide(change({status:"add",currentBytes:null}),"current"),{kind:"absent"});
  assert.deepEqual(saveChangeSide(change({status:"remove",snapshotBytes:null}),"snapshot"),{kind:"absent"});
  const folder=change({directory:true,status:"add",currentBytes:null,snapshotBytes:null});
  assert.deepEqual(saveChangeSide(folder,"snapshot"),{kind:"folder"});
  assert.deepEqual(saveChangeSide(folder,"current"),{kind:"absent"});
  for(const bytes of [null,-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]) assert.deepEqual(saveChangeSide(change({currentBytes:bytes}),"current"),{kind:"unknown"});
});
test("filtering preserves exact paths, directory transitions and the complete restore plan", () => {
  const files=[change({path:"Café/零.sav"}),change({path:"slot",status:"remove"}),change({path:"slot",status:"add",directory:true,currentBytes:null,snapshotBytes:null})];
  const original=structuredClone(files);
  assert.deepEqual(filterSaveChanges(files," CAFE\u0301\\零 ","all"),[files[0]]);
  assert.deepEqual(filterSaveChanges(files,"slot","all"),files.slice(1));
  assert.deepEqual(filterSaveChanges(files,"slot","remove"),[files[1]]);
  assert.deepEqual(filterSaveChanges(files,"missing","add"),[]);
  assert.deepEqual(files,original);
});
