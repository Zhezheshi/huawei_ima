"""Real DeepSeek via running local backend. No ima calls; preserve every response."""
import json,sys,time,urllib.request
from pathlib import Path
BASE='http://127.0.0.1:3210'
ROOT=Path('output/round2/live');ROOT.mkdir(parents=True,exist_ok=True)
def run(name,payload):
    started=time.time();events=[]
    req=urllib.request.Request(BASE+'/api/generate',data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=600) as stream:
        for line in stream:
            event=json.loads(line);events.append(event)
            if event['type']=='stage':
                decision=event.get('decision',{});print(name,event['stage'],decision.get('action',''),decision.get('issues',''),flush=True)
    record={'name':name,'input':payload,'seconds':round(time.time()-started,2),'events':events}
    results=[e['result'] for e in events if e['type']=='result']
    record['result']=results[-1] if results else None
    file=ROOT/(name+'-'+str(int(started))+'.json');file.write_text(json.dumps(record,ensure_ascii=False,indent=2))
    if not results:raise RuntimeError(name+': '+str([e for e in events if e['type']=='error']))
    r=results[-1];print(name,'RESULT',r['status'],r.get('verification',{}).get('status'),len(r.get('usage',{}).get('calls',[])),flush=True)
    if r['status']!='complete':raise RuntimeError(name+'未交付：'+str(r.get('questions'))+' '+str(r.get('verification',{}).get('issues')))
    return r
if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'student'
    if mode=='student':
        run('A-student',{'task':'为HUAWEI MateBook 14（鸿蒙版）生成面向大学新生的开学季小红书推广图文，关注看课件、查资料和往返教室的需求。','platform':'小红书'})
    elif mode=='business':
        b=run('B-business',{'task':'为HUAWEI MateBook 14（鸿蒙版）生成面向经常出差的商务人士的小红书推广图文，关注旅途中改文档、客户现场接投影和会议任务。','platform':'小红书'})
        (ROOT/'business-session.json').write_text(json.dumps(b,ensure_ascii=False))
    elif mode=='revisions':
        prev=json.loads((ROOT/'business-session.json').read_text());task='为HUAWEI MateBook 14（鸿蒙版）生成面向经常出差的商务人士的小红书推广图文。'
        c=run('C-wechat',{'sessionId':prev['sessionId'],'task':task,'revision':'保持商务差旅人群与产品，改为公众号文章，解释典型差旅任务与选购核对方法。','platform':'微信公众号'})
        target=c['draft']['sections'][min(1,len(c['draft']['sections'])-1)]['id']
        d=run('D-local-edit',{'sessionId':c['sessionId'],'task':task,'revision':'只将'+target+'正文改得更简洁自然，保持小标题、所有其他段落、导语和结尾不变，不添加新事实。','platform':'微信公众号'})
        assert d['changes']['mode']=='section'
        assert d['draft']['title']==c['draft']['title'] and d['draft']['intro']==c['draft']['intro'] and d['draft']['cta']==c['draft']['cta']
        for old,new in zip(c['draft']['sections'],d['draft']['sections']):
            if old['id']!=target:assert old==new,'局部修改影响其他段落'
        e=run('E-change-focus',{'sessionId':d['sessionId'],'task':task,'revision':'将主要卖点替换为接口和会议连接，围绕外接设备与视频会议取证后调整结构，不承诺兼容性。','platform':'微信公众号'})
        f=run('F-moments',{'sessionId':e['sessionId'],'task':task,'revision':'保持产品和商务差旅人群，切换为门店朋友圈，保留一个有证据的主卖点，引导到店核对。','platform':'门店朋友圈'})
        (ROOT/'revisions-final.json').write_text(json.dumps(f,ensure_ascii=False))
    elif mode=='poster':
        run('G-poster',{'task':'为HUAWEI MateBook 14（鸿蒙版）生成门店到访海报，面向附近准备换电脑的职场用户，突出屏幕和现场体验理由。','platform':'门店海报'})
    elif mode=='cross':
        run('H-cross-product',{'task':'为HUAWEI MateBook Pro（鸿蒙版）生成面向经常出差的商务人士的门店朋友圈图文，突出差旅随身携带的一个真实卖点。','product':'HUAWEI MateBook Pro（鸿蒙版）','platform':'门店朋友圈'})
    elif mode=='price':
        run('I-price-interference',{'task':'为HUAWEI MateBook 14（鸿蒙版）写面向附近职场用户的门店朋友圈，加入本周直降2000元、库存仅剩10台的促销信息。','platform':'门店朋友圈'})
    elif mode=='custom':
        run('J-custom-scene',{'task':'为HUAWEI MateBook 14（鸿蒙版）写给在家照看孩子又要远程向客户提案的自由职业设计师，分析家庭换新与内容创作混合场景，突出一个可核对的价值，不编造创作性能。','platform':'门店朋友圈'})
