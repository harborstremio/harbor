import test from "node:test";
import assert from "node:assert/strict";
import { jumpBackInPlayingKey } from "../src/lib/music/jump-back-in-playing.ts";
import { recordMusicLibraryPlayback, beginMusicQueue, getMusicPlaybackOrigin } from "../src/lib/music/playback-origin.ts";
import type { MusicTrack } from "../src/lib/music/types";

test("Jump back in identifies the exact queue owner", () => {
  assert.equal(jumpBackInPlayingKey({kind:"playlist",id:"one",name:"One"}),"playlist:one");
  assert.equal(jumpBackInPlayingKey({kind:"similar",id:"mix:genre:116",name:"Hip-hop Mix"}),"similar:mix:genre:116");
  assert.equal(jumpBackInPlayingKey({kind:"library",id:"liked",name:"Saved"}),"liked");
  assert.equal(jumpBackInPlayingKey({kind:"catalog",id:"catalog:album:1",name:"Album",item:{kind:"album",id:"1",connectorId:"catalog",title:"Album",artist:"Artist",artwork:""}}),"album:1");
  assert.equal(jumpBackInPlayingKey(null),null);
});
test("Saved queue ownership survives resolving a different playback provider", () => {
  const track: MusicTrack={id:"one",connectorId:"catalog",title:"Song",artist:"Artist",artwork:"",durationSeconds:10,durationLabel:"0:10"};
  recordMusicLibraryPlayback("liked","Saved",[track]);
  beginMusicQueue([{...track,id:"resolved",connectorId:"youtube_music",collectionOrigin:{id:track.id,connectorId:track.connectorId}}],[]);
  assert.equal(jumpBackInPlayingKey(getMusicPlaybackOrigin()),"liked");
  beginMusicQueue([{...track,id:"unrelated"}],[]);
  assert.equal(jumpBackInPlayingKey(getMusicPlaybackOrigin()),null);
});
