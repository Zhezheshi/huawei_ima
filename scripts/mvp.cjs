const fs=require('node:fs/promises');
const path=require('node:path');
const ima=require('../src/ima.cjs');
function csv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 const keys=rows.shift().map(x=>x.replace(/^\uFEFF/,''));
 return rows.filter(r=>r.length===keys.length).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])));
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function child(items,title){const x=items.find(x=>x.title===title&&x.media_type===99);if(!x)throw new Error('缺少指定目录：'+title);return ima.list(x.media_id);}
(async()=>{
 const out=path.resolve('output/mvp');await fs.mkdir(path.join(out,'images'),{recursive:true});
 await ima.connect();
 let items=await child(await ima.list(),ima.NAME);
 items=await child(items,'P1-产品参数库');items=await child(items,'01-鸿蒙电脑');items=await child(items,'HUAWEI MateBook 14');
 const read=async title=>{const item=items.find(x=>x.title===title);if(!item)throw new Error('缺少'+title);return (await ima.original(item)).bytes.toString('utf8');};
 const facts=(await read('产品事实.md')).split('即将离开consumer.huawei.com')[0].trim();
 const index=csv(await read('图片索引.csv'));
 const imageItems=await child(items,'images');
 const images=[];
 for(const row of index){
  if(row['产品型号']!=='HUAWEI MateBook 14（鸿蒙版）')continue;
  const item=imageItems.find(x=>x.title===row['文件名']);if(!item)continue;
  const img=await ima.original(item);
  const png=img.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=img.bytes[0]===255&&img.bytes[1]===216&&img.bytes[2]===255;
  if(!png&&!jpg)throw new Error('图片文件签名不符');
  const name=path.basename(row['文件名']);
  await fs.writeFile(path.join(out,'images',name),img.bytes);
  images.push({name,model:row['产品型号'],source:row['来源页面'],caption:row['官网图片说明'],position:images.length===0?'封面':'正文配图',path:'images/'+name,bytes:img.bytes.length});
  if(images.length===3)break;
 }
 if(images.length<3)throw new Error('同型号图片不足3张');
 const needles=['HarmonyOS 6','14.2 英寸','屏幕比例\n\n3:2','支持 10 点触控'];
 if(!needles.every(x=>facts.includes(x)))throw new Error('预期事实未找到，禁止套用规则草稿');
 const evidence=needles.map((text,i)=>({id:'F'+(i+1),quote:text,document:'产品事实.md',library:ima.NAME}));
 const body=`开学选电脑，先把学习任务列清楚\n\n从查课程资料、看文献到整理笔记，先想清楚你每天要做什么，再去看配置。\n\nHUAWEI MateBook 14（鸿蒙版）采用 HarmonyOS 6［F1］。先核对学校要求的软件、考试工具和外设能否在目标系统上使用，再决定是否适合自己。\n\n它配备14.2英寸屏幕［F2］，屏幕比例为3:2［F3］，支持10点触控［F4］。到店时可以带一份常看的文档，试试阅读、翻页和触控操作是否合手。\n\n选购前也要核对具体销售版本。本文没有实测续航、软件兼容或性能，不据此作相关承诺。\n\n准备购机？把专业、必用软件和携带需求整理成清单，再咨询具体配置。\n\n#开学选电脑 #大学生电脑 #华为MateBook`;
 const report={created_at:new Date().toISOString(),mode:'规则草稿；未接入写作大模型',task:{model:'HUAWEI MateBook 14（鸿蒙版）',audience:'大学新生',scene:'开学选购',platform:'小红书'},strategy:{goal:'帮助准备选购的学生形成核对清单',angle:'先确认学习任务与软件条件，再体验屏幕和触控',cta:'带软件和任务清单咨询配置'},evidence,images,verification:{source:'真实 ima 读取',facts:'4个事实片段均在原文中匹配；不代表已独立核验官网现状',image_model:'图片索引型号与文件名一致，3张文件签名通过；未完成视觉人工复核',compliance:'规则草稿未加入价格、补贴、亲测体验或软件兼容承诺；未实现通用合规审核器',private_libraries:'未调用空名称知识库查询，未访问私人库'},limitations:['仅支持当前型号、场景与平台的链路验证','不具备自由任务生成、多轮修改和完整语义核验','图片使用授权与最终发布仍需核对']};
 await fs.writeFile(path.join(out,'facts.md'),facts);
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(out,'draft.md'),body+'\n\n## 配图来源\n'+images.map(x=>`- ${x.name}：${x.caption}；${x.position}；${x.source}`).join('\n'));
 const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ima 链路 MVP</title><style>body{font:16px/1.8 system-ui;max-width:1000px;margin:40px auto;padding:0 24px;background:#f5f6f8;color:#17212d}article,section{background:white;padding:28px;border-radius:16px;margin:20px 0}pre{white-space:pre-wrap;font:inherit}img{max-width:100%;height:230px;object-fit:contain}figure{margin:0} .images{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}a{color:#185abc}@media(max-width:650px){.images{grid-template-columns:1fr}}</style><h1>ima 营销内容链路 MVP</h1><p>已连接比赛共享库 · 正文读取成功 · 3张图片下载成功</p><p>规则草稿 / 尚未接入写作大模型 / 待发布审核</p><article><pre>${escape(body)}</pre></article><section><h2>来自 ima 的同型号配图</h2><div class="images">${images.map(x=>`<figure><img src="${escape(x.path)}" alt="${escape(x.caption)}"><figcaption>${escape(x.caption)}<br>${escape(x.position)} · <a href="${escape(x.source)}">官方来源页</a></figcaption></figure>`).join('')}</div></section><section><h2>事实依据</h2>${evidence.map(x=>`<p>${x.id} · 产品事实.md：${escape(x.quote)}</p>`).join('')}<a href="facts.md">查看从 ima 读取的正文</a></section><section><h2>验证与限制</h2><pre>${escape(JSON.stringify(report.verification,null,2))}</pre><p>${escape(report.limitations.join('；'))}</p></section></html>`;
 await fs.writeFile(path.join(out,'index.html'),html);
 console.log(JSON.stringify({status:'通过',library:ima.NAME,fact_count:evidence.length,images:images.map(x=>({name:x.name,bytes:x.bytes})),preview:path.join(out,'index.html'),generation:report.mode}));
})().catch(()=>{console.error('MVP 未完成：资料、网络或校验失败。未输出内部标识、凭证或签名链接。');process.exitCode=1;});
