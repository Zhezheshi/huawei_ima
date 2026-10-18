#!/usr/bin/env python3
"""Run a command with an ephemeral DeepSeek key; never save it to disk."""
import getpass
import os
import subprocess
import sys


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit('用法：python3 scripts/with_deepseek.py <要运行的命令及参数>')
    if not sys.stdin.isatty():
        raise SystemExit('请在本机交互式终端运行，避免密钥输入回显。')
    key = getpass.getpass('DeepSeek API Key（隐藏输入，留空取消）：').strip()
    if not key:
        raise SystemExit('已取消。')
    if any(c.isspace() for c in key):
        raise SystemExit('密钥包含空白字符，已停止。')
    env = os.environ.copy()
    env['DEEPSEEK_API_KEY'] = key
    try:
        result = subprocess.run(args, env=env)
    except KeyboardInterrupt:
        raise SystemExit(130) from None
    except FileNotFoundError:
        raise SystemExit('找不到要运行的命令。') from None
    finally:
        env.pop('DEEPSEEK_API_KEY', None)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
