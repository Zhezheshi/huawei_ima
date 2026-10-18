const {timingSafeEqual} = require('node:crypto');
function configure(env = process.env) {
 const host = env.HOST || '127.0.0.1', port = Number(env.PORT || 3210);
 if (!['127.0.0.1','0.0.0.0'].includes(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw Error('HOST或PORT配置无效');
 const localOrigin = 'http://127.0.0.1:' + port, origins = new Set([localOrigin,'http://localhost:'+port]);
 const hosts = new Set(['127.0.0.1:'+port,'localhost:'+port]);
 if (env.APP_ORIGIN) {
  let url; try { url = new URL(env.APP_ORIGIN); } catch { throw Error('APP_ORIGIN须为完整HTTPS来源'); }
  if (url.origin !== env.APP_ORIGIN || url.protocol !== 'https:' || url.username || url.password) throw Error('APP_ORIGIN须为完整HTTPS来源，不含路径或凭证');
  origins.add(url.origin); hosts.add(url.host);
 }
 const password = env.APP_PASSWORD || '', username = env.APP_USER || 'team';
 if (host === '0.0.0.0' && (!env.APP_ORIGIN || password.length < 16)) throw Error('容器对外监听须配置APP_ORIGIN和至少16字符的APP_PASSWORD');
 if (username.includes(':')) throw Error('APP_USER不能含冒号');
 const expected = Buffer.from(username + ':' + password);
 const authorized = header => {
  if (!password) return true;
  if (!/^Basic [a-zA-Z0-9+/=]+$/.test(header || '')) return false;
  const actual = Buffer.from(header.slice(6), 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
 };
 return {host, port, localOrigin, origins, hosts, authorized};
}
module.exports = {configure};
