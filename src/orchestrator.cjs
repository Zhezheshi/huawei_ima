const crypto=require('node:crypto');
const knowledge=require('./knowledge.cjs'),modelClient=require('./model.cjs');
const {platforms,scenes,prompt}=require('./prompts.cjs');
const policy=require('./policy.cjs');
const legacy=require('./agent.cjs');
const clone=x=>structuredClone(x),array=x=>Array.isArray(x)?x:[];
const compact=x=>String(x||'').replace(/\s/g,'');
function publicFields(d){const fields={title:d.title,intro:d.intro,cta:d.cta,tags:array(d.tags).join(' ')};for(const s of d.sections)fields['section:'+s.id]=s.heading+'\n'+s.text;for(const x of d.imagePlan)fields['image:'+x.id]=x.caption;return fields;}
const {validateDraft,normalizeMoments,momentsIssues,platformIssues,reduceBackground}=require('./draft.cjs');
function patchDraft(previous,patches,scope,allowHeadings=false){const allowed=new Set(scope);if(!Array.isArray(patches)||!patches.length)throw Error('未返回有效局部修改');const d=clone(previous),seen=new Set();for(const patch of patches){if(!patch||!allowed.has(patch.sectionId)||seen.has(patch.sectionId))throw Error('局部修改越过指定段落范围');const s=d.sections.find(x=>x.id===patch.sectionId);if(!s||typeof patch.text!=='string'||!patch.text.trim())throw Error('局部修改段落不存在或正文为空');s.text=patch.text;if(allowHeadings&&typeof patch.heading==='string')s.heading=patch.heading;seen.add(patch.sectionId);}return d;}
function patchFields(previous,fields,scope){
 if(!fields||typeof fields!=='object'||Array.isArray(fields)||!Object.keys(fields).length)throw Error('未返回有效字段修改');
 const d=clone(previous);for(const [key,value] of Object.entries(fields)){if(!scope.includes(key)||!['title','intro','cta'].includes(key)||typeof value!=='string')throw Error('字段修改越过指定范围');d[key]=value;}return d;
}
function editImages(previous,previousImages,pool,edit,rule){
 const draft=clone(previous),images=clone(previousImages),ids=new Set(array(edit.imageIds));
 if(edit.action==='remove'){
  if(!ids.size||[...ids].some(id=>!draft.imagePlan.some(x=>x.id===id)))throw Error('请明确指定当前稿件中的图片ID');
  if(draft.imagePlan.length-ids.size<rule.min)throw Error('删除后低于平台最低图数，请切换平台或替换图片');
  draft.imagePlan=draft.imagePlan.filter(x=>!ids.has(x.id));for(const s of draft.sections)s.imageIds=s.imageIds.filter(x=>!ids.has(x));
 }else if(edit.action==='add'){
  const count=Math.min(6,Math.max(1,Number(edit.count)||1));
  const selected=new Set(draft.imagePlan.map(x=>x.id));if([...ids].some(id=>selected.has(id)||!pool.some(x=>x.id===id)))throw Error('指定新增图片不存在或已在稿中');const available=pool.filter(x=>!selected.has(x.id)&&(!ids.size||ids.has(x.id)));
  if(draft.imagePlan.length+count>rule.max)throw Error('增加后超出平台图数上限，请减少图片或切换平台');
  if(available.length<count)throw Error('没有足够的同型号新图片，保留上一稿，不重复或伪造配图');
  for(const img of available.slice(0,count)){if(!images.some(x=>x.id===img.id))images.push(clone(img));draft.imagePlan.push({id:img.id,caption:img.caption,position:draft.sections.at(-1).id+'后'});draft.sections.at(-1).imageIds.push(img.id);}
 }else throw Error('图片修改必须明确增加或删除');
 return{draft,images:images.filter(x=>draft.imagePlan.some(p=>p.id===x.id))};
}
function completeImages(draft,pool,rule,excluded=[]){
 const used=new Set(draft.imagePlan.map(x=>x.id)),denied=new Set(excluded);let count=0;
 for(const image of pool){if(draft.imagePlan.length>=rule.min)break;if(used.has(image.id)||denied.has(image.id))continue;
  const section=draft.sections[count%draft.sections.length];draft.imagePlan.push({id:image.id,position:section.id+'后',caption:image.caption});if(!section.imageIds.includes(image.id))section.imageIds.push(image.id);used.add(image.id);count++;
 }return count;
}
function specificationIssues(draft,evidence){
 const pattern=/(\d+(?:\.\d+)?)\s*(GHz|MHz|kg|mm|GB|TB|Wh|nits|Hz|PPI|英寸|公斤|千克|g)(?![a-z])/gi;
 const norm=(n,u)=>n+'|'+u.toLowerCase().replace(/公斤|千克/,'kg');
 const allowed=new Set();for(const e of evidence.filter(x=>x.kind==='product_fact'))for(const m of e.quote.matchAll(pattern))allowed.add(norm(m[1],m[2]));
 const errors=[];for(const [location,text] of Object.entries(publicFields(draft)))for(const m of text.matchAll(pattern))if(!allowed.has(norm(m[1],m[2])))errors.push(location+'的规格 '+m[1]+m[2]+' 未被当前产品原文支持（型号数字不可当规格）');return [...new Set(errors)];
}
function reviewDecision(review,draft,evidence,images,task){
 const fields=publicFields(draft),byId=new Map(evidence.map(x=>[x.id,x]));let faults=[];
 const factualSignalStrict=text=>/\d+(?:\.\d+)?\s*(?:GHz|MHz|kg|mm|GB|TB|Wh|nits|Hz|PPI|英寸|公斤|千克|小时|元)|[¥￥]\s*\d|HarmonyOS\s*\d|Windows\s*\d|\d+\s*[:：×]\s*\d+|更快|更轻|更高效|流畅|持久|高性能|降低|减少|保障|搭载|具备|支持|兼容|续航|提升|翻倍|保证|免费|库存|到手价|采用|容量|重量|厚度|分辨率|处理器|屏幕比例|色域|配色|颜色|外观/i.test(text||'');
 const claims=array(review.claims).filter(c=>{
  if(!c||typeof c!=='object')return false;
  const text=String(c.text||'').replace(/\[F\d+\]/g,'');
  const signal=factualSignalStrict(text);
  if(typeof c.location==='string'&&c.location.startsWith('image:')&&!/\d+(?:\.\d+)?\s*(?:kg|mm|GB|Wh|Hz|英寸)|搭载|支持|兼容|提升|保证|价格|库存|更快|更高效/i.test(text))return false;
  const advice=/^(?:建议|请|欢迎|邀您|可到店|到店|选购前|采购前)|(?:需|待|请|建议).{0,12}(?:核对|确认|验证|测试)/.test(text);
  if(advice&&!/\d/.test(text)&&text.split(/[。！？；，]/).filter(Boolean).every(part=>/建议|请|欢迎|邀您|到店|核对|确认|验证|测试/.test(part)&&!/采用|搭载|具备|保证|免费|库存|到手价|[¥￥]|可兼容|完全兼容|支持所有|兼容所有|更快|更高效/.test(part)))return false;
  if(/顺不顺手|合不合适|好不好用|是否适合/.test(text)&&!/\d|搭载|采用|具备|保证|提升|翻倍|免费|库存|到手价|支持所有|兼容所有|更快|更高效|减少|降低/.test(text))return false;
  const neutralReason=/免责|核对提示|非肯定|不构成.*(?:产品事实|承诺)|场景标题|编辑建议/.test(c.reason||'');
  if(neutralReason&&!/\d|搭载|采用|具备|保证|提升|翻倍|免费|库存|到手价|(?:产品|该机|本机|这款|电脑|系统).{0,12}(?:支持|兼容)|(?:^|[，。；])(?:支持|兼容)|(?:支持|兼容)(?:所有|全部)|更快|更高效|减少|降低/.test(text))return false;
  // The model's false/non-factual flag cannot exempt a concrete product promise.
  const neutral=!signal&&(c.location==='title'||/不构成|非.*事实|场景|核对建议|编辑建议/.test(c.reason||''));
  return signal||c.isProductClaim===true&&!neutral;
 }).map((c,i)=>{
  c={...c,text:typeof c.text==='string'?c.text.replace(/\[F\d+\]/g,''):c.text};
  let status=['supported','unsupported','conflict','pending'].includes(c.status)?c.status:'pending';
  const refs=array(c.evidenceIds).filter(x=>typeof x==='string');
  const modelEvidenceIds=[...refs];
  // Repair a missing reference only for an exact specification literal with a unique primary source.
  // This does not change the model's support verdict or establish semantic support by itself.
  if(status==='supported'){
   const literalPattern=/\d+(?:\.\d+)?\s*(?:GHz|MHz|kg|mm|GB|TB|Wh|nits|Hz|PPI|英寸|公斤|千克)(?![a-z])|\d+\s*[:：×]\s*\d+/gi;
   for(const match of String(c.text||'').matchAll(literalPattern)){
    const literal=compact(match[0]).toLowerCase();
    if(refs.some(id=>compact(byId.get(id)?.quote||'').toLowerCase().includes(literal)))continue;
    const candidates=evidence.filter(e=>e.kind==='product_fact'&&e.product===task.product&&compact(e.quote).toLowerCase().includes(literal));
    if(candidates.length===1&&!refs.includes(candidates[0].id))refs.push(candidates[0].id);
   }
  }
  if(typeof c.text!=='string'||typeof c.location!=='string'||!fields[c.location]||!compact(fields[c.location]).replace(/\[F\d+\]/g,'').includes(compact(c.text).replace(/\[F\d+\]/g,''))){status='pending';faults.push('审核陈述无法定位到成稿');}
  if(status==='supported'&&(!refs.length||refs.some(id=>!byId.has(id)||byId.get(id).kind==='guidance'||byId.get(id).product!==task.product))){status='unsupported';faults.push('审核引用不属于当前产品事实');}
  if(status==='supported'&&/\d+(?:\.\d+)?\s*(?:GHz|MHz|kg|mm|GB|TB|Wh|nits|Hz|PPI|英寸)|HarmonyOS\s*\d|Windows\s*\d|\d+\s*[:：×]\s*\d+/i.test(c.text||'')&&!refs.some(id=>byId.get(id)?.kind==='product_fact')){status='unsupported';faults.push('具体参数缺少原始产品事实引用');}
  return{id:'C'+(i+1),location:c.location||'',text:c.text||'',evidenceIds:refs,modelEvidenceIds,referenceRepaired:refs.length!==modelEvidenceIds.length,status,conditions:String(c.conditions||''),reason:String(c.reason||'')};
 });
 if(!claims.length)faults.push('审核未提取产品陈述');
 for(const [location,text] of Object.entries(fields)){if(location==='tags'||location.startsWith('image:'))continue;const cleaned=text.replace(/\[F\d+\]/g,'');const numbers=[...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(?:kg|mm|GB|TB|Wh|nits|Hz|PPI|英寸|公斤|千克)/gi)].map(x=>x[1]);for(const value of numbers)if(!claims.some(c=>c.location===location&&compact(c.text).includes(value)))faults.push(location+'中的规格数值未被独立核验：'+value);}
 const checkedImages=array(review.imageChecks).filter(x=>images.some(i=>i.id===x.id)&&draft.imagePlan.some(i=>i.id===x.id));
 for(const p of draft.imagePlan)if(!checkedImages.some(x=>x.id===p.id&&x.status==='supported'))faults.push('图片'+p.id+'缺少通过的索引审核');
 if(task.platform==='门店朋友圈'&&review.platformCheck?.singleCoreSellingPoint!==true)faults.push('朋友圈缺少通过的单核心卖点审核');
 const issues=array(review.issues).filter(x=>x&&typeof x.message==='string');faults.push(...issues.filter(x=>x.severity==='error').map(x=>x.message));
 if(review.overall!=='pass'&&!faults.length&&claims.length&&claims.every(c=>c.status==='supported')&&checkedImages.every(i=>i.status==='supported'))faults.push('审核总评与逐项结果不一致：请说明阻断原因或校正总评');
 const conflict=claims.some(x=>x.status==='conflict')||checkedImages.some(x=>x.status==='conflict')||review.overall==='conflict';
 const rejected=claims.filter(x=>x.status!=='supported');
 const status=conflict?'conflict':claims.some(x=>x.status==='unsupported')?'unsupported':faults.length||rejected.length||!claims.length||review.overall!=='pass'?'pending':'pass';
 return{status,claims,platformCheck:review.platformCheck||null,imageChecks:checkedImages.map(x=>({id:x.id,status:x.status,reason:String(x.reason||'')})),issues:[...new Set([...faults,...rejected.map(x=>x.id+' '+x.status+'：'+x.reason)])],notes:['独立LLM辅助核验＋确定性规则，不等于第三方认证或完整事实证明。','图片核验依据索引和文件格式；未使用视觉模型识别画面。'],independent:true};
}
function parameterQueries(text){
 const queries=[];const pairs=[[/电池|续航|\bWh\b/i,'电池 容量'],[/重量|厚度|尺寸|\bkg\b|\bmm\b/i,'尺寸与重量'],[/屏幕|亮度|刷新率|分辨率|英寸|nits|PPI|OLED/i,'屏幕'],[/接口|USB|HDMI|DisplayPort/i,'接口'],[/处理器|内存|存储|\bGB\b|\bTB\b/i,'处理器 内存 存储'],[/系统|HarmonyOS|Windows/i,'操作系统'],[/配色|颜色|原野绿|深空灰|皓月银|樱语粉/i,'配色']];
 for(const [pattern,topic] of pairs)if(pattern.test(text))queries.push(topic);
 const specs=String(text||'').match(/\d+(?:\.\d+)?\s*(?:Wh|kg|mm|GB|TB|nits|Hz|英寸)/gi)||[];
 return [...new Set([...specs,...queries])].map(query=>({query,kind:'fact',required:false,purpose:'核验缺口优先补取原始产品事实，不能用限制卡替代参数证据'}));
}
function removeUnsupported(draft,verification){
 const d=clone(draft),removed=[];
 for(const claim of verification.claims.filter(x=>x.status==='unsupported'||x.status==='pending')){
  const location=claim.location;let obj,key;
  if(location.startsWith('section:')){obj=d.sections.find(s=>s.id===location.slice(8));key='text';}else if(['title','intro','cta'].includes(location)){obj=d;key=location;}
  if(!obj||typeof obj[key]!=='string')continue;
  const sentences=obj[key].match(/[^。！？!?]+[。！？!?]?/g)||[];
  const bad=compact(claim.text).replace(/\[F\d+\]/g,'');
  const kept=sentences.filter(sentence=>{const match=bad&&compact(sentence).replace(/\[F\d+\]/g,'').includes(bad);if(match)removed.push({location,text:sentence});return !match;});
  obj[key]=kept.join('');if(!obj[key].trim())obj[key]=key==='text'?'请按实际配置核对后再选择。':key==='title'?'选购核对建议':'';
 }
 return{draft:d,removed};
}
function createAgent({provider=knowledge,model=modelClient}={}){
 const sessions=new Map();
 async function generate(input,onStage=()=>{}){
  const old=input.sessionId?sessions.get(input.sessionId):null;
  if(input.sessionId&&!old)throw Error('当前创作会话已失效，请清空会话后重新生成');
  const previous=old?.current||null;
  const boundary=policy.preflight({...input,product:input.product||previous?.task?.product||old?.pendingTask?.product||''});if(boundary)return boundary;
  const trace=[],stage=(name,action,summary,data={})=>{const e={at:new Date().toISOString(),stage:name,action,summary,...data};trace.push(e);onStage(name,e);};
  const sessionId=old?.id||crypto.randomUUID();const session=old||{id:sessionId,history:[],current:null};
  if(!old){if(sessions.size>=25)sessions.delete(sessions.keys().next().value);sessions.set(sessionId,session);}
  const queryModel=async(name,data)=>model.call(name,prompt(name),data);
  const options=await provider.init();
  stage('任务理解','parse_task','解析目标、痛点、购买阶段与修改范围');
  const parsed=await queryModel('parse',{request:input.task,baseRequestIsUnchanged:previous?.request?.task===input.task,revision:input.revision||'',selectedProduct:input.product||'',selectedPlatform:input.platform||'',products:options,previous:previous?{task:previous.task,strategy:previous.draft.strategy,draft:previous.draft}:old?.pendingTask?{task:old.pendingTask}:null});
  const task=parsed.task;if(!task||typeof task!=='object')throw Error('任务解析结构无效');
  if(input.platform)task.platform=input.platform;
  let questions=array(parsed.questions).filter(x=>typeof x==='string');
  const missing=['product','audience','scene','platform'].filter(k=>typeof task[k]!=='string'||!task[k].trim());
  if(!missing.length&&options.includes(task.product)&&platforms[task.platform])questions=questions.filter(q=>!/核心卖点|重点|预算/.test(q));
  if(missing.length)questions.push('请补充：'+missing.join('、'));
  if(!options.includes(task.product))questions.push('请选择当前资料库中的准确产品及系统版本');
  if(!platforms[task.platform])questions.push('请选择小红书、公众号、门店朋友圈或门店海报');
  if(questions.length){session.pendingTask=task;return{status:'needs_input',sessionId,task,questions:[...new Set(questions)],trace};}
  task.painPoints=array(task.painPoints).filter(x=>typeof x==='string');task.goal=typeof task.goal==='string'?task.goal:'了解适用条件并咨询';task.sceneTypes=array(task.sceneTypes);task.stage=task.stage||'了解选购';
  const change=parsed.change||{mode:previous?'full':'new',sectionIds:[],needsNewEvidence:true};
  const sameContext=previous&&task.product===previous.task.product&&task.platform===previous.task.platform&&task.audience===previous.task.audience;
  const explicitSections=[...String(input.revision||'').matchAll(/\bS\d+\b/g)].map(x=>x[0]);if(sameContext&&explicitSections.length&&/只|仅|其余.*不变|其他.*不变/.test(input.revision||'')&&explicitSections.every(id=>previous.draft.sections.some(s=>s.id===id))){change.mode='section';change.sectionIds=[...new Set(explicitSections)];if(/不添.*事实|不加.*事实/.test(input.revision||''))change.needsNewEvidence=false;}
  const imageEdit=!!(sameContext&&change.mode==='images');
  const sectionEdit=!!(sameContext&&change.mode==='section'&&array(change.sectionIds).length&&change.sectionIds.every(id=>previous.draft.sections.some(s=>s.id===id)));
  const titleOnly=!!(sameContext&&!explicitSections.length&&/只|仅|其他.*不变|其余.*不变/.test(input.revision||'')&&/(?<!小)标题/.test(input.revision||'')&&task.platform!=='门店朋友圈');
  if(titleOnly){change.mode='fields';change.fieldNames=['title'];change.needsNewEvidence=false;}
  const fieldEdit=titleOnly,localEdit=sectionEdit||fieldEdit;
  const applyPatch=async(previousDraft,materials,review)=>{
   const name=fieldEdit?'patch_fields':'patch';
   const patched=await queryModel(name,{...materials,previousDraft,request:input.revision||input.task,editScope:fieldEdit?change.fieldNames:change.sectionIds,review});
   return fieldEdit?patchFields(previousDraft,patched.fields,change.fieldNames):patchDraft(previousDraft,patched.patches,change.sectionIds,/小标题|段落标题/.test(input.revision||'')&&!/保留小标题|不改小标题/.test(input.revision||''));
  };
  stage('营销策略','plan_evidence',localEdit?'规划局部修改所需证据；未修改内容锁定':'先确定内容策略，再决定检索问题',{task,change});
  const catalog=await provider.catalog(task.product);
  const plan=await queryModel('plan',{task,change,previousStrategy:previous?.draft.strategy,availableEvidence:previous?.evidence.map(x=>({id:x.id,topic:x.topic,kind:x.kind})),catalog,sceneReferences:scenes,platformRules:platforms[task.platform]});
  if(!plan.strategy||typeof plan.strategy.angle!=='string'||!Array.isArray(plan.strategy.priorities))throw Error('策略规划结构不完整');
  if(localEdit||imageEdit)plan.strategy=clone(previous.draft.strategy);
  plan.strategy.outline=array(plan.strategy.outline).filter(x=>typeof x==='string');plan.strategy.priorities=plan.strategy.priorities.filter(x=>typeof x==='string');
  if(task.platform==='门店朋友圈')plan.strategy.priorities=plan.strategy.priorities.slice(0,1);
  if(task.platform==='门店海报')plan.strategy.priorities=plan.strategy.priorities.slice(0,3);
  stage('营销策略','strategy_selected',plan.strategy.angle,{strategy:plan.strategy});
  const evidence=new Map();if(localEdit||imageEdit)for(const e of previous.evidence)evidence.set(e.id,e);
  let retrievalRounds=0;const searches=[];
  const retrieve=async(requests,round)=>{for(const request of array(requests).slice(0,round===0?5:2)){if(typeof request.query!=='string'||!request.query.trim())continue;const kind=['fact','limit','guidance'].includes(request.kind)?request.kind:'fact';const normalized=kind+'|'+request.query.trim();if(searches.some(x=>x.key===normalized))continue;const hit=await provider.search({product:task.product,query:request.query,kind,limit:kind==='guidance'?2:3});for(const e of hit.evidence){if(e.kind!=='guidance'&&e.product!==task.product)throw Error('检索返回了其他型号证据，已阻止');evidence.set(e.id,e);}const log={key:normalized,query:request.query,kind,required:!!request.required,purpose:String(request.purpose||''),hits:hit.evidence.map(x=>({id:x.id,topic:x.topic,document:x.document,sourceType:x.sourceType,source:x.source,retrievedAt:x.retrievedAt})),sourceAttempts:hit.sourceAttempts||[]};searches.push(log);stage('证据检索',kind==='guidance'?'search_scene_guidance':kind==='limit'?'search_product_limits':'search_product_facts',request.query,{round,...log});}
   if(round===0){const paired=array(requests).filter(x=>x.kind==='limit').flatMap(x=>parameterQueries(x.query||'')).slice(0,3);if(paired.length)await retrieve(paired,1);}
  };
  if((!localEdit&&!imageEdit)||change.needsNewEvidence){let requests=array(plan.searches);if(!requests.some(x=>x.kind==='fact'))requests=[{query:task.focus||plan.strategy.priorities[0]||'操作系统 屏幕',kind:'fact',required:true,purpose:'补齐主卖点事实'},...requests];await retrieve(requests,0);}
  else stage('证据检索','reuse_evidence','局部表达修改复用上一稿已取得证据',{evidenceIds:[...evidence.keys()]});
  if(searches.some(x=>x.required&&!x.hits.length)){
   const extra=await queryModel('supplement',{task,strategy:plan.strategy,searches,evidence:[...evidence.values()],platformRules:platforms[task.platform]});
   if(array(extra.questions).length&&![...evidence.values()].some(x=>x.kind==='product_fact'))return{status:'needs_input',sessionId,task,questions:extra.questions,trace};
   if(array(extra.searches).length){retrievalRounds++;await retrieve(extra.searches,retrievalRounds);}
   stage('证据检索','gap_decision',String(extra.summary||'缺失的非关键卖点不用于成稿'),{droppedClaims:array(extra.droppedClaims)});
  }
  const rule=platforms[task.platform];
  let images=(localEdit||imageEdit)?clone(previous.images):await provider.images({product:task.product,query:String(plan.imageNeeds?.query||task.focus||task.scene),count:Math.min(6,Math.max(rule.min,(Number(plan.imageNeeds?.count)||rule.min)+2))});
  for(const image of images){
   const number=String(image.id).match(/^I(\d+)$/);if(!number||Number(number[1])>=1000)continue;
   const id='F'+(8000+Number(number[1]));evidence.set(id,{id,product:task.product,kind:'appearance_index',topic:'图片索引外观：'+image.id,quote:'同型号图片索引：'+image.model+'；'+image.caption+'。仅支持索引内外观与配色说明，不证明参数、体验、兼容或现货。',document:'图片索引.csv',relativePath:image.relativePath,source:image.source||'',sourceType:provider.mode==='demo'?'demo':'local_image_index',retrievedAt:image.retrievedAt||new Date().toISOString()});
  }
  stage('证据检索','select_product_images','按画面需求选择同型号图片',{query:plan.imageNeeds?.query||'',images:images.map(x=>({id:x.id,name:x.name,caption:x.caption}))});
  const stop=(verification,message)=>({status:'blocked',publishable:false,sessionId,task,strategy:plan.strategy,evidence:[...evidence.values()],images,verification,trace,retrieval:{rounds:1+retrievalRounds,searches},questions:[message],source:provider.label});
  const sourceConflicts=provider.conflicts([...evidence.values()]);if(sourceConflicts.length)return stop({status:'conflict',claims:[],imageChecks:[],issues:sourceConflicts.map(x=>x.message),conflicts:sourceConflicts,notes:['相同条件的证据冲突，未自动选择一方，暂停发布。']},'发现资料冲突，请核对源文后再继续');
  if(images.length<rule.min)return stop({status:'pending',claims:[],imageChecks:[],issues:['同型号可用图片不足平台最低要求'],notes:[]},'素材不足，请补充同型号图片或切换平台');
  if(![...evidence.values()].some(x=>x.kind==='product_fact'))return stop({status:'pending',claims:[],imageChecks:[],issues:['未取得产品事实'],notes:[]},'没有取得足以创作的产品事实，已停止');
  if([...evidence.values()].some(e=>e.sourceType==='official')){
   stage('证据检索','reconcile_sources','核对本地与官网资料的型号、配置、版本和适用条件');
   const reconciliation=await queryModel('reconcile',{task,evidence:[...evidence.values()]});
   if(!Array.isArray(reconciliation.conflicts))return stop({status:'pending',claims:[],imageChecks:[],issues:['来源一致性检查结构无效'],notes:[]},'来源检查未完成，暂停创作');
   const contradictions=reconciliation.conflicts.filter(c=>array(c.evidenceIds).length>=2&&c.evidenceIds.every(id=>evidence.has(id))&&c.sameProduct===true&&c.sameConfiguration===true);
   if(contradictions.length)return stop({status:'conflict',claims:[],imageChecks:[],issues:contradictions.map(c=>String(c.reason||'来源存在同条件矛盾')),conflicts:contradictions,notes:['未按日期擅自覆盖旧资料。']},'官网与本地同条件资料冲突，请确认配置或版本');
  }
  const materials=()=>({task,strategy:plan.strategy,platformRules:rule,evidence:[...evidence.values()],images:images.map(({url,...x})=>x),constraints:array(plan.risks)});
  const checkedDraft=async(name,data)=>{
   let candidate=await queryModel(name,data);
   try{return validateDraft(candidate,task);}catch(error){
    stage('内容创作','repair_draft_structure','进行一次结构修复，修复后仍须完整审核',{issues:[error.message],fromStage:name});
    candidate=await queryModel('repair',{...materials(),invalidDraft:candidate,structureError:error.message,originalStage:name});
    try{return validateDraft(candidate,task);}catch(second){throw Error('成稿结构修复失败（'+name+'，已重试1次）：'+second.message);}
   }
  };
  stage('内容创作',localEdit?'patch_sections':'write_content',localEdit?'仅修改指定段落，其余字段由代码保持不变':'按照策略和检索证据写作',{editScope:localEdit?change.sectionIds:[],evidenceIds:[...evidence.keys()]});
  let draft;if(imageEdit){const edit=change.imageEdit||{};const pool=await provider.images({product:task.product,query:String(edit.query||''),count:rule.max});const edited=editImages(previous.draft,previous.images,pool,edit,rule);draft=edited.draft;images=edited.images;}else if(localEdit){draft=await applyPatch(previous.draft,materials());}else draft=await checkedDraft('write',{...materials(),previousDraft:previous?.draft,request:input.revision||input.task});
  draft.strategy=clone(plan.strategy);validateDraft(draft,task);
  let review,verification,repairCount=0,reviewCorrectionUsed=false,momentsCompressionUsed=false,articleFitCount=0;
  const getReview=async(data)=>{
   if(!imageEdit)return queryModel('review',data);
   const checked=await queryModel('review_images',{task,imagePlan:draft.imagePlan,images:images.map(({url,...x})=>x),evidence:[...evidence.values()],platformRules:rule,reviewFormatCorrections:data.reviewFormatCorrections});
   return{...checked,claims:clone(previous.verification.claims),platformCheck:clone(previous.verification.platformCheck)};
  };
  for(let round=0;round<3;round++){
   const corpus={raw:[...evidence.values()].filter(x=>x.kind==='product_fact').map(x=>x.quote).join('\n'),evidence:[...evidence.values()],images};
   if(!localEdit&&!imageEdit){const count=completeImages(draft,images,rule,array(review?.imageChecks).filter(x=>x.status!=='supported').map(x=>x.id));if(count)stage('内容创作','complete_image_plan','以已检索的同型号图片补齐平台最低图数',{added:count});}
   if(!localEdit&&!imageEdit){legacy.sourceConditions(draft,corpus);if(task.platform==='门店朋友圈')normalizeMoments(draft);}
   if(rule.minChars&&!localEdit&&!imageEdit&&verification&&articleFitCount){
    const reduced=reduceBackground(draft,task,verification);draft=reduced.draft;
    if(reduced.removed.length)stage('内容创作','reduce_background_sentences','删去完整的无引用背景句，保留事实、限定条件和CTA，再独立审核',{removedSentences:reduced.removed.length});
   }
   if(rule.minChars&&!localEdit&&!imageEdit&&articleFitCount<2&&platformIssues(draft,task).length){
    articleFitCount++;stage('内容创作','fit_article_length','按平台调整正文篇幅，再执行完整审核',{issues:platformIssues(draft,task)});
    draft=await checkedDraft('fit_article',{...materials(),previousDraft:draft,lengthIssues:platformIssues(draft,task),lengthBudget:task.platform==='小红书'?{intro:40,sections:3,eachSection:120,cta:30,target:420}:{intro:40,sections:5,eachSection:120,cta:30,target:700}});draft.strategy=clone(plan.strategy);
    completeImages(draft,images,rule);legacy.sourceConditions(draft,corpus);
   }
   if(task.platform==='门店朋友圈'&&!localEdit&&!imageEdit&&!momentsCompressionUsed&&momentsIssues(draft).some(x=>x.includes('字，须重写'))){
    momentsCompressionUsed=true;stage('内容创作','compress_moments','仅压缩正文，保留一个核心卖点、事实条件和咨询引导，再完整审核',{characters:[...draft.sections[0].text].length});
    const short=await queryModel('compress',{...materials(),previousDraft:draft,targetCharacters:140,maxCharacters:220});
    if(typeof short.text!=='string'||!short.text.trim())throw Error('朋友圈压缩未返回有效正文，已停止交付');
    draft.sections[0].text=short.text.replace(/\s+/gu,' ').trim();legacy.sourceConditions(draft,corpus);
   }
   stage('核验修订','independent_review','独立提取产品陈述，核对证据、条件、图片索引与合规',{round});
   review=await getReview({task,publishable:publicFields(draft),imagePlan:draft.imagePlan,evidence:[...evidence.values()],images:images.map(({url,...x})=>x),platformRules:rule});
   verification=reviewDecision(review,draft,[...evidence.values()],images,task);
   draft.claims=verification.claims.filter(c=>c.status==='supported').map(c=>({text:c.text,evidenceIds:c.evidenceIds}));
   let mechanical=legacy.checks(draft,corpus,task).filter(x=>x!=='事实引用未在正文标注');
   if(!reviewCorrectionUsed&&[...verification.issues,...mechanical].some(x=>/审核陈述无法定位|审核引用|审核总评|审核未提取产品陈述|未返回产品事实关联|规格数值未被独立核验|原始产品事实引用|单核心卖点审核|事实中的数字|事实引用未在|缺少通过的索引审核/.test(x))){
    reviewCorrectionUsed=true;stage('核验修订','correct_review_references','先校正审核的定位或引用映射，避免无效改稿',{issues:[...verification.issues,...mechanical]});
    review=await getReview({task,publishable:publicFields(draft),imagePlan:draft.imagePlan,evidence:[...evidence.values()],images:images.map(({url,...x})=>x),platformRules:rule,previousReview:review,reviewFormatCorrections:[...verification.issues,...mechanical],instruction:'请校正审核输出，不是改写文案。引用应包含真正支持参数的原始事实；非事实建议不列claims；location仅用publishable提供的键。'});
    verification=reviewDecision(review,draft,[...evidence.values()],images,task);draft.claims=verification.claims.filter(c=>c.status==='supported').map(c=>({text:c.text,evidenceIds:c.evidenceIds}));mechanical=legacy.checks(draft,corpus,task).filter(x=>x!=='事实引用未在正文标注');
   }
   mechanical.push(...specificationIssues(draft,[...evidence.values()]));mechanical.push(...platformIssues(draft,task));
   verification.issues=[...new Set([...verification.issues,...mechanical])];if(mechanical.length&&verification.status==='pass')verification.status='pending';verification.reviewRounds=round+1;
   stage('核验修订','review_result',verification.status==='pass'?'本轮审核通过':'发现需处理的陈述或合规问题',{round,status:verification.status,claims:verification.claims.map(x=>({id:x.id,status:x.status,location:x.location})),issues:verification.issues});
   if(verification.status==='conflict')return stop(verification,'独立审核发现来源或条件冲突，已暂停发布');
   if(verification.status==='pass')break;
   if(round===2)break;
   if(imageEdit)return stop(verification,'图片修改后核验未通过，保留上一稿正文与会话，请调整图片要求');
   const priority=parameterQueries(verification.claims.filter(x=>x.status!=='supported').map(x=>x.text+' '+x.reason).join(' ')+' '+mechanical.join(' '));
   if((priority.length||array(review.followupSearches).length)&&retrievalRounds<2){retrievalRounds++;await retrieve([...priority,...array(review.followupSearches)],retrievalRounds);const conflict=provider.conflicts([...evidence.values()]);if(conflict.length)return stop({...verification,status:'conflict',conflicts:conflict},'补充取证发现资料冲突，已暂停发布');}
   stage('核验修订','targeted_revision','针对审核问题修订，不增加未经取证的承诺',{round:round+1,issues:verification.issues});repairCount++;
   if(localEdit){const outside=verification.claims.some(x=>x.status!=='supported'&&!(fieldEdit?change.fieldNames.includes(x.location):change.sectionIds.some(id=>x.location==='section:'+id)));if(outside)return stop(verification,'审核问题涉及未授权修改的段落，请扩大修改范围或重新生成');draft=await applyPatch(draft,materials(),verification);}
   else {draft=await checkedDraft('revise',{...materials(),previousDraft:draft,review:verification,preserveSupportedClaims:verification.claims.filter(c=>c.status==='supported'&&c.evidenceIds.some(id=>evidence.get(id)?.kind==='product_fact')).slice(0,3),removeUnsupportedClaims:round===1?verification.claims.filter(x=>x.status!=='supported'):[]});
    if(round===1){const cleaned=removeUnsupported(draft,verification);draft=cleaned.draft;if(cleaned.removed.length)stage('核验修订','remove_unsupported_sentences','最终修订删除仍未解决的原问题句，再独立审核',{removed:cleaned.removed});}
   }
   draft.strategy=clone(plan.strategy);validateDraft(draft,task);
  }
  if(verification.status!=='pass')return stop(verification,'有限修订后仍存在不支持或待确认陈述，未发布候选稿');
  const usedIds=new Set(draft.imagePlan.map(x=>x.id));
  draft.warnings=[...new Set([...(provider.mode==='demo'?['模拟Demo：所有产品设定与自绘图片均非官方真实资料，不可作为真实广告。']:[]),...draft.warnings,...policy.warnings(input,task,images.length)])];
  const changes={mode:imageEdit?'images':fieldEdit?'fields':localEdit?'section':previous?'full':'new',summary:String(change.summary||'生成图文'),changedSections:previous?draft.sections.filter(x=>JSON.stringify(x)!==JSON.stringify(previous.draft.sections.find(s=>s.id===x.id))).map(x=>x.id):draft.sections.map(x=>x.id),unchangedSections:previous?draft.sections.filter(x=>JSON.stringify(x)===JSON.stringify(previous.draft.sections.find(s=>s.id===x.id))).map(x=>x.id):[]};
  stage('交付导出','deliver','交付审核通过的当前版本',{changes,repairCount,source:provider.label});
  const result={status:'complete',publishable:true,sessionId,request:{task:input.task},version:(session.version||0)+1,task,draft,evidence:[...evidence.values()],images:images.filter(x=>usedIds.has(x.id)),verification,trace,changes,repairCount,retrieval:{rounds:1+retrievalRounds,searches},provenance:{demo:provider.mode==='demo',library:provider.label,source:provider.label+'＋DeepSeek 分阶段生成与独立审核',mode:provider.mode,model:'deepseek-flash',retrievedAt:new Date().toISOString(),generatedAt:new Date().toISOString(),cached:provider.mode==='local'}};
  session.version=result.version;session.current=clone(result);session.pendingTask=null;session.history.push({version:result.version,task:clone(task),draft:clone(draft),changes});if(session.history.length>12)session.history.shift();return result;
 }
 return{generate,init:()=>provider.init(),assets:provider.assets,usage:model.usage||[],mode:provider.mode,sourceLabel:provider.label,getSession:id=>sessions.get(id)?.current||null};
}
module.exports={normalizeMoments,momentsIssues,parameterQueries,removeUnsupported,editImages,...createAgent(),createAgent,reviewDecision,patchFields,patchDraft,validateDraft,specificationIssues,completeImages};
