// Team review access, independent of platform-reserved Authorization headers.
const {createHash, randomBytes, timingSafeEqual} = require('node:crypto');
const digest = value => createHash('sha256').update(value).digest();
const SESSION_MS = 8 * 60 * 60 * 1000, WINDOW_MS = 60 * 1000, MAX_FAILURES = 10;
function createAuth(settings, now = Date.now) {
 const required = !!settings.password, sessions = new Map();
 const expected = digest(JSON.stringify([settings.username, settings.password]));
 const cookieName = settings.secureCookie ? '__Host-yx_review' : 'yx_review';
 const attributes = `Path=/; HttpOnly; SameSite=${settings.frameAncestors.length ? 'None' : 'Lax'}${settings.secureCookie ? '; Secure' : ''}`;
 let failures = 0, windowStart = now();
 function prune() { for (const [key, expires] of sessions) if (expires <= now()) sessions.delete(key); }
 function authorized(cookie = '') {
  if (!required) return true;
  prune();
  const values = String(cookie).split(';').map(x => x.trim()).filter(x => x.startsWith(cookieName + '='));
  if (values.length !== 1) return false;
  const token = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token) && sessions.has(digest(token).toString('hex'));
 }
 function login(data, previousCookie) {
  if (now() - windowStart >= WINDOW_MS) { failures = 0; windowStart = now(); }
  if (failures >= MAX_FAILURES) return {status:429, error:'尝试次数过多，请一分钟后重试', retryAfter:Math.ceil((WINDOW_MS - (now() - windowStart)) / 1000)};
  const valid = data && typeof data.username === 'string' && typeof data.password === 'string' && data.username.length <= 128 && data.password.length <= 1024;
  if (!valid || !timingSafeEqual(digest(JSON.stringify([data.username, data.password])), expected)) {
   failures++; return {status:401, error:'用户名或访问口令错误'};
  }
  prune(); logout(previousCookie);
  while (sessions.size >= 64) sessions.delete(sessions.keys().next().value);
  const token = randomBytes(32).toString('hex');
  sessions.set(digest(token).toString('hex'), now() + SESSION_MS);
  return {status:200, cookie:`${cookieName}=${token}; ${attributes}; Max-Age=${SESSION_MS / 1000}`};
 }
 function logout(cookie = '') {
  for (const part of String(cookie).split(';')) {
   const value = part.trim();
   if (value.startsWith(cookieName + '=')) sessions.delete(digest(value.slice(cookieName.length + 1)).toString('hex'));
  }
  return `${cookieName}=; ${attributes}; Max-Age=0`;
 }
 return {required, authorized, login, logout};
}
module.exports = {createAuth};
