import test from "node:test";
import assert from "node:assert/strict";
import {replacementFile,transferFilename,transferStateKey,transferProgressBytes} from "../src/lib/games/transfer-relink.ts";
import type {GameTransfer} from "../src/lib/games/transfers.ts";

const record={id:"one",profile:"p",destination:"D:\\Games\\game.zip",status:"paused",sourceLink:"https://gofile.io/d/abc123",expectedBytes:1234,expectedSha256:"a".repeat(64)} as GameTransfer;
test("fresh file selection preserves identity and checks name, size and checksum",()=>{
 const request={url:"https://cdn.example/game.zip?new=1",sourceLink:record.sourceLink,expectedBytes:1234,expectedSha256:"A".repeat(64)};
 assert.equal(transferFilename(record),"game.zip");
 assert.equal(replacementFile(record,request,"GAME.ZIP",true).url,request.url);
 assert.throws(()=>replacementFile(record,request,"GAME.ZIP",false));
 for(const changed of [{sourceLink:undefined},{expectedBytes:1235},{expectedBytes:0},{expectedSha256:"b".repeat(64)},{url:"file:///game.zip"},{url:"https://user:secret@example.com/game.zip"}])assert.throws(()=>replacementFile(record,{...request,...changed},"game.zip",true));
});
test("unknown sizes and tokenized URLs can be reviewed without inventing metadata",()=>{
 const next=replacementFile({...record,total:null,expectedBytes:null,expectedSha256:null},{url:"https://cdn.example/opaque?token=abc",sourceLink:record.sourceLink},"game.zip",true);
 assert.equal(next.expectedBytes,undefined);assert.equal(next.expectedSha256,undefined);
});
test("saved-byte checking is distinct from the final checksum and terminal errors",()=>{
 assert.equal(transferStateKey({...record,status:"checking",checkingPartial:0}),"games.download.relink.checking");
 assert.equal(transferStateKey({...record,status:"checking",checkingPartial:123}),"games.download.relink.checking");
 assert.equal(transferStateKey({...record,status:"checking"}),"games.download.state.checking");
 assert.equal(transferStateKey({...record,status:"failed",checkingPartial:123}),"games.download.state.failed");
 assert.deepEqual(transferProgressBytes({...record,status:"checking",checkingPartial:250,received:1000,total:2000}),{received:250,total:1000});
 assert.deepEqual(transferProgressBytes({...record,status:"downloading",received:1250,total:2000}),{received:1250,total:2000});
});
