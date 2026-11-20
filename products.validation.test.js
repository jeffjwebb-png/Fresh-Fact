const {test}=require('node:test');const assert=require('node:assert/strict');
const {passageMatches,evidenceFromPage,searchWikipedia}=require('./products');
test('decimal quantities remain intact in citable passages',()=>{
const p=passageMatches('kilowatt hour megajoules','A kilowatt-hour is equal to 3.6 megajoules. It measures energy.');
assert.match(p[0].passage,/3\.6 megajoules/);assert.equal(p[0].termCoverage,1);
});
test('term coverage describes visible returned text, not hidden truncated text',()=>{
assert.equal(passageMatches('needle','a '.repeat(400)+'needle.').length,0);
});
test('contradictory source stays contradictory and is not labeled supported',()=>{
const p=evidenceFromPage({finalUrl:'https://example.com',retrievedAt:'2026-10-01T00:00:00Z',title:'Energy',text:'Solar panels do not generate electricity at night.'},'Solar panels generate electricity at night');
assert.match(p.passages[0].passage,/do not/);assert.equal(p.supported,undefined);assert.match(p.contentHashSha256,/^[a-f0-9]{64}$/);
});
test('Wikipedia search retries one transient upstream failure',async()=>{
let calls=0;let delays=0;
const urls=await searchWikipedia('solar power',{fetchImpl:async()=>{
calls+=1;
if(calls===1)return new Response('temporarily unavailable',{status:503});
return new Response(JSON.stringify({query:{search:[{pageid:123}]}}),{status:200,headers:{'content-type':'application/json'}});
},delay:async()=>{delays+=1;}});
assert.equal(calls,2);assert.equal(delays,1);assert.deepEqual(urls,['https://en.wikipedia.org/?curid=123']);
});
test('Wikipedia search does not retry a permanent client error',async()=>{
let calls=0;
await assert.rejects(searchWikipedia('solar power',{fetchImpl:async()=>{calls+=1;return new Response('bad request',{status:400});},delay:async()=>{}}),/SEARCH_UNAVAILABLE/);
assert.equal(calls,1);
});
