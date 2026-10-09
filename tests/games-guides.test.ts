import test from "node:test";
import assert from "node:assert/strict";
import { parseGuideVideos, parseGuideVideoPage, parseKickGuides } from "../src/lib/games/guides-data.ts";

function results(titles: string[], live = false) {
  return `var ytInitialData = ${JSON.stringify({ contents: titles.map((title, index) => ({
    videoRenderer: {
      videoId: `guide${String(index).padStart(6, "0")}`,
      title: { simpleText: title },
      badges: live ? [{ metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_LIVE_NOW" } }] : [],
    },
  })) })};`;
}

test("Pokémon videos accept creator names without Version and spaced compound editions", () => {
  const titles = ["Pokémon Fire Red walkthrough", "Pokemon FireRed Version Part 1", "Pokemon LeafGreen walkthrough", "Pokemon Red walkthrough", "Pokemon FireRed 2 walkthrough"];
  assert.deepEqual(parseGuideVideos(results(titles), "Pokémon FireRed Version", false).map(item => item.title), titles.slice(0, 2));
  assert.deepEqual(parseGuideVideos(results(["Pokemon Soul Silver walkthrough", "Pokemon Silver walkthrough"]), "Pokémon SoulSilver Version", false).map(item=>item.title), ["Pokemon Soul Silver walkthrough"]);
  assert.equal(parseGuideVideos(results(["Pokemon Crystal walkthrough"]), "Pokémon Crystal Version", false).length, 1);
  assert.equal(parseGuideVideos(results(["Pokemon Yellow walkthrough"]), "Pokémon Yellow Version: Special Pikachu Edition", false).length, 1);
});

test("guide videos match Roman and decimal game numbers without mixing sequels", () => {
  const titles = ["Hades 2 beginner guide", "Hades II walkthrough", "Hades III walkthrough", "Hades walkthrough"];
  assert.deepEqual(parseGuideVideos(results(titles), "Hades II", false).map(item => item.title), titles.slice(0, 2));
  assert.deepEqual(parseGuideVideos(results(titles), "Hades 2", false).map(item => item.title), titles.slice(0, 2));
  assert.deepEqual(parseGuideVideos(results(titles), "Hades", false).map(item => item.title), [titles[3]]);
  const dated = "Hades 2 2026 beginner guide";
  assert.deepEqual(parseGuideVideos(results([dated]), "Hades II", false).map(item => item.title), [dated]);
});

test("number aliases retain the rest of the selected title and live status", () => {
  const titles = ["Age of Empires 2 Definitive Edition guide", "Age of Empires II guide", "Age of Empires III Definitive Edition guide"];
  assert.deepEqual(parseGuideVideos(results(titles, true), "Age of Empires II: Definitive Edition", true).map(item => item.title), [titles[0]]);
  assert.deepEqual(parseGuideVideos(results(titles), "Age of Empires II: Definitive Edition", true), []);
});

test("title words are preserved and larger sequel numbers cannot match the original", () => {
  const titles = ["V Rising guide", "5 Rising guide", "I Expect You To Die guide", "1 Expect You To Die guide", "Final Fantasy XVI guide", "Final Fantasy 16 guide"];
  assert.deepEqual(parseGuideVideos(results(titles), "V Rising", false).map(item => item.title), [titles[0]]);
  assert.deepEqual(parseGuideVideos(results(titles), "I Expect You To Die", false).map(item => item.title), [titles[2]]);
  assert.deepEqual(parseGuideVideos(results(titles), "Final Fantasy XVI", false).map(item => item.title), titles.slice(4));
  assert.deepEqual(parseGuideVideos(results(titles), "Final Fantasy", false), []);
});

test("CS2 shorthand titles match the current game without adding CS:GO results",()=>{
  const titles=["CS2 aiming guide","Counter-Strike 2 utility guide","CS:GO settings","Counter-Strike 3 guide"];
  assert.deepEqual(parseGuideVideos(results(titles),"Counter-Strike 2",false).map(item=>item.title),titles.slice(0,2));
});

test("video results are not truncated to eighteen and expose the real continuation",()=>{
  const html=results(Array.from({length:25},(_,i)=>`Hades II walkthrough ${2020+i}`));
  assert.equal(parseGuideVideos(html,"Hades II",false).length,25);
  const data={onResponseReceivedCommands:[{appendContinuationItemsAction:{continuationItems:[{continuationItemRenderer:{continuationEndpoint:{commandMetadata:{webCommandMetadata:{apiUrl:"/youtubei/v1/search"}},continuationCommand:{token:"NEXT_PROVIDER_PAGE"}}}}]}}]};
  assert.deepEqual(parseGuideVideoPage(data,"Hades II",false,"2.20260930.00.00").cursor,{token:"NEXT_PROVIDER_PAGE",clientVersion:"2.20260930.00.00"});
  assert.equal(parseGuideVideoPage(data,"Hades II",false).cursor,undefined);
});

test("Kick server data validates category, deduplicates channels and rejects unsafe images",()=>{
  const stream=(slug:string,game="Counter-Strike 2",image="https://images.kick.com/image.webp")=>({title:"Ranked",channel:{slug,username:slug},category:{name:game},thumbnail:{src:image}});
  const payload=`1:${JSON.stringify({data:{livestreams:[stream("player"),stream("player"),stream("other","Counter-Strike: Global Offensive"),stream("../../bad"),stream("safe","Counter-Strike 2","https://evil.example/pixel")]}})}\n`;
  const html=`<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
  const items=parseKickGuides(html,"Counter-Strike 2");
  assert.deepEqual(items.map(item=>item.id),["player","safe"]);assert.equal(items[1].image,"");assert.equal(items[0].live,true);
  assert.throws(()=>parseKickGuides("<html>Temporarily unavailable</html>","Counter-Strike 2"));
});
