// Real authentication test; never print credentials, raw errors, or response headers.
(async()=>{
 const key=process.env.DEEPSEEK_API_KEY;
 if(!key){console.error('缺少环境变量。请通过 scripts/with_deepseek.py 启动本测试。');process.exitCode=1;return;}
 try{
  const r=await fetch('https://api.deepseek.com/models',{
   headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(30000)
  });
  if(!r.ok){
   const tips={401:'认证失败，请检查密钥。',402:'账户余额不足。',429:'请求频率受限，请稍后重试。'};
   console.error(`DeepSeek 返回 HTTP ${r.status}。${tips[r.status]||'请求未成功；未输出原始响应。'}`);
   process.exitCode=1;return;
  }
  const body=await r.json();
  const models=(body.data||[]).map(x=>x.id).filter(x=>typeof x==='string'&&/^[\w.\-:/]{1,100}$/.test(x));
  console.log('真实调用成功：DeepSeek 官方接口已接受认证。');
  console.log('账号可见模型：'+(models.join('、')||'未返回模型名称'));
  console.log('本次仅查询模型列表，没有生成文本或上传项目资料。');
 }catch{
  console.error('网络或响应解析失败。未输出密钥或原始错误，请检查网络后重试。');
  process.exitCode=1;
 }
})();
