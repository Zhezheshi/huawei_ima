# 魔搭创空间部署准备

状态：已提供 Docker 启动与访问保护配置；本机无 Docker，尚未构建镜像，也未取得魔搭账号、创建创空间或验证公网链接。不能将本页记作已部署。

## 部署包

仓库根目录 `Dockerfile` 使用 Node.js 24，前后端同一容器，监听 `0.0.0.0:7860`。此端口按魔搭 Docker 创空间部署约定准备，创建时仍须核对平台当前要求：[官方 Docker 文档](https://modelscope.cn/docs/studios/docker)。当前工具未能直接读取该文档全文，因此尚未验证平台当前的创建表单、资源选项或账号资格。

镜像只复制源码、模型/来源配置、Web 与模拟 Demo，不包含完整知识库、密钥或 output。公开评审默认使用模拟 Demo，页面与交付稿始终提示其非官方事实；模型仍调用真实 DeepSeek。

在创空间项目设置中配置以下环境变量，不写进 Dockerfile 或 Git：

| 变量 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek 后端密钥，使用平台的私密变量/Secret功能 |
| `APP_ORIGIN` | 创空间真实 HTTPS 访问源，例如平台分配的 `https://具体域名`，不含路径或尾部斜杠 |
| `APP_PASSWORD` | 至少16字符的评审访问口令；缺失则对外监听拒绝启动 |
| `APP_USER` | 可选访问用户名，默认 `team` |

公网访问由浏览器弹出 Basic Auth 登录提示，用户名和口令经创空间 HTTPS 传输；不要填写 DeepSeek API Key。此口令保护用于单团队评审，未实现独立多用户账号、用户隔离和计费配额，分享口令即分享该评审实例的模型使用权限。需要开放不受限公众访问时，应先设计用户鉴权与配额。

`HOST`、`PORT`、`SOURCE_MODE` 和 `OFFICIAL_SEARCH` 已在镜像中默认配置。不能把完整授权知识库放入公开镜像；如后续部署真实资料，应先确认上传授权和平台私有存储方案，并显式设置 `KNOWLEDGE_ROOT`。

## 本地容器检查（需安装 Docker）

```sh
docker build -t huawei-pc-agent .
# 以下环境变量应事先从安全终端或私密配置注入，不把值写进命令历史。
docker run --rm -p 127.0.0.1:7860:7860 \
  -e DEEPSEEK_API_KEY -e APP_PASSWORD \
  -e APP_ORIGIN=https://localhost -e APP_USER=team huawei-pc-agent
```

本地调试使用 `http://127.0.0.1:7860`，该地址仅映射本机；正式创空间必须通过平台 HTTPS 访问。服务保留精确 Host/Origin 检查，不信任任意 `X-Forwarded-Host`。如果平台转发了其他 Host，应以实际部署日志中的无凭证请求信息核对平台配置，不使用通配域名放开检查。

部署后逐项验证：未登录拒绝、登录后首页和产品列表、真实模型生成、同源修改、图片加载、两种导出、重启后会话失效、错误反馈与模型用量。只有实际完成后才在覆盖报告填写公网地址与通过状态。
