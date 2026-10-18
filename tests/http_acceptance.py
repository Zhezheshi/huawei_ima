import json
from pathlib import Path
import urllib.request, urllib.error

results=[]
def check(name,path,expected,body=None,headers=None):
    data=None if body is None else body.encode()
    req=urllib.request.Request('http://127.0.0.1:3210'+path,data=data,headers=headers or {})
    try:
        response=urllib.request.urlopen(req,timeout=15)
        status=response.status; content=response.read().decode()
    except urllib.error.HTTPError as e:
        status=e.code;content=e.read().decode()
    assert status==expected,(name,status,content)
    results.append({'test':name,'expected':expected,'actual':status,'response':content[:300]})
check('健康状态','/api/health',200)
check('跨站写入阻止','/api/generate',403,'{}',{'Content-Type':'application/json','Origin':'https://untrusted.invalid'})
check('源码配置不公开','/config/model.json',404)
check('密钥路径不可访问','/.config/huawei-ima/deepseek_api_key',404)
check('非法图片标识不可访问','/api/images/not-a-real-asset',404)
Path('output/acceptance/http-tests.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('HTTP 基础与边界检查通过：'+str(len(results))+'项；未调用模型。')
