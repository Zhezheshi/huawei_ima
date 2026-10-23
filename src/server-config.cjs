function configure(env = process.env) {
 const host = env.HOST || '127.0.0.1', port = Number(env.PORT || 3210);
 if (!['127.0.0.1','0.0.0.0'].includes(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw Error('HOST或PORT配置无效');
 const localOrigin = 'http://127.0.0.1:' + port, origins = new Set([localOrigin,'http://localhost:'+port]);
 const hosts = new Set(['127.0.0.1:'+port,'localhost:'+port]);
 if (env.APP_ORIGIN) {
  let url; try { url = new URL(env.APP_ORIGIN); } catch { throw Error('APP_ORIGIN须为完整HTTPS来源'); }
  if (url.origin !== env.APP_ORIGIN || url.protocol !== 'https:' || url.username || url.password || url.hostname.includes('*')) throw Error('APP_ORIGIN须为完整HTTPS来源，不含路径、凭证或通配符');
  origins.add(url.origin); hosts.add(url.host);
 }
 const password = env.APP_PASSWORD || '', username = env.APP_USER || 'team';
 if (host === '0.0.0.0' && (!env.APP_ORIGIN || password.length < 16)) throw Error('容器对外监听须配置APP_ORIGIN和至少16字符的APP_PASSWORD');
 if (username.includes(':') || !username.trim() || username.length > 128) throw Error('APP_USER须为有效用户名，不能含冒号');
 const frameAncestors = String(env.APP_FRAME_ANCESTORS || '').trim().split(/\s+/).filter(Boolean);
 for (const value of frameAncestors) {
  let url; try { url = new URL(value); } catch { throw Error('APP_FRAME_ANCESTORS须为以空格分隔的精确HTTPS来源'); }
  if (url.origin !== value || url.protocol !== 'https:' || url.username || url.password || url.hostname.includes('*')) throw Error('APP_FRAME_ANCESTORS须为以空格分隔的精确HTTPS来源');
 }
 const secureCookie = !!env.APP_ORIGIN;
 if (frameAncestors.length && !secureCookie) throw Error('嵌入页面须配置HTTPS APP_ORIGIN');
 return {host, port, localOrigin, origins, hosts, password, username, secureCookie, frameAncestors};
}
module.exports = {configure};
