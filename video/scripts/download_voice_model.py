from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests

root=Path(__file__).resolve().parents[1]/'.models'
root.mkdir(exist_ok=True)
proxy={'https':'http://127.0.0.1:7897'}
def fetch(name):
    path=root/name
    if path.exists() and path.stat().st_size>1_000_000:
        return
    r=requests.get('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/'+name,proxies=proxy,stream=True,timeout=90)
    r.raise_for_status()
    with path.open('wb') as f:
        for chunk in r.iter_content(1024*1024): f.write(chunk)
    print(name,path.stat().st_size,flush=True)
print(requests.get('https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/examples/chinese.py',proxies=proxy,timeout=30).text,flush=True)
with ThreadPoolExecutor(2) as pool:
    list(pool.map(fetch,['kokoro-v1.1-zh.fp16.onnx','voices-v1.1-zh.bin']))
