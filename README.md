# SCUT-BBT-PPT-Exporter

华南理工大学**百步梯录播课 PPT 导出器** —— 基于原生 JS 的无依赖高清课件 PDF 一键合成工具

**如果您觉得本项目有用，请给这个项目一个 Star ⭐**

## 需求背景

期末复习时打开百步梯学堂看录播课，想边看边复习，却发现老师讲课的 PPT 无法直接下载？

一帧一帧暂停截图不仅费时费力、画质模糊，还要手动将几十张图片拼成长图或 PDF；
边看视频边手动记笔记又跟不上老师的语速，期末复习效率大打折扣。

因此就有了这个基于浏览器油猴扩展（Userscript）的百步梯录播课课件一键导出工具。

**零第三方 CDN 依赖**，纯浏览器原生二进制合成，在录播课播放页面右下角：
- **一键提取全套 PPT**：自动读取录播课同步记录的所有原图级 PPT 切片；
- **极速无损生成 PDF**：遵循标准 PDF-1.4 规范与 DCTDecode 图像原生直插，直接在浏览器内存完成二进制流拼装，0 重编码、0 画质压缩损耗；
- **复习打印做笔记神器**：导出的 PDF 可直接导入 iPad（GoodNotes / Notability / MarginNote）做手写笔记，或直接送打印店装订复习。

### 免责声明

1. 如果你成功运行了该软件，即代表你拥有访问华工百步梯学堂该门课程录播的合法学生权限；
2. 本软件仅通过网页公开合规的课件切片接口获取当前课程的 PPT 图像，纯本地内存拼装，不会越权读取系统数据，更不会向任何第三方服务器上传任何数据；
3. 本软件仅供华南理工大学校友个人课后复习、整理课堂笔记学习使用，请尊重教师的教学劳动成果与课件版权，请勿将导出的课件用于商业牟利或恶意传播；
4. 课件导出只是帮你节省了截图翻页的机械劳动，最重要的还是认真听讲、理解消化知识。

---

## 🚀 面向用户：一键安装

无需配置任何编译环境，只要浏览器装有油猴扩展，点击下方按钮即可一键安装：

[![一键安装 - GitHub 官方源](https://img.shields.io/badge/一键安装-GitHub%20官方源-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/Breeze1733/scut-bbt-ppt-exporter/main/scut-bbt-ppt-exporter.user.js)

[![国内镜像 - 一键安装](https://img.shields.io/badge/国内镜像-一键安装%20(推荐国内网络)-FF5627?style=for-the-badge&logo=jsdelivr&logoColor=white)](https://cdn.jsdelivr.net/gh/Breeze1733/scut-bbt-ppt-exporter@main/scut-bbt-ppt-exporter.user.js)

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

进入你要复习的课程，打开某一具体节次的录播视频播放页面（页面 URL 中包含 `course_id` 与 `sub_id` 参数）。

### 3. 一键导出课件

* 页面加载完成后，右下角会自动浮现蓝色按钮：`📥 导出课件 PDF`；
* 点击按钮，脚本将自动按顺序下载 PPT 高清切片；
* 按钮会实时显示进度（如 `下载图片 (12/48)...` -> `正在本地极速合成 PDF...`）；
* 合成完毕后浏览器自动弹出下载保存，文件名自动命名为 `课程名称_courseID_subID.pdf`。

---

## 💡 技术亮点

* **纯原生 PDF 构造引擎**：不依赖 `jsPDF`、`pdf-lib` 等任何体积庞大的第三方 CDN 库，纯原生 JavaScript 手动构建 PDF-1.4 格式二进制流，断网环境下也能正常合成；
* **JPEG 图像直插（/DCTDecode）**：直接把服务器原始 JPEG 图片流打包注入 PDF 图像 XObject 对象中，**不进行任何二次 Canvas 重采样或重编码**，速度极快（几十页课件 1~2 秒内合成完毕），且 100% 保持原始课件画质；
* **自动识别课程标题**：自动抓取播放器上方的课时/课程标题，规范化生成文件名，避免导出一堆无序编号；
* **WebVPN 无缝兼容**：支持通过华南理工大学 WebVPN 进行校外录播课课件导出。

---

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。
