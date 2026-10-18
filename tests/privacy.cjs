const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
test('工具层仅定位比赛库，并在请求前拒绝未知目录与媒体（模拟SDK，不联网）',async()=>{
 const calls=[];const name='赛事授权共享库（测试夹具）';
 const sdk={imaApi:async(api,body)=>{calls.push({api,body});return JSON.stringify({code:0,data:api.endsWith('search_knowledge_base')?{info_list:[{kb_name:name,kb_id:'contest'}]}:{knowledge_list:[{title:'P1',media_id:'contest-folder',media_type:99}],is_end:true}});}};
 const sandbox={process:{env:{IMA_LIBRARY_NAME:name}},module:{exports:{}},require:name=>name==='node:path'?path:name==='node:os'?os:sdk,Buffer,URL,AbortSignal,fetch:()=>{throw Error('不允许联网');}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/ima.cjs'),'utf8'),sandbox);
 const ima=sandbox.module.exports;await ima.connect();await ima.list();const before=calls.length;
 await assert.rejects(ima.list('private-folder'));await assert.rejects(ima.original({media_id:'private-media'}));
 assert.equal(calls.length,before);assert.equal(calls[0].body.query,name);assert.equal(calls[1].body.knowledge_base_id,'contest');
});
