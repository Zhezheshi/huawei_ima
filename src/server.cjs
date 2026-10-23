const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const agent = require('./orchestrator.cjs');
const settings = require('./server-config.cjs').configure();
const auth = require('./auth.cjs').createAuth(settings);
const origin = settings.localOrigin;
let busy = false;
const rejectedHosts = new Set();
const send = (res, status, data) => {
 res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
};
async function staticFile(res, file) {
 const data = await fs.readFile(path.join(__dirname, '../web', file));
 const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
 res.writeHead(200, {'Content-Type':type + '; charset=utf-8', 'Cache-Control':'no-store'});
 res.end(data);
}
async function readJSON(req, limit) {
 const chunks = []; let size = 0;
 for await (const chunk of req.iterator({destroyOnReturn:false})) {
  size += chunk.length;
  if (size > limit) { req.resume(); throw Object.assign(Error('请求内容过长'), {status:413}); }
  chunks.push(chunk);
 }
 let data;
 try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
 catch { throw Object.assign(Error('请求格式错误'), {status:400}); }
 if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(Error('请求必须是JSON对象'), {status:400});
 return data;
}
const server = http.createServer(async (req, res) => {
 res.setHeader('X-Content-Type-Options', 'nosniff');
 res.setHeader('Referrer-Policy', 'no-referrer');
 const frames = settings.frameAncestors.join(' ') || "'none'";
 res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors ${frames}; base-uri 'none'; form-action 'self'; object-src 'none'`);
 try {
  const u = new URL(req.url, origin);
  // Public liveness has no configuration or credentials, including for platform IP probes.
  if (req.method === 'GET' && u.pathname === '/healthz') return send(res, 200, {status:'ok'});
  if (!settings.acceptsHost(req.headers.host)) {
   const host = String(req.headers.host || '').slice(0, 255);
   if (rejectedHosts.size < 5 && !rejectedHosts.has(host)) {
    rejectedHosts.add(host); console.warn('拒绝未配置的请求主机：' + host);
   }
   return send(res, 403, {error:'请求主机不允许'});
  }
  if (req.method === 'POST') {
   if (req.headers.origin && !settings.origins.has(req.headers.origin)) return send(res, 403, {error:'请求来源不允许'});
   if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, {error:'请使用JSON请求'});
   if (u.pathname === '/api/auth/login') {
    const data = await readJSON(req, 4096);
    if (!auth.required) return send(res, 200, {authenticated:true, required:false});
    const result = auth.login(data, req.headers.cookie);
    if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
    if (result.retryAfter) res.setHeader('Retry-After', result.retryAfter);
    return send(res, result.status, result.error ? {error:result.error} : {authenticated:true});
   }
  }
  if (req.method === 'GET' && u.pathname === '/api/auth/status') return send(res, 200, {required:auth.required, authenticated:auth.authorized(req.headers.cookie)});
  if (req.method === 'GET' && ['/login.js', '/style.css'].includes(u.pathname)) return await staticFile(res, u.pathname.slice(1));
  const authorized = auth.authorized(req.headers.cookie);
  if (req.method === 'GET' && u.pathname === '/login' && authorized) {
   res.writeHead(303, {Location:'/', 'Cache-Control':'no-store'}); return res.end();
  }
  if (!authorized) {
   if (req.method === 'GET' && ['/', '/login'].includes(u.pathname)) return await staticFile(res, 'login.html');
   return send(res, 401, {error:'访问会话已失效，请重新登录', login:'/login'});
  }
  if (req.method === 'POST') {
   if (u.pathname === '/api/auth/logout') {
    res.setHeader('Set-Cookie', auth.logout(req.headers.cookie)); return send(res, 200, {authenticated:false});
   }
   if (u.pathname !== '/api/generate') return send(res, 404, {error:'接口不存在'});
   if (busy) return send(res, 409, {error:'已有任务正在生成，请稍后重试'});
   const data = await readJSON(req, 30000);
   if (typeof data.task !== 'string' || !data.task.trim()) return send(res, 400, {error:'请描述营销需求'});
   for (const k of ['product', 'platform', 'revision', 'sessionId']) {
    if (data[k] != null && typeof data[k] !== 'string') return send(res, 400, {error:'输入字段格式错误'});
   }
   if (!process.env.DEEPSEEK_API_KEY) return send(res, 503, {error:'服务端未配置 DeepSeek 密钥，请联系维护者配置后重试'});
   busy = true;
   res.writeHead(200, {'Content-Type':'application/x-ndjson; charset=utf-8', 'Cache-Control':'no-store', 'X-Accel-Buffering':'no'});
   const emit = value => { if (!res.destroyed) res.write(JSON.stringify(value) + '\n'); };
   res.flushHeaders();
   const heartbeat = setInterval(() => emit({type:'heartbeat'}), 10000);
   heartbeat.unref();
   try {
    const start = agent.usage.length;
    const result = await agent.generate(data, (stage, decision) => emit({type:'stage', stage, decision}));
    result.usage = {calls:agent.usage.slice(start)};
    if (process.env.ACCEPTANCE_LOG === '1') {
     const dir = path.join(__dirname, '../output/round2/runs');
     await fs.mkdir(dir, {recursive:true});
     await fs.writeFile(path.join(dir, Date.now() + '.json'), JSON.stringify({input:data, result}, null, 2));
    }
    emit({type:'result', result});
   } catch (e) {
    const safe = typeof e.message === 'string' && !/fetch|token|Bearer|https:|apikey/i.test(e.message) ? e.message : '连接或生成失败，请检查网络与配置后重试';
    emit({type:'error', error:safe});
   } finally { clearInterval(heartbeat); busy = false; res.end(); }
   return;
  }
  if (req.method !== 'GET') return send(res, 405, {error:'不支持此方法'});
  if (u.pathname === '/api/sources') return send(res, 200, require('./knowledge.cjs').status());
  if (u.pathname === '/api/products') return send(res, 200, {products:await agent.init()});
  if (u.pathname === '/api/metrics') return send(res, 200, {calls:agent.usage, source:agent.sourceLabel, mode:agent.mode, ima:require('./ima.cjs').audit});
  if (u.pathname === '/api/health') return send(res, 200, {status:'ready', model:'deepseek-flash', source:agent.sourceLabel, mode:agent.mode, sources:require('./knowledge.cjs').status(), identity:require('./knowledge.cjs').status().identity, keyConfigured:!!process.env.DEEPSEEK_API_KEY});
  if (u.pathname.startsWith('/api/sessions/')) {
   const current = agent.getSession(u.pathname.slice('/api/sessions/'.length));
   return current ? send(res, 200, current) : send(res, 404, {error:'会话已失效，请重新生成'});
  }
  if (u.pathname.startsWith('/api/images/')) {
   const asset = agent.assets.get(u.pathname.slice('/api/images/'.length));
   if (!asset) return send(res, 404, {error:'图片不存在或服务已重启'});
   res.writeHead(200, {'Content-Type':asset.type, 'Cache-Control':'private, max-age=3600'}); return res.end(asset.bytes);
  }
  const files = {'/':'index.html', '/app.js':'app.js', '/content.js':'content.js'};
  if (!files[u.pathname]) return send(res, 404, {error:'页面不存在'});
  return await staticFile(res, files[u.pathname]);
 } catch (e) {
  if (!res.headersSent) send(res, e.status || 503, {error:e.status ? e.message : '暂时无法读取当前资料源，请检查本地路径或配置'});
  else res.end();
 }
});
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.listen(settings.port, settings.host, () => console.log('华为 PC 营销 Agent 已启动：' + origin));
server.on('error', () => { console.error('服务启动失败，请检查端口是否占用'); process.exitCode = 1; });
