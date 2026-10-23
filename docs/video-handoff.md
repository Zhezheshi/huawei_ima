# 90秒宣传片交接与远端资料入口

同步日期：2026-10-23。本片为2026-10-22已完成的原版，1920×1080、30FPS、2700帧、90秒。此次只发布已有成片和资料，没有换配音、改字幕或重新渲染。

此前视频位于本机独立的yingxiao-promo目录，业务仓库未跟踪这些文件，因此截图所示的远端检索缺失属实。现已将可渲染工程及成片放入本仓库video/，主分支与fix/marketing-validation同步，魔搭同样提供副本。

| 截图提到的资料 | 本仓库入口 |
|---|---|
| 90秒宣传片 | [带配乐成片](../video/exports/映销-90秒-宣传片.mp4) |
| 无配乐版 | [同画面无配乐版](../video/exports/映销-90秒-无配乐版.mp4)，仍含原旁白和音效 |
| Remotion工程 | [工程说明](../video/README.md)、[注册入口](../video/src/index.ts)、[合成规格](../video/src/Root.tsx)、[主时间线](../video/src/Main.tsx) |
| 旁白原文 | [8段完整原文](../video/docs/narration.md)、[12镜原始文本与时间](../video/src/narration.json) |
| 完整分析与语义时间轴 | [voiceover_timeline.md](voiceover_timeline.md) |
| 独立旁白音频 | [public/audio](../video/public/audio/)，33段实际使用WAV，文件名与captions.json逐条对应 |
| 独立背景音乐和音效 | audio/bgm.wav、bgm-workbench.wav及各MP3/riser.wav；未混入旁白 |
| 字幕与逐句时间 | [captions.json](../video/src/captions.json)、[SRT](../video/exports/映销-90秒-中文字幕.srt) |
| 多轨与场景动画 | [workbench.ts](../video/src/workbench.ts)、[Scenes.tsx](../video/src/Scenes.tsx) |
| 来源、制作与历史终检 | [制作说明](../video/docs/制作说明.md)、[素材记录](../video/docs/音频与素材.md)、[独立终检](../video/docs/独立终检.md) |
| 发布文件校验 | [清单与SHA256](../video/manifest.json) |

业务手动演示步骤docs/demo-walkthrough.md不是这支宣传片的台词，也不是其时间轴。后续分析以此处链接的实际运行源码为准。

MP4各只有一条混合音轨；需要换配音时使用工程中的独立WAV/BGM/SFX，不从成片拆声道，也不把无配乐版当成无旁白底片。现有音频全部保留原样，本次没有生成豆包音频。

冻结截图来自原应用历史验收结果，画面已标注本地资料、历史实测；不是当前魔搭线上生成录像。发布的是视频所需的脱敏截图纹理，不包括完整知识库、原始业务会话JSON、密钥、模型权重或Python/Node依赖。

视频目录不进入业务Docker镜像，不改变当前线上工作台或其密钥状态。现有DeepSeek HTTP401问题仍以业务验收报告记录为准；宣传片上传不表示该凭证问题已解决。
