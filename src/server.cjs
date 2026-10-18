const http=require('node:http');const fs=require('node:fs/promises');const path=require('node:path');const agent=require('./orchestrator.cjs');
const PORT=Number(process.env.PORT||3210),HOST='127.0.0.1';const origin='http://'+HOST+':'+PORT;
let busy=false;
const send=(r,status,data)=>{r.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});r.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
try{
 if(req.headers.host!==HOST+':'+PORT&&req.headers.host!=='localhost:'+PORT)return send(res,403,{error:'仅允许本机访问'});
 const u=new URL(req.url,origin);
 if(req.method==='POST'){
  if(req.headers.origin&&![origin,'http://localhost:'+PORT].includes(req.headers.origin))return send(res,403,{error:'请求来源不允许'});
  if(!String(req.headers['content-type']).startsWith('application/json'))return send(res,415,{error:'请使用JSON请求'});
  if(u.pathname!=='/api/generate')return send(res,404,{error:'接口不存在'});
  if(busy)return send(res,409,{error:'已有任务正在生成，请稍后重试'});
  let body='';for await(const b of req){body+=b.toString();if(Buffer.byteLength(body)>30000)return send(res,413,{error:'任务过长'});}
  let data;try{data=JSON.parse(body);}catch{return send(res,400,{error:'任务格式错误'});}
  if(!data||typeof data!=='object'||Array.isArray(data))return send(res,400,{error:'任务必须是JSON对象'});
  if(typeof data.task!=='string'||!data.task.trim())return send(res,400,{error:'请描述营销需求'});
  for(const k of ['product','platform','revision','sessionId'])if(data[k]!=null&&typeof data[k]!=='string')return send(res,400,{error:'输入字段格式错误'});
  busy=true;res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'});
  const emit=x=>{if(!res.destroyed)res.write(JSON.stringify(x)+'\n');};
  try{const start=agent.usage.length;const result=await agent.generate(data,(stage,decision)=>emit({type:'stage',stage,decision}));result.usage={calls:agent.usage.slice(start)};if(process.env.ACCEPTANCE_LOG==='1'){const dir=path.join(__dirname,'../output/round2/runs');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,Date.now()+'.json'),JSON.stringify({input:data,result},null,2));}emit({type:'result',result});}
  catch(e){const safe=typeof e.message==='string'&&!/fetch|token|Bearer|https:|apikey/i.test(e.message)?e.message:'连接或生成失败，请检查网络与配置后重试';emit({type:'error',error:safe});}
  finally{busy=false;res.end();}return;
 }
 if(req.method!=='GET')return send(res,405,{error:'不支持此方法'});
 if(u.pathname==='/api/sources')return send(res,200,require('./knowledge.cjs').status());
 if(u.pathname==='/api/products')return send(res,200,{products:await agent.init()});
 if(u.pathname==='/api/metrics')return send(res,200,{calls:agent.usage,source:agent.sourceLabel,mode:agent.mode,ima:require('./ima.cjs').audit});
 if(u.pathname==='/api/health')return send(res,200,{status:'ready',model:'deepseek-flash',source:agent.sourceLabel,mode:agent.mode,sources:require('./knowledge.cjs').status(),identity:require('./knowledge.cjs').status().identity,keyConfigured:!!process.env.DEEPSEEK_API_KEY});
 if(u.pathname.startsWith('/api/sessions/')){const current=agent.getSession(u.pathname.slice('/api/sessions/'.length));return current?send(res,200,current):send(res,404,{error:'会话已失效，请重新生成'});}
 if(u.pathname.startsWith('/api/images/')){const a=agent.assets.get(u.pathname.slice('/api/images/'.length));if(!a)return send(res,404,{error:'图片不存在或服务已重启'});res.writeHead(200,{'Content-Type':a.type,'Cache-Control':'private, max-age=3600'});return res.end(a.bytes);}
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};if(!files[u.pathname])return send(res,404,{error:'页面不存在'});
 const file=files[u.pathname];const data=await fs.readFile(path.join(__dirname,'../web',file));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data);
}catch{if(!res.headersSent)send(res,503,{error:'暂时无法读取当前资料源，请检查本地路径或配置'});else res.end();}});
server.listen(PORT,HOST,()=>console.log('华为 PC 营销 Agent 已启动：'+origin));
server.on('error',()=>{console.error('服务启动失败，请检查端口是否占用');process.exitCode=1;});
