const config = require('../config/model.json');
(async () => {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('缺少密钥环境变量');
  if (config.base_url !== 'https://api.deepseek.com' || config.model !== 'deepseek-flash') {
    throw new Error('配置不符合已授权的接口和模型');
  }
  const response = await fetch(config.base_url + '/chat/completions', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: config.model, messages: [
      {role: 'user', content: '这是连通性测试。请仅回复：文本生成测试成功。'}
    ], max_tokens: 256, thinking: {type: 'disabled'}, stream: false}),
    redirect: 'error', signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    console.error('生成请求失败，HTTP ' + response.status + '；未输出原始响应。');
    process.exitCode = 1; return;
  }
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('未返回正文');
  // Report success without echoing arbitrary server text or request data.
  console.log(JSON.stringify({status: '文本生成成功', model: config.model,
    expected_reply_matched: content.trim() === '文本生成测试成功。',
    output_characters: content.length, usage: result.usage ? {
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      total_tokens: result.usage.total_tokens
    } : undefined}));
})().catch(() => {
  console.error('生成测试未完成：密钥、网络、配置或响应异常；未输出敏感信息。');
  process.exitCode = 1;
});
