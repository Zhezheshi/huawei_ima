"""Deterministic original 120-BPM electronic underscore; no stock music used."""
from pathlib import Path
import numpy as np
import soundfile as sf
import json
root=Path(__file__).resolve().parents[1]
sr=48000; total=90; n=sr*total
rng=np.random.default_rng(20261022)
audio=np.zeros((n,2),dtype=np.float32)
def put(a,start,level=1,pan=0):
    i=round(start*sr); end=min(n,i+len(a))
    if i<0 or i>=n:return
    a=a[:end-i]*level
    audio[i:end,0]+=a*np.sqrt((1-pan)/2)
    audio[i:end,1]+=a*np.sqrt((1+pan)/2)
def midi(m):return 440*2**((m-69)/12)
def note(hz,dur,bright=.14):
    t=np.arange(round(dur*sr))/sr
    env=np.minimum(1,t/.012)*np.exp(-t*2.7)*(np.minimum(1,(dur-t)/.06))
    return ((np.sin(2*np.pi*hz*t)+bright*np.sin(4*np.pi*hz*t))*env).astype(np.float32)
chords=[[50,57,60,65],[46,53,57,62],[48,53,57,60],[48,55,58,64]]
for block,start in enumerate(np.arange(0,90,4)):
    chord=chords[block%4];dur=min(4.5,90-start);t=np.arange(round(dur*sr))/sr
    env=np.minimum(1,t/.7)*np.minimum(1,(dur-t)/.8)
    for j,m in enumerate(chord):
        hz=midi(m);a=(np.sin(2*np.pi*hz*t)+.17*np.sin(2*np.pi*(hz*1.002)*t))*.045*env
        put(a,start,pan=(-.6+j*.4))
for beat,start in enumerate(np.arange(0,90,.5)):
    energy=.4 if start<6 else .66 if start<12 else .84 if start<76 else .65 if start<83 else 1.05
    # Rounded low kick, no bright game feedback tones.
    t=np.arange(round(.32*sr))/sr
    phase=2*np.pi*(43*t+80*.020*(1-np.exp(-t/.020)))
    kick=np.sin(phase)*np.exp(-t*15)*np.minimum(1,t/.002)
    put(kick,start,.32*energy)
    if beat%2:
        t=np.arange(round(.14*sr))/sr;noise=rng.normal(0,1,len(t));smooth=np.convolve(noise,np.ones(6)/6,mode='same')
        clap=(noise-smooth)*np.exp(-t*37)*np.minimum(1,t/.003)
        put(clap,start,.037*energy,pan=.10)
    t=np.arange(round(.065*sr))/sr;noise=rng.normal(0,1,len(t));hat=(noise-np.roll(noise,1))*.5*np.exp(-t*84)
    put(hat,start+.25,.015*energy,pan=.35 if beat%2 else -.35)
    if start>=12:
        m=chords[int(start//4)%4][0]-12
        put(note(midi(m),.38,.05),start+.02,.16*energy,pan=-.05)
        if beat%4==2:put(note(midi(chords[int(start//4)%4][2]+12),.65,.04),start+.25,.029,pan=.5)
peak=float(np.max(np.abs(audio)));audio*=.72/peak
sf.write(root/'public/audio/bgm.wav',audio,sr,subtype='PCM_16')
f=np.arange(n)/sr*30
gain=np.interp(f,[0,60,2490,2650,2699],[0,.105,.105,.14,0])
sf.write(root/'public/audio/bgm-workbench.wav',audio*gain[:,None],sr,subtype='PCM_16')
# A single original rising air sweep for the finale (source energy peak at its end).
t=np.arange(round(1.4*sr))/sr; noise=rng.normal(0,1,len(t));noise=np.convolve(noise,np.ones(4)/4,mode='same')
env=(t/1.4)**1.6*np.minimum(1,(1.4-t)/.025)
riser=noise*env*.4
sf.write(root/'public/audio/riser.wav',riser,sr,subtype='PCM_16')
(root/'docs/score-record.json').write_text(json.dumps({'type':'original procedural electronic underscore','bpm':120,'beat0':0,'seed':20261022,'sampleRate':sr,'duration':90,'allSceneCutsOnBeat':True,'license':'Original score made for this video; no third-party BGM included'},indent=2),encoding='utf-8')
print('score generated',peak)
