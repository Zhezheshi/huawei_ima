# 魔搭 Docker 部署

版本：0.4.0（2026-10-23）。目标创空间为 [Zhezheshi/huawei_ima](https://www.modelscope.cn/studios/Zhezheshi/huawei_ima)，运行域名为 `https://zhezheshi-huawei-ima.ms.show`。目标 SDK 已从 Gradio 改为 Docker，保留免费 `platform/2v-cpu-8g-mem` 资源。代码、容器构建、运行及真实模型验收是不同状态，最新结果见[更新报告](acceptance-2026-10-23.md)。当前平台已Running、登录通过；线上模型生成收到DeepSeek HTTP401，需更新有效Secret后再验收。

## 容器与数据

根目录 Dockerfile 使用 Node.js 24，监听 `0.0.0.0:7860`，以非 root 用户运行。镜像只复制源码、模型/来源配置、Web 与模拟 Demo，不复制完整授权知识库、密钥、本地缓存、视频或 output。无需 npm install，运行时没有额外 npm 依赖。

公开 Demo 的参数、图片均明确标为模拟；模型仍为真实 DeepSeek，未配置密钥时可查看界面，生成按钮禁用，接口返回明确的503。不得把 Demo 内容当作华为真实产品资料。真实资料需要另行确认上传授权和私有存储方案。

## 创空间设置

在设置中选择 **Docker SDK**。平台 Docker 文档要求阿里云账号绑定和实名验证，这类账号操作由持有人完成；仅选用已查询可用的免费资源。

在创空间变量设置中填写以下值，不把私密值写入 Git、README 或 Dockerfile：

| 类型 | 名称 | 值或用途 |
|---|---|---|
| Secret | `DEEPSEEK_API_KEY` | 用户授权存入此创空间的后端模型密钥 |
| Secret | `APP_PASSWORD` | 至少16字符的随机评审口令，访问者凭此使用团队模型额度 |
| Variable | `APP_ORIGIN` | `https://zhezheshi-huawei-ima.ms.show`，不含路径或尾部斜杠 |
| Variable | `APP_USER` | 可选，默认 `team` |
| Variable | `APP_PROXY_MODE` | 此创空间设置`modelscope`，适配重部署时变化的平台函数Host |
| Variable | `APP_PROXY_HOSTS` | 其他固定反向代理可选：精确内部Host，以空格分隔；魔搭动态部署不使用此项 |
| Variable | `APP_FRAME_ANCESTORS` | 可选：`https://modelscope.cn https://www.modelscope.cn`，允许创空间页面嵌入 |

镜像已默认配置 `HOST=0.0.0.0`、`PORT=7860`、`SOURCE_MODE=demo`、`OFFICIAL_SEARCH=0`。缺少精确HTTPS来源或足够长度的口令时，对外监听拒绝启动。更换域名应同时更新 APP_ORIGIN。魔搭会在重部署时改变内部函数域名；显式APP_PROXY_MODE=modelscope只适用于HOST=0.0.0.0且APP_ORIGIN为精确HTTPS ms.show来源的部署，仅额外接受已观测的studio前缀、北京VPC函数域名语法。它不会扩展浏览器Origin白名单，不接受任意域名，也不信任X-Forwarded-Host。其他代理可通过APP_PROXY_HOSTS填写固定精确值。被拒绝Host最多记录5个不同值，不记录Cookie、口令或其他请求头。

## 登录与嵌入

平台保留 `Authorization`、`X-modelscope-*` 和 `X-studio-*` 请求头，所以应用评审登录使用 JSON 表单和 Cookie，不再使用 Basic Auth。后端向 DeepSeek 官方 API 发起请求所需的 Authorization 不经过创空间入口，仍正常保留。

- 用户打开首页后输入用户名和评审口令。登录不会收集 DeepSeek 密钥。
- 访问令牌为随机值，服务器只在内存保存其摘要；Cookie 使用 HttpOnly、Path=/，外部HTTPS部署还使用 Secure 与 `__Host-` 前缀，不设置 Domain。
- 有效期8小时；退出、重新登录、服务器重启会使相应旧会话失效。最多保留64个访问会话，超出后淘汰最早一个。
- 默认 SameSite=Lax、禁止嵌入；显式配置精确嵌入来源时使用 SameSite=None/Secure。若浏览器阻止第三方Cookie，登录页提供“在新窗口打开工作台”，不会反复跳转。
- 每分钟累计10次失败登录后暂时限流，返回429和Retry-After。此限流按单个服务实例共享，不信任可伪造的代理IP。
- POST要求JSON，携带的Origin必须在精确来源白名单中。会话过期时前端转到登录页；退出会清除当前浏览器保存的创作会话编号。

此机制用于单团队评审，不是独立多用户账号或用量隔离。分享评审口令意味着分享该实例的模型使用权限；不适合无限制公众试用。

## 健康与长任务

`GET /healthz` 为无需登录的最小存活检查，只返回 `{"status":"ok"}`，不会调用模型或披露配置。该单一只读存活路径允许平台IP探测的Host；其他页面和API仍检查Host。Docker HEALTHCHECK 使用此地址。它不代表密钥有效、资料可用或模型生成已验收；受保护的 `/api/health` 可检查密钥是否配置与资料模式。

生成接口返回NDJSON，提前刷新响应头，并每10秒发送一个无内容的heartbeat事件；浏览器忽略心跳，只展示实际阶段与结果。响应设置 `X-Accel-Buffering: no`，减少代理缓存阶段信息的风险。真实平台仍须验证自身的最长请求时限。

## 本地验证

```sh
npm test
npm run test:http
# 需本机装有Docker；以下口令从环境变量安全注入，不写真实值到命令历史。
docker build -t huawei-pc-agent .
docker run --rm -p 127.0.0.1:7860:7860 \
  -e APP_PASSWORD -e DEEPSEEK_API_KEY \
  -e APP_ORIGIN=https://localhost huawei-pc-agent
```

带 Secure Cookie 的容器配置应通过HTTPS反向代理进行登录测试；仅用 `http://127.0.0.1:7860/healthz` 检查本地容器存活。纯本机开发不设置 APP_ORIGIN、HOST=0.0.0.0 和口令时仍可直接打开工作台。

CI执行Node.js 22/24的自动测试和HTTP测试，并在Linux执行Docker构建及无密钥容器健康检查。测试用口令仅为公开测试夹具，不可作为真实评审口令。

## 平台分享入口与自动检查

普通访问者使用创空间分享页或其`?mode=full`完整应用入口。平台会为浏览器建立自己的转发上下文；直接用Python/curl访问`ms.show`可能返回网关403或跳转到创空间，不能据此认定应用未运行。

平台给出的`studio-…api-inference.modelscope.net`是需要ModelScope Token的机器API地址，不作为普通用户分享链接。应用自己的Cookie登录仍然必须通过；不要在公开页面或示例中放入平台Token来绕过网关。

## 发布后验收

源码推送后，在已配置私密变量且账号具备Docker资格的前提下触发部署。先检查build日志，再检查run日志，确认运行后逐项验收：未登录保护、登录与退出、产品列表、真实模型生成、同源修改、图片加载、两种导出、重启后失效和用量。线上真实生成会产生DeepSeek用量，不能用本地模拟测试代替。

官方参考：[Docker约束与端口](https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/references/docker-templates.md)、[创空间API与配置](https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/references/openapi-studio-endpoints.md)。

## DeepSeek HTTP401处理

若登录正常但生成显示DeepSeek HTTP401，说明服务端这次请求未通过模型凭证认证。维护者在创空间Secret中更新DEEPSEEK_API_KEY并重新部署；不要修改前端传密钥，也不要关闭审核或用固定稿替代。状态接口keyConfigured只说明值存在，无法证明其有效。更新后先以公开Demo单案例复验，再测试修改与实际导出。
