// Summarize only recorded results. Never calls a model or rewrites originals.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../output/acceptance-20261018'),project=path.resolve(__dirname,'..');
const {bodyCharacters}=require('../src/draft.cjs');
const sceneCases=[['开学季','A-student'],['职场办公','C-wechat'],['内容创作','J-creator'],['家庭换新','O-family'],['企业采购','K-enterprise'],['门店到访','G-poster'],['新品首发','L-launch'],['节日营销','M-holiday']];
const names={'C-wechat':'商务公众号','D-local-edit':'局部正文修改','D-title-only':'只改标题','E-new-focus':'更换核心卖点','F-moments':'切换朋友圈','F-add-image':'增加图片','F-remove-image':'删除图片','A-student':'学生小红书','J-creator':'内容创作','O-family':'家庭换新','K-enterprise':'企业采购','G-poster':'门店海报','L-launch':'新品主题','M-holiday':'节日主题','J-mixed':'混合场景','H-cross-product':'跨型号','I-adversarial':'编价格/体验对抗','N-clarification':'信息不足追问'};
const safe=s=>String(s??'').replace(/[|\r\n]/g,' ');
async function main(){
 const all=[],latest=new Map();
 for(const group of await fs.readdir(root,{withFileTypes:true})){
  if(!group.isDirectory()||group.name==='browser')continue;
  for(const file of await fs.readdir(path.join(root,group.name))){
   if(!file.endsWith('.json')||['summary.json','source-fingerprint.json'].includes(file))continue;
   const full=path.join(root,group.name,file);let r;try{r=JSON.parse(await fs.readFile(full,'utf8'));}catch{continue;}
   if(!r.id||!Array.isArray(r.usage))continue;
   r.group=group.name;r.modified=(await fs.stat(full)).mtimeMs;all.push(r);
   if(!latest.has(r.id)||latest.get(r.id).modified<r.modified)latest.set(r.id,r);
  }
 }
 const browserCalls=[];
 for(const file of await fs.readdir(path.join(root,'browser'))){if(!file.endsWith('.json'))continue;try{const r=JSON.parse(await fs.readFile(path.join(root,'browser',file),'utf8'));if(r.input&&r.result?.usage?.calls)browserCalls.push(...r.result.usage.calls);}catch{}}
 const callMap=new Map();for(const call of [...all.flatMap(r=>r.usage),...browserCalls])callMap.set(call.at+'|'+call.stage+'|'+call.attempt,call);
 const calls=[...callMap.values()];
 const usage={requests:calls.length,successful:calls.filter(c=>c.httpStatus===200).length,tokens:calls.reduce((n,c)=>n+(c.usage?.total_tokens||0),0)};
 let unit='',http='';try{unit=await fs.readFile(path.join(root,'unit-tests.tap'),'utf8');}catch{}try{http=await fs.readFile(path.join(root,'http-tests.tap'),'utf8');}catch{}
 const count=s=>({tests:Number(s.match(/^# tests (\d+)/m)?.[1]||0),pass:Number(s.match(/^# pass (\d+)/m)?.[1]||0),fail:Number(s.match(/^# fail (\d+)/m)?.[1]||0)});
 const label=r=>!r?'未测':!r.pass?'未通过':r.result?.status==='complete'?'通过（真实生成）':r.result?.status==='blocked'?'通过（安全阻断）':r.result?.status==='needs_input'?'通过（追问）':'未通过';
 const rows=[...latest.values()].map(r=>`| ${r.id} ${names[r.id]||''} | ${label(r)} | ${r.group} | ${r.result?.draft?(r.result.task.platform==='门店朋友圈'?[...r.result.draft.sections[0].text].length:bodyCharacters(r.result.draft)):'—'} | ${r.result?.images?.length??'—'} | ${r.calls} | ${r.tokens} |`).join('\n');
 const unitCount=count(unit),httpCount=count(http);
 const report=`# 本轮开发与验收（2026-10-18）

基线：fced207；本机增量修复分支：fix/marketing-validation。此报告由实际记录生成；原始证据、输出、图片和逐次用量只在忽略的output目录，不进入公开仓库。

## 数据与真实性

所有本轮真实模型测试使用授权本地v7知识库，OFFICIAL_SEARCH=0。产品事实片段和图片索引文字按用户明确授权发送至DeepSeek官方API；没有发送完整知识库或图片文件。当前记录不能证明实时官网或ima调用成功。模型审核属于辅助核验；图片按索引、型号与文件校验，不是视觉识别或版权证明。

## 自动化测试

- 规则/模拟/本地资料测试：${unitCount.pass}/${unitCount.tests}通过，失败${unitCount.fail}；逐项见output/acceptance-20261018/unit-tests.tap。
- 无密钥真实HTTP集成：${httpCount.pass}/${httpCount.tests}通过，失败${httpCount.fail}；单项内含未登录、错误口令、Host/Origin、JSON参数和静态路径断言，不调用模型。

## 真实模型回归

下表采用每个案例最新记录；失败不会被旧通过记录覆盖。“安全阻断”仅表示对抗测试预期成立，不等于生成了一篇通过稿。朋友圈字数含可见引用；长文正文计数不含引用标记和空白，不含标题/小标题/标签。

| 案例 | 最新结果 | 批次 | 正文字数 | 图片 | 请求数 | Token |
|---|---|---|---:|---:|---:|---:|
${rows}

## 浏览器与导出

真实浏览器生成节日送礼朋友圈，单段131字，2张图片，审核通过。实际点击下载Markdown与HTML，再读取下载文件确认中文完整、两种文件各嵌入2张图，HTML不含会话图片链接。下载检查在output/acceptance-20261018/browser/downloads-check.json。复制按钮提示成功，但自动化剪贴板通道读回为空，未将其计作系统剪贴板全文实测通过；正文一致性另由共享renderer测试覆盖。

真实模型门店海报的HTML在浏览器打开，桌面图片加载成功，无横向溢出。截图在browser/poster-desktop.jpg；朋友圈截图在browser/holiday-preview.jpg。最终浏览器增删图片、取证展开结果见browser/checks.json：图片1→2→1，正文保持不变，最新朋友圈192字、单段、图片加载正常、无横向溢出。用户因时间安排取消操作演示视频，本轮不交付视频。

## 失败与修复

初始公众号因审核原句含[F编号]而误把编号当规格数字，已从审核陈述中移除引用标记后重新定位；初始切朋友圈和家庭换新还出现审核字段遗漏或索引误判，保留p0-first/p0-second原始失败记录。新增结构修复不绕过独立审核；若一次修复仍失败会明确终止。公众号、小红书加入正文篇幅校验、最多两次定向调整和受保护的完整背景句精简；朋友圈统一单段、完整字符计数、一次定向压缩和单卖点审核。

本轮所有已归档真实请求（含失败、旧批次与首次浏览器案例）${usage.requests}次，HTTP200 ${usage.successful}次，API回传总用量${usage.tokens} tokens；不估算金额。不含未归档的其他开发机历史用量。逐次usage位于对应案例JSON。

## 部署与提交边界

Dockerfile、镜像文件白名单、PowerShell启动和评审口令保护已准备；本机无Docker，尚未构建镜像。尚未在魔搭创建或发布创空间，也没有可验证的公网链接。现有源码仓库可访问；用户最终要求将源码、测试、文档和部署配置同步到GitHub；原始输出、知识库与密钥不推送，最终同步状态以Git提交与远程验证为准。源码包在无完整知识库的独立解压目录复现：73项通过、1项本地资料测试按预期跳过，Demo健康接口与模拟型号读取成功，详见browser/package-smoke.json。作品说明书见submission.md，部署步骤见deployment.md。正式提交与录制状态不得从代码存在推断为完成。
`;
 await fs.writeFile(path.join(project,'docs/acceptance-2026-10-18.md'),report);
 const matrix=`# 赛题覆盖矩阵（2026-10-18本轮实测）

数据源为授权本地v7，OFFICIAL_SEARCH=0。赛事变更依据用户提供的通知：ima不再强制。本轮未取得新版赛题手册，平台篇幅采用现有项目规则；如官方手册改变须重新核对。详细案例、失败和用量见[验收报告](acceptance-2026-10-18.md)。

## 八类场景

| 场景 | 本轮最新实测 | 案例 |
|---|---|---|
${sceneCases.map(([scene,id])=>`| ${scene} | ${label(latest.get(id))} | ${id} |`).join('\n')}

新品主题无首发时间/旧款证据时放弃首发和升级断言；节日营销不编价格与权益；企业采购不编企业政策或兼容承诺。一次真实通过不等于所有任务稳定通过。

## 四平台

| 平台 | 约束 | 本轮生成证据 |
|---|---|---|
| 小红书 | 3—6图；正文300—650字 | ${label(latest.get('A-student'))} |
| 公众号 | 2—4图；正文650—1000字 | ${label(latest.get('C-wechat'))} |
| 门店朋友圈 | 1—3图；单段≤220字；一个核心卖点 | ${label(latest.get('F-moments'))} |
| 门店海报 | 1图、最多3卖点；主标题≤22字、副标题≤45字、CTA≤35字 | ${label(latest.get('G-poster'))} |

## 六类参考问题

| 问题 | 证据 |
|---|---|
| 大学新生小红书的学习、携带与续航需求 | A-student；电池容量不得换算续航 |
| 差旅职场公众号的卖点排序 | C-wechat；策略与取证记录 |
| 同产品切换朋友圈结构和配图 | F-moments、F-add-image、F-remove-image |
| 只有“想买轻薄本”时追问 | N-clarification；确定性预检、0模型调用，不能冒充LLM追问 |
| 相近型号参数与图片隔离 | H-cross-product；真实模型＋规则测试 |
| 无依据价格、补贴和体验 | I-adversarial；安全阻断/删除风险文本，详见验收表 |

## 八项最低功能与限制

本机/评审身份与资料源、任务输入、知识与图片检索、场景平台策略、图文生成、事实核验、合规检查、修改导出均有代码实现与相关测试。身份为本机进程或受口令保护的评审实例，未实现独立多用户账号。八个系统提示模块见src/prompts.cjs；检索是轻量关键词检索，图片只验证索引与格式；当前会话保存在内存，重启失效；不自动发布营销内容。
`;
 await fs.writeFile(path.join(project,'docs/competition-coverage.md'),matrix);
 await fs.writeFile(path.join(root,'totals.json'),JSON.stringify({usage,unit:unitCount,http:httpCount,latest:[...latest.values()].map(r=>({id:r.id,group:r.group,pass:r.pass,status:r.result?.status}))},null,2));
 console.log(JSON.stringify({unit:unitCount,http:httpCount,usage,cases:latest.size,report:'docs/acceptance-2026-10-18.md'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
