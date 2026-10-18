// Controlled conflict injection: original local documents are never edited.
const fs=require('node:fs/promises'),path=require('node:path');
const provider=require('../src/knowledge.cjs'),model=require('../src/model.cjs');
const {createAgent}=require('../src/orchestrator.cjs'),{prompt}=require('../src/prompts.cjs');
(async()=>{
 const product='HUAWEI MateBook 14（鸿蒙版）';
 const injected=['6','5'].map((version,i)=>({id:'F'+(900+i),product,kind:'product_fact',topic:'操作系统',quote:'测试夹具：同一SKU、同一发布日期、同一系统版本口径，操作系统 HarmonyOS '+version,document:'TEST-CONFLICT-'+i+'.md',relativePath:'测试注入，不存在于实际产品资料库',source:'',library:'仅用于测试的冲突夹具',factKey:'操作系统',value:'HarmonyOS'+version,condition:'同一SKU同一日期同一系统口径'}));
 const fixture={...provider,label:'本地真实资料＋明确标记的冲突测试夹具',search:async args=>{const real=await provider.search(args);return{...real,evidence:args.kind==='fact'?[...real.evidence,...injected]:real.evidence};}};
 const agent=createAgent({provider:fixture,model});
 const result=await agent.generate({task:'为HUAWEI MateBook 14（鸿蒙版）面向职场用户写系统版本选购核对的朋友圈推广。',platform:'门店朋友圈'});
 if(result.status!=='blocked'||result.verification.status!=='conflict'||result.publishable!==false)throw Error('冲突未被拦截');
 if(model.usage.some(x=>x.stage==='write'))throw Error('冲突后仍进入写作');
 const independent=await model.call('review',prompt('review'),{task:{product,audience:'职场用户',scene:'选购',platform:'门店朋友圈'},publishable:{title:'系统版本核对',intro:'',cta:'',tags:'','section:S1':'该SKU采用HarmonyOS 6[F900]。'},imagePlan:[],images:[],evidence:injected,platformRules:{min:1,max:3},testNotice:'两个来源是明确注入的同条件冲突夹具，不是实际资料库的错误。请验证同条件冲突审核能力。'});
 if(independent.overall!=='conflict'&&!independent.claims?.some(x=>x.status==='conflict'))throw Error('独立审核未识别夹具冲突');
 await fs.writeFile(path.join(__dirname,'../output/round2/conflict-live.json'),JSON.stringify({notice:'测试注入冲突，不声称本地原库有冲突；未修改原库',result,independent,usage:model.usage},null,2));
 console.log('冲突测试通过：真实编排器在写作前暂停；独立DeepSeek审核识别夹具冲突。模型调用 '+model.usage.length+' 次。');
})().catch(e=>{console.error('冲突实测未通过：'+e.message);process.exitCode=1;});
