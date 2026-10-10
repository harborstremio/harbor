import test from "node:test";
import assert from "node:assert/strict";
import { hackDriveDownload, hackDriveFile, hackGithubRepository, projectPlusFiles, PPLUS_REPOSITORY } from "../src/lib/games/hack-files";
import { hackRelease } from "../src/lib/games/hack-catalog";
import { hackVideoQuery, hackVideoPage } from "../src/lib/games/hack-videos";

test("Project+ assets retain API sizes/digests and reject unrelated or malformed links", () => {
  const asset={name:"Project+.v3.2.Wii.zip",browser_download_url:`https://github.com/${PPLUS_REPOSITORY}/releases/download/v3.2/Wii.zip`,size:1234,digest:`sha256:${"a".repeat(64)}`};
  const result=projectPlusFiles({tag_name:"v3.2",assets:[asset,{...asset,browser_download_url:"https://github.com/someone/other/releases/download/v3.2/Wii.zip"},{...asset,browser_download_url:"not a URL"},{...asset,name:"game.iso"}]});
  assert.equal(result.version,"v3.2");assert.equal(result.files.length,1);assert.equal(result.files[0].sizeBytes,1234);assert.equal(result.files[0].sha256,"a".repeat(64));
  assert.throws(()=>projectPlusFiles({draft:true,assets:[asset]}));assert.throws(()=>projectPlusFiles({prerelease:true,assets:[asset]}));
});
test("Project M uses its actual download page even when metadata still points at an old homepage",()=>{
  assert.equal(hackRelease({name:"Project M",projectUrl:"https://old.example/"})?.page,"https://pmunofficial.com/en/download/");
  assert.equal(hackRelease({name:"Project M"})?.method,"modpack");assert.equal(hackRelease({name:"Project+"})?.method,"modpack");
});

test("creator releases work for any exact GitHub project, without crossing repository identities", () => {
  assert.equal(hackGithubRepository("https://github.com/creator/game-hack/releases"), "creator/game-hack");
  assert.equal(hackGithubRepository("https://github.com/creator/game-hack/releases/tag/v2"), "creator/game-hack");
  assert.equal(hackGithubRepository("https://github.com/creator/game-hack/issues"), undefined);
  assert.equal(hackGithubRepository("https://github.com.example/creator/game-hack"), undefined);
  const file = {name:"game.bps",browser_download_url:"https://github.com/creator/game-hack/releases/download/v2/game.bps"};
  assert.deepEqual(projectPlusFiles({tag_name:"v2",assets:[file,{...file,browser_download_url:"https://github.com/other/game-hack/releases/download/v2/game.bps"}]}, "creator/game-hack").files.map(item=>item.name), ["game.bps"]);
  assert.equal(hackRelease({name:"A hack",links:[{url:"https://www.igdb.com/games/a-hack"},{url:"https://github.com/creator/game-hack"}]})?.page,"https://github.com/creator/game-hack");
});

test("Sonic Riders Enhanced exposes the creator patcher download instead of requiring a BPS file", () => {
  const release = hackRelease({name:"Sonic Riders Enhanced"});
  assert.equal(release?.method,"modpack");
  assert.match(release?.page ?? "", /sonic-riders-enhanced-version-1-0\.3193/);
  assert.match(release?.download ?? "", /1lFnxUqnJUl-bDxEqZd2UyhljoFKJcx8t/);
});

test("published Drive files resolve only with a bounded partial-file response, never an HTML interstitial", () => {
  const page = 'https://drive.google.com/file/d/1lFnxUqnJUl-bDxEqZd2UyhljoFKJcx8t/view';
  const url = hackDriveDownload(page)!;
  assert.equal(new URL(url).searchParams.get('id'), '1lFnxUqnJUl-bDxEqZd2UyhljoFKJcx8t');
  assert.equal(hackDriveDownload(page.replace('drive.google.com','drive.google.com.example')), undefined);
  assert.equal(hackDriveDownload('https://drive.google.com/uc?id=abcdefghijklmnopqrst&id=another'),undefined);
  const headers = {'content-range':'bytes 0-7/850550346','content-disposition':'attachment; filename="Sonic Riders Enhanced v1.0 Patcher.zip"','content-type':'application/octet-stream'};
  assert.deepEqual(hackDriveFile(url,new Response(null,{status:206,headers})),{name:'Sonic Riders Enhanced v1.0 Patcher.zip',url,kind:'direct',sizeBytes:850550346});
  assert.equal(hackDriveFile(url,new Response(null,{status:200,headers})),undefined);
  assert.equal(hackDriveFile(url,new Response(null,{status:206,headers:{...headers,'content-type':'text/html'}})),undefined);
  assert.equal(hackDriveFile(url,new Response(null,{status:206,headers:{...headers,'content-disposition':'attachment; filename="../game.iso"'}})),undefined);
});
test("Video discovery pages exact original-game relationships and skips unrelated unofficial ports",()=>{
  const query=hackVideoQuery(24,1559);assert.match(query,/videos != null/);assert.match(query,/parent_game = 1559/);assert.match(query,/offset 24/);assert.throws(()=>hackVideoQuery(0,-1));
  const item={id:9,name:"A hack",game_type:5,summary:"A new adventure",parent_game:{id:1559,name:"FireRed"},platforms:[{id:24,name:"GBA"}],videos:[{video_id:"abcdefghijk",name:"Gameplay"}]};
  const page=hackVideoPage([item,{...item,id:10,parent_game:{id:1,name:"Other"}},{...item,id:11,summary:"An unofficial port for PSP"}],0,1559);
  assert.equal(page.games.length,1);assert.equal(page.games[0].gameId,9);assert.equal(page.nextOffset,null);
  assert.equal(hackVideoPage(Array.from({length:24},(_,i)=>({...item,id:i+1})),24).nextOffset,48);
});
