'use strict';
const form = document.getElementById('loginForm');
form.onsubmit = async event => {
 event.preventDefault();
 const button = document.getElementById('loginButton'), error = document.getElementById('loginError');
 button.disabled = true; error.hidden = true;
 try {
  const response = await fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:form.username.value, password:form.password.value})});
  const data = await response.json();
  form.password.value = '';
  if (!response.ok) throw Error(data.error || '登录失败，请重试');
  const status = await fetch('/api/auth/status').then(r => r.json());
  if (!status.authenticated) throw Error('浏览器未保存访问会话，请在新窗口打开工作台后登录');
  window.location.replace('/');
 } catch (e) { error.textContent = e.message || '连接失败，请稍后重试'; error.hidden = false; }
 finally { button.disabled = false; }
};
