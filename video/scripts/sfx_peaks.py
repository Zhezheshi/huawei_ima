from pathlib import Path
import subprocess,json
import numpy as np
import imageio_ffmpeg
root=Path(__file__).resolve().parents[1]
rows={}
for name in ['soft','sweep','impact','shimmer','click']:
    r=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(root/f'public/audio/{name}.mp3'),'-ac','1','-ar','24000','-f','f32le','-'],capture_output=True,check=True)
    a=np.frombuffer(r.stdout,dtype=np.float32)
    # 10 ms energy envelope is stable across codec noise and agrees with perceptual attack.
    w=240;env=np.convolve(a*a,np.ones(w)/w,mode='same')
    rows[name]={'peakFrame':round(int(np.argmax(env))/24000*30,4),'maxAmplitude':round(float(np.max(np.abs(a))),4),'seconds':round(len(a)/24000,4)}
(root/'docs/sfx-peaks.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(rows)
