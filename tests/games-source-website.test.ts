import test from 'node:test';
import assert from 'node:assert/strict';
import { websitePostsUrl } from '../src/lib/games/source-website.ts';
import { sourceWebsite } from '../src/lib/games/sources.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';

test('website queries use the published API root, title search and provider pages without guessing a host',()=>{
 const website={kind:'wordpress' as const,api:'https://example.org/blog/wp-json/',site:'https://example.org/blog/'};
 const url=new URL(websitePostsUrl(website,'Older game & sequel',4));
 assert.equal(url.pathname,'/blog/wp-json/wp/v2/posts');assert.equal(url.searchParams.get('search'),'Older game & sequel');assert.equal(url.searchParams.get('search_columns[]'),'post_title');assert.equal(url.searchParams.get('page'),'4');assert.equal(url.searchParams.get('per_page'),'30');
 const plain=new URL(websitePostsUrl({...website,api:'https://example.org/?rest_route=/'},'',2));assert.equal(plain.searchParams.get('rest_route'),'/wp/v2/posts');assert.equal(plain.searchParams.has('search'),false);assert.equal(plain.pathname,'/');
 for(const page of [0,-1,1.5,5001])assert.throws(()=>websitePostsUrl(website,'',page),/source_limit/);
});

test('website subscriptions persist only supported adapter config with matching canonical site',()=>{
 const website={kind:'wordpress' as const,api:'https://example.org/wp-json/',site:'https://example.org/'};
 const stored={id:'website-1',url:website.site,name:'Projects',format:'website',website,enabled:true,checkedAt:1,entries:[],skipped:0};
 assert.deepEqual(validateSourceStore([stored])[0].website,website);assert.equal(validateSourceStore([stored])[0].format,'website');
 assert.throws(()=>validateSourceStore([{...stored,website:undefined}]),/source_storage/);
 assert.throws(()=>validateSourceStore([{...stored,website:{...website,site:'https://elsewhere.example/'}}]),/source_storage/);
 assert.equal(sourceWebsite({...website,api:'file:///local'}),undefined);assert.equal(sourceWebsite({...website,api:'https://user:pass@example.org/wp-json/'}),undefined);
 assert.equal(validateSourceStore([{...stored,format:'community',website:undefined}])[0].website,undefined);
});
