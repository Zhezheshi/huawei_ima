// Build a local report from real recorded runs; does not call the model.
const fs=require('node:fs/promises'),path=require('node:path');
const {sameModel}=require('../src/policy.cjs');
const {sourceConditions,checks}=require('../src/agent.cjs');
const root=path.join(__dirname,'../output/acceptance');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 const finalMetrics=await fetch('http://127.0.0.1:3210/api/metrics').then(r=>r.json());
 await fs.writeFile(path.join(root,'metrics-final.json'),JSON.stringify(finalMetrics,null,2));
 const phases=await Promise.all(['metrics-phase1.json','metrics-phase2.json','metrics-final.json'].map(async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'))));
 const unique=new Map();for(const phase of phases)for(const c of phase.calls)unique.set(c.at+'|'+c.kind,c);
 const calls=[...unique.values()];const totals=calls.reduce((s,c)=>{s.prompt_tokens+=c.usage?.prompt_tokens||0;s.completion_tokens+=c.usage?.completion_tokens||0;s.total_tokens+=c.usage?.total_tokens||0;return s;},{prompt_tokens:0,completion_tokens:0,total_tokens:0});
 const all=await Promise.all((await fs.readdir(path.join(root,'runs'))).sort().map(async file=>({file,...JSON.parse(await fs.readFile(path.join(root,'runs',file),'utf8'))})));
 const complete=all.filter(r=>r.result.status==='complete');
 const t1=complete.find(x=>x.result.task.platform==='小红书'),t2=complete.find(x=>x.result.task.platform==='微信公众号'),t3=complete.find(x=>x.result.task.platform==='门店朋友圈'&&x.result.task.product.includes('14')),cross=complete.find(x=>x.result.task.product==='HUAWEI MateBook Pro（鸿蒙版）');
 if(!t1||!t2||!t3||!cross)throw Error('缺少所需真实生成记录');
 const body=r=>[r.draft.intro,...r.draft.sections.map(x=>x.text),r.draft.cta].join('\n');
 const cases=[];
 for(const [name,run,min,max] of [['T1',t1,3,6],['T2',t2,2,4],['T3',t3,1,3],['跨型号',cross,1,3]]){
  const r=run.result;if(r.images.length<min||r.images.length>max)throw Error(name+'配图数量不合格');
  if(r.images.some(x=>!sameModel(x.model,r.task.product)))throw Error(name+'图片型号不一致');
  const validIds=new Set(r.evidence.map(x=>x.id));if(r.draft.claims.some(c=>!c.evidenceIds.length||c.evidenceIds.some(id=>!validIds.has(id))))throw Error(name+'证据关联不合格');
  if(/库存仅剩|直降2000|亲测性能最好/.test(body(r)))throw Error(name+'含违规表达');
  if(name==='T3'&&(body(r).length>222||r.draft.sections.length!==1||r.draft.strategy.priorities.length!==1))throw Error('朋友圈适配不合格');
  // Save an offline copy with the source-exact weight qualifier patch. Original JSON is never changed.
  const draft=sourceConditions(structuredClone(r.draft),{raw:r.evidence.map(x=>x.quote).join('\n')});
  const archive={...r,draft};await fs.writeFile(path.join(root,name+'-archive.json'),JSON.stringify({note:'原始模型响应见 runs；此归档仅按源文补齐重量版本限定，无新模型调用',...archive},null,2));
  const productFolder=r.task.product==='HUAWEI MateBook Pro（鸿蒙版）'?'HUAWEI MateBook Pro':'HUAWEI MateBook 14';
  let figures='';for(const image of r.images){if(path.basename(image.name)!==image.name)throw Error('非法图片名');const bytes=await fs.readFile(path.join(__dirname,'../参考资料/华为PC全板块深度知识库_v7/P1-产品参数库/01-鸿蒙电脑',productFolder,'images',image.name));const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!png&&!jpg)throw Error('图片签名异常');figures+=`<figure><img src="data:${png?'image/png':'image/jpeg'};base64,${bytes.toString('base64')}"><figcaption>${esc(image.name)} · ${esc(image.source)}</figcaption></figure>`;}
  await fs.writeFile(path.join(root,name+'-preview.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(draft.title)}</title><style>body{max-width:800px;margin:30px auto;padding:20px;font:16px/1.9 system-ui}img{max-width:100%;max-height:350px;object-fit:contain}p,pre{white-space:pre-wrap}figcaption,small{font-size:11px;color:#888}</style><h1>${esc(draft.title)}</h1><p>${esc(r.task.audience+' / '+r.task.scene+' / '+r.task.platform)}</p><p>${esc(r.provenance.source)}</p><small>离线归档预览：沿用本次真实模型输出与本地同型号图片，按原文补齐重量版本限定；未新调用模型。原始结果完整保留在 runs。</small><p>${esc(draft.intro)}</p>${draft.sections.map(x=>`<h2>${esc(x.heading)}</h2><p>${esc(x.text)}</p>`).join('')}<p>${esc(draft.cta)}</p>${figures}<details><summary>策略、证据和核验记录</summary><pre>${esc(JSON.stringify({strategy:draft.strategy,evidence:r.evidence,verification:r.verification},null,2))}</pre></details></html>`);
  cases.push({case:name,run:run.file,status:'本地备用链路通过；实时ima验收受阻',platform:r.task.platform,product:r.task.product,title:r.draft.title,images:r.images.length,body_characters:body(r).length,source:r.provenance.source,live_ima:false});
 }
 if(t1.result.draft.strategy.angle===t2.result.draft.strategy.angle||t1.result.draft.strategy.priorities[0]===t2.result.draft.strategy.priorities[0])throw Error('场景策略未变化');
 if(body(t3.result).length>=body(t2.result).length/2)throw Error('朋友圈未明显缩短');
 if(!body(cross.result).includes('970')||body(cross.result).includes('1.33'))throw Error('跨型号参数未正确切换');
 if(cross.result.images.some(x=>!x.name.includes('matebook-pro-harmonyos')))throw Error('跨型号图片不匹配');
 const ima=phases.flatMap(p=>p.ima||[]);const blocked=ima.filter(x=>x.code!==0);
 const summary={at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),unit_tests:21,cases,model:{calls:calls.length,successful:calls.filter(x=>x.httpStatus===200).length,...totals,records:calls},ima:{calls:ima.length,failures:blocked},p1:'C1—C7规则/模拟验证通过；C1/C2/C7另有真实HTTP零模型调用验证；未重复进行LLM对抗生成',submission_ready:false,blockers:['ima 原文接口返回220021，今日获取次数已达上限；当前不能完成实时原文及图片验收','尚未提供可访问的GitHub链接、魔搭链接和正式作品说明书'],untested:['配额恢复后的实时 ima 原文及图片完整链路','C3—C6未逐项增加真实LLM对抗调用，采用规则和模拟检查','正式部署、GitHub/魔搭评审期访问、演示视频']};
 await fs.writeFile(path.join(root,'summary.json'),JSON.stringify(summary,null,2));
 const md=`# 华为 PC 营销 Agent 测试验收报告\n\n时间：${summary.at}（Asia/Shanghai）\n\n## 结论\n\n本地 Web 演示与真实 DeepSeek 生成可用；严格实时 ima 端到端验收仍受外部配额阻断。不能将本地备用资料、模拟SDK或离线回放记成实时ima成功。初赛提交材料尚不齐全，当前不应宣称已可完整提交。\n\n## P0 与跨产品结果\n\n|测试|平台|图片|正文字符数（含换行）|结果|\n|---|---|---:|---:|---|\n${cases.map(c=>`|${c.case}|${c.platform}|${c.images}|${c.body_characters}|${c.status}|`).join('\n')}\n\nT1/T2/T3和跨型号均通过真实浏览器交互提交并实际调用 deepseek-flash。T3首次因多余追问未完成，只发生1次解析调用；修复后以相同任务和修改要求重测成功。T3在页面点击朋友圈并填写修改要求，不依赖修改代码指定输出。跨型号从真实比赛库目录发现的MateBook Pro选项切换，生成970g数据和Pro图片，未沿用14型号1.33kg数据。\n\n原始输入和完整输出：runs/*.json。T1/T2/T3/跨型号-preview.html为可离线查看归档；归档按资料补齐重量限定，原始响应不变。归档图像取用户授权的同型号本地文件，不是实时ima图片取证。JSON内的/api/images链接属于对应运行进程，离线查看请用内嵌图片的HTML。\n\n## P1 对抗、隐私与错误测试\n\n- 21项自动测试通过，详情见unit-tests.txt；测试源码见tests目录。\n- C1泛称追问、C2明确混用另一型号、C7私人库请求：规则测试＋真实HTTP接口通过，新增模型调用0次；私人库未被访问。\n- C3促销与库存、C4虚构体验：用已有证据和模拟草稿验证拦截，未额外进行真实模型对抗生成。\n- C5千字朋友圈、C6请求20张图片：确定性警告规则验证，不将其冒充完整模型端到端测试。\n- 工具层：模拟官方SDK校验比赛库准确名称及固定库ID；未知目录和媒体在发请求前拒绝，不访问私人库。\n- 模型HTTP503、非法JSON：模拟响应验证明确失败，不以Mock成功或规则草稿兜底。\n- 5项HTTP健康与边界测试通过（http-tests.json）；另有非法JSON、null与数组请求400测试。\n\n## Web与导出\n\n加载状态、任务修改、平台切换、图片展示、事实及图片来源展开、复制均在浏览器完成。真实下载T3的Markdown及HTML，保存为T3-export.md / T3-export.html。Markdown包含图片语法、来源和插入位置；HTML内嵌1张真实本地图片，离线可查看；未发现凭证头或内部库标识字段。\n\n## 已修复\n\n- 产品、人群、场景、平台完整时，不再因可选的核心卖点阻断生成。\n- 私人库请求和明确跨型号混用在模型/检索前拦截。\n- 库存、直降促销、虚构第一人称经历、标签中的风险表达纳入检查。\n- Pro与Pro S精确区分；Windows/鸿蒙冲突拒绝；所选图片型号核对。\n- 数字按完整值比较，避免16借用160；修复14.2被误当序号剥离的问题。\n- 依据原文明示内容补齐重量对应键盘版本；仍不声称完整语义事实核验。\n- 配图数量不足不再标成完全通过；非法或重复引用拦截；JSON字段类型校验。\n- Markdown增加可用图片链接及插入位置；API无效JSON对象400反馈；生成失败时明确保留的是上次结果。\n\n## 外部阻断与未测\n\n${summary.blockers.map(x=>'- '+x).join('\n')}\n\n${summary.untested.map(x=>'- 未测：'+x).join('\n')}\n\n## 本轮费用用量\n\n实际模型请求 ${calls.length} 次，HTTP200 ${summary.model.successful} 次；输入 ${totals.prompt_tokens} tokens，输出 ${totals.completion_tokens} tokens，合计 ${totals.total_tokens} tokens。计数包括T3首次多余追问，不包含模拟测试，不包含本轮之前的开发调用。逐次记录见metrics-phase*.json、metrics-final.json及summary.json。未估算金额。\n\n## 启动\n\n\`\`\`sh\n./scripts/start\n\`\`\`\n\n本机地址：http://127.0.0.1:3210/。当前验收服务已保持运行。完整提示词在src/agent.cjs，凭证不在源码或报告。所有验收产物在output/下，已被.gitignore忽略。\n`;
 await fs.writeFile(path.join(root,'report.md'),md);
 console.log(JSON.stringify({cases:cases.map(x=>({case:x.case,images:x.images,characters:x.body_characters})),model_calls:calls.length,tokens:totals,ima_blocked:blocked.map(x=>({code:x.code,msg:x.msg})),report:path.join(root,'report.md')}));
})().catch(e=>{console.error('验收报告检查未完成：'+e.message);process.exitCode=1;});
