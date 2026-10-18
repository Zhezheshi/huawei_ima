const path = require('node:path');
const os = require('node:os');
// Optional legacy adapter: the SDK is loaded only when ima is explicitly used.
const imaApi=(...args)=>require(path.join(os.homedir(), '.codex/skills/ima-skill/ima_api.cjs')).imaApi(...args);
const NAME = process.env.IMA_LIBRARY_NAME || '';
let pinned;
const audit=[];
const allowedMedia = new Set();
async function call(api, body) {
  const r = JSON.parse(await imaApi('openapi/wiki/v1/' + api, body, {baseUrl:'https://ima.qq.com'}));
  audit.push({at:new Date().toISOString(),api,code:r.code,msg:r.code===0?'success':String(r.msg||'请求失败').replace(/https?:\/\/\S+/g,'[链接隐藏]').slice(0,150)});
  if (r.code !== 0) {
    const message=typeof r.msg==='string'&&!/https?:|Bearer|token|api.?key|client.?id/i.test(r.msg)?r.msg.slice(0,180):'请求未成功';
    throw new Error(`ima ${api} 失败 (${r.code})：${message}`);
  }
  return r.data;
}
async function connect() {
  if(!NAME)throw new Error('可选ima模式需要显式设置IMA_LIBRARY_NAME为已授权共享库准确名称');
  const d = await call('search_knowledge_base', {query:NAME,cursor:'',limit:20});
  const matches=(d.info_list||[]).filter(x=>x.kb_name===NAME);
  if(matches.length!==1) throw new Error('比赛库未找到或存在重名，已停止。');
  allowedMedia.clear();
  pinned=matches[0].kb_id;
  return NAME;
}
async function list(folder) {
  if(!pinned) throw new Error('尚未锁定比赛库');
  if(folder && !allowedMedia.has(folder))throw new Error('目录不属于已读取的比赛库范围');
  let cursor='', items=[];
  for(let page=0;page<100;page++) {
    const b={knowledge_base_id:pinned,cursor,limit:50};
    if(folder)b.folder_id=folder;
    const d=await call('get_knowledge_list',b);
    for(const item of d.knowledge_list||[])if(item.media_id)allowedMedia.add(item.media_id);
    items.push(...(d.knowledge_list||[]));
    if(d.is_end)return items;
    if(!d.next_cursor||d.next_cursor===cursor)throw new Error('目录分页异常');
    cursor=d.next_cursor;
  }
  throw new Error('目录超出分页限制');
}
async function original(item) {
  if(!pinned || !allowedMedia.has(item.media_id))throw new Error('原文不属于已读取的比赛库范围');
  const d=await call('get_media_info',{media_id:item.media_id});
  const info=d.url_info;
  if(!info?.url)throw new Error('原文不可访问，请使用 ima 客户端查看');
  const u=new URL(info.url);
  if(u.protocol!=='https:')throw new Error('非 HTTPS 原文链接已阻止');
  // Only use media-specific headers; never forward the user's API credentials.
  const headers={};
  for(const [k,v] of Object.entries(info.headers||{})) {
    if(/ima-openapi|apikey|clientid/i.test(k))throw new Error('原文请求含不允许的凭证字段');
    headers[k]=v;
  }
  const r=await fetch(u,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error('原文下载失败，请使用 ima 客户端查看');
  return {bytes:Buffer.from(await r.arrayBuffer()),type:r.headers.get('content-type')||''};
}
module.exports={connect,list,original,NAME,audit};
