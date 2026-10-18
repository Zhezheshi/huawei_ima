#!/usr/bin/env python3
"""Save a hidden-input key to macOS Keychain through stdin, never argv."""
import getpass
from pathlib import Path
import subprocess
import sys

if not sys.stdin.isatty():
    raise SystemExit('请在本机交互式终端运行。')
helper = Path(__file__).resolve().parent.parent / '.local' / 'deepseek-keychain'
if not helper.is_file():
    raise SystemExit('请先运行 ./scripts/build_keychain.sh')
key = getpass.getpass('DeepSeek API Key（隐藏输入，留空取消）：').strip()
if not key:
    raise SystemExit('已取消。')
if any(c.isspace() for c in key):
    raise SystemExit('密钥包含空白字符，已停止。')
result = subprocess.run([str(helper), 'save'], input=key.encode('utf-8'))
raise SystemExit(result.returncode)
