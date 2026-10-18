#!/usr/bin/env python3
"""Interactively save ima credentials without echoing them or passing them as arguments."""
import getpass
import os
from pathlib import Path
import sys


def main():
    if not sys.stdin.isatty():
        raise SystemExit('请在本机交互式终端运行；不要把凭证发送到聊天。')
    config = Path.home() / '.config' / 'ima'
    if config.is_symlink():
        raise SystemExit('凭证目录是符号链接，已停止。')
    config.mkdir(mode=0o700, parents=True, exist_ok=True)
    config.chmod(0o700)
    values = {}
    for name, label in [('client_id', 'Client ID'), ('api_key', 'API Key')]:
        target = config / name
        if target.is_symlink():
            raise SystemExit('凭证文件是符号链接，已停止。')
        exists = target.exists() and target.stat().st_size > 0
        value = getpass.getpass(f'{label}（隐藏输入' + ('，留空保留已有值' if exists else '') + '）：').strip()
        if not value and not exists:
            raise SystemExit('未输入完整凭证，未保存本次输入。')
        if value:
            values[name] = value
    for name, value in values.items():
        target = config / name
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, 'O_NOFOLLOW', 0)
        fd = os.open(target, flags, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(value + '\n')
    print('凭证已保存到本机 ~/.config/ima/，文件权限为 600；未显示凭证。')


if __name__ == '__main__':
    main()
