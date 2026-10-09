import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { heroLogoTitleKey, indexRetroLogoFiles, retroHeroLogos, steamLibraryLogo } from "../src/lib/games/hero-logo-data";
import { darkMonochromeLogo, gameLogoShape } from "../src/lib/games/logo-art";
import { romGameArtwork } from "../src/lib/games/rom-editorial";

test("GTA V stacked title logos stand alone while unknown compact emblems retain text", () => {
  for (const appId of [271590, 3240220]) {
    assert.equal(gameLogoShape(400, 440, appId), "wide");
    assert.equal(gameLogoShape(0, 0, appId), "compact");
  }
  assert.equal(gameLogoShape(400, 440, 123), "compact");
  assert.equal(gameLogoShape(800, 200, 123), "wide");
});

const info = (file = "a".repeat(40)+"/logo_2x.png") => ({ status:"success", data:{ "123":{ appid:"123", common:{ gameid:"123", type:"Game", library_assets_full:{ library_logo:{ image2x:{ english:file } } } } } } });
test("Steam library artwork keeps exact app identity and a publisher logo path", () => {
  assert.equal(steamLibraryLogo(info(),123),`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/${"a".repeat(40)}/logo_2x.png`);
  assert.equal(steamLibraryLogo(info(),124),undefined);
  for(const file of ["../logo.png","https://example.com/logo.png","cover.jpg","x/logo.png","logo.png?url=other"])
    assert.equal(steamLibraryLogo(info(file),123),undefined);
  const wrong=info();wrong.data[123].common.gameid="124";assert.equal(steamLibraryLogo(wrong,123),undefined);
  const tool=info();tool.data[123].common.type="Tool";assert.equal(steamLibraryLogo(tool,123),undefined);
});

test("Retro spelling handles articles and accents without collapsing editions or sequels", () => {
  assert.equal(heroLogoTitleKey("The Legend of Zelda: The Minish Cap"),heroLogoTitleKey("Legend of Zelda, The - The Minish Cap"));
  assert.equal(heroLogoTitleKey("Pokémon FireRed"),heroLogoTitleKey("Pokemon - FireRed Version"));
  assert.notEqual(heroLogoTitleKey("Super Mario World"),heroLogoTitleKey("Super Mario World 2: Yoshi's Island"));
  assert.notEqual(heroLogoTitleKey("Final Fantasy VI"),heroLogoTitleKey("Final Fantasy VI Advance"));
});

test("Retro index prefers a released English-region mark and excludes unsafe/sample files", () => {
  const indexed=indexRetroLogoFiles(["Metroid Fusion (Japan).png","Metroid Fusion (USA) (Virtual Console).png","Metroid Fusion (USA).png","Metroid Fusion (USA) (Beta).png","../Other (USA).png","Unknown (USA) (Proto).png"]);
  assert.equal(indexed.metroidfusion,"Metroid Fusion (USA).png");
  assert.equal(Object.keys(indexed).length,1);
  assert.equal(retroHeroLogos({24:indexed},["Metroid Fusion"],[24])[0],"https://thumbnails.libretro.com/Nintendo%20-%20Game%20Boy%20Advance/Named_Logos/Metroid%20Fusion%20(USA).png");
  assert.deepEqual(retroHeroLogos({24:indexed},["Metroid Fusion"],[19]),[]);
  assert.deepEqual(retroHeroLogos({24:indexed},["Metroid Fusion"],[24],5),[]);
  assert.deepEqual(retroHeroLogos({24:indexed},["Metroid Fusion Remastered"],[24]),[]);
  const ellipsis=indexRetroLogoFiles(["NiGHTS into Dreams... (USA).png","../NiGHTS into Dreams... (USA).png","Bad\u0000Name (USA).png"]);
  assert.deepEqual(Object.keys(ellipsis),["nightsintodreams"]);
});

test("Published index resolves SNES/GBA titles and keeps remakes on their own platform", () => {
  const index=JSON.parse(readFileSync(new URL("../src/lib/games/retro-logo-index.json",import.meta.url),"utf8"));
  for(const [name,platform] of [["Super Metroid",19],["Chrono Trigger",19],["Metroid Fusion",24],["The Legend of Zelda: The Minish Cap",24],["Pokémon FireRed",24],["Super Mario Bros. 2",18],["GoldenEye 007",4],["Kirby's Dream Land",33]] as const)
    assert.equal(retroHeroLogos(index,[name],[platform]).length,1,name);
  assert.deepEqual(retroHeroLogos(index,["Chrono Trigger"],[6]),[]);
});

test("Expanded retro index resolves original Sega and GameCube titles without crossing platforms", () => {
  const index=JSON.parse(readFileSync(new URL("../src/lib/games/retro-logo-index.json",import.meta.url),"utf8"));
  for(const [name,platform] of [["Sonic the Hedgehog",29],["NiGHTS into Dreams...",32],["Alex Kidd in Miracle World",64],["Super Smash Bros. Melee",21]] as const)
    assert.equal(retroHeroLogos(index,[name],[platform],0).length,1,name);
  assert.deepEqual(retroHeroLogos(index,["Sonic the Hedgehog"],[7],0),[]);
  assert.deepEqual(retroHeroLogos(index,["Sonic the Hedgehog 2"],[29],5),[]);
});

test("ROM hero gaps use distinct exact-game assets, never a collection or remake substitution", () => {
  const expected=new Map([[375,"metal-gear-solid.png"],[427,"final-fantasy-vii.png"],[421,"final-fantasy-ix.png"],[1128,"symphony-of-the-night.png"],[1185,"crash-bandicoot.png"],[125,"diablo.svg"],[358,"super-mario-bros.svg"],[1068,"super-mario-bros-3.svg"],[4438,"sonic-the-hedgehog-2.png"]]);
  const paths=new Set<string>();
  for(const [id,file] of expected){
    const art=romGameArtwork(id);assert.equal(art?.logo,`/games/roms/${file}`);assert.ok(art?.source.startsWith("https://"));
    assert.ok(readFileSync(new URL(`../public${art!.logo}`,import.meta.url)).byteLength>100);
    paths.add(art!.logo);
  }
  assert.equal(paths.size,expected.size);
  assert.equal(romGameArtwork(125)?.monochrome,true);assert.equal(romGameArtwork(427)?.monochrome,undefined);
  assert.equal(romGameArtwork(undefined),undefined);assert.equal(romGameArtwork(999999999),undefined);
});

test("only dark monochrome transparent logos receive the white variant", () => {
 const pixels=(color:number[])=>new Uint8ClampedArray([...Array.from({length:100},()=>color).flat(),0,0,0,0,0,0,0,0]);
 assert.equal(darkMonochromeLogo(pixels([0,0,0,255])),true);
 assert.equal(darkMonochromeLogo(pixels([50,50,50,128])),true);
 assert.equal(darkMonochromeLogo(pixels([255,255,255,255])),false);
 assert.equal(darkMonochromeLogo(pixels([80,5,5,255])),false);
 assert.equal(darkMonochromeLogo(new Uint8ClampedArray([0,0,0,255])),false);
 assert.equal(darkMonochromeLogo(new Uint8ClampedArray(12)),false);
});
