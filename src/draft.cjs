const strings = value => Array.isArray(value) && value.every(x => typeof x === 'string');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateDraft(d, task) {
 const errors = [];
 if (!object(d)) throw Error('成稿必须是 JSON 对象');
 for (const key of ['title', 'intro', 'cta']) if (typeof d[key] !== 'string') errors.push(key + '须为字符串');
 for (const key of ['tags', 'warnings']) if (!strings(d[key])) errors.push(key + '须为字符串数组');
 if (!Array.isArray(d.sections) || !d.sections.length || d.sections.length > 12 || !d.sections.every(s => object(s) && typeof s.heading === 'string' && typeof s.text === 'string' && s.text.trim() && strings(s.imageIds))) errors.push('sections须为1—12个含heading、非空text、imageIds的段落');
 if (!Array.isArray(d.imagePlan) || !d.imagePlan.every(i => object(i) && ['id', 'caption', 'position'].every(k => typeof i[k] === 'string'))) errors.push('imagePlan字段不完整');
 if (!Array.isArray(d.claims) || !d.claims.every(c => object(c) && typeof c.text === 'string' && strings(c.evidenceIds))) errors.push('claims须含text与字符串数组evidenceIds');
 if (errors.length) throw Error('模型成稿结构不完整：' + errors.join('；'));
 d.sections.forEach((s, i) => { s.id = 'S' + (i + 1); });
 if (task.platform === '门店海报') {
  if (d.sections.length > 3 || d.imagePlan.length !== 1) throw Error('海报必须是一张主视觉和最多三个卖点');
  d.poster = {subtitle: d.intro, bullets: d.sections.map(s => s.text)};
 }
 return d;
}

// Formatting only: keep every word; length/focus problems require a model rewrite.
function normalizeMoments(d) {
 const text = [d.title, d.intro, ...d.sections.flatMap(s => [s.heading, s.text]), d.cta, ...d.tags.map(t => '#' + t.replace(/^#/, ''))]
  .map(s => s.trim()).filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim();
 d.title = d.intro = d.cta = '';
 d.tags = [];
 d.sections = [{id: 'S1', heading: '', text, imageIds: d.imagePlan.map(i => i.id)}];
 d.imagePlan.forEach((p, i) => { p.position = i ? 'S1后' : '封面'; });
 return d;
}

function momentsIssues(d) {
 const parts = [d.title, d.intro, ...d.sections.flatMap(s => [s.heading, s.text]), d.cta, ...d.tags.map(t => '#' + t)];
 const length = [...parts.join('')].length;
 const issues = [];
 if (length > 220) issues.push(`朋友圈可发布文案共${length}字，须重写为220字以内（包含引用、标题和标签）`);
 if (d.sections.length !== 1 || d.title || d.intro || d.cta || d.tags.length || d.sections.some(s => s.heading || /[\r\n]/.test(s.text))) issues.push('朋友圈必须是一个无标题正文段；CTA写在该段内');
 if (d.strategy?.priorities?.length !== 1) issues.push('朋友圈策略必须只有一个核心卖点');
 return issues;
}

function bodyCharacters(d) {
 return [...[d.intro,...d.sections.map(s=>s.text),d.cta].join('').replace(/\[F\d+\]|\s/gu,'')].length;
}
function platformIssues(d, task) {
 if(task.platform==='门店朋友圈')return momentsIssues(d);
 const issues=[],rule=require('./prompts.cjs').platforms[task.platform];
 if(rule?.minChars){const count=bodyCharacters(d);if(count<rule.minChars||count>rule.maxChars)issues.push(`${task.platform}正文${count}字，须为${rule.minChars}—${rule.maxChars}字（不计引用标记和空白）`);}
 if(task.platform==='门店海报')for(const [key,max,label] of [['title',22,'标题'],['intro',45,'副标题'],['cta',35,'行动引导']])if([...d[key].replace(/\[F\d+\]/g,'')].length>max)issues.push(`海报${label}超过${max}字`);
 return issues;
}
function reduceBackground(d, task, verification) {
 const rule=require('./prompts.cjs').platforms[task.platform],draft=structuredClone(d),removed=[];
 if(!rule?.maxChars||bodyCharacters(draft)<=rule.maxChars)return {draft,removed};
 // Remove complete, unreferenced background sentences only. Never cut a fact,
 // qualifier, CTA, number, or sentence already classified as a product claim.
 const protectedWords=/\[F\d+\]|\d|不|未|没|仅|需|须|以|实际|配置|条件|取决|版本|保证|免费|库存|支持|兼容|续航|性能|重量|尺寸|屏幕|接口|电池|键盘|摄像|内存|处理器|系统|配色|外观|到店|咨询|联系|体验|核对|确认/;
 const claims=(verification?.claims||[]).map(c=>c.text.replace(/\s/g,''));
 for(const object of [draft,...draft.sections]){
  const key=object===draft?'intro':'text',original=object[key];
  const sentences=original.match(/[^。！？!?]+[。！？!?]?/g)||[];
  for(const sentence of sentences){
   if(bodyCharacters(draft)<=rule.maxChars)break;
   const normalized=sentence.replace(/\s/g,'');
   if(protectedWords.test(sentence)||claims.some(c=>c.includes(normalized)||normalized.includes(c)))continue;
   const next=object[key].replace(sentence,'');if(!next.trim())continue;
   const before=object[key];object[key]=next;
   if(bodyCharacters(draft)<rule.minChars){object[key]=before;continue;}
   removed.push(sentence);
  }
 }
 return {draft,removed};
}
module.exports = {validateDraft, normalizeMoments, momentsIssues, bodyCharacters, platformIssues, reduceBackground};
