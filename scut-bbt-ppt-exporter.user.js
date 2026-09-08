// ==UserScript==
// @name         SCUT 百步梯学堂录播课 PPT 一键导出 PDF
// @namespace    https://github.com/Breeze1733/scut-bbt-ppt-exporter
// @version      1.0.0
// @description  纯原生无任何第三方 CDN 依赖，直接在浏览器端解析百步梯录播课课件并秒速拼装高清 PDF，复习打印做笔记神器
// @author       Breeze1733
// @license      MIT
// @match        https://video.jw.scut.edu.cn/*
// @match        https://video-jw-443.webvpn.scut.edu.cn/*
// @match        https://video-jw-scut-edu-cn-443.webvpn.scut.edu.cn/*
// @icon         https://video.jw.scut.edu.cn/favicon.ico
// @homepageURL  https://github.com/Breeze1733/scut-bbt-ppt-exporter
// @supportURL   https://github.com/Breeze1733/scut-bbt-ppt-exporter/issues
// @updateURL    https://raw.githubusercontent.com/Breeze1733/scut-bbt-ppt-exporter/main/scut-bbt-ppt-exporter.user.js
// @downloadURL  https://raw.githubusercontent.com/Breeze1733/scut-bbt-ppt-exporter/main/scut-bbt-ppt-exporter.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 1. 纯原生 PDF 组装器（遵循标准 PDF-1.4 规范与 /DCTDecode 原生 JPEG 直插）
  async function buildPdfFromImages(images) {
    const chunks = [];
    const offsets = [];
    let currentOffset = 0;

    function appendString(str) {
      const enc = new TextEncoder().encode(str);
      chunks.push(enc);
      currentOffset += enc.length;
    }

    function appendBuffer(buf) {
      chunks.push(buf);
      currentOffset += buf.byteLength;
    }

    // PDF 头部规范
    appendString('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    const pageCount = images.length;
    const totalObjs = 2 + pageCount * 3;

    function startObj(id) {
      offsets[id] = currentOffset;
      appendString(`${id} 0 obj\n`);
    }

    function endObj() {
      appendString('endobj\n');
    }

    // 1 号对象：文档 Catalog
    startObj(1);
    appendString('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObj();

    // 2 号对象：页面集合索引
    startObj(2);
    const kidList = [];
    for (let i = 0; i < pageCount; i++) {
      kidList.push(`${3 + i * 3} 0 R`);
    }
    appendString(`<< /Type /Pages /Kids [${kidList.join(' ')}] /Count ${pageCount} >>\n`);
    endObj();

    // 逐页嵌入图片
    for (let i = 0; i < pageCount; i++) {
      const item = images[i];
      const pageId = 3 + i * 3;
      const contentId = 3 + i * 3 + 1;
      const imgId = 3 + i * 3 + 2;
      const w = item.width;
      const h = item.height;

      // 单页描述
      startObj(pageId);
      appendString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
      endObj();

      // 绘制流
      startObj(contentId);
      const streamContent = `q\n${w} 0 0 ${h} 0 0 cm\n/Im Do\nQ\n`;
      const streamContentEnc = new TextEncoder().encode(streamContent);
      appendString(`<< /Length ${streamContentEnc.length} >>\nstream\n`);
      appendBuffer(streamContentEnc);
      appendString('\nendstream\n');
      endObj();

      // 原生图像 XObject（直接嵌入原图二进制流，杜绝任何中间重编码）
      startObj(imgId);
      appendString(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${item.buffer.byteLength} >>\nstream\n`);
      appendBuffer(new Uint8Array(item.buffer));
      appendString('\nendstream\n');
      endObj();
    }

    // 交叉引用表 (xref)
    const xrefOffset = currentOffset;
    appendString(`xref\n0 ${totalObjs + 1}\n`);
    appendString('0000000000 65535 f \n');
    for (let id = 1; id <= totalObjs; id++) {
      const offsetStr = String(offsets[id]).padStart(10, '0');
      appendString(`${offsetStr} 00000 n \n`);
    }

    // 文件结尾
    appendString(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks, { type: 'application/pdf' });
  }

  // 2. 挂载右下角悬浮按钮
  function createExportButton() {
    if (document.getElementById('scut-ppt-download-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'scut-ppt-download-btn';
    btn.innerText = '📥 导出课件 PDF';

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '90px',
      right: '25px',
      zIndex: '999999',
      padding: '10px 18px',
      backgroundColor: '#0052cc',
      color: '#ffffff',
      border: 'none',
      borderRadius: '24px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
      transition: 'all 0.3s ease',
      outline: 'none',
    });

    btn.onmouseover = () => {
      if (!btn.disabled) btn.style.backgroundColor = '#0747a6';
    };
    btn.onmouseout = () => {
      if (!btn.disabled) btn.style.backgroundColor = '#0052cc';
    };
    btn.onclick = startDownload;
    document.body.appendChild(btn);
  }

  // 3. 抓取图片并启动组装
  async function startDownload() {
    const btn = document.getElementById('scut-ppt-download-btn');
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('course_id');
    const subId = params.get('sub_id');

    if (!courseId || !subId) {
      alert('当前页面未检测到课程参数，请先进入具体的录播课播放页面！');
      return;
    }

    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.innerText = '正在读取课件目录...';

    try {
      const apiUrl = `/pptnote/v1/schedule/search-ppt?course_id=${courseId}&sub_id=${subId}&page=1&per_page=100`;
      const res = await fetch(apiUrl).then(r => r.json());
      const list = res.list || [];

      if (list.length === 0) {
        alert('该课程录播未包含同步课件数据！');
        resetButton(btn);
        return;
      }

      const collectedImages = [];

      for (let i = 0; i < list.length; i++) {
        btn.innerText = `下载图片 (${i + 1}/${list.length})...`;

        let content = {};
        try {
          content = JSON.parse(list[i].content || '{}');
        } catch (e) {}

        const imgUrl = content.pptimgurl || content.pptthumb;
        if (!imgUrl) continue;

        // 获取原图二进制流
        const imgBuffer = await fetch(imgUrl).then(r => r.arrayBuffer());

        // 解析图片的原始自然长宽
        const blobUrl = URL.createObjectURL(new Blob([imgBuffer], { type: 'image/jpeg' }));
        const imgObj = new Image();
        imgObj.src = blobUrl;
        await new Promise(r => {
          imgObj.onload = r;
          imgObj.onerror = r;
        });

        const width = imgObj.naturalWidth || 1920;
        const height = imgObj.naturalHeight || 1080;
        URL.revokeObjectURL(blobUrl);

        collectedImages.push({
          width,
          height,
          buffer: imgBuffer,
        });
      }

      btn.innerText = '正在本地极速合成 PDF...';
      const pdfBlob = await buildPdfFromImages(collectedImages);

      // 尝试提取课程/课时名称作为文件名
      let courseTitle = '';
      const titleCandidate = document.querySelector('.course-name, .video-name, .lesson-name, .title, h1, h2');
      if (titleCandidate && titleCandidate.innerText.trim()) {
        courseTitle = titleCandidate.innerText.trim().replace(/[\/\\:*?"<>|]/g, '_');
      }
      const downloadFileName = courseTitle ? `${courseTitle}_${courseId}_${subId}.pdf` : `course_${courseId}_${subId}.pdf`;

      // 触发下载
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(pdfBlob);
      downloadLink.download = downloadFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadLink.href);

      btn.innerText = '✅ 课件导出成功！';
      setTimeout(() => resetButton(btn), 3000);
    } catch (err) {
      console.error('[-] 导出课件失败:', err);
      alert('导出出错: ' + err.message);
      resetButton(btn);
    }
  }

  function resetButton(btn) {
    btn.disabled = false;
    btn.style.cursor = 'pointer';
    btn.innerText = '📥 导出课件 PDF';
  }

  // 页面加载或单页切换时自动挂载按钮
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', createExportButton);
  } else {
    createExportButton();
  }
  setInterval(createExportButton, 2000);
})();
