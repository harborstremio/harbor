import test from "node:test";
import assert from "node:assert/strict";
import { proCrosshair } from "../src/lib/games/pro-crosshair.ts";
import { archivedProPlayers } from "../src/lib/games/pro-config-archives.ts";
import { guideRetryAt } from "../src/lib/games/guide-source-status.ts";
import { cs2CrosshairCode } from "../src/lib/games/pro-crosshair-code.ts";
import type { ProConfig } from "../src/lib/games/pro-configs.ts";

const config=(values:Record<string,string>):ProConfig=>({groups:[{id:"crosshair",title:"Crosshair",values:Object.entries(values).map(([key,value])=>({key,label:key,value}))}],crosshair:"",commands:"",checkedAt:0});
test("crosshair preview reflects published CS2 color, T shape, dot and transparency",()=>{
  const result=proCrosshair(config({cl_crosshairsize:"2",cl_crosshairthickness:"1",cl_crosshairgap:"-2",cl_crosshaircolor:"Custom",cl_crosshaircolor_r:"0",cl_crosshaircolor_g:"255",cl_crosshaircolor_b:"165",cl_crosshair_t:"Yes",cl_crosshairdot:"Yes",cl_crosshairusealpha:"Yes",cl_crosshairalpha:"128"}),"cs2")!;
  assert.equal(result.color,"rgb(0,255,165)");assert.equal(result.rects.length,4);
  assert.ok(result.rects.every(r=>r.opacity===128/255));
  assert.equal(result.rects.filter(r=>r.y<0&&r.height>r.width).length,0);
});
test("VALORANT handles separate horizontal/vertical lengths and bounded opacity",()=>{
  const result=proCrosshair(config({crosshair_color:"#ffffff",show_inner_lines:"On",inner_line_length:"4;6",inner_line_thickness:"2",inner_line_offset:"3",inner_line_opacity:"9",outlines:"On",outline_opacity:"-1"}),"valorant")!;
  assert.equal(result.rects[0].width,4);assert.equal(result.rects[2].height,6);
  assert.equal(result.rects[0].opacity,1);assert.equal(result.outlineOpacity,0);
  assert.equal(proCrosshair(config({crosshair_color:"url(https://invalid.example)"}),"valorant"),null);
});
test("current CS2 pixel fields render without legacy scaling or invented styles",()=>{
  const values={cl_crosshairstyle:"Static Cross",cl_crosshair_length:"2",cl_crosshair_thickness:"2",cl_crosshair_gap:"0",cl_crosshaircolor_r:"0",cl_crosshaircolor_g:"255",cl_crosshaircolor_b:"0",cl_crosshaircolor_a:"128",cl_crosshair_drawoutline:"Half"};
  const result=proCrosshair(config(values),"cs2")!;
  assert.equal(result.color,"rgb(0,255,0)");assert.equal(result.rects.length,4);
  assert.equal(result.rects[0].width,2);assert.equal(result.rects[0].height,2);
  assert.equal(result.rects[0].opacity,128/255);assert.equal(result.outline,.5);
  assert.equal(proCrosshair(config({...values,cl_crosshairstyle:"Static Circle"}),"cs2"),null);
  assert.equal(proCrosshair(config({...values,cl_crosshairstyle:"Dot Only"}),"cs2")?.rects.length,1);
  assert.equal(proCrosshair(config({cl_crosshairstyle:"Dot Only",cl_crosshair_thickness:"2"}),"cs2")?.rects.length,1);
});
test("missing crosshair data and unsupported games do not produce invented previews",()=>{
  assert.equal(proCrosshair(config({}),"cs2"),null);
  assert.equal(proCrosshair(config({sensitivity:"4.8"}),"cod"),null);
});
test("creator snapshots never leak settings between Call of Duty editions",()=>{
  assert.deepEqual(archivedProPlayers("cod","Call of Duty: Modern Warfare II (2022)").map(p=>p.id),["archive-tgd-mw2"]);
  assert.deepEqual(archivedProPlayers("cod","Call of Duty: Modern Warfare 2 (2009)"),[]);
  assert.deepEqual(archivedProPlayers("cod","Call of Duty 4: Modern Warfare"),[]);
  assert.deepEqual(archivedProPlayers("callofdutywarzone").map(p=>p.id),["archive-nate-mw"]);
  assert.deepEqual(archivedProPlayers("cod","Call of Duty: Black Ops II").map(p=>p.id),["archive-nate-bo2"]);
  assert.deepEqual(archivedProPlayers("cod","Call of Duty: Black Ops III"),[]);
  assert.ok(archivedProPlayers("css").every(p=>p.edition==="Counter-Strike: Source"&&p.published&&p.url.startsWith("https://www.gamingcfg.com/config/")));
});
test("rate limits respect seconds and HTTP dates with a finite fallback",()=>{
  const now=Date.parse("2026-10-01T12:00:00Z");
  assert.equal(guideRetryAt("120",now),now+120000);
  assert.equal(guideRetryAt("Thu, 01 Oct 2026 12:02:00 GMT",now),now+120000);
  assert.equal(guideRetryAt(null,now),now+60000);
  assert.equal(guideRetryAt("0",now),now+1000);
});
const CROSSHAIR_PIXEL={cl_crosshairstyle:"Static Cross",cl_crosshair_recoil:"No",cl_crosshairdot:"Yes",cl_crosshair_length:"0",cl_crosshair_thickness:"4",cl_crosshair_gap:"2",cl_crosshair_drawoutline:"No",cl_crosshaircolor_r:"0",cl_crosshaircolor_g:"255",cl_crosshaircolor_b:"145",cl_crosshaircolor_a:"255",cl_crosshair_t:"No",cl_crosshair_dynamic_splitdist:"3",cl_crosshair_dynamic_splitalpha_innermod:"0",cl_crosshair_dynamic_splitalpha_outermod:"1",cl_crosshair_dynamic_maxdist_splitratio:"1",cl_crosshair_dynamic_spread_limit:"255",cl_crosshair_screen_height:"960"};
const CROSSHAIR_LEGACY={cl_crosshairstyle:"Classic Static",cl_crosshair_recoil:"No",cl_crosshairdot:"No",cl_crosshairsize:"1",cl_crosshairthickness:"1",cl_crosshairgap:"-4",cl_crosshair_drawoutline:"No",cl_crosshair_outlinethickness:"1",cl_crosshaircolor:"Cyan",cl_crosshaircolor_r:"50",cl_crosshaircolor_g:"150",cl_crosshaircolor_b:"50",cl_crosshairusealpha:"Yes",cl_crosshairalpha:"250",cl_crosshair_t:"No",cl_crosshairgap_useweaponvalue:"No",cl_crosshair_dynamic_splitdist:"7",cl_fixedcrosshairgap:"-5",cl_crosshair_dynamic_splitalpha_innermod:"1",cl_crosshair_dynamic_splitalpha_outermod:"0.5",cl_crosshair_dynamic_maxdist_splitratio:"0.3"};
const settings=(values:Record<string,string>)=>Object.entries(values).map(([key,value])=>({key,label:key,value}));
test("CS2 share codes reproduce the provider's own code and never fill in absent values",()=>{
  assert.equal(cs2CrosshairCode(settings(CROSSHAIR_PIXEL)),"CSGO-VT5h9-bzS2V-hZXPc-7WkTt-rVTVP");
  assert.match(cs2CrosshairCode(settings(CROSSHAIR_LEGACY)),/^CSGO(-[\w]{5}){5}$/);
  const { cl_crosshair_screen_height:_height, ...incomplete }=CROSSHAIR_PIXEL;
  assert.equal(cs2CrosshairCode(settings(incomplete)),"");
  assert.equal(cs2CrosshairCode(settings({ ...CROSSHAIR_LEGACY, cl_fixedcrosshairgap:"" })),"");
  assert.equal(cs2CrosshairCode([]),"");
});
