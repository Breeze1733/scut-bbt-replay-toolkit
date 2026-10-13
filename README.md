# SCUT-BBT-Replay-Toolkit

华南理工大学**百步梯学堂课堂回放工具箱** —— 基于原生 JS 的全能录播导出神器（零第三方 CDN 依赖）。

一键提取并导出高清课件 PPT (PDF)、纯文本字幕 (TXT)、时间轴字幕 (SRT)、原始字幕 (JSON)，支持多视频智能拼接与一键打包 ZIP 下载。

v2.1 新增可选的**字幕校准**：配置一次模型 API，一键读取当前课程字幕和课件，自动校准并下载 TXT。无需导出再导入文件，无需启动本地服务。

**如果您觉得本项目有用，请给这个项目一个 Star ⭐**

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

## 校准字幕

工具箱新增一行 **校准字幕 (TXT)**。点击 **下载校准字幕**，等待处理完毕后自动下载一个 `_校准.txt` 文件。

首次使用时填写 API 地址、模型名和 Key，保存后自动开始。配置会保存在本机脚本管理器中，以后直接点击下载即可；旁边的设置图标可随时修改。未配置模型时，原始资料下载仍照常可用。

- 支持 Chat Completions 兼容接口，例如 `https://你的服务/v1` 或完整的 `/chat/completions` 地址。
- 默认参考课件，需要支持图片的模型；纯文本模型可在设置中关闭课件参考。
- 结合课程名称、上下文和课件，主动纠正同音错字、英文术语和符号读法。后台按小段校对，只应用能定位到原文的局部修改，保留讲解顺序、例子和推导，不做摘要。对明显不合规则的修改保留原文，模型仍可能误判。
- 校准时字幕、课程名和所选课件会发送至配置的 API，可能产生费用。Key 保存在脚本管理器存储中，不进入导出文件；清空 Key 并保存即可删除。
- 每次模型请求最多等待 300 秒，这不是整堂课的总耗时上限。中转站可能先发送空白保活数据，界面会显示等待完整结果；只有完整结果通过解析后才算完成。超时、断连或上游错误不会自动重发，中转站可能仍在执行，请先核对后台记录。明确返回上下文超限时，保留现有的术语缩减后重试一次机制。
- 每批课件术语和校准字幕完成后，立即保存到本机脚本管理器存储（不是页面内存）。刷新或关闭页面后，回到同一课程、使用相同 API 地址/模型/课件参考设置，再点 **下载校准字幕** 即可跳过已完成批次；原字幕或校准规则发生变化时会重新处理。完整结果也会保留，重复下载无需再次调用模型。
- 中断后如已有字幕批次完成，会出现 **下载已完成部分**，文件注明完成条数，未完成字幕不会混入。正在请求的一批不能恢复半截响应，重试可能再次计费；不要在多个标签页同时处理同一课程。清除脚本数据、卸载脚本或更换浏览器可能丢失本机进度。缓存包含本课原字幕、术语和修改结果，不包含 API Key（Key 只在模型设置中保存）。
- 自选 API 使用 `GM_xmlhttpRequest` 和 `@connect *`，更新脚本时可能需要允许新增权限。API 需 HTTPS，本机服务可用 HTTP。

---

## 免责声明

1. 如果你成功运行了该软件，即代表你拥有访问华工百步梯学堂该门课程录播的合法学生权限；
2. 原始资料导出通过当前登录会话获取 PPT 图像与字幕，在本地内存拼装。可选的字幕校订会将相关资料发送到用户自行配置的模型 API，请在使用前确认该服务的数据处理方式及课件使用权限；
3. 本软件仅供华南理工大学校友个人课后复习、整理课堂笔记学习使用，请尊重教师的教学劳动成果与课件版权，请勿将导出的课件用于商业牟利或恶意传播；
4. 资料导出只是帮你节省了截图翻页与手工摘录的机械劳动，最重要的还是认真听讲、理解消化知识。

---

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。
