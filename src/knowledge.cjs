const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const config={...require('../config/sources.json')};
if(process.env.SOURCE_MODE)config.active=process.env.SOURCE_MODE;
if(!['local','demo','ima'].includes(config.active))throw Error('SOURCE_MODE仅支持local、demo、ima');const {sameModel}=require('./policy.cjs');
const officialIds=new Map();
const root=path.resolve(__dirname,'..',config.active==='demo'?config.demoRoot:(process.env.KNOWLEDGE_ROOT||config.localRoot));const assets=new Map(),products=new Map(),loaded=new Map();let ready;
const sourceLabel=config.active==='ima'?'指定 ima 比赛共享库':config.active==='demo'?'公开Demo（模拟资料与自绘示意图，非官方产品事实）':'授权本地资料＋定向官网取证';
function csv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const keys=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,''));return rows.filter(x=>x.length===keys.length).map(x=>Object.fromEntries(keys.map((k,i)=>[k,x[i]])));}
function keywords(text){const normalized=String(text||'').toLowerCase();const terms=new Set(normalized.match(/[a-z]+|\d+(?:\.\d+)?/g)||[]);for(const chunk of normalized.match(/[\u4e00-\u9fff]+/g)||[]){terms.add(chunk);for(let i=0;i<chunk.length-1;i++)terms.add(chunk.slice(i,i+2));}return [...terms];}
const synonyms={便携:'尺寸 重量 机身 厚度',差旅:'移动办公 通勤 尺寸 重量 电池 接口',续航:'电池 额定容量 使用条件',显示:'屏幕 分辨率 亮度 色域',学习:'屏幕 内存 存储',性能:'处理器 内存 存储',外设:'接口 兼容',会议:'摄像头 音频 接口',系统:'操作系统 软件 兼容',换新:'迁移 软件 兼容',创作:'屏幕 色域 存储',采购:'版本 限制 兼容 服务',连接:'接口 无线连接',触控:'屏幕 触摸屏'};
function score(text,query){let q=query;for(const [k,v] of Object.entries(synonyms))if(query.includes(k))q+=' '+v;const lower=text.toLowerCase();return keywords(q).reduce((sum,k)=>sum+(lower.includes(k)?(k.length>2?3:1):0),0);}
function sections(raw){return raw.split(/\n(?=## )/).filter(x=>x.startsWith('## ')&&!/^## (来源|官方规格摘录)/.test(x));}
function factValue(topic,quote){if(topic==='操作系统')return(quote.match(/(?:HarmonyOS|Windows)\s*[\d.]+(?:\s*(?:Home|Pro))?/i)||[])[0]?.replace(/\s/g,'').toLowerCase()||null;return null;}
async function init(){if(!ready)ready=(async()=>{
 if(config.active==='ima'){
  const ima=require('./ima.cjs');await ima.connect();let items=await ima.list();const top=items.find(x=>x.title===ima.NAME);if(top)items=await ima.list(top.media_id);const p1=items.find(x=>x.title==='P1-产品参数库');if(!p1)throw Error('ima 缺少产品目录');for(const cat of (await ima.list(p1.media_id)).filter(x=>/^0[12]-/.test(x.title))){for(const model of await ima.list(cat.media_id)){if(model.media_type!==99)continue;const label=model.title+(cat.title.includes('鸿蒙')?'（鸿蒙版）':'（Windows）');products.set(label,{label,title:model.title,category:cat.title,remote:model});}}
 }else{
  for(const category of ['01-鸿蒙电脑','02-MateBook-Windows'])for(const entry of await fs.readdir(path.join(root,'P1-产品参数库',category),{withFileTypes:true})){if(!entry.isDirectory())continue;const label=entry.name+(category.includes('鸿蒙')?'（鸿蒙版）':'（Windows）');products.set(label,{label,title:entry.name,category});}
 }
 if(!products.size)throw Error('当前数据源没有可用产品');
 })();try{await ready;}catch(e){ready=undefined;throw e;}return [...products.keys()];}
async function load(label){await init();if(loaded.has(label))return loaded.get(label);const promise=(async()=>{
 const product=products.get(label);if(!product)throw Error('请选择当前数据源中的准确产品型号');
 const dir=path.join(root,'P1-产品参数库',product.category,product.title);const docs=[];let index,remoteImages;
 if(config.active==='ima'){
  const ima=require('./ima.cjs'),items=await ima.list(product.remote.media_id);
  for(const item of items.filter(x=>/\.md$/i.test(x.title)&&/事实|规格|限制/.test(x.title))){const r=await ima.original(item);docs.push({title:item.title,relativePath:product.category+'/'+product.title+'/'+item.title,text:r.bytes.toString('utf8'),date:null});}
  const ix=items.find(x=>x.title==='图片索引.csv');if(!ix)throw Error('ima 缺少图片索引');index=csv((await ima.original(ix)).bytes.toString('utf8'));
  const imageFolder=items.find(x=>x.title==='images');remoteImages=imageFolder?await ima.list(imageFolder.media_id):[];
 }else{
  for(const file of (await fs.readdir(dir)).filter(x=>/\.md$/i.test(x)&&/事实|规格|限制/.test(x)).sort()){const text=await fs.readFile(path.join(dir,file),'utf8');const stat=await fs.stat(path.join(dir,file));docs.push({title:file,relativePath:path.relative(root,path.join(dir,file)),text,date:(text.match(/(?:抓取日期|核验日期|更新日期)[：:]\s*(\d{4}-\d{2}-\d{2})/)||[])[1]||null,modifiedAt:stat.mtime.toISOString()});}
  index=csv(await fs.readFile(path.join(dir,'图片索引.csv'),'utf8'));
 }
 const records=[];let n=1;
 for(const doc of docs){const clean=doc.text.split('即将离开consumer.huawei.com')[0].trim();const urls=clean.match(/https:\/\/[^\s)]+/g)||[];const primary=/事实|规格/.test(doc.title);let pieces=sections(clean);if(!pieces.length)pieces=[clean];for(const piece of pieces){const topic=piece.split('\n')[0].replace(/^#+\s*/,'');records.push({id:'F'+n++,product:label,kind:primary?'product_fact':'product_limit',topic,quote:piece.slice(0,8500),document:doc.title,relativePath:doc.relativePath,source:urls.find(x=>x.includes('specs'))||urls[0]||'',sourceUrls:urls,library:sourceLabel,sourceType:config.active==='demo'?'demo':config.active==='ima'?'ima':'local',retrievedAt:new Date().toISOString(),sourceDate:doc.date,fileModifiedAt:doc.modifiedAt||null,configuration:'详见原始片段中的版本及配置条件',factKey:primary?topic:null,value:primary?factValue(topic,piece):null,condition:'同型号同系统'});}}
 const imageRecords=index.filter(x=>path.basename(x['文件名']||'')===x['文件名']&&sameModel(x['产品型号']||'',label)).map((x,i)=>({id:'I'+(i+1),name:x['文件名'],model:x['产品型号'],caption:x['官网图片说明']||'产品外观',usage:x['建议用途']||'',source:x['来源页面']||'',originalUrl:x['原始图片URL']||'',sourceType:config.active==='demo'?'demo':'local_index',retrievedAt:new Date().toISOString(),relativePath:path.relative(root,path.join(dir,'images',x['文件名'])),file:path.join(dir,'images',x['文件名'])}));
 if(!records.some(x=>x.kind==='product_fact'))throw Error('该产品缺少可追溯的原始事实');
 return{product,records,imageRecords,remoteImages,loadedAt:new Date().toISOString()};
 })();loaded.set(label,promise);try{return await promise;}catch(e){loaded.delete(label);throw e;}}
async function catalog(product){const p=await load(product);return{source:sourceLabel,product,topics:p.records.map(x=>({topic:x.topic,kind:x.kind,document:x.document})),images:p.imageRecords.map(x=>({id:x.id,caption:x.caption})),tools:['search_product_facts','search_product_limits','search_scene_guidance','select_product_images']};}
async function guidance(query){if(config.active==='ima')return[];const dir=path.join(root,'P8-客户场景库');const choices=[];for(const group of await fs.readdir(dir,{withFileTypes:true})){if(!group.isDirectory()||group.name.startsWith('12-'))continue;for(const file of await fs.readdir(path.join(dir,group.name))){if(!file.endsWith('.md'))continue;const rank=score(group.name+' '+file,query);if(rank)choices.push({file:path.join(dir,group.name,file),rank});}}choices.sort((a,b)=>b.rank-a.rank);const out=[];for(const c of choices.slice(0,2)){const text=await fs.readFile(c.file,'utf8');out.push({id:'G'+crypto.createHash('sha256').update(c.file).digest('hex').slice(0,7),kind:'guidance',topic:path.basename(c.file,'.md'),quote:text.slice(0,2400),document:path.basename(c.file),relativePath:path.relative(root,c.file),source:'',library:sourceLabel,sourceType:config.active==='demo'?'demo':'local',retrievedAt:new Date().toISOString(),product:null});}return out;}
async function search({product,query,kind='fact',limit=3}){
 if(typeof query!=='string'||!query.trim())return{query,evidence:[],notice:'空查询未执行'};
 if(kind==='guidance')return{query,kind,evidence:await guidance(query)};
 const p=await load(product);const candidates=p.records.filter(x=>kind==='limit'?x.kind==='product_limit':x.kind==='product_fact').map(r=>({r,rank:score(r.topic+' '+r.quote,query)+score(r.topic,query)*4})).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank);
 const evidence=candidates.slice(0,Math.min(4,Math.max(1,limit))).map(x=>x.r);let sourceAttempts=[];
 if(config.active==='local'&&config.official?.enabled&&process.env.OFFICIAL_SEARCH!=='0'&&kind==='fact'){
  const remote=await require('./official.cjs').search({product,query,sources:p.records.flatMap(r=>r.sourceUrls||[r.source]),limit:1});sourceAttempts=remote.access;
  for(const e of remote.evidence.slice(0,2)){const key=product+'|'+e.id;if(!officialIds.has(key))officialIds.set(key,'F'+(9000+officialIds.size));evidence.push({...e,id:officialIds.get(key),originalEvidenceId:e.id});}
 }
 return{query,kind,evidence,sourceAttempts,notice:candidates.length?'':'未找到同型号的相关证据'};
}
async function images({product,query='',count=3}){
 const p=await load(product);const allowedImages=p.imageRecords.filter(x=>!/手写笔|触控笔|配件/.test(x.caption+' '+x.name)||/手写|触控笔|配件/.test(query));const ordered=allowedImages.map((x,i)=>({x,rank:score(x.caption+' '+x.name,query),i})).sort((a,b)=>b.rank-a.rank||a.i-b.i);const selected=[];
 for(const {x} of ordered){let asset=assets.get(product+'|'+x.id);if(!asset){let bytes;try{if(config.active==='ima'){const item=p.remoteImages.find(y=>y.title===x.name);if(!item)continue;bytes=(await require('./ima.cjs').original(item)).bytes;}else bytes=await fs.readFile(x.file);}catch{continue;}
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!png&&!jpg)continue;const assetId=crypto.randomUUID();asset={bytes,type:png?'image/png':'image/jpeg',url:'/api/images/'+assetId};assets.set(assetId,asset);assets.set(product+'|'+x.id,asset);}
 const {file,...metadata}=x;selected.push({...metadata,url:asset.url,selectionReason:score(x.caption+' '+x.name,query)>0?'索引匹配画面需求':'同型号外观备选，指定场景素材未直接命中'});if(selected.length>=Math.min(6,Math.max(1,count)))break;
 }return selected;
}
function conflicts(evidence){const groups=new Map(),out=[];for(const e of evidence){if(e.kind!=='product_fact'||!e.factKey||!e.value)continue;const key=e.product+'|'+e.factKey+'|'+(e.condition||'');const others=groups.get(key)||[];for(const prev of others)if(prev.value!==e.value)out.push({status:'conflict',topic:e.factKey,evidenceIds:[prev.id,e.id],message:'同产品同条件的来源值不一致'});others.push(e);groups.set(key,others);}return out;}
function status(){return{mode:config.active,label:sourceLabel,localRoot:config.active==='demo'?config.demoRoot:config.localRoot,officialEnabled:config.active==='local'&&!!config.official?.enabled&&process.env.OFFICIAL_SEARCH!=='0',imaRequired:false,identity:{mode:'local',label:'本机创作会话（无需云端账号）'},notice:config.active==='demo'?'模拟资料和自绘图，不代表官方真实产品':'官网不可访问时回退本地；逐条证据保留来源和获取时间'};}
module.exports={status,init,catalog,search,images,conflicts,assets,mode:config.active,label:sourceLabel};
