import db from '../db';

// 15 款专属预设表情包
export const DEFAULT_STICKERS = [
  { name: '心动', url: 'https://u2.fukit.cn/PcyFGX4gq', category: 'preset' },
  { name: '亲亲你', url: 'https://u2.fukit.cn/7ioPavcc6', category: 'preset' },
  { name: '无聊', url: 'https://u2.fukit.cn/QsQ3U486T', category: 'preset' },
  { name: '醒醒', url: 'https://u2.fukit.cn/IFFAjnNe0', category: 'preset' },
  { name: '我来啦', url: 'https://u2.fukit.cn/JZmOAwvK1', category: 'preset' },
  { name: '你好我吃一点', url: 'https://u2.fukit.cn/lAig21Rcu', category: 'preset' },
  { name: '乖宝宝', url: 'https://u2.fukit.cn/0Omv9Oy78', category: 'preset' },
  { name: '哄哄你', url: 'https://u2.fukit.cn/h09DfAhR2', category: 'preset' },
  { name: '开心', url: 'https://u2.fukit.cn/vENEKAqtS', category: 'preset' },
  { name: '喝酒咕噜噜', url: 'https://u2.fukit.cn/ZIscxjpk1', category: 'preset' },
  { name: '嗅嗅你', url: 'https://u2.fukit.cn/VjCrvNu26', category: 'preset' },
  { name: '有点生气', url: 'https://u2.fukit.cn/PacUkxYj8', category: 'preset' },
  { name: '超心动', url: 'https://u2.fukit.cn/mSVQW0LeA', category: 'preset' },
  { name: '你好可爱', url: 'https://u2.fukit.cn/RQmg53mU9', category: 'preset' },
  { name: '哭了', url: 'https://u2.fukit.cn/sBcqPCOgz', category: 'preset' },
];

/**
 * 初始化并补齐预设表情包。
 *
 * 根据 URL 判断预设是否已存在：
 * - 可以自动补充未来新增的预设；
 * - 不会覆盖用户的自定义表情；
 * - 不会重复导入同一 URL。
 */
export const initDefaultStickers = async () => {
  try {
    await db.transaction('rw', db.stickers, async () => {
      const existingStickers = await db.stickers.toArray();

      const existingUrls = new Set(
        existingStickers
          .map((sticker) => sticker.url)
          .filter(Boolean)
      );

      const now = Date.now();

      const missingStickers = DEFAULT_STICKERS
        .filter((sticker) => !existingUrls.has(sticker.url))
        .map((sticker, index) => ({
          ...sticker,
          createdAt: now + index,
        }));

      if (missingStickers.length > 0) {
        await db.stickers.bulkAdd(missingStickers);
      }
    });
  } catch (err) {
    console.error('Failed to init default stickers:', err);
  }
};

/**
 * 获取全部表情包。
 */
export const getAllStickers = async () => {
  try {
    // 获取前自动补齐预设表情包
    await initDefaultStickers();

    return await db.stickers
      .orderBy('createdAt')
      .reverse()
      .toArray();
  } catch (err) {
    console.error('Failed to get stickers:', err);
    return [];
  }
};

/**
 * 添加单个自定义表情包。
 *
 * @param {string} name 表情名称 / 含义
 * @param {string} url 图片 URL 或 Base64 图片
 */
export const addCustomSticker = async (name, url) => {
  try {
    const trimmedName = String(name || '').trim();
    const trimmedUrl = String(url || '').trim();

    if (!trimmedName) {
      throw new Error('表情包名称不能为空');
    }

    if (!trimmedUrl) {
      throw new Error('表情包链接不能为空');
    }

    const payload = {
      name: trimmedName,
      url: trimmedUrl,
      category: 'custom',
      createdAt: Date.now(),
    };

    const id = await db.stickers.add(payload);

    return {
      id,
      ...payload,
    };
  } catch (err) {
    console.error('Failed to add sticker:', err);
    throw err;
  }
};

/**
 * 判断是否为可用的图片地址。
 *
 * 支持：
 * - https://...
 * - http://...
 * - data:image/...;base64,...（本地图片转 Base64 的格式）
 */
const isValidStickerUrl = (url) => {
  const isBase64Image = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(url);

  if (isBase64Image) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);

    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

/**
 * 批量解析表情包导入文本。
 *
 * 支持三种格式：
 *
 * 1. 推荐格式：每个表情使用两行
 *    含义：开心
 *    url：https://example.com/happy.gif
 *
 * 2. 同一行格式
 *    含义：开心 url：https://example.com/happy.gif
 *
 * 3. 简写格式：一行一个表情
 *    开心：https://example.com/happy.gif
 *
 * 同时支持中文冒号「：」与英文冒号「:」。
 * 空行与 # 开头的注释行会自动忽略。
 *
 * @param {string} text 批量导入文本
 * @returns {{
 *   stickers: Array<{name: string, url: string}>,
 *   invalidLines: Array<{line: number, content: string, reason: string}>
 * }}
 */
export const parseStickerImportText = (text) => {
  const lines = String(text || '').split(/\r?\n/);

  const stickers = [];
  const invalidLines = [];

  // 用于处理两行形式：
  // 含义：开心
  // url：https://example.com/happy.gif
  let pendingName = null;

  const pushSticker = (name, url, lineNumber, content) => {
    const trimmedName = String(name || '').trim();
    const trimmedUrl = String(url || '').trim();

    if (!trimmedName) {
      invalidLines.push({
        line: lineNumber,
        content,
        reason: '表情包含义不能为空',
      });
      return;
    }

    if (!trimmedUrl) {
      invalidLines.push({
        line: lineNumber,
        content,
        reason: '图片链接不能为空',
      });
      return;
    }

    if (!isValidStickerUrl(trimmedUrl)) {
      invalidLines.push({
        line: lineNumber,
        content,
        reason: '图片链接无效，仅支持 HTTP、HTTPS 或 Base64 图片链接',
      });
      return;
    }

    stickers.push({
      name: trimmedName,
      url: trimmedUrl,
    });
  };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    // 忽略空行、注释行
    if (!line || line.startsWith('#')) {
      return;
    }

    /**
     * 格式：
     * 含义：开心 url：https://example.com/happy.gif
     * 名称：开心 url：https://example.com/happy.gif
     */
    const sameLineMatch = line.match(
      /^(?:含义|名称|name)\s*[：:]\s*(.+?)\s+(?:url|链接)\s*[：:]\s*(\S+)\s*$/i
    );

    if (sameLineMatch) {
      if (pendingName) {
        invalidLines.push({
          line: pendingName.line,
          content: pendingName.content,
          reason: '缺少对应的 url 图片链接',
        });
        pendingName = null;
      }

      pushSticker(
        sameLineMatch[1],
        sameLineMatch[2],
        lineNumber,
        rawLine
      );
      return;
    }

    /**
     * 格式：
     * 含义：开心
     * 名称：开心
     * name: 开心
     */
    const nameLineMatch = line.match(
      /^(?:含义|名称|name)\s*[：:]\s*(.+)\s*$/i
    );

    if (nameLineMatch) {
      // 前一个名称还没配 URL，则标记前一个为无效
      if (pendingName) {
        invalidLines.push({
          line: pendingName.line,
          content: pendingName.content,
          reason: '缺少对应的 url 图片链接',
        });
      }

      pendingName = {
        name: nameLineMatch[1].trim(),
        line: lineNumber,
        content: rawLine,
      };
      return;
    }

    /**
     * 格式：
     * url：https://example.com/happy.gif
     * 链接：https://example.com/happy.gif
     */
    const urlLineMatch = line.match(
      /^(?:url|链接)\s*[：:]\s*(.+)\s*$/i
    );

    if (urlLineMatch) {
      if (!pendingName) {
        invalidLines.push({
          line: lineNumber,
          content: rawLine,
          reason: '找到了 url，但前面没有对应的“含义”',
        });
        return;
      }

      pushSticker(
        pendingName.name,
        urlLineMatch[1],
        lineNumber,
        `${pendingName.content}\n${rawLine}`
      );

      pendingName = null;
      return;
    }

    /**
     * 简写格式：
     * 开心：https://example.com/happy.gif
     */
    const separatorIndex = line.search(/[：:]/);

    if (separatorIndex === -1) {
      invalidLines.push({
        line: lineNumber,
        content: rawLine,
        reason: '格式无法识别，请使用“含义：名称 + url：链接”或“名称：链接”',
      });
      return;
    }

    if (pendingName) {
      invalidLines.push({
        line: pendingName.line,
        content: pendingName.content,
        reason: '缺少对应的 url 图片链接',
      });
      pendingName = null;
    }

    const name = line.slice(0, separatorIndex).trim();
    const url = line.slice(separatorIndex + 1).trim();

    pushSticker(name, url, lineNumber, rawLine);
  });

  // 文本结束时仍有未匹配 URL 的名称
  if (pendingName) {
    invalidLines.push({
      line: pendingName.line,
      content: pendingName.content,
      reason: '缺少对应的 url 图片链接',
    });
  }

  return {
    stickers,
    invalidLines,
  };
};

/**
 * 批量导入自定义表情包。
 *
 * 规则：
 * - 不合法的行不会影响其他合法行导入；
 * - 数据库中已有相同 URL 时自动跳过；
 * - 本次粘贴的内容中出现重复 URL 时自动跳过；
 * - 不覆盖已有的预设表情或自定义表情。
 *
 * @param {string} text 批量导入文本
 * @returns {Promise<{
 *   added: Array,
 *   skipped: Array<{name: string, url: string, reason: string}>,
 *   invalidLines: Array<{line: number, content: string, reason: string}>
 * }>}
 */
export const batchAddCustomStickers = async (text) => {
  const { stickers, invalidLines } = parseStickerImportText(text);

  if (stickers.length === 0) {
    return {
      added: [],
      skipped: [],
      invalidLines,
    };
  }

  try {
    return await db.transaction('rw', db.stickers, async () => {
      const existingStickers = await db.stickers.toArray();

      const existingUrls = new Set(
        existingStickers
          .map((sticker) => sticker.url)
          .filter(Boolean)
      );

      const importedUrls = new Set();
      const skipped = [];

      const stickersToAdd = stickers.filter((sticker) => {
        if (existingUrls.has(sticker.url)) {
          skipped.push({
            ...sticker,
            reason: '该图片链接已经存在于表情包库中',
          });
          return false;
        }

        if (importedUrls.has(sticker.url)) {
          skipped.push({
            ...sticker,
            reason: '本次导入内容中图片链接重复',
          });
          return false;
        }

        importedUrls.add(sticker.url);
        return true;
      });

      if (stickersToAdd.length === 0) {
        return {
          added: [],
          skipped,
          invalidLines,
        };
      }

      const now = Date.now();

      const payloads = stickersToAdd.map((sticker, index) => ({
        name: sticker.name,
        url: sticker.url,
        category: 'custom',
        // 确保批量导入的表情有稳定排序
        createdAt: now + index,
      }));

      const ids = await db.stickers.bulkAdd(payloads, {
        allKeys: true,
      });

      const added = payloads.map((sticker, index) => ({
        id: ids[index],
        ...sticker,
      }));

      return {
        added,
        skipped,
        invalidLines,
      };
    });
  } catch (err) {
    console.error('Failed to batch add stickers:', err);
    throw err;
  }
};

/**
 * 删除表情包。
 *
 * @param {number|string} id 表情包 ID
 */
export const deleteSticker = async (id) => {
  try {
    await db.stickers.delete(id);
  } catch (err) {
    console.error('Failed to delete sticker:', err);
  }
};

export default {
  initDefaultStickers,
  getAllStickers,
  addCustomSticker,
  parseStickerImportText,
  batchAddCustomStickers,
  deleteSticker,
};
