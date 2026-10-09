import test from "node:test";
import assert from "node:assert/strict";
import { recentSetupParent, setupLocationChoices, setupParent } from "../src/lib/games/setup-locations";
import type { SetupJob } from "../src/lib/games/setup";

test("install parents preserve Windows, UNC and POSIX roots", () => {
  assert.equal(setupParent("D:\\Game"), "D:\\");
  assert.equal(setupParent("\\\\?\\W:\\Games\\Game"), "W:\\Games");
  assert.equal(setupParent("\\\\server\\share\\Game"), "\\\\server\\share");
  assert.equal(setupParent("/Game"), "/");
  assert.equal(setupParent("/games/Game"), "/games");
});
test("recent location belongs to the active profile", () => {
  const jobs = [{ profile:"one",destination:"D:\\Games\\A",startedAt:2 },{ profile:"two",destination:"F:\\Other\\B",startedAt:3 }] as SetupJob[];
  assert.equal(recentSetupParent(jobs,"one"),"D:\\Games");
  assert.equal(recentSetupParent(jobs,"missing"),"");
});
test("quick choices deduplicate case-insensitive locations and retain unknown free space", () => {
  const drive={path:"D:\\",label:"Data (D:)",availableBytes:null};
  const options=setupLocationChoices({drives:[drive],selected:{...drive,path:"d:/"}},"Game: One","D:\\Downloads\\Game");
  assert.equal(options.length,1);assert.equal(options[0].recent,true);assert.equal(options[0].destination,"d:\\Game_ One");assert.equal(options[0].availableBytes,null);
});
test("quick choices cannot suggest the download folder, its children or its ancestor", () => {
  const loc=(path:string)=>({path,label:path,availableBytes:100});
  assert.deepEqual(setupLocationChoices({drives:[loc("D:\\"),loc("D:\\Game")],selected:null},"Game","D:\\Game"),[]);
  assert.deepEqual(setupLocationChoices({drives:[loc("D:\\")],selected:null},"Game","D:\\Game\\Downloads"),[]);
  assert.deepEqual(setupLocationChoices({drives:[loc("D:\\")],selected:null},"Game","D:\\"),[]);
  assert.equal(setupLocationChoices({drives:[loc("D:\\")],selected:null},"Game","D:\\Games").length,1);
  assert.deepEqual(setupLocationChoices({drives:[loc("D:\\")],selected:null},"CON","D:\\Downloads"),[]);
});
