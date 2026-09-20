// ==UserScript==
// @name         SCUT 百步梯学堂课堂回放工具箱
// @namespace    https://github.com/Breeze1733/scut-bbt-replay-toolkit
// @version      2.0.1
// @description  华南理工大学百步梯学堂录播课全能工具箱：一键导出高清课件 PPT (PDF)、纯文本字幕 (TXT)、时间轴字幕 (SRT)、原始字幕 (JSON)，支持多视频自动拼接与一键打包 ZIP 下载。
// @author       Breeze1733
// @license      MIT
// @match        https://video.jw.scut.edu.cn/*
// @match        https://video-jw-443.webvpn.scut.edu.cn/*
// @match        https://video-jw-scut-edu-cn-443.webvpn.scut.edu.cn/*
// @icon         https://video.jw.scut.edu.cn/favicon.ico
// @homepageURL  https://github.com/Breeze1733/scut-bbt-replay-toolkit
// @supportURL   https://github.com/Breeze1733/scut-bbt-replay-toolkit/issues
// @updateURL    https://raw.githubusercontent.com/Breeze1733/scut-bbt-replay-toolkit/main/scut-bbt-replay-toolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/Breeze1733/scut-bbt-replay-toolkit/main/scut-bbt-replay-toolkit.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ==========================================
  // 1. 纯原生 PDF 组装器（PDF-1.4 / DCTDecode）
  // ==========================================
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

    appendString('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    const pageCount = images.length;
    const totalObjs = 2 + pageCount * 3;

    function startObj(id) {
      offsets[id] = currentOffset;
      appendString(id + ' 0 obj\n');
    }

    function endObj() {
      appendString('endobj\n');
    }

    // 1 号对象：Catalog
    startObj(1);
    appendString('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObj();

    // 2 号对象：Pages
    startObj(2);
    const kidList = [];
    for (let i = 0; i < pageCount; i++) {
      kidList.push((3 + i * 3) + ' 0 R');
    }
    appendString('<< /Type /Pages /Kids [' + kidList.join(' ') + '] /Count ' + pageCount + ' >>\n');
    endObj();

    // 逐页嵌入图片
    for (let i = 0; i < pageCount; i++) {
      const item = images[i];
      const pageId = 3 + i * 3;
      const contentId = 3 + i * 3 + 1;
      const imgId = 3 + i * 3 + 2;
      const w = item.width;
      const h = item.height;

      startObj(pageId);
      appendString('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /XObject << /Im ' + imgId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>\n');
      endObj();

      startObj(contentId);
      const streamContent = 'q\n' + w + ' 0 0 ' + h + ' 0 0 cm\n/Im Do\nQ\n';
      const streamContentEnc = new TextEncoder().encode(streamContent);
      appendString('<< /Length ' + streamContentEnc.length + ' >>\nstream\n');
      appendBuffer(streamContentEnc);
      appendString('\nendstream\n');
      endObj();

      startObj(imgId);
      appendString('<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + item.buffer.byteLength + ' >>\nstream\n');
      appendBuffer(new Uint8Array(item.buffer));
      appendString('\nendstream\n');
      endObj();
    }

    // xref
    const xrefOffset = currentOffset;
    appendString('xref\n0 ' + (totalObjs + 1) + '\n');
    appendString('0000000000 65535 f \n');
    for (let id = 1; id <= totalObjs; id++) {
      const offsetStr = String(offsets[id]).padStart(10, '0');
      appendString(offsetStr + ' 00000 n \n');
    }

    appendString('trailer\n<< /Size ' + (totalObjs + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ==========================================
  // 2. 纯原生 ZIP 打包器（标准 STORE + CRC32）
  // ==========================================
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(files) {
    const fileEntries = [];
    let localOffset = 0;
    const parts = [];
    const enc = new TextEncoder();
    const d = new Date();
    const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      let dataBytes;
      if (f.data instanceof Uint8Array) {
        dataBytes = f.data;
      } else if (f.data instanceof ArrayBuffer) {
        dataBytes = new Uint8Array(f.data);
      } else {
        dataBytes = enc.encode(String(f.data));
      }

      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(localHeader.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileEntries.push({ nameBytes, crc, size, offset: localOffset, dosTime, dosDate });
      parts.push(localHeader);
      parts.push(dataBytes);
      localOffset += localHeader.length + dataBytes.length;
    }

    const cdOffset = localOffset;
    let cdSize = 0;
    for (const e of fileEntries) {
      const cdHeader = new Uint8Array(46 + e.nameBytes.length);
      const dv = new DataView(cdHeader.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint16(8, 0x0800, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, e.dosTime, true);
      dv.setUint16(14, e.dosDate, true);
      dv.setUint32(16, e.crc, true);
      dv.setUint32(20, e.size, true);
      dv.setUint32(24, e.size, true);
      dv.setUint16(28, e.nameBytes.length, true);
      dv.setUint16(30, 0, true);
      dv.setUint16(32, 0, true);
      dv.setUint16(34, 0, true);
      dv.setUint16(36, 0, true);
      dv.setUint32(38, 0, true);
      dv.setUint32(42, e.offset, true);
      cdHeader.set(e.nameBytes, 46);
      parts.push(cdHeader);
      cdSize += cdHeader.length;
    }

    const eocd = new Uint8Array(22);
    const dvEocd = new DataView(eocd.buffer);
    dvEocd.setUint32(0, 0x06054b50, true);
    dvEocd.setUint16(4, 0, true);
    dvEocd.setUint16(6, 0, true);
    dvEocd.setUint16(8, fileEntries.length, true);
    dvEocd.setUint16(10, fileEntries.length, true);
    dvEocd.setUint32(12, cdSize, true);
    dvEocd.setUint32(16, cdOffset, true);
    dvEocd.setUint16(20, 0, true);
    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }

  // ==========================================
  // 3. 字幕提取与格式转换
  // ==========================================
  function extractSubtitleItems(body) {
    if (Array.isArray(body)) {
      if (
        body.length > 0 &&
        body.every(item => item && typeof item === 'object' && !Array.isArray(item)) &&
        body.some(item => 'BeginSec' in item && 'Text' in item)
      ) {
        return body;
      }
      for (const item of body) {
        if (item && typeof item === 'object') {
          const inner = extractSubtitleItems(item);
          if (inner.length > 0) return inner;
        }
      }
      return [];
    }
    if (body && typeof body === 'object') {
      for (const key of ['all_content', 'data', 'result', 'list', 'rows']) {
        const value = body[key];
        if (value && typeof value === 'object') {
          const inner = extractSubtitleItems(value);
          if (inner.length > 0) return inner;
        }
      }
    }
    return [];
  }

  function formatTime(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s - Math.floor(s)) * 1000);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + ',' + String(ms).padStart(3, '0');
  }

  function toTxt(items) {
    return items
      .map(it => (typeof it?.Text === 'string' ? it.Text.trim() : ''))
      .filter(Boolean)
      .join('\n');
  }

  function toSrt(items, offsetSeconds = 0, startIndex = 1) {
    let index = startIndex;
    const lines = [];
    let maxEnd = offsetSeconds;

    for (const it of items) {
      const text = typeof it?.Text === 'string' ? it.Text.trim() : '';
      if (!text || it.BeginSec === undefined || it.BeginSec === null) continue;
      const begin = (Number(it.BeginSec) || 0) + offsetSeconds;
      let end = (it.EndSec !== undefined && it.EndSec !== null)
        ? (Number(it.EndSec) || (begin + 5)) + offsetSeconds
        : begin + 5;
      if (end < begin) end = begin + 5;
      if (end > maxEnd) maxEnd = end;

      lines.push(index + '\n' + formatTime(begin) + ' --> ' + formatTime(end) + '\n' + text);
      index++;
    }
    return {
      srtText: lines.join('\n\n'),
      nextIndex: index,
      maxEnd: maxEnd,
    };
  }

  // ==========================================
  // 4. 工具函数：日期解析与文件命名规范
  // ==========================================
  function sanitizeFilename(name) {
    const cleaned = String(name || '课程')
      .replace(/[\u0000-\u001f\u007f\x2f\x5c\x3a\x2a\x3f\x22\x3c\x3e\x7c]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || '课程';
  }

  function formatYYMMDD(dateObj) {
    const yy = String(dateObj.getFullYear()).slice(-2);
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  }

  function parseDateString(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/(?:20)?(\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
    if (m) {
      const yy = m[1];
      const mm = String(m[2]).padStart(2, '0');
      const dd = String(m[3]).padStart(2, '0');
      return yy + '-' + mm + '-' + dd;
    }
    return null;
  }

  function triggerDownload(blobOrBuffer, filename) {
    const blob = blobOrBuffer instanceof Blob ? blobOrBuffer : new Blob([blobOrBuffer]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  // 检验是否为平台公共站点名/无意义通用词（必须排除，绝不能当作课程名称）
  function isGenericSiteName(str) {
    if (!str || typeof str !== 'string') return true;
    const t = str.trim();
    if (!t) return true;
    const blacklist = [
      '华南理工大学百步梯学堂',
      '百步梯学堂',
      '华南理工大学',
      '百步梯',
      '百步梯录播',
      '课堂回放',
      '华园视频',
      'livingroom',
      'livingpage',
      '首页',
    ];
    if (blacklist.includes(t)) return true;
    if (/^华南理工大学(?:百步梯)?(?:学堂|课堂|录播)?$/i.test(t)) return true;
    return false;
  }

  // 从课时标题、网页标题或混合文本中剥离日期与节次，提取出纯粹的课程名
  function cleanCourseName(str) {
    if (!str || typeof str !== 'string') return '';
    let clean = str.trim();
    if (isGenericSiteName(clean)) return '';

    // 移除常见的浏览器标题后缀如 '- 华南理工大学百步梯学堂', '_百步梯学堂'
    clean = clean.replace(/[-_|\\s]+华南理工大学(?:百步梯)?(?:学堂)?.*$/i, '').trim();

    // 移除日期：2026-09-14, 2026/09/14, 2026.09.14, 26-09-14, 20260914 等
    clean = clean.replace(/[-_\\s]*(?:20\\d{2}[-\\/.\\]\\d{1,2}[-\\/.\\]\\d{1,2}|\\d{2}[-\\/.\\]\\d{1,2}[-\\/.\\]\\d{1,2}|20\\d{6})[-_\\s]*/g, ' ').trim();

    // 移除节次/课时：第1-2节, 第 1-3 节, 第1节, 1-2节, 第1-2讲, (1-2), （1-3节）等
    clean = clean.replace(/[-_\\s]*第?\\s*\\d+(?:[-~至到]\\d+)?\\s*[节课时讲][-_\\s]*/g, ' ').trim();
    clean = clean.replace(/[\\(（]\\s*(?:第?\\s*\\d+(?:[-~至到]\\d+)?\\s*[节课时讲]?|\\d+)\\s*[\\）\\)]/g, ' ').trim();

    // 移除首尾多余的分隔符
    clean = clean.replace(/^[-_\\s.,:：]+|[-_\\s.,:：]+$/g, '').trim();

    if (isGenericSiteName(clean)) return '';
    return clean;
  }

  // 递归/多层级深度检索对象中潜在的课程名字段
  function findTitleInObj(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') {
      const c = cleanCourseName(obj);
      if (c && !isGenericSiteName(c)) return c;
      return '';
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findTitleInObj(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof obj === 'object') {
      for (const k of ['course_title', 'course_name', 'courseName', 'subject_name', 'course_title_cn']) {
        if (obj[k] && typeof obj[k] === 'string') {
          const c = cleanCourseName(obj[k]);
          if (c && !isGenericSiteName(c)) return c;
        }
      }
      for (const k of ['data', 'list', 'rows', 'result']) {
        if (obj[k]) {
          const found = findTitleInObj(obj[k]);
          if (found) return found;
        }
      }
    }
    return '';
  }

  // ==========================================
  // 5. 课程与多视频（Mode B）课时探测
  // ==========================================
  async function resolveCourseInfo(courseId, subId) {
    let courseName = '';
    let lecturerName = '';
    let currentLessonTitle = '';
    let dateStr = null;

    // 1. 尝试从课时详情接口获取
    let subInfoData = null;
    try {
      const subInfoRes = await fetch('/courseapi/v3/portal-home-setting/get-sub-info?course_id=' + courseId + '&sub_id=' + subId, { credentials: 'include' }).then(r => r.json());
      subInfoData = subInfoRes?.data;
      if (subInfoData) {
        lecturerName = subInfoData.lecturer_name || '';
        currentLessonTitle = subInfoData.sub_title || subInfoData.title || '';
        dateStr = parseDateString(subInfoData.start_time || subInfoData.create_time || subInfoData.date || subInfoData.sub_title || subInfoData.title);
        courseName = findTitleInObj(subInfoData);
      }
    } catch (e) {}

    // 2. 尝试从课程搜索接口获取课程全称
    if (!courseName) {
      try {
        const courseTitleRes = await fetch('/courseapi/v3/multi-search/get-course-teacher-others?course_id=' + courseId + '&per_page=1', { credentials: 'include' }).then(r => r.json());
        courseName = findTitleInObj(courseTitleRes);
      } catch (e) {}
    }

    // 3. 尝试从课程目录接口获取
    let allLessons = [];
    try {
      const catRes = await fetch('/courseapi/v2/course/catalogue?course_id=' + courseId, { credentials: 'include' }).then(r => r.json());
      if (!courseName) {
        courseName = findTitleInObj(catRes?.result);
      }
      allLessons = catRes?.result?.data || [];
    } catch (e) {}

    // 4. 从当前课时标题（如 "数据库系统2026-09-14第1-2节"）中智能剥离日期与节次提取课程名
    if (!courseName && currentLessonTitle) {
      courseName = cleanCourseName(currentLessonTitle);
    }

    // 5. 从浏览器 document.title 中提取
    if (!courseName && document.title) {
      courseName = cleanCourseName(document.title);
    }

    // 6. 从播放页 DOM 元素中提取（严格排除页面顶栏与导航栏中的平台标题）
    if (!courseName) {
      const selectors = [
        '.breadcrumb', '.el-breadcrumb', '.ant-breadcrumb',
        '.course-title', '.cur-course', '.course-info .name',
        '.video-title', '.lesson-title', '[class*="course-title"]', '[class*="course-name"]'
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.closest('header, nav, .header, .navbar, .top-header, #header, #nav, #scut-bbt-root, .scut-bbt-card')) continue;
          const text = el.innerText ? el.innerText.trim() : '';
          const candidate = cleanCourseName(text);
          if (candidate && !isGenericSiteName(candidate)) {
            courseName = candidate;
            break;
          }
        }
        if (courseName) break;
      }
    }

    // 7. 日期保底
    if (!dateStr) {
      dateStr = parseDateString(currentLessonTitle) || parseDateString(document.title) || formatYYMMDD(new Date());
    }

    // 8. 课程名终极保底：使用课程ID（绝不使用平台公共标题）
    courseName = sanitizeFilename(courseName || ('课程_' + courseId));

    // 获取课程目录，探测同天/同大排课的关联视频（B 模式：多视频自动对齐）
    let relatedLessons = [{ subId: String(subId), title: currentLessonTitle || ('第 ' + subId + ' 节') }];
    if (Array.isArray(allLessons) && allLessons.length > 0) {
      const matched = [];
      for (const item of allLessons) {
        const sid = String(item.sub_id || item.id || '');
        const title = item.title || item.sub_title || '';
        const itemDate = parseDateString(title) || parseDateString(item.start_time || item.create_time);

        if (sid === String(subId) || (dateStr && itemDate === dateStr)) {
          matched.push({ subId: sid, title: title || ('第 ' + sid + ' 节') });
        }
      }
      if (matched.length > 0) {
        relatedLessons = matched;
      }
    }

    return {
      courseId,
      subId,
      courseName,
      lecturerName,
      dateStr,
      baseFileName: courseName + '_' + dateStr,
      relatedLessons,
    };
  }

  // 获取课件 PPT (PDF)
  async function fetchPptPdf(courseInfo, onProgress) {
    const { courseId, subId, relatedLessons } = courseInfo;
    onProgress('正在读取课件目录...', 10);

    const imageCandidates = [];
    const seenUrls = new Set();
    const subIdsToTry = [subId, ...relatedLessons.map(l => l.subId).filter(s => s !== subId)];

    for (const sid of subIdsToTry) {
      try {
        const apiUrl = '/pptnote/v1/schedule/search-ppt?course_id=' + courseId + '&sub_id=' + sid + '&page=1&per_page=100';
        const res = await fetch(apiUrl, { credentials: 'include' }).then(r => r.json());
        const list = res?.list || [];
        for (const item of list) {
          let content = {};
          try {
            content = JSON.parse(item.content || '{}');
          } catch (e) {}
          const imgUrl = content.pptimgurl || content.pptthumb;
          if (imgUrl && !seenUrls.has(imgUrl)) {
            seenUrls.add(imgUrl);
            imageCandidates.push(imgUrl);
          }
        }
        if (imageCandidates.length > 0) break;
      } catch (e) {}
    }

    if (imageCandidates.length === 0) {
      throw new Error('该课程录播未包含同步课件数据');
    }

    const collectedImages = [];
    for (let i = 0; i < imageCandidates.length; i++) {
      const pct = Math.round(15 + ((i + 1) / imageCandidates.length) * 65);
      onProgress('正在下载课件图片 (' + (i + 1) + '/' + imageCandidates.length + ')...', pct);

      const imgBuffer = await fetch(imageCandidates[i], { credentials: 'include' }).then(r => r.arrayBuffer());

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

      collectedImages.push({ width, height, buffer: imgBuffer });
    }

    onProgress('正在本地合成高清 PDF...', 90);
    const pdfBlob = await buildPdfFromImages(collectedImages);
    return { blob: pdfBlob, pageCount: collectedImages.length };
  }

  // 获取字幕（支持多视频自动拼接）
  async function fetchSubtitles(courseInfo, onProgress) {
    const { relatedLessons } = courseInfo;
    const lessonSubtitles = [];

    for (let i = 0; i < relatedLessons.length; i++) {
      const lesson = relatedLessons[i];
      onProgress('正在拉取字幕 (' + (i + 1) + '/' + relatedLessons.length + ')...', Math.round(20 + ((i + 1) / relatedLessons.length) * 60));
      try {
        const apiUrl = '/courseapi/v3/web-socket/search-trans-result?sub_id=' + lesson.subId + '&format=json';
        const res = await fetch(apiUrl, { credentials: 'include' }).then(r => r.json());
        const items = extractSubtitleItems(res);
        lessonSubtitles.push({
          subId: lesson.subId,
          title: lesson.title,
          items: items,
        });
      } catch (e) {
        lessonSubtitles.push({
          subId: lesson.subId,
          title: lesson.title,
          items: [],
        });
      }
    }

    const totalLines = lessonSubtitles.reduce((acc, cur) => acc + cur.items.length, 0);
    if (totalLines === 0) {
      throw new Error('未检索到字幕数据（录播可能尚未生成字幕）');
    }

    // 1. 生成纯文本 TXT（多视频自动分章节拼接）
    let txtContent = '';
    if (lessonSubtitles.length === 1) {
      txtContent = toTxt(lessonSubtitles[0].items);
    } else {
      txtContent = lessonSubtitles
        .filter(l => l.items.length > 0)
        .map(l => '=== ' + l.title + ' ===\n\n' + toTxt(l.items))
        .join('\n\n\n');
    }

    // 2. 生成标准时间轴 SRT（多视频时间轴自动顺延累加）
    const srtParts = [];
    let currentOffset = 0;
    let subtitleIndex = 1;

    for (const l of lessonSubtitles) {
      if (l.items.length === 0) continue;
      const res = toSrt(l.items, currentOffset, subtitleIndex);
      if (res.srtText) {
        srtParts.push(res.srtText);
        subtitleIndex = res.nextIndex;
        currentOffset = res.maxEnd + 2;
      }
    }
    const srtContent = srtParts.join('\n\n');

    // 3. 生成 JSON 数据
    const jsonContent = JSON.stringify(
      lessonSubtitles.length === 1
        ? lessonSubtitles[0].items
        : lessonSubtitles.map(l => ({
            subId: l.subId,
            title: l.title,
            subtitles: l.items,
          })),
      null,
      2
    );

    return {
      txtContent,
      srtContent,
      jsonContent,
      totalLines,
      lessonCount: lessonSubtitles.filter(l => l.items.length > 0).length,
    };
  }

  // ==========================================
  // 7. UI 界面与悬浮窗口注入（纯净学术设计，无 emoji）
  // ==========================================
  function injectStyles() {
    if (document.getElementById('scut-bbt-toolkit-style')) return;
    const style = document.createElement('style');
    style.id = 'scut-bbt-toolkit-style';
    style.textContent = '' +
      '#scut-bbt-root { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; position: fixed; bottom: 24px; right: 24px; z-index: 999999; }' +
      '#scut-bbt-root * { box-sizing: border-box; }' +
      '.scut-bbt-pill { display: flex; align-items: center; gap: 6px; background: #0052cc; color: #ffffff; padding: 10px 18px; border-radius: 24px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(0, 82, 204, 0.35); transition: all 0.25s ease; user-select: none; }' +
      '.scut-bbt-pill:hover { background: #0747a6; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 82, 204, 0.45); }' +
      '.scut-bbt-card { width: 370px; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2); border: 1px solid #e2e8f0; overflow: hidden; animation: scut-bbt-fadein 0.2s ease-out; }' +
      '@keyframes scut-bbt-fadein { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }' +
      '.scut-bbt-header { background: #f8fafc; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }' +
      '.scut-bbt-header-info { flex: 1; overflow: hidden; padding-right: 10px; }' +
      '.scut-bbt-title { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
      '.scut-bbt-subtitle { font-size: 12px; color: #64748b; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
      '.scut-bbt-header-actions { display: flex; align-items: center; gap: 8px; }' +
      '.scut-bbt-btn-zip { background: #0052cc; color: #ffffff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s; white-space: nowrap; }' +
      '.scut-bbt-btn-zip:hover { background: #0747a6; }' +
      '.scut-bbt-btn-zip:disabled { background: #cbd5e1; cursor: not-allowed; }' +
      '.scut-bbt-btn-close { background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px; line-height: 1; }' +
      '.scut-bbt-btn-close:hover { color: #334155; background: #e2e8f0; }' +
      '.scut-bbt-body { padding: 8px 16px; }' +
      '.scut-bbt-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }' +
      '.scut-bbt-row:last-child { border-bottom: none; }' +
      '.scut-bbt-row-left { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b; font-weight: 500; cursor: pointer; }' +
      '.scut-bbt-row-left input[type="checkbox"] { width: 15px; height: 15px; accent-color: #0052cc; cursor: pointer; margin: 0; }' +
      '.scut-bbt-row-right { display: flex; align-items: center; gap: 10px; }' +
      '.scut-bbt-row-status { font-size: 11px; color: #94a3b8; }' +
      '.scut-bbt-btn-single { background: #f1f5f9; color: #0052cc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 4px 9px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }' +
      '.scut-bbt-btn-single:hover { background: #e0e7ff; border-color: #0052cc; }' +
      '.scut-bbt-btn-single:disabled { background: #f8fafc; color: #94a3b8; border-color: #e2e8f0; cursor: not-allowed; }' +
      '.scut-bbt-footer { background: #f8fafc; padding: 8px 16px 12px; border-top: 1px solid #e2e8f0; }' +
      '.scut-bbt-status-bar { font-size: 12px; color: #475569; min-height: 18px; line-height: 18px; }' +
      '.scut-bbt-progress { height: 4px; background: #e2e8f0; border-radius: 2px; margin-top: 6px; overflow: hidden; }' +
      '.scut-bbt-progress-bar { height: 100%; background: #0052cc; border-radius: 2px; width: 0%; transition: width 0.25s ease; }' +
      '.scut-bbt-hidden { display: none !important; }';
    document.head.appendChild(style);
  }

  function createToolkitUi() {
    if (document.getElementById('scut-bbt-root')) return;

    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('course_id');
    const subId = params.get('sub_id');

    if (!courseId || !subId) return;

    injectStyles();

    const root = document.createElement('div');
    root.id = 'scut-bbt-root';

    root.innerHTML = '' +
      '<div id="scut-bbt-pill" class="scut-bbt-pill">' +
        '<span>百步梯回放工具箱</span>' +
      '</div>' +
      '<div id="scut-bbt-card" class="scut-bbt-card scut-bbt-hidden">' +
        '<div class="scut-bbt-header">' +
          '<div class="scut-bbt-header-info">' +
            '<div class="scut-bbt-title">SCUT 百步梯学堂课堂回放工具箱</div>' +
            '<div class="scut-bbt-subtitle" id="scut-bbt-desc">正在探测课程与课时...</div>' +
          '</div>' +
          '<div class="scut-bbt-header-actions">' +
            '<button id="scut-bbt-btn-zip" class="scut-bbt-btn-zip">一键打包 (ZIP)</button>' +
            '<button id="scut-bbt-btn-close" class="scut-bbt-btn-close" title="收起">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="scut-bbt-body">' +
          '<div class="scut-bbt-row">' +
            '<label class="scut-bbt-row-left">' +
              '<input type="checkbox" id="scut-bbt-check-ppt" checked />' +
              '<span>PPT 课件 (PDF)</span>' +
            '</label>' +
            '<div class="scut-bbt-row-right">' +
              '<span class="scut-bbt-row-status" id="scut-bbt-status-ppt">就绪</span>' +
              '<button class="scut-bbt-btn-single" id="scut-bbt-dl-ppt">下载 PDF</button>' +
            '</div>' +
          '</div>' +
          '<div class="scut-bbt-row">' +
            '<label class="scut-bbt-row-left">' +
              '<input type="checkbox" id="scut-bbt-check-txt" checked />' +
              '<span>TXT 纯文本字幕</span>' +
            '</label>' +
            '<div class="scut-bbt-row-right">' +
              '<span class="scut-bbt-row-status" id="scut-bbt-status-txt">就绪</span>' +
              '<button class="scut-bbt-btn-single" id="scut-bbt-dl-txt">下载 TXT</button>' +
            '</div>' +
          '</div>' +
          '<div class="scut-bbt-row">' +
            '<label class="scut-bbt-row-left">' +
              '<input type="checkbox" id="scut-bbt-check-srt" checked />' +
              '<span>SRT 时间轴字幕</span>' +
            '</label>' +
            '<div class="scut-bbt-row-right">' +
              '<span class="scut-bbt-row-status" id="scut-bbt-status-srt">就绪</span>' +
              '<button class="scut-bbt-btn-single" id="scut-bbt-dl-srt">下载 SRT</button>' +
            '</div>' +
          '</div>' +
          '<div class="scut-bbt-row">' +
            '<label class="scut-bbt-row-left">' +
              '<input type="checkbox" id="scut-bbt-check-json" checked />' +
              '<span>JSON 原始数据</span>' +
            '</label>' +
            '<div class="scut-bbt-row-right">' +
              '<span class="scut-bbt-row-status" id="scut-bbt-status-json">就绪</span>' +
              '<button class="scut-bbt-btn-single" id="scut-bbt-dl-json">下载 JSON</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="scut-bbt-footer">' +
          '<div class="scut-bbt-status-bar" id="scut-bbt-status-bar">就绪</div>' +
          '<div class="scut-bbt-progress scut-bbt-hidden" id="scut-bbt-progress-wrap">' +
            '<div class="scut-bbt-progress-bar" id="scut-bbt-progress-bar"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    const pill = document.getElementById('scut-bbt-pill');
    const card = document.getElementById('scut-bbt-card');
    const btnClose = document.getElementById('scut-bbt-btn-close');
    const btnZip = document.getElementById('scut-bbt-btn-zip');
    const statusBar = document.getElementById('scut-bbt-status-bar');
    const progressWrap = document.getElementById('scut-bbt-progress-wrap');
    const progressBar = document.getElementById('scut-bbt-progress-bar');
    const descEl = document.getElementById('scut-bbt-desc');

    const dlPpt = document.getElementById('scut-bbt-dl-ppt');
    const dlTxt = document.getElementById('scut-bbt-dl-txt');
    const dlSrt = document.getElementById('scut-bbt-dl-srt');
    const dlJson = document.getElementById('scut-bbt-dl-json');

    const checkPpt = document.getElementById('scut-bbt-check-ppt');
    const checkTxt = document.getElementById('scut-bbt-check-txt');
    const checkSrt = document.getElementById('scut-bbt-check-srt');
    const checkJson = document.getElementById('scut-bbt-check-json');

    const statusPpt = document.getElementById('scut-bbt-status-ppt');
    const statusTxt = document.getElementById('scut-bbt-status-txt');
    const statusSrt = document.getElementById('scut-bbt-status-srt');
    const statusJson = document.getElementById('scut-bbt-status-json');

    let courseInfo = null;
    let cachedPdfBlob = null;
    let cachedSubtitles = null;
    let isWorking = false;

    pill.onclick = () => {
      pill.classList.add('scut-bbt-hidden');
      card.classList.remove('scut-bbt-hidden');
      initCourseInfo();
    };

    btnClose.onclick = () => {
      card.classList.add('scut-bbt-hidden');
      pill.classList.remove('scut-bbt-hidden');
    };

    function setStatus(text, progress = null) {
      statusBar.innerText = text;
      if (progress !== null) {
        progressWrap.classList.remove('scut-bbt-hidden');
        progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
      } else {
        progressWrap.classList.add('scut-bbt-hidden');
        progressBar.style.width = '0%';
      }
    }

    function setWorking(busy) {
      isWorking = busy;
      btnZip.disabled = busy;
      dlPpt.disabled = busy;
      dlTxt.disabled = busy;
      dlSrt.disabled = busy;
      dlJson.disabled = busy;
    }

    async function initCourseInfo() {
      if (courseInfo && courseInfo.courseName && !courseInfo.courseName.startsWith("课程_")) return;
      try {
        courseInfo = await resolveCourseInfo(courseId, subId);
        const relatedCount = courseInfo.relatedLessons.length;
        const countNote = relatedCount > 1 ? (' (检测到 ' + relatedCount + ' 节关联课时)') : '';
        descEl.innerText = courseInfo.courseName + ' · ' + courseInfo.dateStr + countNote;
        setStatus('准备就绪，支持单个下载或一键打包');
      } catch (e) {
        descEl.innerText = 'ID: ' + courseId + '_' + subId;
        setStatus('课程信息解析完毕');
      }
    }

    // 单独下载 PPT (PDF)
    dlPpt.onclick = async () => {
      if (isWorking) return;
      await initCourseInfo();
      setWorking(true);
      try {
        if (!cachedPdfBlob) {
          const res = await fetchPptPdf(courseInfo, (msg, p) => setStatus(msg, p));
          cachedPdfBlob = res.blob;
          statusPpt.innerText = res.pageCount + ' 页';
        }
        triggerDownload(cachedPdfBlob, courseInfo.baseFileName + '.pdf');
        setStatus('PPT (PDF) 下载完成', 100);
      } catch (e) {
        setStatus('PPT 导出失败: ' + e.message);
        alert('PPT 导出失败: ' + e.message);
      } finally {
        setWorking(false);
      }
    };

    // 获取并缓存字幕
    async function ensureSubtitles() {
      if (!cachedSubtitles) {
        cachedSubtitles = await fetchSubtitles(courseInfo, (msg, p) => setStatus(msg, p));
        statusTxt.innerText = cachedSubtitles.totalLines + ' 行';
        statusSrt.innerText = cachedSubtitles.totalLines + ' 条';
        statusJson.innerText = cachedSubtitles.totalLines + ' 条';
      }
      return cachedSubtitles;
    }

    // 单独下载 TXT
    dlTxt.onclick = async () => {
      if (isWorking) return;
      await initCourseInfo();
      setWorking(true);
      try {
        const subs = await ensureSubtitles();
        triggerDownload(new Blob([subs.txtContent], { type: 'text/plain;charset=utf-8' }), courseInfo.baseFileName + '.txt');
        setStatus('TXT 纯文本字幕下载完成', 100);
      } catch (e) {
        setStatus('字幕下载失败: ' + e.message);
        alert('字幕下载失败: ' + e.message);
      } finally {
        setWorking(false);
      }
    };

    // 单独下载 SRT
    dlSrt.onclick = async () => {
      if (isWorking) return;
      await initCourseInfo();
      setWorking(true);
      try {
        const subs = await ensureSubtitles();
        triggerDownload(new Blob([subs.srtContent], { type: 'application/x-subrip;charset=utf-8' }), courseInfo.baseFileName + '.srt');
        setStatus('SRT 时间轴字幕下载完成', 100);
      } catch (e) {
        setStatus('字幕下载失败: ' + e.message);
        alert('字幕下载失败: ' + e.message);
      } finally {
        setWorking(false);
      }
    };

    // 单独下载 JSON
    dlJson.onclick = async () => {
      if (isWorking) return;
      await initCourseInfo();
      setWorking(true);
      try {
        const subs = await ensureSubtitles();
        triggerDownload(new Blob([subs.jsonContent], { type: 'application/json;charset=utf-8' }), courseInfo.baseFileName + '.json');
        setStatus('JSON 原始字幕数据下载完成', 100);
      } catch (e) {
        setStatus('字幕下载失败: ' + e.message);
        alert('字幕下载失败: ' + e.message);
      } finally {
        setWorking(false);
      }
    };

    // 一键打包 ZIP 下载
    btnZip.onclick = async () => {
      if (isWorking) return;
      await initCourseInfo();

      const wantPpt = checkPpt.checked;
      const wantTxt = checkTxt.checked;
      const wantSrt = checkSrt.checked;
      const wantJson = checkJson.checked;

      if (!wantPpt && !wantTxt && !wantSrt && !wantJson) {
        alert('请至少勾选一项要打包的内容！');
        return;
      }

      setWorking(true);
      const zipEntries = [];

      try {
        // 1. PPT 处理
        if (wantPpt) {
          if (!cachedPdfBlob) {
            const res = await fetchPptPdf(courseInfo, (msg, p) => setStatus(msg, p));
            cachedPdfBlob = res.blob;
            statusPpt.innerText = res.pageCount + ' 页';
          }
          const pdfBuffer = await cachedPdfBlob.arrayBuffer();
          zipEntries.push({
            name: courseInfo.baseFileName + '.pdf',
            data: new Uint8Array(pdfBuffer),
          });
        }

        // 2. 字幕处理
        if (wantTxt || wantSrt || wantJson) {
          const subs = await ensureSubtitles();
          if (wantTxt) {
            zipEntries.push({
              name: courseInfo.baseFileName + '.txt',
              data: subs.txtContent,
            });
          }
          if (wantSrt) {
            zipEntries.push({
              name: courseInfo.baseFileName + '.srt',
              data: subs.srtContent,
            });
          }
          if (wantJson) {
            zipEntries.push({
              name: courseInfo.baseFileName + '.json',
              data: subs.jsonContent,
            });
          }
        }

        // 3. 原生零依赖打包
        setStatus('正在生成 ZIP 压缩包...', 95);
        const zipBlob = buildZip(zipEntries);
        triggerDownload(zipBlob, courseInfo.baseFileName + '.zip');
        setStatus('打包下载完成！', 100);
      } catch (e) {
        setStatus('打包失败: ' + e.message);
        alert('打包失败: ' + e.message);
      } finally {
        setWorking(false);
      }
    };
  }

  // 页面加载或单页切换时挂载工具箱
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', createToolkitUi);
  } else {
    createToolkitUi();
  }
  setInterval(createToolkitUi, 2000);
})();

