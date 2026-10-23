// Real HTTP, keyless Demo: no model traffic and no paid API.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),net=require('node:net'),path=require('node:path');
async function start(extra={}){
 const probe=net.createServer();await new Promise(ok=>probe.listen(0,'127.0.0.1',ok));const port=probe.address().port;await new Promise(ok=>probe.close(ok));
 const env={...process.env,SOURCE_MODE:'demo',OFFICIAL_SEARCH:'0',HOST:'0.0.0.0',PORT:String(port),APP_ORIGIN:'https://review.invalid',APP_PASSWORD:'nonsecret-test-password',APP_FRAME_ANCESTORS:'https://modelscope.cn https://www.modelscope.cn',DEEPSEEK_API_KEY:'',...extra};
 const child=spawn(process.execPath,['src/server.cjs'],{cwd:path.resolve(__dirname,'..'),env,stdio:['ignore','pipe','pipe']});
 await new Promise((ok,no)=>{const timer=setTimeout(()=>{child.kill();no(Error('测试服务启动超时'));},10000);child.stdout.on('data',data=>{if(data.toString().includes('已启动')){clearTimeout(timer);ok();}});child.once('exit',()=>{clearTimeout(timer);no(Error('测试服务提前退出'));});});
 const base='http://127.0.0.1:'+port;
 const post=(url,data,headers={})=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof data==='string'?data:JSON.stringify(data)});
 const login=()=>post('/api/auth/login',{username:'team',password:env.APP_PASSWORD});
 return {base,post,login,close:()=>new Promise(ok=>{child.once('exit',ok);child.kill();})};
}
const cookieOf=r=>r.headers.get('set-cookie').split(';')[0];

test('真实HTTP：无需Authorization的Cookie登录、刷新、退出与保护边界',async()=>{
 const s=await start();try{
  const page=await fetch(s.base+'/');assert.equal(page.status,200);assert.match(await page.text(),/loginForm/);assert.equal(page.headers.get('www-authenticate'),null);
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors https:\/\/modelscope.cn https:\/\/www.modelscope.cn/);
  assert.equal((await fetch(s.base+'/login.js')).status,200);
  assert.deepEqual(await (await fetch(s.base+'/healthz')).json(),{status:'ok'});
  for(const url of ['/api/health','/api/products','/api/metrics','/api/sources','/api/images/test','/api/sessions/test','/app.js'])assert.equal((await fetch(s.base+url)).status,401);
  const basic='Basic '+Buffer.from('team:nonsecret-test-password').toString('base64');
  assert.equal((await fetch(s.base+'/api/health',{headers:{Authorization:basic}})).status,401);
  assert.equal((await s.post('/api/auth/login',{username:'team',password:'wrong'})).status,401);
  const login=await s.login();assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/SameSite=None; Secure/);
  const cookie=cookieOf(login),headers={cookie,Authorization:'Bearer platform-owned-header'};
  const app=await fetch(s.base+'/',{headers});assert.equal(app.status,200);assert.match(await app.text(),/id="task"/);
  const health=await (await fetch(s.base+'/api/health',{headers})).json();assert.equal(health.keyConfigured,false);assert.equal(health.mode,'demo');
  assert.ok((await (await fetch(s.base+'/api/products',{headers})).json()).products[0].includes('演示'));
  const refresh=await s.post('/api/auth/login',{username:'team',password:'nonsecret-test-password'},headers);assert.equal(refresh.status,200);
  assert.equal((await fetch(s.base+'/api/health',{headers:{cookie}})).status,401);
  const next=cookieOf(refresh);assert.equal((await s.post('/api/auth/logout',{}, {cookie:next})).status,200);
  assert.equal((await fetch(s.base+'/api/health',{headers:{cookie:next}})).status,401);
 }finally{await s.close();}
});
test('真实HTTP：Host/Origin、JSON、请求大小、无密钥与私有文件边界',async()=>{
 const s=await start();try{
  const cookie=cookieOf(await s.login());
  const badHost=await new Promise((ok,no)=>{const r=require('node:http').get(s.base+'/',{headers:{cookie,host:'evil.invalid','x-forwarded-host':'review.invalid'}},response=>{response.resume();ok(response.statusCode);});r.on('error',no);});assert.equal(badHost,403);
  for(const url of ['/api/auth/login','/api/auth/logout','/api/generate'])assert.equal((await s.post(url,{}, {cookie,Origin:'https://evil.invalid'})).status,403);
  assert.equal((await fetch(s.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
  assert.equal((await s.post('/api/generate',{}, {cookie,'Content-Type':'application/jsonp'})).status,415);
  for(const body of ['not json','null','[]','{}','{"task":123}','{"task":"test","platform":[]}'])assert.equal((await s.post('/api/generate',body,{cookie})).status,400);
  assert.equal((await s.post('/api/auth/login',{password:'x'.repeat(5000)})).status,413);
  assert.equal((await s.post('/api/generate',{task:'x'.repeat(31000)},{cookie})).status,413);
  const missing=await s.post('/api/generate',{task:'为演示 MateBook A 写门店海报'},{cookie});assert.equal(missing.status,503);assert.match((await missing.json()).error,/未配置/);
  for(const url of ['/config/model.json','/src/server.cjs','/.env','/.git/config'])assert.equal((await fetch(s.base+url,{headers:{cookie}})).status,404);
  assert.equal((await (await fetch(s.base+'/api/metrics',{headers:{cookie}})).json()).calls.length,0);
 }finally{await s.close();}
});
test('真实HTTP：口令猜测限流返回429与Retry-After',async()=>{
 const s=await start();try{
  for(let i=0;i<10;i++)assert.equal((await s.post('/api/auth/login',{username:'team',password:'wrong'})).status,401);
  const blocked=await s.login();assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
 }finally{await s.close();}
});
test('真实HTTP：默认本机无口令模式仍可直接使用',async()=>{
 const s=await start({HOST:'127.0.0.1',APP_ORIGIN:'',APP_PASSWORD:'',APP_FRAME_ANCESTORS:''});try{
  assert.match(await (await fetch(s.base+'/')).text(),/id="task"/);
  assert.deepEqual(await (await fetch(s.base+'/api/auth/status')).json(),{required:false,authenticated:true});
  assert.equal((await fetch(s.base+'/api/products')).status,200);
  assert.match((await fetch(s.base+'/')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
 }finally{await s.close();}
});
test('真实HTTP：精确内部Host仍须登录且不接受伪造的转发来源',async()=>{
 const s=await start({APP_PROXY_HOSTS:'internal.invalid:7860'});try{
  const request=(host,cookie)=>new Promise((ok,no)=>{const req=require('node:http').get(s.base+'/api/health',{headers:{host,...(cookie?{cookie}:{}),'X-Forwarded-Host':'review.invalid'}},res=>{res.resume();ok(res.statusCode);});req.on('error',no);});
  assert.equal(await request('internal.invalid:7860'),401);
  const cookie=cookieOf(await s.login());assert.equal(await request('internal.invalid:7860',cookie),200);
  assert.equal(await request('other.internal.invalid:7860',cookie),403);
 }finally{await s.close();}
});
test('真实HTTP：魔搭动态函数Host保留登录与Origin校验；健康探测仅返回最小状态',async()=>{
 const s=await start({APP_ORIGIN:'https://review.ms.show',APP_PROXY_MODE:'modelscope'});try{
  const request=(url,host,cookie)=>new Promise((ok,no)=>{const req=require('node:http').get(s.base+url,{headers:{host,...(cookie?{cookie}:{})}},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>ok({status:res.statusCode,body}));});req.on('error',no);});
  assert.deepEqual(await request('/healthz','21.0.0.1:7860'),{status:200,body:'{"status":"ok"}'});
  const host='studio-review-abcdefgh.cn-beijing-vpc.fcapp.run';
  assert.equal((await request('/api/products',host)).status,401);
  const cookie=cookieOf(await s.login());assert.equal((await request('/api/health',host,cookie)).status,200);
  const cross=await s.post('/api/generate',{}, {cookie,Origin:'https://evil.invalid'});assert.equal(cross.status,403);
  assert.equal((await request('/api/health','evil.fcapp.run',cookie)).status,403);
 }finally{await s.close();}
});
