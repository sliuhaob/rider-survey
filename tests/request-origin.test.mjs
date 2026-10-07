import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.ts';

const base = 'https://survey.roxy-design.com';
const answer = {id:'b1dc3227-641e-447e-bf74-ed2bf377c4de',answers:{q0:'我已阅读说明，愿意参加',q1:'是'}};
function environment() {
 const rows = new Set();
 return {rows, SURVEY_ADMIN_KEY:'test-only', DB:{prepare(){return {bind(id){return {async run(){rows.add(id);}};}};}}};
}
async function post(headers, env, path='/api/responses') {
 return worker.fetch(new Request(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(answer)}),env);
}
test('mobile requests without Origin can submit with verified same-origin evidence',async()=>{
 for(const headers of [
  {Referer:base+'/?v=3'},
  {'Sec-Fetch-Site':'same-origin'},
  {'X-Survey-Request':'1'},
  {Origin:'null',Referer:base+'/'},
  {Origin:'null','X-Survey-Request':'1'},
  {Origin:base},
  {Origin:'https://sliuhaob.github.io'}
 ]) {
  const env=environment();
  for(let i=0;i<2;i++) {const response=await post(headers,env);assert.equal(response.status,200,JSON.stringify(headers));assert.equal((await response.json()).receipt,answer.id);}
  assert.equal(env.rows.size,1);
 }
});
test('foreign origins, misleading referrers, and unverified requests remain rejected',async()=>{
 for(const headers of [
  {}, {Origin:'null'},
  {Origin:'https://evil.example',Referer:base+'/', 'X-Survey-Request':'1'},
  {Referer:base+'.evil.example/', 'X-Survey-Request':'1'},
  {Referer:'https://evil.example/', 'Sec-Fetch-Site':'same-origin'},
  {Referer:'not a URL', 'X-Survey-Request':'1'},
  {'Sec-Fetch-Site':'cross-site','X-Survey-Request':'1'},
  {'Sec-Fetch-Site':'same-site','X-Survey-Request':'1'},
  {'X-Survey-Request':'1','Content-Type':'text/plain'},
  {Origin:'http://127.0.0.1:5173'}
 ]) {
  const env=environment();assert.equal((await post(headers,env)).status,403,JSON.stringify(headers));assert.equal(env.rows.size,0);
 }
});
test('preflight grants only trusted origins and includes the compatibility header',async()=>{
 for(const origin of ['', 'null','https://evil.example','https://sliuhaob.github.io']){
  const response=await worker.fetch(new Request(base+'/api/responses',{method:'OPTIONS',headers:{Origin:origin,'X-Survey-Request':'1','Access-Control-Request-Headers':'content-type,x-survey-request'}}),environment());
  const trusted=origin==='https://sliuhaob.github.io';
  assert.equal(response.status,trusted?204:403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),trusted?origin:null);
  if(trusted)assert.match(response.headers.get('Access-Control-Allow-Headers'),/X-Survey-Request/);
 }
});
test('form submissions cannot write answers and export still requires the secret',async()=>{
 const env=environment();assert.equal((await post({Origin:base,'Content-Type':'text/plain'},env)).status,415);
 assert.equal((await post({Referer:base+'/'},env,'/api/export')).status,401);
 assert.equal(env.rows.size,0);
});

test('HTTP visits and in-flight submissions upgrade without changing the method',async()=>{
 for(const method of ['GET','POST']){
  const response=await worker.fetch(new Request('http://survey.roxy-design.com/api/responses?v=4',{method}),environment());
  assert.equal(response.status,307);
  assert.equal(response.headers.get('Location'),base+'/api/responses?v=4');
 }
});
test('an already-open HTTP form can finish over HTTPS, without gaining export access',async()=>{
 const origin='http://survey.roxy-design.com';
 const env=environment();
 const response=await post({Origin:origin,'Sec-Fetch-Site':'cross-site','X-Survey-Request':'1'},env);
 assert.equal(response.status,200);assert.equal(env.rows.size,1);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal(response.headers.get('Strict-Transport-Security'),'max-age=31536000');
 const preflight=await worker.fetch(new Request(base+'/api/responses',{method:'OPTIONS',headers:{Origin:origin}}),env);
 assert.equal(preflight.status,204);
 assert.equal((await post({Origin:origin},env,'/api/export')).status,403);
 assert.equal((await post({Origin:origin+'.evil.example'},env)).status,403);
});
