// Deterministic boundaries; these are basic rules, not semantic fact verification.
function preflight(input){
 const text=[input.task,input.revision].filter(Boolean).join('\n');
 if(/(?:私人|私有|其他|其它|别的|所有|全部).{0,10}(?:知识库|资料库)|知识库.{0,8}(?:私人|私有)/.test(text))return{status:'blocked',questions:['仅允许访问指定比赛共享库和已授权本地参考资料，不会查询私人知识库。']};
 if(/(?:另一款|其他型号|其它型号|别的型号).{0,12}(?:参数|性能|图片)|(?:借用|混用|套用).{0,12}(?:参数|性能|图片)/.test(text))return{status:'blocked',questions:['不能混用其他型号的参数或图片。请选择准确产品，本次只使用该型号证据。']};
 if(!input.product&&!/matebook|擎云/i.test(text))return{status:'needs_input',questions:['请提供准确产品型号及系统版本、目标人群和营销场景；可从左侧产品列表选择。']};
 if(!input.product&&/matebook\s*14/i.test(text)&&!/鸿蒙|harmony|windows|酷睿|ultra/i.test(text))return{status:'needs_input',questions:['MateBook 14 存在不同系统和版本，请选择准确型号，避免参数混用。']};
 return null;
}
function warnings(input,task,available){
 const text=[input.task,input.revision].filter(Boolean).join('\n'),notes=[];
 if(/价格|促销|直降|库存|仅剩|补贴|到手价|\d+元/.test(text))notes.push('未提供已核验的当期价格、优惠或库存依据，本次不发布这些具体承诺。');
 if(/亲测|最好|用了|使用了|三个月|第一|绝对/.test(text))notes.push('未提供真实体验证据，不采用虚构第一人称使用经历或绝对化评价。');
 const chars=text.match(/(\d+)\s*字/);
 if(task.platform==='门店朋友圈'&&chars&&Number(chars[1])>220)notes.push('篇幅要求与朋友圈短文冲突，已按朋友圈短文规则调整至220字以内。');
 const imgs=text.match(/(\d+)\s*张/);
 if(imgs&&Number(imgs[1])>Math.min(available,task.platform==='小红书'?6:task.platform==='微信公众号'?4:3))notes.push(`请求的${imgs[1]}张图片超出素材数量或平台上限，仅使用当前型号的实际可用图片，不重复凑数。`);
 return notes;
}
function sameModel(a,b){
 const system=x=>/鸿蒙|harmony/i.test(x)?'harmony':/windows/i.test(x)?'windows':'';
 if(system(a)&&system(b)&&system(a)!==system(b))return false;
 const clean=x=>x.toLowerCase().replace(/huawei|华为|（鸿蒙版）|\(鸿蒙版\)|（windows）|\(windows\)|\s/g,'');
 return clean(a)===clean(b);
}
module.exports={preflight,warnings,sameModel};
