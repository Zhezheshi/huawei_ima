(function (root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.MarketingContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
 const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isMoments = result => result.task.platform === '门店朋友圈';
 function text(result) {
  const d = result.draft;
  const fields = [d.title, d.intro, ...d.sections.map(s => [s.heading, s.text].filter(Boolean).join('\n')), d.cta, d.tags.map(t => '#' + t.replace(/^#/, '')).join(' ')].filter(Boolean);
  return fields.join(isMoments(result) ? ' ' : '\n\n');
 }
 function figure(result, id, imageData = {}) {
  const image = result.images.find(i => i.id === id), plan = result.draft.imagePlan.find(i => i.id === id);
  if (!image || !plan) return '';
  const url = imageData[id] || image.url;
  if (!/^\/api\/images\/[a-zA-Z0-9-]+$/.test(url || '') && !/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(url || '')) throw Error('图片地址不可用');
  return `<figure data-image="${esc(id)}"><img src="${esc(url)}" alt="${esc(plan.caption)}"><figcaption>${esc(id)} · ${esc(plan.caption)} · ${esc(image.sourceType === 'demo' ? '模拟示意图，非官方事实' : '本地图片索引')}</figcaption></figure>`;
 }
 function article(result, imageData = {}, editing = true) {
  const d = result.draft;
  let body = '';
  if (result.task.platform === '门店海报') {
   body = `<div class="poster"><div class="poster-brand">HUAWEI PC · 到店体验</div><h2>${esc(d.title)}</h2><p class="poster-subtitle">${esc(d.intro)}</p>${figure(result, d.imagePlan[0]?.id, imageData)}<ul>${d.sections.map(s => `<li>${esc(s.text)}</li>`).join('')}</ul><div class="poster-cta">${esc(d.cta)}</div></div>`;
  } else if (isMoments(result)) {
   body = `<p class="moments-copy" data-section="S1">${esc(text(result))}</p>${d.imagePlan.map(p => figure(result, p.id, imageData)).join('')}`;
  } else {
   const shown = new Set();
   const show = id => { if (shown.has(id)) return ''; shown.add(id); return figure(result, id, imageData); };
   body = `<h2>${esc(d.title)}</h2><p class="intro">${esc(d.intro)}</p>` + (d.imagePlan.length ? show(d.imagePlan[0].id) : '');
   for (const s of d.sections) body += `<section data-section="${esc(s.id)}">${editing ? `<div class="section-label">${esc(s.id)} · 可指定此段修改</div>` : ''}${s.heading ? `<h3>${esc(s.heading)}</h3>` : ''}<p>${esc(s.text)}</p></section>` + s.imageIds.map(show).join('');
   body += d.imagePlan.map(p => show(p.id)).join('') + `<p class="cta">${esc(d.cta)}</p><div class="tags">${d.tags.map(t => '#' + esc(t.replace(/^#/, ''))).join(' ')}</div>`;
  }
  if (d.warnings.length) body += `<div class="warning">${d.warnings.map(esc).join('；')}</div>`;
  return `<article class="article${result.task.platform === '门店海报' ? ' poster-article' : ''}">${body}<div class="result-meta">版本 ${esc(result.version)} · ${esc(result.provenance.source)}<br>来源读取时间 ${esc(result.provenance.retrievedAt)} · 独立LLM辅助核验，发布前仍需人工复核。</div></article>`;
 }
 function appendix(result) {
  const d = result.draft;
  return `\n\n## 场景与营销决策\n人群：${result.task.audience}；场景：${result.task.scene}；阶段：${result.task.stage}；目标：${result.task.goal}\n\n策略：${d.strategy.angle}\n卖点优先级：${d.strategy.priorities.join(' → ')}\n\n## 事实来源\n${result.provenance.source}\n` + result.evidence.map(e => `- [${e.id}] ${e.topic}；${e.document}；${e.relativePath || ''}；资料日期：${e.sourceDate || '未标注'}；获取：${e.retrievedAt || '未记录'}；${e.sourceType || ''}；${e.configuration || e.condition || ''}；${e.source || ''}\n${e.quote}`).join('\n\n') + '\n\n## 独立核验\n' + result.verification.claims.map(c => `- ${c.id} ${c.status}：${c.text}；证据${c.evidenceIds.join(',')}；${c.conditions || ''}；${c.reason || ''}`).join('\n') + '\n\n' + [...result.verification.notes, ...d.warnings].join('\n');
 }
 function markdown(result, imageData) {
  const d = result.draft;
  let body = isMoments(result) ? text(result) : '# ' + d.title + '\n\n' + d.intro;
  const shown = new Set();
  const image = id => {
   if (shown.has(id)) return ''; shown.add(id);
   const item = result.images.find(i => i.id === id), plan = d.imagePlan.find(i => i.id === id);
   if (!item || !plan || !/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(imageData?.[id] || '')) throw Error('图片尚未读取，Markdown未导出');
   const caption = plan.caption.replace(/[\[\]\r\n]/g, '');
   return `\n\n![${caption}](${imageData[id]})\n\n> 图片${id}；插入位置：${plan.position}；来源文件：${item.relativePath || item.name}；来源页：${item.source || '模拟自绘图'}`;
  };
  if (!isMoments(result)) {
   if (d.imagePlan.length) body += image(d.imagePlan[0].id);
   for (const s of d.sections) { body += '\n\n' + (s.heading ? '## ' + s.heading + '\n\n' : '') + s.text; for (const id of s.imageIds) body += image(id); }
   body += '\n\n' + d.cta + '\n\n' + d.tags.map(t => '#' + t.replace(/^#/, '')).join(' ');
  }
  for (const p of d.imagePlan) body += image(p.id);
  return body + appendix(result);
 }
 function html(result, css, imageData) {
  for (const p of result.draft.imagePlan) if (!imageData?.[p.id]) throw Error('图片尚未读取，HTML未导出');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(result.draft.title || result.task.platform)}</title><style>${css.replace(/<\/style/gi, '<\\/style')}body{max-width:800px;margin:20px auto;padding:20px;background:white}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>${article(result, imageData, false)}<details><summary>场景、证据与核验</summary><pre>${esc(appendix(result))}</pre></details></body></html>`;
 }
 return {text, article, markdown, appendix, html};
});
