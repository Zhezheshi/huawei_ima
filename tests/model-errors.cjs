const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function modelWith(fetch,ima={}){const box={module:{exports:{}},require:name=>name==='./ima.cjs'?ima:name==='./policy.cjs'?require('../src/policy.cjs'):name==='../config/model.json'?require('../config/model.json'):require(name),process:{env:{DEEPSEEK_API_KEY:'nonsecret-test-placeholder'}},URL,Buffer,AbortSignal,fetch,__dirname:path.join(__dirname,'../src')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/agent.cjs'),'utf8')+'\nmodule.exports.testModel=llm;',box);return box.module.exports;}
test('DeepSeek HTTP异常明确报错，不返回Mock文案',async()=>{let calls=0;const m=modelWith(async()=>{calls++;return{ok:false,status:503};});await assert.rejects(m.testModel('test',{}),/HTTP 503/);assert.equal(calls,1);});
test('模型非法JSON明确报错，不以规则草稿兜底',async()=>{const m=modelWith(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'{not valid JSON'}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})}));await assert.rejects(m.testModel('test',{}),/JSON/);assert.equal(m.usage.length,1);});
test('四项关键信息齐全时忽略模型对可选卖点的多余追问（模拟SDK和LLM）',async()=>{
 const product='HUAWEI MateBook 14（鸿蒙版）';const folder=(title,media_id)=>({title,media_id,media_type:99});
 const files={undefined:[folder('赛事授权共享库（测试夹具）','root')],root:[folder('P1-产品参数库','p1')],p1:[folder('01-鸿蒙电脑','harmony')],harmony:[folder('HUAWEI MateBook 14','model')],model:[{title:'产品事实.md'},{title:'图片索引.csv'},folder('images','images')],images:[{title:'test.jpg'}]};
 const ima={NAME:'赛事授权共享库（测试夹具）',connect:async()=>{},list:async id=>files[id],original:async item=>({bytes:item.title==='产品事实.md'?Buffer.from('# 产品\n\n## 操作系统\n\nHarmonyOS 6'):item.title==='图片索引.csv'?Buffer.from('文件名,产品型号,官网图片说明,来源页面\ntest.jpg,HUAWEI MateBook 14（鸿蒙版）,外观,https://consumer.huawei.com/\n'):Buffer.from([255,216,255])})};
 const generated={strategy:{angle:'差旅',priorities:['系统核对'],outline:[]},title:'到店体验',intro:'准备出差？',sections:[{heading:'',text:'HarmonyOS 6[F1]',imageIds:[]}],cta:'到店核对软件',tags:[],imagePlan:[{id:'I1',position:'封面',caption:'外观'}],claims:[{text:'HarmonyOS 6',evidenceIds:['F1']}],warnings:[]};
 let calls=0;const m=modelWith(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify(calls++===0?{product,audience:'商务人士',scene:'差旅',platform:'门店朋友圈',questions:['请确认核心卖点']}:generated)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})}),ima);
 const result=await m.generate({task:'为MateBook 14鸿蒙版写商务差旅朋友圈'});assert.equal(result.status,'complete');assert.equal(calls,2);
});

function currentModelWith(fetch){
 const box={module:{exports:{}},require,process:{env:{DEEPSEEK_API_KEY:'nonsecret-test-placeholder'}},AbortSignal,fetch};
 box.require=name=>name==='../config/model.json'?require('../config/model.json'):require(name);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/model.cjs'),'utf8'),box);return box.module.exports;
}
test('当前模型客户端非法JSON只重试一次且保留API用量',async()=>{
 let calls=0;const m=currentModelWith(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:++calls===1?'{broken':'{"ok":true}'}}],usage:{total_tokens:7}})}));
 const r=await m.call('write','test',{});assert.equal(r.ok,true);assert.equal(calls,2);assert.equal(m.usage[0].status,'invalid_json');assert.equal(m.usage.reduce((n,c)=>n+c.usage.total_tokens,0),14);
});
test('当前模型客户端连续非法JSON明确停止，不交付替代稿',async()=>{
 const m=currentModelWith(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'not json'}}]})}));
 await assert.rejects(m.call('write','test',{}),/连续返回非法JSON/);assert.equal(m.usage.length,2);
});
