import test from "node:test";
import assert from "node:assert/strict";
import { RESIDENT_EVIL_STORY, residentEvilStoryAvailable, storyDate } from "../src/lib/games/story-timelines.ts";
test("story chronology requires exact franchise identity and preserves overlap and adaptations", () => {
  assert.equal(residentEvilStoryAvailable({franchises:[{id:100,name:'Resident Evil'}]}),false);
  assert.equal(residentEvilStoryAvailable({franchises:[{id:29,name:'Resident Evil'}]}),true);
  const three=RESIDENT_EVIL_STORY.find(entry=>entry.key==='three')!,two=RESIDENT_EVIL_STORY.find(entry=>entry.key==='two')!;
  assert.ok(three.day!<two.day!);assert.equal(three.note,'overlap');assert.equal(two.originalId,880);
  assert.equal(storyDate(RESIDENT_EVIL_STORY.find(entry=>entry.key==='darkside')!,'en'),'1998–2002');
  assert.deepEqual(RESIDENT_EVIL_STORY.flatMap(entry=>entry.media?[entry.media.id]:[]),['tmdb:movie:13648','tmdb:tv:110642','tmdb:movie:133121','tmdb:movie:400136']);
});
