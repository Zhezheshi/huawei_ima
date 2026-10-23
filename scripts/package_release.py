"""Package public source + simulated Demo, never local knowledge or run outputs."""
import hashlib
import argparse
import re
import subprocess
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='dist/huawei-pc-agent-20261023.zip', help='Project-relative ZIP output')
args = parser.parse_args()
target = (root / args.output).resolve()
if not target.is_relative_to(root) or target.suffix != '.zip':
    raise SystemExit('打包路径必须是项目内的.zip文件')
allowed_dirs = {'src', 'web', 'demo', 'config', 'scripts', 'tests', 'docs', '.github'}
allowed_root = {'README.md', 'LICENSE', 'package.json', '.gitignore', '.dockerignore', 'Dockerfile', '.env.example', 'IMA配置说明.md'}
files = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode('utf-8').split('\0')
entries = []
for name in sorted(set(filter(None, files))):
    relative = Path(name)
    if relative.parts[0] not in allowed_dirs and name not in allowed_root:
        continue
    if relative.is_absolute() or '..' in relative.parts:
        raise SystemExit('拒绝非法打包路径')
    file = root / relative
    if not file.is_file() or not file.resolve().is_relative_to(root):
        raise SystemExit('拒绝指向项目外的打包文件：' + name)
    if any(part in {'ima', 'secrets', 'node_modules', '__pycache__'} for part in relative.parts[:-1]) or (relative.name.startswith('.env') and relative.name != '.env.example'):
        raise SystemExit('拒绝私密或缓存路径：' + name)
    data = file.read_bytes()
    if re.search(rb'(?i)\b(?:sk-[a-z0-9]{24,}|ghp_[a-z0-9]{30,}|github_pat_[a-z0-9_]{30,}|ms-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\b', data):
        raise SystemExit('检测到疑似凭证，打包已停止：' + name)
    entries.append((name, data))
target.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, data in entries:
        archive.writestr('huawei-pc-agent/' + name, data)
    manifest = '\n'.join(hashlib.sha256(data).hexdigest() + '  ' + name for name, data in entries) + '\n'
    archive.writestr('huawei-pc-agent/SHA256SUMS.txt', manifest)
print('已生成源码与部署包：' + str(target))
print('文件数：' + str(len(entries)) + '；SHA256：' + hashlib.sha256(target.read_bytes()).hexdigest())
