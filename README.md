# 映销 · 华为 PC 营销 Agent

基于 Node.js CommonJS 与 DeepSeek Flash 的营销工作台，支持本地授权资料和公开模拟 Demo。当前版本 **0.4.0**，已完成营销约束回归及 Cookie 登录部署修复。测试结果和部署边界见 [2026-10-23 更新报告](docs/acceptance-2026-10-23.md)；历史真实模型回归另见 [2026-10-18 报告](docs/acceptance-2026-10-18.md)。

## 当前功能

需求解析与必要追问 → 客户洞察与营销策略 → 策略驱动取证与补查 → 图文创作 → 独立 LLM 审核及规则检查 → 最多两次修订 → 当前会话修改与导出。

- 八类场景：开学季、职场办公、内容创作、家庭换新、企业采购、门店到访、新品首发、节日营销，也允许混合场景。
- 四个平台：小红书 3—6 图、公众号 2—4 图、门店朋友圈 1—3 图、门店海报 1 图及最多三个卖点。
- Web 展示策略、证据、来源及获取时间、审核问题和图文预览，支持复制、Markdown 与含图 HTML 导出。
- 当前会话支持段落补丁、卖点/人群/平台切换和图片增删；服务重启后会话失效。
- 实际运行提示词：`src/prompts.cjs`；编排：`src/orchestrator.cjs`；数据源：`src/knowledge.cjs`、`src/official.cjs`。架构和提示词说明见 `docs/`。

## 克隆与快速运行

需要 Node.js 22+ 和 Python 3，无额外 npm 依赖，无需 npm install。

```sh
git clone https://github.com/Zhezheshi/huawei_ima.git
cd huawei_ima
SOURCE_MODE=demo python3 scripts/with_deepseek.py node src/server.cjs
```

按终端提示隐藏输入你自己的 DeepSeek API Key，打开 http://127.0.0.1:3210/ 。密钥仅注入子进程，不保存到源码、不发到聊天。若已有安全配置的 `DEEPSEEK_API_KEY` 环境变量，可直接 `SOURCE_MODE=demo npm start`。`.env.example` 仅为配置示例，程序不会自动加载 `.env`。

Demo 页面会预选“演示 MateBook A（Windows）”，默认需求及八个快捷示例均跟随模拟型号。例如输入“为演示 MateBook A 面向大学新生写开学季小红书图文”。`demo/` 只含少量**模拟参数和项目自绘示意图，非华为官方真实资料**；仍调用真实 DeepSeek，不提供假模型响应。

## Windows PowerShell

```powershell
cd huawei_ima
# 无需修改执行策略，直接在 PowerShell 调用安全输入脚本。
$env:SOURCE_MODE = 'local'
$env:OFFICIAL_SEARCH = '0' # 首次验收只读本地资料，明确不代表实时官网
# 若默认参考资料目录不存在，用实际已授权目录覆盖：
$env:KNOWLEDGE_ROOT = 'C:\你的授权资料目录\华为PC全板块深度知识库_v7'
python scripts/with_deepseek.py node src/server.cjs
```

也可运行 `./scripts/start.ps1 -Mode demo` 或 `-Mode local -KnowledgeRoot '实际目录'`。脚本提示隐藏输入密钥；不要将密钥贴进聊天、写入命令历史或源码。Windows 的 Python 命令通常为 `python`。

如本机需要代理，Node.js 24 可在当前终端设置正确的 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY=127.0.0.1,localhost`，再用 `python scripts/with_deepseek.py node --use-env-proxy src/server.cjs`。代理端口以本机系统设置为准，不改写其他人的全局 Git 配置。Node.js 22 的代理能力需按其具体版本另行核实。

## DeepSeek 配置

沿用 `config/model.json` 中现有接口与模型设置。不要改猜模型 ID，不提交密钥。

macOS 也可使用已有钥匙串方案：

```sh
./scripts/build_keychain.sh
python3 scripts/configure_deepseek.py
SOURCE_MODE=demo ./scripts/start
```

后续从钥匙串读取并注入后端。启动端口可用 `PORT=3211` 覆盖；服务仅监听本机。模型用量查询 `/api/metrics`，来源状态查询 `/api/sources`。

## 完整本地资料与官网模式

完整知识库不随仓库发布，需由队友自行取得授权资料。配置 `config/sources.json` 的 `localRoot`，或用环境变量指定：

```sh
SOURCE_MODE=local KNOWLEDGE_ROOT="/你的授权资料目录/华为PC全板块深度知识库_v7 2" python3 scripts/with_deepseek.py node src/server.cjs
```

目录至少包含 `P1-产品参数库/01-鸿蒙电脑`、`P1-产品参数库/02-MateBook-Windows` 和 `P8-客户场景库`；型号目录包含产品事实、限制说明、图片索引和本地图片。可参考 `demo/knowledge` 的结构。

正常模式优先按型号检索本地资料，并定向读取本地来源登记中的华为官网/商城产品页；有域名与路径白名单、robots 检查、限频、缓存及访问失败回退，不做全站爬虫。不同来源保留原文、条件、URL 和获取时间，无法解决的同条件冲突暂停交付。`OFFICIAL_SEARCH=0` 可只用本地资料。

根据主办方最新通知（用户提供），**ima 不再强制**。适配器仅作为可选历史模块保留，默认不调用也不需要其 SDK；配置见 `IMA配置说明.md`。

## 验证与接续开发

```sh
npm test
# 真实 API 验收会产生模型用量，需密钥与授权完整知识库
python3 scripts/with_deepseek.py node tests/upgrade-live.cjs
```

规则、模拟与真实 API 测试应分开统计。缺完整本地库时相应本地集成测试跳过。原始日志、失败输出和用量在本机 `output/`，不公开提交。历史与覆盖说明见 `docs/competition-coverage.md`，当前交接状态见 `docs/handoff.md`。

## 已知限制

- 已增加一次成稿结构修复、朋友圈统一单段与一次定向压缩、引用定位和非事实建议分类；这不保证模型每次都通过。当前真实验收及未测项见 `docs/acceptance-2026-10-18.md`。
- 官网能否访问取决于站点限制；无原始证据不能发布规格或效果承诺。检索为轻量关键词排序，非向量检索，未穷尽全库。
- 独立 LLM 加规则核验可能漏判或误判，不是绝对可靠的事实证明。图片仅核对索引、型号与文件格式，未做视觉识别或授权确认。
- 不发布具体价格、促销金额、库存及无依据兼容/性能承诺；不合格稿或冲突稿禁止交付。
- 未实现独立多用户账号、长期记忆、配额计费或自动发布。魔搭代码仓库已建立，Docker SDK 配置与运行状态见部署报告；源码同步不等于线上生成验收完成。
- 完整参考资料、真实模型原始输出、凭证、本地缓存及授权不明图片均排除在 Git 之外。

## 当前修复与验收入口

- `npm test`：规则、模拟编排、结构修复、局部修改、导出内容与部署配置测试。
- `npm run test:http`：启动无密钥 Demo 子进程，验证真实 HTTP 的鉴权、Host/Origin 与请求边界；不调用模型。
- `npm run test:acceptance`：连接已配置密钥的本机 `3211` 服务，执行真实模型回归，会产生费用并发送检索到的证据片段；先确认资料外发授权。`TEST_ORIGIN` 可指定另一个本机端口，`CASES` 可选逗号分隔的案例编号，`RUN_ID` 区分原始记录批次。

完整本地输出在忽略的 `output/acceptance-20261018/`。真实 API、模拟测试、浏览器下载和未测项分别统计。Markdown 和 HTML 都内嵌图片，不依赖服务会话里的 `/api/images/` 链接；部分 Markdown 阅读器会过滤 data URI，此时使用 HTML 离线查看。

魔搭 Docker 部署见 [部署说明](docs/deployment.md)。本机默认仅监听127.0.0.1；容器对外监听必须设置精确 HTTPS 来源与评审访问口令。访问采用页面登录与 HttpOnly Cookie，适配魔搭保留认证头规则；可选配置精确嵌入来源。当前创空间：[Zhezheshi/huawei_ima](https://www.modelscope.cn/studios/Zhezheshi/huawei_ima)。线上状态以更新报告为准。

当前交付包：[源码与Demo部署包](releases/huawei-pc-agent-20261023.zip)，不含完整知识库、密钥与原始运行记录；校验值见releases/SHA256SUMS.txt。当前报告见[2026-10-23更新报告](docs/acceptance-2026-10-23.md)。
