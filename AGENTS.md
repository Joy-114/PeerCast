# PeerCast 项目规则

纯网页P2P屏幕分享工具，MVP只做 1 Host + 1 Viewer。

## 约束

- 不做账号、数据库、后端、媒体服务器
- 第一版不使用框架和npm，只用HTML/CSS/JavaScript
- signaling先手动复制完整SDP Offer/Answer
- 暂不使用STUN/TURN，先验证本机/局域网P2P
- 文件和代码尽量少
- 每次只实现一个最小功能
- 不擅自增加功能或依赖
- 修改前说明要改什么
- 修改后自行检查
- 出错先定位原因，不要大规模重写
