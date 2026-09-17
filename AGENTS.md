# PeerCast 项目规则

PeerCast 0.2.0-alpha：共享同一套 WebRTC 核心的 Web 与 Windows Desktop 项目，只做 1 Host + 1 Viewer。

## 约束

- 不做账号、数据库、信令后端或项目运营的媒体服务器
- Web 保持纯 HTML/CSS/JavaScript，无 npm 运行依赖；Desktop 使用现有 Electron/npm 构建和 C# WASAPI 模块
- signaling 手动交换完整 Offer/Answer，默认使用可逆 PC1 格式；保留 Raw JSON
- 保留可配置 STUN 与可选 TURN；不把 STUN 候选出现当作公网媒体验收通过
- Host/Viewer 分别拥有自己的 peer，不重写已验证的握手核心
- 文件和代码尽量少
- 每次只实现一个最小功能
- 不擅自增加功能或依赖
- 修改前说明要改什么
- 修改后自行检查
- 出错先定位原因，不要大规模重写
- 构建只生成产物，不自动发布；Installer 放 GitHub Release Assets，不提交到 Git
- 遵循 CONTRIBUTING.md 和 docs/TESTING.md；自动测试与真实硬件验收分开报告
- 不提交凭据、真实 SDP、用户设备信息、本机路径、日志和缓存
