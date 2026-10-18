const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createAgent, reviewDecision, patchFields, patchDraft} = require('../src/orchestrator.cjs');
const {validateDraft, normalizeMoments, momentsIssues, bodyCharacters, platformIssues, reduceBackground} = require('../src/draft.cjs');
const content = require('../web/content.js');
const product = '演示 MateBook A（Windows）';
const evidence = [{id:'F1', product, kind:'product_fact', topic:'操作系统', quote:'HarmonyOS 6', sourceType:'demo'}];
const image = id => ({id, model:product, caption:'模拟外观图，非官方事实', url:'/api/images/' + id, name:id+'.png', sourceType:'demo'});
const makeDraft = (text = '采用HarmonyOS 6[F1]。欢迎到店核对。') => ({title:'', intro:'', sections:[{id:'S1', heading:'', text, imageIds:['I1']}], cta:'', tags:[], imagePlan:[{id:'I1', position:'封面', caption:'模拟产品外观'}], claims:[], warnings:[]});
const makeReview = (data, extra = {}) => ({overall:'pass', claims:[{location:'section:S1', text:'HarmonyOS 6', evidenceIds:['F1'], status:'supported'}], imageChecks:data.imagePlan.map(i=>({id:i.id, status:'supported', reason:'模拟索引一致'})), issues:[], platformCheck:{singleCoreSellingPoint:true,reason:'仅核对系统'}, ...extra});
function fixture({write = makeDraft(), revise = makeDraft(), repair = makeDraft(), review, parse} = {}) {
 const calls = [];
 const provider = {mode:'demo', label:'模拟回归夹具', assets:new Map(), init:async()=>[product], catalog:async()=>({}), search:async()=>({evidence}), images:async()=>['I1','I2','I3'].map(image), conflicts:()=>[]};
 const model = {usage:[], call:async(stage, prompt, data)=>{
  calls.push({stage,data});
  if (stage === 'parse') return parse ? parse(data) : {task:{product, audience:'职场用户', scene:'门店到访', platform:data.selectedPlatform || '门店朋友圈'}, questions:[], change:{mode:data.previous?'full':'new', needsNewEvidence:true}};
  if (stage === 'plan') return {strategy:{angle:'系统核对', priorities:['系统'], outline:[]}, searches:[{query:'系统',kind:'fact',required:true}], imageNeeds:{count:1}};
  if (stage === 'write') return structuredClone(write);
  if (stage === 'revise') return structuredClone(revise);
  if (stage === 'compress') return {text:revise.sections[0].text};
  if (stage === 'fit_article') return structuredClone(repair);
  if (stage === 'repair') return structuredClone(repair);
  if (stage === 'review' || stage === 'review_images') return review ? review(data) : makeReview(data);
  if (stage === 'patch') return {patches:[{sectionId:'S1',text:'系统为HarmonyOS 6[F1]。请到店核对。'}]};
  if (stage === 'patch_fields') return {fields:{title:'到店聊聊你的任务'}};
  throw Error('未预期阶段 ' + stage);
 }};
 return {agent:createAgent({provider,model}), calls};
}
const request = {task:'为演示电脑写门店到访朋友圈',product,platform:'门店朋友圈'};

test('朋友圈格式归一保留每一字段的文字且不截断',()=>{
 const d=makeDraft('正文\n分行');d.title='标题';d.intro='导语';d.cta='咨询';d.tags=['选购'];d.sections[0].heading='小标题';
 normalizeMoments(d);assert.equal(d.sections[0].text,'标题 导语 小标题 正文 分行 咨询 #选购');assert.equal(d.title,'');assert.equal(d.cta,'');assert.deepEqual(d.tags,[]);
});
test('220字边界按Unicode可见字符计数，标题与标签不可绕过',()=>{
 const d=makeDraft('😀'.repeat(220));d.strategy={priorities:['系统']};assert.deepEqual(momentsIssues(d),[]);
 d.title='标题';assert.ok(momentsIssues(d).some(x=>x.includes('222字')));d.title='';d.tags=['标签'];assert.ok(momentsIssues(d).length);
});
test('长文正文计数不含引用、标题和空白，篇幅与海报长度都有边界',()=>{
 const d=makeDraft('汉'.repeat(300)+'[F19] \n');d.title='不属于正文的标题';assert.equal(bodyCharacters(d),300);assert.deepEqual(platformIssues(d,{platform:'小红书'}),[]);
 d.sections[0].text='汉'.repeat(651);assert.ok(platformIssues(d,{platform:'小红书'}).length);d.sections[0].text='汉'.repeat(649);assert.ok(platformIssues(d,{platform:'微信公众号'}).length);
 d.title='长'.repeat(23);assert.ok(platformIssues(d,{platform:'门店海报'}).some(x=>x.includes('标题')));
});
test('小红书超长先定向调整再审核，最终正文满足范围',async()=>{
 const long=makeDraft('采用HarmonyOS 6[F1]。'+'场景核对。'.repeat(150)),fit=makeDraft('采用HarmonyOS 6[F1]。'+'带照片到店核对。'.repeat(50));
 const f=fixture({write:long,repair:fit}),r=await f.agent.generate({...request,platform:'小红书'});assert.equal(r.status,'complete');assert.ok(bodyCharacters(r.draft)>=300&&bodyCharacters(r.draft)<=650);assert.equal(f.calls.filter(c=>c.stage==='fit_article').length,1);assert.equal(f.calls.at(-1).stage,'review');
});
test('句级精简只删完整背景，保留数字、引用、条件和CTA',()=>{
 const d=makeDraft('采用HarmonyOS 6[F1]。'+'忙碌的日子需要安排好节奏。'.repeat(45)+'早晨的旅程充满期待。'.repeat(15));d.cta='欢迎到店核对';d.intro='准备一段新旅程。';
 const r=reduceBackground(d,{platform:'小红书'},{claims:[{text:'采用HarmonyOS 6'}]});assert.ok(r.removed.length);assert.ok(r.draft.sections[0].text.includes('采用HarmonyOS 6[F1]。'));assert.ok(r.draft.sections[0].text.includes('需要安排好节奏'));assert.equal(r.draft.cta,d.cta);assert.ok(bodyCharacters(r.draft)<=650);assert.ok(d.sections[0].text.length>r.draft.sections[0].text.length);
});
test('朋友圈超长触发重写而非截断，最终重新独立审核',async()=>{
 const f=fixture({write:makeDraft('采用HarmonyOS 6[F1]。'+'核对场景。'.repeat(55))});const r=await f.agent.generate(request);
 assert.equal(r.status,'complete');assert.ok([...content.text(r)].length<=220);assert.ok(f.calls.some(c=>c.stage==='compress'));assert.equal(f.calls.at(-1).stage,'review');
});
test('持续超长只修订两次，不交付候选稿',async()=>{
 const long=makeDraft('采用HarmonyOS 6[F1]。'+'核对场景。'.repeat(55)),f=fixture({write:long,revise:long});const r=await f.agent.generate(request);
 assert.equal(r.publishable,false);assert.equal(r.status,'blocked');assert.equal(f.calls.filter(c=>c.stage==='revise').length,2);assert.equal(r.draft,undefined);
});
test('不满足单卖点语义审核不能因priorities只有一项而通过',async()=>{
 const f=fixture({review:data=>makeReview(data,{platformCheck:{singleCoreSellingPoint:false,reason:'混入多个卖点'}})});const r=await f.agent.generate(request);
 assert.equal(r.status,'blocked');assert.ok(r.verification.issues.some(x=>x.includes('单核心卖点')));
});
test('字段缺失可有限修复，之后仍执行独立审核',async()=>{
 const f=fixture({write:{sections:[null]}});const r=await f.agent.generate(request);
 assert.equal(r.status,'complete');assert.equal(f.calls.filter(c=>c.stage==='repair').length,1);assert.ok(r.trace.some(e=>e.action==='repair_draft_structure'));assert.equal(f.calls.at(-1).stage,'review');
});
test('结构修复仍无效明确失败且不会无限重试',async()=>{
 const f=fixture({write:null,repair:{draft:makeDraft()}});await assert.rejects(f.agent.generate(request),/结构修复失败.*已重试1次/);
 assert.equal(f.calls.filter(c=>c.stage==='repair').length,1);assert.equal(f.calls.filter(c=>c.stage==='review').length,0);
});
test('结构修复不得绕过真实无依据承诺的审核',async()=>{
 const f=fixture({write:{},repair:makeDraft('采用HarmonyOS 6[F1]。到手价1999元。'),revise:makeDraft('采用HarmonyOS 6[F1]。到手价1999元。')});
 const r=await f.agent.generate(request);assert.equal(r.status,'blocked');assert.ok(r.verification.issues.some(x=>/价格|优惠/.test(x)));
});
test('审核后修订返回缺字段时也只修复一次并重新审核',async()=>{
 let reviews=0;const bad=makeDraft();delete bad.warnings;
 const f=fixture({revise:bad,review:data=>makeReview(data,++reviews<=2?{overall:'unsupported',claims:[{location:'section:S1',text:'HarmonyOS 6',status:'unsupported',evidenceIds:['F1'],reason:'需修订'}]}:{})});
 const r=await f.agent.generate(request);assert.equal(r.status,'complete');assert.equal(f.calls.filter(c=>c.stage==='repair').length,1);assert.equal(f.calls.at(-1).stage,'review');
});
test('空段落、空对象和null嵌套元素产生结构诊断',()=>{
 for(const d of [null,[],{}, {...makeDraft(),sections:[null]}, {...makeDraft(),sections:[{heading:'',text:'',imageIds:[]}]}])assert.throws(()=>validateDraft(d,request),/结构|对象/);
});
test('局部正文修改由代码锁定小标题，字段补丁拒绝越界',()=>{
 const d=makeDraft();d.sections[0].heading='原标题';
 const r=patchDraft(d,[{sectionId:'S1',heading:'擅自换标题',text:'新正文'}],['S1']);assert.equal(r.sections[0].heading,'原标题');
 const changed=patchFields(d,{title:'新标题'},['title']);assert.deepEqual(changed.sections,d.sections);
 assert.throws(()=>patchFields(d,{title:'新标题',intro:'越界'},['title']));assert.throws(()=>patchDraft(d,[null],['S1']));
});
test('仅改标题使用字段补丁，其他段落、图片与CTA保持',async()=>{
 const d=makeDraft('采用HarmonyOS 6[F1]。'+'请带上实际任务到店核对。'.repeat(60));d.title='原始标题';d.imagePlan.push({id:'I2',position:'S1后',caption:'模拟图'});d.sections[0].imageIds.push('I2');
 const f=fixture({write:d}),input={...request,platform:'微信公众号'};
 const first=await f.agent.generate(input);assert.equal(first.status,'complete');
 const r=await f.agent.generate({...input,sessionId:first.sessionId,revision:'只修改标题，更自然，其余保持不变'});
 assert.equal(r.status,'complete');assert.equal(r.changes.mode,'fields');assert.equal(r.draft.title,'到店聊聊你的任务');assert.deepEqual(r.draft.sections,first.draft.sections);assert.deepEqual(r.images,first.images);assert.equal(r.draft.cta,first.draft.cta);assert.equal(f.calls.filter(c=>c.stage==='write').length,1);
});
test('审核误列场景标题和兼容性核对建议时保留真实产品审核',()=>{
 const d=makeDraft('HarmonyOS 6[F1]。请核对软件兼容性。');d.title='从课堂到图书馆';
 const review=makeReview(d,{claims:[{location:'title',text:d.title,isProductClaim:true,status:'unsupported',reason:'场景标题'}, {location:'section:S1',text:'请核对软件兼容性',isProductClaim:true,status:'unsupported'}, {location:'section:S1',text:'HarmonyOS 6',evidenceIds:['F1'],status:'supported'}]});
 const v=reviewDecision(review,d,evidence,[image('I1')],request);assert.equal(v.status,'pass');assert.equal(v.claims.length,1);
});
test('标为非事实也不能豁免金额、兼容与性能承诺',()=>{
 for(const text of ['到手价1999元','兼容所有软件','性能提升一倍','保证免费升级']){
  const d=makeDraft(text);const v=reviewDecision(makeReview(d,{claims:[{location:'section:S1',text,isProductClaim:false,status:'supported',evidenceIds:[]}]}),d,evidence,[image('I1')],request);
  assert.notEqual(v.status,'pass');assert.equal(v.claims.length,1);
 }
});
test('跨引用标记的原句可定位，错误位置仍失败',()=>{
 const d=makeDraft('HarmonyOS 6[F1]，欢迎到店核对。');let v=reviewDecision(makeReview(d,{claims:[{location:'section:S1',text:'HarmonyOS 6，欢迎到店核对。',status:'supported',evidenceIds:['F1']}]}),d,evidence,[image('I1')],request);assert.equal(v.status,'pass');
 v=reviewDecision(makeReview(d,{claims:[{location:'section:S9',text:'HarmonyOS 6',status:'supported',evidenceIds:['F1']}]}),d,evidence,[image('I1')],request);assert.notEqual(v.status,'pass');
});
test('审核原句包含引用标记时不把引用编号当参数数字',()=>{
 const d=makeDraft('HarmonyOS 6[F1]');const v=reviewDecision(makeReview(d,{claims:[{location:'section:S1',text:'HarmonyOS 6[F1]',status:'supported',evidenceIds:['F1']}]}),d,evidence,[image('I1')],request);
 assert.equal(v.status,'pass');assert.equal(v.claims[0].text,'HarmonyOS 6');
});
test('系统版本不能仅凭话术限制卡标为已核验',()=>{
 const d=makeDraft('HarmonyOS 6[F15]');const limits=[{id:'F15',product,kind:'product_limit',quote:'HarmonyOS 6需核对软件'}];
 const v=reviewDecision(makeReview(d,{claims:[{location:'section:S1',text:'HarmonyOS 6',status:'supported',evidenceIds:['F15']}]}),d,limits,[image('I1')],request);assert.equal(v.status,'unsupported');
});
test('图片索引可支持配色外观，却不能代替系统与参数事实',()=>{
 const d=makeDraft('原野绿配色外观[F8001]');const index=[{id:'F8001',product,kind:'appearance_index',quote:'原野绿配色外观'}];
 const appearance=reviewDecision(makeReview(d,{claims:[{location:'section:S1',text:'原野绿配色外观',status:'supported',evidenceIds:['F8001']}]}),d,index,[image('I1')],request);assert.equal(appearance.status,'pass');
 const bad=makeDraft('HarmonyOS 6[F8001]');const spec=reviewDecision(makeReview(bad,{claims:[{location:'section:S1',text:'HarmonyOS 6',status:'supported',evidenceIds:['F8001']}]}),bad,index,[image('I1')],request);assert.equal(spec.status,'unsupported');
});
test('邀请现场判断顺不顺手不等于易用保证，保证性语句仍需核验',()=>{
 const d=makeDraft('HarmonyOS 6[F1]。爸妈可以用手指点选，顺不顺手当场感受。');
 const v=reviewDecision(makeReview(d,{claims:[{location:'section:S1',text:'HarmonyOS 6',status:'supported',evidenceIds:['F1']},{location:'section:S1',text:'爸妈可以用手指点选，顺不顺手当场感受',isProductClaim:true,status:'pending',reason:'需实测'}]}),d,evidence,[image('I1')],request);assert.equal(v.status,'pass');
});
test('图片编辑只重新审核图片，正文沿用此前已独立核验的陈述',async()=>{
 const f=fixture({parse:data=>({task:{product,audience:'职场用户',scene:'门店到访',platform:'门店朋友圈'},questions:[],change:data.previous?{mode:'images',needsNewEvidence:false,imageEdit:{action:'add',count:1}}:{mode:'new',needsNewEvidence:true}})});
 const first=await f.agent.generate(request),r=await f.agent.generate({...request,sessionId:first.sessionId,revision:'只增加图片'});assert.equal(r.status,'complete');assert.deepEqual(r.verification.claims,first.verification.claims);assert.equal(f.calls.at(-1).stage,'review_images');assert.equal(content.text(r),content.text(first));
});
test('图片增删保留整篇文字与证据，失败不覆盖已有版本',async()=>{
 const f=fixture({parse:data=>({task:{product,audience:'职场用户',scene:'门店到访',platform:'门店朋友圈'},questions:[],change:data.previous?{mode:'images',needsNewEvidence:false,imageEdit:{action:data.revision.includes('删除')?'remove':'add',imageIds:data.revision.includes('删除')?['I2']:[],count:1}}:{mode:'new',needsNewEvidence:true}})});
 const first=await f.agent.generate(request),added=await f.agent.generate({...request,sessionId:first.sessionId,revision:'增加图片'});
 assert.equal(added.status,'complete');assert.equal(content.text(added),content.text(first));assert.equal(added.images.length,2);
 const removed=await f.agent.generate({...request,sessionId:first.sessionId,revision:'删除I2'});assert.equal(removed.status,'complete');assert.equal(removed.images.length,1);assert.equal(content.text(removed),content.text(first));
 await assert.rejects(f.agent.generate({...request,sessionId:first.sessionId,revision:'删除I2'}));assert.equal(f.agent.getSession(first.sessionId).version,removed.version);
});
test('复制、预览和两种导出的朋友圈正文一致且只有一段',async()=>{
 const f=fixture(),r=await f.agent.generate(request),data={I1:'data:image/png;base64,iVBORw0KGgo='};
 const copy=content.text(r),html=content.html(r,'',data),md=content.markdown(r,data);
 assert.ok(!copy.includes('\n'));assert.equal((html.match(/class="moments-copy"/g)||[]).length,1);assert.ok(md.startsWith(copy+'\n\n!['));assert.ok(html.includes(copy));assert.ok(!html.includes('/api/images/'));assert.ok(!md.includes('/api/images/'));
});
test('导出缺图明确失败，不把产品网页充作图片链接',async()=>{
 const f=fixture(),r=await f.agent.generate(request);assert.throws(()=>content.markdown(r,{}),/图片/);assert.throws(()=>content.html(r,'',{}),/图片/);
});
test('海报输出一致且用户文字不能注入HTML',()=>{
 const r={task:{platform:'门店海报'},draft:{...makeDraft('<script>bad()</script>'),title:'<img onerror=bad()>',strategy:{angle:'核对',priorities:['系统']}},images:[image('I1')],version:1,provenance:{source:'模拟',retrievedAt:'2026-10-18'},evidence:[],verification:{claims:[],notes:[]}};
 const html=content.html(r,'',{I1:'data:image/png;base64,iVBORw0KGgo='});assert.ok(html.includes('class="poster"'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.equal((html.match(/<article/g)||[]).length,(html.match(/<\/article>/g)||[]).length);
});
