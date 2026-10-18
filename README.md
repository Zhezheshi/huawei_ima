# 映销 · 华为 PC 营销 Agent

基于 Node.js CommonJS 与已配置的 DeepSeek Flash 的本地营销工作台。现有代码继续开发中，**尚未全部验收通过**，适合队友接续开发；不应当作已完成参赛提交。

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

Demo 下请选择“演示 MateBook A（Windows）”，输入例如“为演示 MateBook A 面向大学新生写开学季小红书图文”。`demo/` 只含少量**模拟参数和项目自绘示意图，非华为官方真实资料**；仍调用真实 DeepSeek，不提供假模型响应。

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

- 新链路仍有模型成稿结构不完整、朋友圈篇幅约束及审核误判问题；局部修改等真实验收尚有失败，不能宣称全部通过。
- 官网能否访问取决于站点限制；无原始证据不能发布规格或效果承诺。检索为轻量关键词排序，非向量检索，未穷尽全库。
- 独立 LLM 加规则核验可能漏判或误判，不是绝对可靠的事实证明。图片仅核对索引、型号与文件格式，未做视觉识别或授权确认。
- 不发布具体价格、促销金额、库存及无依据兼容/性能承诺；不合格稿或冲突稿禁止交付。
- 未实现多用户账号、长期记忆、自动发布或公共部署；魔搭链接、正式说明书和完整初赛提交仍待完成。
- 完整参考资料、真实模型原始输出、凭证、本地缓存及授权不明图片均排除在 Git 之外。
