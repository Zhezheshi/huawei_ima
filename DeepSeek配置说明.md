# DeepSeek 本地持续调用

采用 macOS 钥匙串保存，运行时注入 `DEEPSEEK_API_KEY`。密钥不在项目中，不进入命令参数、前端或日志。

## 首次录入（仅一次）

```sh
cd /path/to/huawei-pc-marketing-agent
python3 scripts/configure_deepseek.py
```

隐藏输入密钥。若系统弹出钥匙串授权，请核对程序为本项目 `.local/deepseek-keychain` 后授权。选择始终允许可避免每次询问。钥匙串服务名为 `huawei-ima.deepseek`。

## 后续真实接口测试

```sh
./scripts/deepseek
```

自动从钥匙串读取并请求官方模型列表；不需要重复输入。该测试不生成文本、不上传项目资料。模型名称确认后再接入写作。

启动其他可信后端命令：`./scripts/deepseek <命令及参数>`。子进程会收到密钥环境变量，不要用 env、printenv 或会输出环境的程序。

工具需要重新编译时运行 `./scripts/build_keychain.sh`。编译产物 `.local/` 已忽略提交；源码不包含密钥。部署时使用平台 Secret，不复制本机钥匙串。

## 管理密钥

重新运行配置脚本可更新密钥。在 macOS“钥匙串访问”搜索 `huawei-ima.deepseek` 可管理或删除；供应商后台撤销才会让旧密钥失效。

旧明文文件 `~/.config/huawei-ima/deepseek_api_key` 不会被新入口读取；如果曾创建，可自行删除。本次未读取旧文件。
