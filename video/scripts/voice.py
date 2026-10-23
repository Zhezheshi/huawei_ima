from pathlib import Path
import json, subprocess, math
import numpy as np
import soundfile as sf
import onnxruntime as ort
ort.set_default_logger_severity(3)
from misaki import zh
from kokoro_onnx import Kokoro

root=Path(__file__).resolve().parents[1]
shots=json.loads((root/'src/narration.json').read_text(encoding='utf-8'))
g=zh.ZHG2P(version='1.1')
voice=Kokoro(str(root/'.models/kokoro-v1.1-zh.fp16.onnx'),str(root/'.models/voices-v1.1-zh.bin'))
ffmpeg=str(root/'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe')
caps=[]; records=[]
def trim(a,sr):
    ind=np.flatnonzero(np.abs(a)>.007*max(float(np.max(np.abs(a))),.05))
    if len(ind):a=a[max(0,ind[0]-int(.07*sr)):min(len(a),ind[-1]+int(.14*sr))]
    return a
for shot in shots:
    arrays=[]
    for i,line in enumerate(shot['lines']):
        dest=root/f'public/audio/{shot["id"]}-{i}.wav'
        if dest.exists():a,sr=sf.read(dest)
        else:
            ph,_=g(line)
            a,sr=voice.create(ph,voice='zf_001',speed=1.03,is_phonemes=True)
            a=trim(a,sr); sf.write(dest,a,sr)
        arrays.append((a,sr,dest))
    raw=sum(len(a)/sr for a,sr,_ in arrays)
    budget=shot['duration']/30-.75-.13*(len(arrays)-1)
    tempo=max(1,raw/budget)
    cursor=shot['from']+10
    for i,(a,sr,dest) in enumerate(arrays):
        if tempo>1.001:
            temp=dest.with_name(dest.stem+'-fit.wav')
            subprocess.run([ffmpeg,'-y','-hide_banner','-loglevel','error','-i',str(dest),'-af',f'atempo={tempo:.5f}',str(temp)],check=True)
            a,sr=sf.read(temp);temp.replace(dest)
        dur=math.ceil(len(a)/sr*30)
        caps.append({'shot':shot['id'],'from':cursor,'duration':dur,'text':shot['lines'][i],'src':'audio/'+dest.name})
        cursor+=dur+4
    records.append({'id':shot['id'],'rawSeconds':round(raw,3),'tempo':round(tempo,4),'lastFrame':cursor-4,'shotEnd':shot['from']+shot['duration']})
    print(shot['id'],round(raw,2),'tempo',round(tempo,3),'end',cursor-4,flush=True)
(root/'src/captions.json').write_text(json.dumps(caps,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'docs/voice-record.json').write_text(json.dumps({'engine':'Kokoro ONNX v1.1-zh fp16','voice':'zf_001','baseSpeed':1.03,'method':'local neural synthesis; actual per-line audio lengths determine captions','records':records},ensure_ascii=False,indent=2),encoding='utf-8')
def ts(f):
    n=round(f/30*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
(root/'out/映销-90秒-中文字幕.srt').write_text('\n\n'.join(f'{i+1}\n{ts(c["from"])} --> {ts(c["from"]+c["duration"])}\n{c["text"]}' for i,c in enumerate(caps))+'\n',encoding='utf-8')
