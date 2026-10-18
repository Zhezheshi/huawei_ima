// Separate HTTP integration suite: starts a keyless demo process and calls no model.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),net=require('node:net'),path=require('node:path');
test('真实HTTP：评审鉴权、Host/Origin、参数与静态文件边界',async()=>{
 const probe=net.createServer();await new Promise(ok=>probe.listen(0,'127.0.0.1',ok));const port=probe.address().port;await new Promise(ok=>probe.close(ok));
 const env={...process.env,SOURCE_MODE:'demo',HOST:'0.0.0.0',PORT:String(port),APP_ORIGIN:'https://review.invalid',APP_PASSWORD:'nonsecret-test-password',DEEPSEEK_API_KEY:''};
 const child=spawn(process.execPath,['src/server.cjs'],{cwd:path.resolve(__dirname,'..'),env,stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('测试服务启动超时')),10000);child.stdout.on('data',data=>{if(data.toString().includes('已启动')){clearTimeout(timer);ok();}});child.once('exit',()=>{clearTimeout(timer);no(Error('测试服务提前退出'));});});
  const base='http://127.0.0.1:'+port,authorization='Basic '+Buffer.from('team:nonsecret-test-password').toString('base64');
  const get=(url,headers={})=>fetch(base+url,{headers:{authorization,...headers}});
  assert.equal((await fetch(base+'/')).status,401);
  assert.equal((await get('/',{authorization:'Basic '+Buffer.from('team:wrong').toString('base64')})).status,401);
  const badHost=await new Promise((ok,no)=>{const r=require('node:http').get(base+'/',{headers:{authorization,host:'evil.invalid'}},response=>{response.resume();ok(response.statusCode);});r.on('error',no);});assert.equal(badHost,403);
  const health=await (await get('/api/health')).json();assert.equal(health.keyConfigured,false);assert.equal(health.mode,'demo');assert.equal(health.identity.mode,'review');
  assert.equal((await get('/content.js')).status,200);assert.equal((await get('/config/model.json')).status,404);
  assert.ok((await (await get('/api/products')).json()).products[0].includes('演示'));
  for(const body of ['not json','null','[]','{}']){const r=await fetch(base+'/api/generate',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body});assert.equal(r.status,400);}
  const cross=await fetch(base+'/api/generate',{method:'POST',headers:{authorization,'Content-Type':'application/json',Origin:'https://evil.invalid'},body:'{}'});assert.equal(cross.status,403);
  assert.equal((await (await get('/api/metrics')).json()).calls.length,0);
 }finally{child.kill();}
});
