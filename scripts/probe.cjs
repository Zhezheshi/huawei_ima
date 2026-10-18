const ima=require('../src/ima.cjs');
(async()=>{
 await ima.connect();
 let items=await ima.list();
 const root=items.find(x=>x.title===ima.NAME&&x.media_type===99);
 if(root)items=await ima.list(root.media_id);
 const p1=items.find(x=>x.title==='P1-产品参数库');
 if(!p1)throw new Error('P1 不可见');
 const levels=await ima.list(p1.media_id);
 console.log(JSON.stringify(levels.map(x=>({title:x.title,type:x.media_type}))));
 const harmony=levels.find(x=>x.title.includes('鸿蒙电脑'));
 if(!harmony)return;
 const models=await ima.list(harmony.media_id);
 console.log(JSON.stringify(models.map(x=>({title:x.title,type:x.media_type}))));
 const model=models.find(x=>x.title==='HUAWEI MateBook 14');
 if(!model)return;
 const docs=await ima.list(model.media_id);
 console.log(JSON.stringify(docs.map(x=>({title:x.title,type:x.media_type}))));
 for(const doc of docs.filter(x=>/产品事实|图片索引/.test(x.title))){
 const r=await ima.original(doc);console.log(doc.title,r.type,r.bytes.toString('utf8').slice(0,4500));
 }
})().catch(()=>{console.error('探测失败，原始响应及凭证未输出');process.exitCode=1;});
