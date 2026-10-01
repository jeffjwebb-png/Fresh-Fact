const {test}=require('node:test');const assert=require('node:assert/strict');
const {passageMatches,evidenceFromPage}=require('./products');
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
