# SCUT-BBT-Replay-Toolkit

华南理工大学**百步梯学堂课堂回放工具箱** —— 基于原生 JS 的全能录播导出神器（零第三方 CDN 依赖）。

一键提取并导出高清课件 PPT (PDF)、纯文本字幕 (TXT)、时间轴字幕 (SRT)、原始字幕 (JSON)，支持多视频智能拼接与一键打包 ZIP 下载。

**如果您觉得本项目有用，请给这个项目一个 Star ⭐**

---

## 需求背景与功能特性

期末复习时打开百步梯学堂看录播课，想边看边复习，却发现老师讲课的 PPT 无法直接下载，语音字幕也没有现成的导出途径？

本工具箱以**现代悬浮卡片窗口**的形式注入百步梯学堂录播播放页面，为您提供一站式复习资料提取体验：

- **四项合一导出**：
  - **PPT 课件 (PDF)**：原图级 PPT 切片极速组装为高清 PDF，无重编码、无画质损耗，做笔记打印神器；
  - **TXT 纯文本字幕**：过滤时间轴提取纯讲课文本，适合直接浏览、搜索定位或喂给大模型做错字修正与讲义提炼；
  - **SRT 时间轴字幕**：标准字幕格式（包含毫秒级起止时间轴），可直接导入各类本地视频播放器同步观看；
  - **JSON 原始数据**：包含完整的同传字幕结构化数据。
- **现代悬浮卡片面板**：
  - 右下角精简胶囊挂件（`百步梯回放工具箱`），不遮挡视频与进度条；
  - 点击展开卡片窗口，四行项目自由勾选；
  - 支持每行**独立单独下载**，也支持右上角**一键打包 (ZIP) 下载**。
- **多视频自动拼接（B 模式）**：
  - 若一门课某天连上多节（播放器切分为多个录播视频），工具箱自动探测属于同一天的关联视频；
  - TXT 自动按章节拼接合并整场大课文本，SRT 顺延时间轴，与整份 PPT 完美保持内容一致。
- **规范化命名**：
  - 自动提取课程名与上课日期，规范命名为 `{课程名}_{YY-MM-DD}.[pdf|txt|srt|json|zip]`（例如：`高等数学_24-09-20.zip`）。
- **零第三方 CDN 依赖**：
  - 纯原生手写 PDF-1.4 二进制生成器与 ZIP Store 原生打包器，不引入任何外部重型 JS 库，在校外 WebVPN 环境下绝不会因外部 CDN 阻断而报错。

### 免责声明

1. 如果你成功运行了该软件，即代表你拥有访问华工百步梯学堂该门课程录播的合法学生权限；
2. 本软件仅通过网页公开合规的接口获取当前课程的 PPT 图像与字幕，纯本地内存拼装，不会越权读取系统数据，更不会向任何第三方服务器上传任何数据；
3. 本软件仅供华南理工大学校友个人课后复习、整理课堂笔记学习使用，请尊重教师的教学劳动成果与课件版权，请勿将导出的课件用于商业牟利或恶意传播；
4. 资料导出只是帮你节省了截图翻页与手工摘录的机械劳动，最重要的还是认真听讲、理解消化知识。

---

## 🚀 面向用户：一键安装

无需配置任何编译环境，只要浏览器装有油猴扩展，点击下方按钮即可一键安装：

[![一键安装 - GitHub 官方源](https://img.shields.io/badge/一键安装-GitHub%20官方源-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/Breeze1733/scut-bbt-replay-toolkit/main/scut-bbt-replay-toolkit.user.js)

[![国内镜像 - 一键安装](https://img.shields.io/badge/国内镜像-一键安装%20(推荐国内网络)-FF5627?style=for-the-badge&logo=jsdelivr&logoColor=white)](https://cdn.jsdelivr.net/gh/Breeze1733/scut-bbt-replay-toolkit@main/scut-bbt-replay-toolkit.user.js)

> 💡 **提示**：如果点击 GitHub 官方源无法打开或加载缓慢，请直接点击 **【国内镜像一键安装】**（基于 jsDelivr CDN 加速）。

### 前置准备

如果你的电脑尚未安装脚本管理器扩展，推荐先安装以下任一浏览器扩展（已安装请忽略）：
* [Tampermonkey（篡改猴 - Chrome 商店）](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
* [Tampermonkey（Edge 扩展中心）](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
* 或 [Violentmonkey（暴力猴）](https://violentmonkey.github.io/) / [ScriptCat（脚本猫）](https://docs.scriptcat.org/)

安装好扩展后，点击上方 **【一键安装】** 链接，在弹出的窗口中点击 **“安装”** 或 **“更新”** 即可。

---

## 使用方法

建议配合 Google Chrome 或 Microsoft Edge 浏览器完成操作。

### 1. 登录百步梯学堂

* 校内直连访问：[百步梯学堂 (video.jw.scut.edu.cn)](https://video.jw.scut.edu.cn/)
* 校外访问支持：[华工 WebVPN 镜像入口](https://video-jw-443.webvpn.scut.edu.cn/)

### 2. 进入录播课播放页面

进入你要复习的课程，打开具体某节次的录播视频播放页面（URL 中包含 `course_id` 与 `sub_id` 参数）。

### 3. 使用工具箱

* 页面右下角会自动出现悬浮胶囊：`百步梯回放工具箱`；
* 点击后展开卡片窗口，面板自动识别当前课程名、日期及关联课时数；
* **单项下载**：直接点击对应行右侧的 `下载 PDF`、`下载 TXT`、`下载 SRT`、`下载 JSON`；
* **打包下载**：勾选想要打包的项目，点击右上角 `一键打包 (ZIP)`，即可将选中的内容打包为 `{课程名}_{YY-MM-DD}.zip` 下载。

---

## 💡 技术亮点

* **纯原生 PDF 构造引擎**：纯原生 JavaScript 手动构建 PDF-1.4 格式二进制流，DCTDecode JPEG 图像原生直插，不进行二次 Canvas 重采样，极速合成且 100% 保持原始课件画质；
* **纯原生 ZIP 打包器**：基于标准 ZIP STORE 与 CRC-32 规范实现，毫秒级快速打包，无需引入外部臃肿 CDN；
* **多视频自动对齐与顺延**：智能匹配同一天录播课时，字幕分章节合并，SRT 自动顺延时间轴；
* **WebVPN 友好兼容**：全脚本 0 外部依赖，在华南理工大学 WebVPN 代理及校园网环境下稳定运行。

---

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。
