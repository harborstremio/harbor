import assert from "node:assert/strict";
import test from "node:test";
import { isOsrs, osrsChartPaths, osrsHistoryUrl, parseOsrsHistory, parseOsrsItems, parseOsrsLatest } from "../src/lib/games/osrs-data.ts";
const now = Date.UTC(2026, 9, 2, 12), end = now / 1000, start = end - 3600;
const row = (timestamp = start) => ({ timestamp, avgHighPrice: 3_500_000_000.25, avgLowPrice: 3_600_000_000.75, highPriceVolume: 2, lowPriceVolume: 3 });
const history = () => ({ itemId: 4151, startTimestamp: start, endTimestamp: end, timestep: 300, data: [row()] });
test("OSRS identity never attaches its economy to RuneScape or another Steam game", () => { assert.equal(isOsrs({ steamId: 1343370 }), true); assert.equal(isOsrs({ igdbId: 79824 }), true); assert.equal(isOsrs({ steamId: 1343400, igdbId: 79824 }), false); assert.match(osrsHistoryUrl(4151, "7d"), /api\/v2\/osrs\/timeseries\?id=4151&lookback=7d$/); assert.throws(() => osrsHistoryUrl(-1, "7d")); });
test("item mapping keeps original file identity and rejects malformed/duplicate items", () => {
 const item = { id:4151, name:"Abyssal whip", examine:"A weapon from the abyss.", members:true, icon:"Abyssal whip.png", limit:70, highalch:72000 };
 assert.equal(parseOsrsItems([item])[0].icon,"https://oldschool.runescape.wiki/images/Abyssal_whip.png");assert.throws(()=>parseOsrsItems([item,item]));assert.throws(()=>parseOsrsItems([{...item,icon:"../evil.png"}]));assert.equal(parseOsrsItems([{...item,limit:undefined}])[0].limit,null);
});
test("latest sides preserve independent ages, crossed prices and values above signed32bit", () => {
 const data={"4151":{high:3_500_000_000,highTime:end-1000,low:3_600_000_000,lowTime:end-100}};const p=parseOsrsLatest({data},4151,now);assert.equal(p.high?.price,3_500_000_000);assert.ok(p.high!.at<p.low!.at);assert.equal(parseOsrsLatest({data:{}},4151,now).high,null);
 assert.throws(()=>parseOsrsLatest({data},385,now));assert.throws(()=>parseOsrsLatest({data:{4151:{...data[4151],highTime:end+86400}}},4151,now));assert.throws(()=>parseOsrsLatest({data:{4151:{...data[4151],high:null}}},4151,now));assert.equal(parseOsrsLatest({data:{4151:{...data[4151],high:null,highTime:null}}},4151,now).high,null);
});
test("v2 history honors returned boundaries/resolution and retains decimal averages", () => {
 assert.throws(()=>parseOsrsHistory(history(),4151,now,"7d"));
 const h=parseOsrsHistory(history(),4151,now);assert.equal(h.step,300000);assert.equal(h.points[0].high,3_500_000_000.25);assert.equal(h.start,start*1000);assert.throws(()=>parseOsrsHistory({...history(),itemId:385},4151,now));assert.throws(()=>parseOsrsHistory({...history(),data:[row(start+1)]},4151,now));assert.throws(()=>parseOsrsHistory({...history(),data:[row(),row()]},4151,now));assert.throws(()=>parseOsrsHistory({...history(),data:[{...row(),avgHighPrice:null}]},4151,now));
});
test("missing trades break chart paths, never interpolated or relabelled as zero", () => {
 const h=parseOsrsHistory({...history(),data:[row(),row(start+300),{...row(start+600),avgHighPrice:null,highPriceVolume:0},row(start+900),row(start+1200),row(start+1800)]},4151,now);assert.equal(h.points[2].high,null);assert.equal(osrsChartPaths(h,"high",600,180).length,3);assert.equal(osrsChartPaths(h,"low",600,180).length,2);assert.deepEqual(parseOsrsHistory({...history(),data:[]},4151,now).points,[]);
});
