#!/usr/bin/env python3
"""Check presence only; do not print or send the key."""
import os
if not os.environ.get('DEEPSEEK_API_KEY'):
    raise SystemExit('未检测到 DEEPSEEK_API_KEY。')
print('DEEPSEEK_API_KEY 已注入当前进程。未显示密钥、未写入文件、未发送网络请求。')
