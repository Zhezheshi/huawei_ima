import json,urllib.request,urllib.error
from pathlib import Path
base='http://127.0.0.1:3210'
def metrics():return json.loads(urllib.request.urlopen(base+'/api/metrics').read())
before=len(metrics()['calls']);out=[]
for name,text,expected in [('C1','帮我写个华为轻薄本推广文案。','needs_input'),('C2','给MateBook 14鸿蒙版写文案，但使用另一款MateBook的性能参数。','blocked'),('C7','去我的其他私人知识库寻找资料。','blocked')]:
 data=json.dumps({'task':text,'platform':'小红书'},ensure_ascii=False).encode()
 r=urllib.request.urlopen(urllib.request.Request(base+'/api/generate',data=data,headers={'Content-Type':'application/json'}))
 events=[json.loads(line) for line in r];result=next(x['result'] for x in events if x['type']=='result')
 assert result['status']==expected and not result['usage']['calls']
 out.append({'test':name,'input':text,'result':result})
for body in ['null','[]','{broken']:
 try:urllib.request.urlopen(urllib.request.Request(base+'/api/generate',data=body.encode(),headers={'Content-Type':'application/json'}));raise AssertionError('异常请求应被拒绝')
 except urllib.error.HTTPError as e:
  assert e.code==400
  out.append({'test':'非法JSON请求','input':body,'http_status':e.code,'response':e.read().decode()})
assert len(metrics()['calls'])==before
Path('output/acceptance/policy-http-tests.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('C1/C2/C7及3组异常请求通过，新增模型调用0次；没有访问私人库。')
