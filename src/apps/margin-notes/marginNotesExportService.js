// src/apps/margin-notes/marginNotesExportService.js
import { toPng } from 'html-to-image';

/**
 * 将指定的 DOM 节点导出为 PNG 图片并触发下载
 * @param {HTMLElement} node DOM 节点
 * @param {string} fileName 文件名
 */
export async function exportPageToImage(node, fileName = 'margin-note.png') {
  if (!node) {
    throw new Error('未找到可导出的页面元素');
  }

  try {
    const dataUrl = await toPng(node, {
      quality: 0.98,
      pixelRatio: 2.5,
      cacheBust: true,
      filter: (domNode) => {
        // 忽略带有 data-export-ignore 属性的控制按钮
        if (domNode?.getAttribute?.('data-export-ignore') === 'true') {
          return false;
        }
        return true;
      }
    });

    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (error) {
    console.error('[MarginNotes Export] 导出图片失败:', error);
    throw error;
  }
}
