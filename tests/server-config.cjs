const {test}=require('node:test'),assert=require('node:assert/strict');
const {configure}=require('../src/server-config.cjs');

test('默认仍仅监听本机且保持精确Host/Origin限制',()=>{
 const c=configure({});assert.equal(c.host,'127.0.0.1');assert.ok(c.hosts.has('127.0.0.1:3210'));assert.ok(!c.hosts.has('evil.invalid'));assert.ok(!c.origins.has('https://evil.invalid'));assert.equal(c.password,'');
});
test('公网模式缺口令或HTTPS源时拒绝启动',()=>{
 for(const env of [{HOST:'0.0.0.0'},{HOST:'0.0.0.0',APP_ORIGIN:'https://test.invalid',APP_PASSWORD:'short'},{HOST:'0.0.0.0',APP_ORIGIN:'http://test.invalid',APP_PASSWORD:'nonsecret-long-test-password'},{APP_ORIGIN:'https://test.invalid/path'},{APP_ORIGIN:'https://user:password@test.invalid'}])assert.throws(()=>configure(env));
});
test('容器来源和嵌入来源均按精确HTTPS来源校验，不信任通配或脚本',()=>{
 const c=configure({HOST:'0.0.0.0',PORT:'7860',APP_ORIGIN:'https://review.invalid',APP_PASSWORD:'nonsecret-test-password',APP_FRAME_ANCESTORS:'https://modelscope.cn https://www.modelscope.cn'});
 assert.ok(c.hosts.has('review.invalid'));assert.ok(!c.hosts.has('other.review.invalid'));assert.ok(c.origins.has('https://review.invalid'));assert.deepEqual(c.frameAncestors,['https://modelscope.cn','https://www.modelscope.cn']);
 for(const value of ['*','https://*.modelscope.cn',"'self'",'http://modelscope.cn','https://modelscope.cn/path','https://user:pw@modelscope.cn',"https://modelscope.cn;script-src *"])assert.throws(()=>configure({APP_ORIGIN:'https://review.invalid',APP_FRAME_ANCESTORS:value}));
 assert.throws(()=>configure({APP_FRAME_ANCESTORS:'https://modelscope.cn'}));
});
