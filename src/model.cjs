const config=require('../config/model.json');
const usage=[];
async function call(stage,system,data){
 if(!process.env.DEEPSEEK_API_KEY)throw Error('缺少模型密钥，请用 ./scripts/start 启动');
 if(config.base_url!=='https://api.deepseek.com'||config.model!=='deepseek-flash')throw Error('模型配置不符合已授权的官方接口');
 for(let attempt=0;attempt<2;attempt++){
  const entry={at:new Date().toISOString(),stage,attempt,model:config.model,status:'requested'};usage.push(entry);
  let response;try{response=await fetch(config.base_url+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(data)+(attempt?'\n上次JSON无效，请仅返回指定结构的合法JSON。':'')}],response_format:{type:'json_object'},thinking:{type:'disabled'},max_tokens:stage==='write'||stage==='revise'?6500:5000,stream:false}),redirect:'error',signal:AbortSignal.timeout(120000)});}catch{entry.status='network_error';throw Error('DeepSeek 连接失败，请稍后重试');}
  entry.httpStatus=response.status;if(!response.ok){entry.status='http_error';throw Error('DeepSeek 请求失败（HTTP '+response.status+'）');}
  const body=await response.json();entry.status='received';entry.usage=body.usage?{prompt_tokens:body.usage.prompt_tokens||0,completion_tokens:body.usage.completion_tokens||0,total_tokens:body.usage.total_tokens||0}:null;
  try{const content=body.choices?.[0]?.message?.content;if(typeof content!=='string')throw Error();const parsed=JSON.parse(content.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}catch{entry.status='invalid_json';if(attempt)throw Error('模型连续返回非法JSON，任务已停止');}
 }
}
module.exports={call,usage};
