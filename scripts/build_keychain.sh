#!/bin/zsh
set -eu
project_dir="${0:A:h:h}"
mkdir -p "$project_dir/.local/swift-cache"
/usr/bin/swiftc -module-cache-path "$project_dir/.local/swift-cache" "$project_dir/scripts/deepseek_keychain.swift" -o "$project_dir/.local/deepseek-keychain"
print '钥匙串工具已编译。'
