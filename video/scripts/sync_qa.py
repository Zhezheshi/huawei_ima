from pathlib import Path
import subprocess,json
import soundfile as sf
import numpy as np
from scipy.signal import correlate,resample_poly
import imageio_ffmpeg
root=Path(__file__).resolve().parents[1]
src=root/'out'/('promo-v1.mp4')
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-hide_banner','-loglevel','error','-i',str(src),'-vn','-ac','1','-ar','24000',str(root/'out/decoded.wav')],check=True)
y,sr=sf.read(root/'out/decoded.wav')
caps=json.loads((root/'src/captions.json').read_text(encoding='utf-8'))
records=[]
for name in ['brand','strategy','audit']:
    c=next(c for c in caps if c['shot']==name)
    a,_=sf.read(root/'public'/c['src'])
    expect=round(c['from']/30*sr)
    lo=max(0,expect-int(.25*sr));hi=min(len(y),expect+len(a)+int(.25*sr))
    corr=correlate(y[lo:hi],a,mode='valid',method='fft')
    actual=lo+int(np.argmax(corr));offset=(actual-expect)/sr*30
    records.append({'probe':name,'expectedFrame':c['from'],'actualFrame':actual/sr*30,'offsetFrames':round(offset,4)})
(root/'docs/sync-record.json').write_text(json.dumps({'pipeline':'Remotion 4.0.484 / AAC 48kHz / H.264 MP4','method':'three voice waveform probes, normalized cross-correlation, decoded mono 24kHz','records':records},indent=2),encoding='utf-8')
print(records)
