import test from "node:test";
import assert from "node:assert/strict";
import { parseProPortraitSearch, proPortraitId, proPortraitImage } from "../src/lib/games/pro-portrait-data.ts";

const image="https://prosettings.net/wp-content/uploads/flamez-50x50.png";
const player={url:"https://prosettings.net/players/flamez/",title:"flameZ",thumbnail:image};
test("portrait API joins exact player profiles and ignores similarly named cosmetics",()=>{
  const data={groups:[{type:"cs2_cosmetic",items:[{...player,thumbnail:"https://prosettings.net/wp-content/uploads/sticker.png"}]},{type:"player",items:[{...player,url:"https://prosettings.net/players/flame/"},player]}]};
  assert.equal(parseProPortraitSearch(data,"flamez"),image);
  assert.equal(parseProPortraitSearch(data,"flamezzz"),"");
});
test("portrait identity and image validation reject alternate hosts and malformed payloads",()=>{
  for(const url of ["https://prosettings.net.evil.test/players/flamez/","https://x@prosettings.net/players/flamez/","https://prosettings.net/players/flamez/?other=1","http://prosettings.net/players/flamez/"])assert.equal(proPortraitId(url),"");
  for(const url of ["javascript:alert(1)","https://other.test/flamez.png","https://prosettings.net/wp-content/themes/logo.png","https://prosettings.net/wp-content/uploads/face.svg"])assert.equal(proPortraitImage(url),"");
  for(const data of [null,{},[],{groups:[null,{}, {type:"player",items:"bad"}]}])assert.equal(parseProPortraitSearch(data,"flamez"),"");
  assert.equal(parseProPortraitSearch({groups:[{type:"player",items:[{...player,thumbnail:"https://other.test/flamez.png"}]}]},"flamez"),"");
});
