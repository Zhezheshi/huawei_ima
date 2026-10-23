const {test} = require('node:test'), assert = require('node:assert/strict');
const {createAuth} = require('../src/auth.cjs');
const {configure} = require('../src/server-config.cjs');
const config = {HOST:'0.0.0.0', APP_ORIGIN:'https://review.invalid', APP_PASSWORD:'nonsecret-test-password'};
const credentials = {username:'team', password:config.APP_PASSWORD};
const tokenCookie = login => login.cookie.split(';')[0];

test('Cookie登录不依赖Authorization；错误口令和伪造会话均拒绝', () => {
 const auth = createAuth(configure(config));
 for (const data of [null, {}, {username:'team', password:'wrong'}, {username:[], password:config.APP_PASSWORD}]) assert.equal(auth.login(data).status, 401);
 assert.equal(auth.authorized('Basic ' + Buffer.from('team:' + config.APP_PASSWORD).toString('base64')), false);
 assert.equal(auth.authorized('__Host-yx_review=' + 'a'.repeat(64)), false);
 const login = auth.login(credentials);
 assert.equal(login.status, 200); assert.ok(auth.authorized(tokenCookie(login)));
 assert.match(login.cookie, /HttpOnly/); assert.match(login.cookie, /Secure/); assert.match(login.cookie, /SameSite=Lax/);
 assert.ok(!login.cookie.includes(config.APP_PASSWORD));
 assert.equal(auth.authorized(tokenCookie(login) + '; ' + tokenCookie(login)), false);
});
test('退出、重新登录和8小时过期均使旧Cookie失效；重启不复用会话', () => {
 let time = 1000; const auth = createAuth(configure(config), () => time);
 const first = tokenCookie(auth.login(credentials));
 const second = tokenCookie(auth.login(credentials, first));
 assert.equal(auth.authorized(first), false); assert.ok(auth.authorized(second));
 assert.equal(createAuth(configure(config)).authorized(second), false);
 assert.match(auth.logout(second), /Max-Age=0/); assert.equal(auth.authorized(second), false);
 const third = tokenCookie(auth.login(credentials));
 time += 8 * 3600 * 1000; assert.equal(auth.authorized(third), false);
});
test('限制连续猜测口令；一分钟后恢复，不信任可伪造的转发IP', () => {
 let time = 0; const auth = createAuth(configure(config), () => time);
 for (let i = 0; i < 10; i++) assert.equal(auth.login({username:'team', password:'wrong'}).status, 401);
 assert.equal(auth.login(credentials).status, 429); assert.equal(auth.login(credentials).retryAfter, 60);
 time += 60000; assert.equal(auth.login(credentials).status, 200);
});
test('最多保留64个访问会话，溢出淘汰最早Cookie', () => {
 const auth = createAuth(configure(config)); const first = tokenCookie(auth.login(credentials));
 let last; for (let i = 0; i < 64; i++) last = tokenCookie(auth.login(credentials));
 assert.equal(auth.authorized(first), false); assert.ok(auth.authorized(last));
});
test('嵌入评审配置使用None/Secure；本机无需口令且不强制Secure', () => {
 const frame = createAuth(configure({...config, APP_FRAME_ANCESTORS:'https://modelscope.cn https://www.modelscope.cn'}));
 assert.match(frame.login(credentials).cookie, /SameSite=None; Secure/);
 assert.ok(createAuth(configure({})).authorized());
 const local = createAuth(configure({APP_PASSWORD:config.APP_PASSWORD})).login(credentials);
 assert.match(local.cookie, /^yx_review=/); assert.ok(!local.cookie.includes('Secure'));
});
