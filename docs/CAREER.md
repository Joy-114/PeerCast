# PeerCast：求职表达材料

以下表述限于已有实现与测试证据。不要把 alpha 写成生产服务，不声称用户量、
延迟 SLA、跨网络成功率或 CS2/Discord 实机测试已经通过。

## A. English résumé — three bullets

- Built a one-to-one screen-sharing application with JavaScript and WebRTC, sharing the same Host/Viewer core between a browser edition and an Electron Windows desktop app; validated signaling and media lifecycle behavior with 50 browser regression assertions.
- Implemented Windows per-process audio capture using C# and WASAPI Process Loopback, streaming PCM through Electron IPC and AudioWorklet into independently controlled WebRTC tracks; verified isolation between two synthetic audio processes and end-to-end delivery to the Viewer.
- Packaged the desktop application with an NSIS installer and added compressed SDP exchange, configurable ICE servers, measured media diagnostics, and reproducible build/test documentation; clearly separated automated evidence from pending hardware and cross-network acceptance.

## B. LinkedIn / GitHub introduction

PeerCast is an open-source alpha project exploring one-to-one screen sharing and
independent audio control. It combines a framework-free JavaScript WebRTC core,
an Electron Windows desktop shell, and a C# WASAPI process-loopback helper.
The repository focuses on explicit signaling, a narrow native bridge, observable
media behavior, and reproducible tests. Native isolation is tested with synthetic
processes; real application, cross-network and sustained 60 FPS validation remain
documented next steps.

## C. 两分钟面试介绍

“PeerCast 是一个一对一屏幕分享项目。我关注的问题是：分享游戏画面时，用户
可能想让对方听见游戏，却不想把语音聊天一起发送。因此我保留了浏览器版，
又用 Electron 包装成 Windows 桌面软件，复用同一套 JavaScript WebRTC 核心。

连接部分采用手动交换 Offer 和 Answer。这样没有信令服务器，也能清楚检查
状态机、ICE 候选和失败原因。我给完整 SDP 增加 gzip 和 Base64URL 编码，减少
复制长度，同时保留原始格式、类型校验和错误提示。网络方面支持 STUN 和可选
TURN，但不会把发现公网候选误认为跨网络连接已经成功。

最有挑战的是应用音频。浏览器给出的 System Audio 已经混合，不能可靠拆出
Discord。因此我用 C# 调用 Windows Process Loopback，按进程树获得 PCM，
通过受限 Electron IPC 和 AudioWorklet 转成独立 WebRTC 音轨。每路都有自己的
Send、Mute、Gain，Viewer 也能独立调音量。我还处理了进程退出、PID 重用和
停止共享时的资源释放。

验证方面，浏览器回归有 50 个断言，原生测试让两个进程同时播放不同频率，
检测选中进程是否排除了另一个；另有从原生音频到 Viewer 的端到端测试。
我没有把这些测试夸大成真实 CS2/Discord 或稳定 1080p60 的证明。这些以及
第二网络实测仍在验收清单里。这个项目让我把浏览器媒体、Windows API、进程
边界、安装打包和可复现验证串成了一个能交给别人检查的工程。”

## D. 10 个可能追问

| 问题 | 回答方向 |
| --- | --- |
| 1. 为什么还需要 Offer/Answer？ | 协商编解码器、媒体方向与传输参数；手动通道传递描述，不传媒体。说明同一 peer 的状态机。 |
| 2. STUN 为什么不能保证连通？ | 地址发现不同于可达性；NAT 映射、过滤及防火墙可能阻断，需要 TURN。 |
| 3. P2P 还安全吗？ | WebRTC 媒体使用 DTLS-SRTP；手动 SDP 通道仍需可信，PC1 压缩不是加密，不等于身份认证。 |
| 4. 为什么不能从 System Audio 去掉 Discord？ | 已混合信号缺乏可靠来源分解；需要在 Windows 按进程捕获，并防止系统混音再次进入。 |
| 5. C# 音频如何进入 WebRTC？ | WASAPI PCM→stdout→主进程→有限 IPC→AudioWorklet→独立 Gain/Destination→音轨；说明格式、缓冲和生命周期。 |
| 6. Send、Mute 和 Volume 有何区别？ | Send OFF 停采集/替换空轨；Mute gain=0；Volume 改 gain；Viewer 音量只影响本地播放。 |
| 7. 为什么选 Electron，不选 Tauri？ | 统一 Chromium 捕获行为和较直接的 desktopCapturer 集成；代价是包体和进程开销，没有编造内存比较结果。 |
| 8. 怎么证明应用隔离？ | 双进程不同频率、双向检测及 Viewer RMS；明确测试假设、实际应用边界和待验收项。 |
| 9. 请求 60 FPS 为什么只收到 42？ | 内容变化、采集、编码负载、网络拥塞/自适应；比较 getSettings 和 getStats，不把请求值当实测值。 |
| 10. 如何避免泄漏和 IPC 风险？ | 显式停止、AbortController、tracks/context/helper 释放；主 frame 和页面校验、preload 白名单、sandbox；补充还需威胁建模与压力测试。 |

## E. 岗位匹配

按项目已经展示的能力，优先投递：

1. **Software Engineering Intern / Desktop Software Intern**：完整功能链、故障定位、测试和 Windows 打包最直接。
2. **Frontend Engineering Intern（媒体/交互方向）**：浏览器 API、状态管理、异步流程、可观测性；应补充团队常用框架经验，项目本身没有 React。
3. **Real-Time Communications / Multimedia Intern**：WebRTC、ICE、媒体轨、音频图和统计；需准备编码器、拥塞控制与同步问题，避免声称已实现这些底层算法。
4. **Windows / Systems Software Intern**：COM/WASAPI、进程身份、IPC 与资源释放；C# interop 是优势，但不等同于 C++ 驱动开发经验。
5. **QA Automation / SDET Intern**：可重复媒体夹具、边界测试、故障路径和区分自动/人工证据。

该项目对纯后端数据库、云平台运维或机器学习岗位的直接证明较弱。上述是技术
匹配判断，不是当前职位空缺清单或录用保证。简历应突出自己能够解释、修改和
复现的部分；如使用 AI 辅助开发，应按雇主要求如实说明并能独立讲清设计取舍。
