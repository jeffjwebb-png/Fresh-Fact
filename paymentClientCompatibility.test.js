const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlaygroundPayment } = require('./paymentClientCompatibility');
const encode = p => Buffer.from(JSON.stringify(p)).toString('base64');
const decode = s => JSON.parse(Buffer.from(s, 'base64').toString());
const fixture = () => ({x402Version:2,accepted:{scheme:'exact',network:'eip155:8453',amount:'30000',maxAmountRequired:'30000',name:'USD Coin',version:'2',extra:{name:'USD Coin',version:'2'},payTo:'recipient',asset:'USDC',maxTimeoutSeconds:300},payload:{signature:'unchanged',authorization:{value:'30000',to:'recipient',nonce:'unchanged'}}});
test('redundant display labels are removed without changing authorization or payment terms',()=>{
 const p=fixture(), result=decode(normalizePlaygroundPayment(encode(p)));
 assert.deepEqual(result.payload,p.payload);
 const canonical={...p.accepted};for(const k of ['maxAmountRequired','name','version'])delete canonical[k];
 assert.deepEqual(result.accepted,canonical);
});
test('mismatched display amount is not normalized',()=>{const p=fixture();p.accepted.maxAmountRequired='1';const s=encode(p);assert.equal(normalizePlaygroundPayment(s),s);});
test('malformed or canonical requests remain unchanged',()=>{assert.equal(normalizePlaygroundPayment('invalid'),'invalid');const p=fixture();for(const k of ['maxAmountRequired','name','version'])delete p.accepted[k];const s=encode(p);assert.equal(normalizePlaygroundPayment(s),s);});
test('installed x402 matcher accepts normalized requirements and rejects altered amounts', async()=>{
 const { x402ResourceServer } = await import('@x402/core/server');
 const { ExactEvmScheme } = await import('@x402/evm/exact/server');
 const server = new x402ResourceServer({getSupported:async()=>({kinds:[]})}).register('eip155:8453',new ExactEvmScheme());
 const p=fixture();const canonical={...p.accepted};for(const k of ['maxAmountRequired','name','version'])delete canonical[k];
 assert.equal(server.findMatchingRequirements([canonical],p),undefined);
 const normalized=decode(normalizePlaygroundPayment(encode(p)));
 assert.deepEqual(server.findMatchingRequirements([canonical],normalized),canonical);
 normalized.accepted.amount='1';assert.equal(server.findMatchingRequirements([canonical],normalized),undefined);
});
