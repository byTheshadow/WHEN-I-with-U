// src/apps/fiction/fictionImageService.js
//
// 互动文游的配图：从一段「画面描述」到生图、存图、写回节点。
// 只管数据和生成，不管界面（界面在后面几轮做）。
//
// 数据放在文游自己的两张表里，不碰生图室的画廊：
//   fictionImages      一张图一行的元数据（含小缩略图，列表和统计读它）
//   fictionImageFiles  原图 Blob（不进备份，见 backupService.js 的 BACKUP_EXCLUDED_TABLES）
//
// fictionImages 一行的字段：
//   saveId / nodeId   属于哪个存档、哪一段
//   source            'auto'（AI 给的描述自动生成）| 'manual'（用户手动配图）
//   description       画面描述，用户可以改；重新生成用的是它
//   status            'pending' | 'done' | 'error'
//   errorKind         'config'（没配置接口）| 'input' | 'storage' | 'other'；没有错误时为空字符串
//   errorMessage      给用户看的失败原因
//   prompt            实际发出去的完整正面提示词（done 之后才有）
//   negativePrompt    实际发出去的负面提示词
//   backend / model / params   生成时用的后端、模型、参数（含种子）
//   fileId            fictionImageFiles 里原图的 id；只拿到外链时为 null
//   remoteUrl         只拿到外链时的链接，否则为空字符串
//   thumbnail         缩略图 data URL，没有时为空字符串
//   width / height    原图尺寸，未知时为 0
//   afterParagraph    插在第几段正文之后；null 表示放在这一段末尾（显示位置留给界面那一轮定）
//   replacesImageId   重新生成出来的图记下旧图的 id（不建索引）；用户处理完旧图后清成 null
//   createdAt / updatedAt
//
// 节点的 imageIds 数组记录这一段有哪些图（按生成顺序）。
//
// 画风（固定前缀、画师串、负面词）沿用生图室的全局设置；人物长相不读生图室里填的外貌，
// 所以这里不传 chatId / characterId。NovelAI 一律夹到免费额度，和聊天里 AI 自己生图时一样。

import db from '../../db';
import { getImageGenConfig } from '../imagestudio/imageGenConfigService';
import {
  ImageGenError,
  requestNovelAiImage,
  requestThirdPartyImage,
} from '../imagestudio/imageGenAdapters';
import { readSizeAndMakeThumbnail } from '../imagestudio/imageGenMedia';
import { buildGenerationPrompts, generateSeed, getMissingConfigItems } from '../imagestudio/imageGenRequest';
import { BACKEND_NOVELAI, clampNovelAiParams } from '../imagestudio/imageGenRules';
import { loadPromptSources } from '../imagestudio/imageGenRunner';
import { FICTION_IMAGE_MODES, getSave } from './fictionService';

export const FICTION_IMAGE_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  ERROR: 'error',
};

export const FICTION_IMAGE_SOURCE = {
  AUTO: 'auto',
  MANUAL: 'manual',
};

export const FICTION_IMAGE_ERROR_KIND = {
  CONFIG: 'config',
  INPUT: 'input',
  STORAGE: 'storage',
  OTHER: 'other',
};

// 某张图的状态变了（开始、完成、失败、被删）就在 window 上发这个事件，
// detail 是 { saveId, nodeId, imageId, status }，界面据此刷新。
export const FICTION_IMAGE_CHANGED_EVENT = 'fiction:image-changed';

export const DESCRIPTION_MAX = 2000;

const LOG_TAG = '[Fiction]';

const now = () => Date.now();

const emitChanged = (row, status) => {
  if (typeof window === 'undefined' || !row) return;

  window.dispatchEvent(new CustomEvent(FICTION_IMAGE_CHANGED_EVENT, {
    detail: { saveId: row.saveId, nodeId: row.nodeId, imageId: row.id, status },
  }));
};

// 聊天里 AI 自己触发生图时的做法（chatImageGenService.js）：NovelAI 强制免费额度。
const forceFreeNovelAi = (config) => {
  if (config.backend !== BACKEND_NOVELAI) return config;

  return { ...config, novelai: { ...config.novelai, allowAnlas: false } };
};

// ---------------- 读 ----------------

export const getImage = (imageId) => db.fictionImages.get(imageId);

export const listImagesByNode = async (nodeId) => {
  const rows = await db.fictionImages.where('nodeId').equals(nodeId).toArray();

  return rows.sort((a, b) => a.id - b.id);
};

// 整个存档的所有图，新的在前（给「这个存档的全部图片」页用）。
export const listImagesBySave = async (saveId) => {
  const rows = await db.fictionImages.where('saveId').equals(saveId).toArray();

  return rows.sort((a, b) => b.id - a.id);
};

// 读原图。没有（只有外链，或备份恢复后原图不在了）返回 null。
export const getImageBlob = async (imageId) => {
  try {
    const row = await db.fictionImages.get(imageId);

    if (!row || row.fileId == null) return null;

    return (await db.fictionImageFiles.get(row.fileId))?.blob || null;
  } catch (error) {
    console.warn(LOG_TAG, '读取配图原图失败：', error);

    return null;
  }
};

// ---------------- 生成 ----------------

// 一次生图：读配置、拼提示词、发请求。成功返回 { blob, remoteUrl, prompt, negativePrompt, meta }。
// 配置没填全、描述为空、请求失败都抛 ImageGenError。
const requestOnce = async (description) => {
  const rawConfig = await getImageGenConfig();
  const missing = getMissingConfigItems(rawConfig);

  if (missing.length > 0) {
    throw new ImageGenError(
      `还没配置好生图接口，请到生图室设置（还缺少：${missing.join('、')}）。`,
      { kind: FICTION_IMAGE_ERROR_KIND.CONFIG },
    );
  }

  const scene = String(description || '').trim();

  if (!scene) {
    throw new ImageGenError('画面描述是空的，请先写一下想画什么。', {
      kind: FICTION_IMAGE_ERROR_KIND.INPUT,
    });
  }

  const config = forceFreeNovelAi(rawConfig);
  const sources = await loadPromptSources({ config });
  const { positive, negative } = buildGenerationPrompts({ config, sceneText: scene, ...sources });

  if (config.backend === BACKEND_NOVELAI) {
    const nai = config.novelai;
    const clamped = clampNovelAiParams(nai, nai.allowAnlas);
    const seed = generateSeed();
    const result = await requestNovelAiImage({
      config,
      positive,
      negative,
      params: clamped.params,
      seed,
    });

    return {
      blob: result.blob,
      remoteUrl: result.remoteUrl || '',
      prompt: positive,
      negativePrompt: negative,
      meta: {
        backend: BACKEND_NOVELAI,
        model: nai.model,
        params: {
          ...clamped.params,
          scale: nai.scale,
          sampler: nai.sampler,
          noiseSchedule: nai.noiseSchedule,
          cfgRescale: nai.cfgRescale,
          ucPreset: nai.ucPreset,
          seed,
        },
      },
    };
  }

  const result = await requestThirdPartyImage({ config, positive });

  return {
    blob: result.blob,
    remoteUrl: result.remoteUrl || '',
    prompt: positive,
    negativePrompt: negative,
    meta: {
      backend: config.backend,
      model: config.thirdParty.model,
      params: { size: config.thirdParty.size },
    },
  };
};

const patchImage = async (imageId, patch) => {
  const count = await db.fictionImages.update(imageId, { ...patch, updatedAt: now() });

  if (!count) return null;

  const row = await db.fictionImages.get(imageId);

  emitChanged(row, row?.status);

  return row;
};

const describeFailure = (error) => {
  if (error instanceof ImageGenError) {
    return {
      kind: error.kind === FICTION_IMAGE_ERROR_KIND.CONFIG || error.kind === FICTION_IMAGE_ERROR_KIND.INPUT
        ? error.kind
        : FICTION_IMAGE_ERROR_KIND.OTHER,
      message: error.message,
    };
  }

  const isQuota = error?.name === 'QuotaExceededError' || /quota/i.test(String(error?.message));

  if (isQuota) {
    return {
      kind: FICTION_IMAGE_ERROR_KIND.STORAGE,
      message: '存储空间不足，这张图没有保存下来。请先清理一些空间，再重试。',
    };
  }

  return {
    kind: FICTION_IMAGE_ERROR_KIND.OTHER,
    message: error?.message || '生成失败，请重试。',
  };
};

// 正在排队或生成的图 id。刷新页面后这个集合是空的，所以数据库里还停在 pending 的就是被打断的。
const inFlight = new Set();

// 一次只跑一张：连着几段都要配图时排队，避免同时往生图接口发好几个请求。
let queue = Promise.resolve();

const runImageJob = async (imageId) => {
  const row = await db.fictionImages.get(imageId);

  if (!row) return;

  await patchImage(imageId, {
    status: FICTION_IMAGE_STATUS.PENDING,
    errorKind: '',
    errorMessage: '',
  });

  try {
    const result = await requestOnce(row.description);

    let info = { width: 0, height: 0, thumbnail: '' };

    if (result.blob) {
      try {
        info = await readSizeAndMakeThumbnail(result.blob);
      } catch (thumbError) {
        // 缩略图做不出来不影响图本身。
        console.warn(LOG_TAG, '配图缩略图生成失败：', thumbError);
      }
    }

    let saved = false;

    await db.transaction('rw', db.fictionImages, db.fictionImageFiles, async () => {
      // 生成期间这张图可能已经被删了（删存档、删这一段），那就不写，免得留下孤儿原图。
      if (!(await db.fictionImages.get(imageId))) return;

      const fileId = result.blob
        ? await db.fictionImageFiles.add({
          imageId,
          blob: result.blob,
          mime: result.blob.type || 'image/png',
        })
        : null;

      await db.fictionImages.update(imageId, {
        status: FICTION_IMAGE_STATUS.DONE,
        errorKind: '',
        errorMessage: '',
        prompt: result.prompt,
        negativePrompt: result.negativePrompt,
        fileId,
        remoteUrl: result.remoteUrl,
        thumbnail: info.thumbnail,
        width: info.width,
        height: info.height,
        updatedAt: now(),
        ...result.meta,
      });

      saved = true;
    });

    if (saved) {
      emitChanged(row, FICTION_IMAGE_STATUS.DONE);

      console.info(LOG_TAG, '配图完成', {
        imageId,
        nodeId: row.nodeId,
        backend: result.meta.backend,
        size: `${info.width}x${info.height}`,
        hasFile: Boolean(result.blob),
      });
    }
  } catch (error) {
    console.warn(LOG_TAG, '配图失败：', error);

    const failure = describeFailure(error);

    await patchImage(imageId, {
      status: FICTION_IMAGE_STATUS.ERROR,
      errorKind: failure.kind,
      errorMessage: failure.message,
    }).catch((patchError) => console.warn(LOG_TAG, '记录配图失败原因时出错：', patchError));
  }
};

const enqueueJob = (imageId) => {
  inFlight.add(imageId);

  queue = queue
    .then(() => runImageJob(imageId))
    .catch((error) => console.warn(LOG_TAG, '配图任务出错：', error))
    .finally(() => inFlight.delete(imageId));
};

// ---------------- 写 ----------------

/**
 * 给某一段新增一张图并开始生成（不等生成完，立刻返回新记录的 id）。
 * 记录先写成 pending，节点的 imageIds 同时加上这个 id，界面可以马上显示「生成中」。
 */
export const createImage = async ({
  saveId,
  nodeId,
  description,
  source = FICTION_IMAGE_SOURCE.AUTO,
  afterParagraph = null,
  replacesImageId = null,
}) => {
  const text = String(description || '').trim().slice(0, DESCRIPTION_MAX);

  const imageId = await db.transaction('rw', db.fictionImages, db.fictionNodes, async () => {
    const node = await db.fictionNodes.get(nodeId);

    if (!node || node.saveId !== saveId) throw new Error('找不到要配图的那一段。');

    const timestamp = now();

    const id = await db.fictionImages.add({
      saveId,
      nodeId,
      source,
      description: text,
      status: FICTION_IMAGE_STATUS.PENDING,
      errorKind: '',
      errorMessage: '',
      prompt: '',
      negativePrompt: '',
      backend: '',
      model: '',
      params: null,
      fileId: null,
      remoteUrl: '',
      thumbnail: '',
      width: 0,
      height: 0,
      afterParagraph,
      replacesImageId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db.fictionNodes.update(nodeId, { imageIds: [...(node.imageIds || []), id] });

    return id;
  });

  emitChanged({ saveId, nodeId, id: imageId }, FICTION_IMAGE_STATUS.PENDING);
  enqueueJob(imageId);

  return imageId;
};

/**
 * 失败的图再试一次（描述不变，原地重跑，不新增记录）。
 * 只对 error 状态的图生效；返回是否真的开始了。
 */
export const retryImage = async (imageId) => {
  const row = await db.fictionImages.get(imageId);

  if (!row || row.status !== FICTION_IMAGE_STATUS.ERROR || inFlight.has(imageId)) return false;

  enqueueJob(imageId);

  return true;
};

/**
 * 重新生成：新增一张图，旧的原样保留（要不要删旧图由界面问用户）。
 * description 不传就沿用旧图的描述；传了就用新的（用户改过描述，比如把 1boy 改成 1girl）。
 * 返回新记录的 id。
 */
export const regenerateImage = async (imageId, { description } = {}) => {
  const row = await db.fictionImages.get(imageId);

  if (!row) throw new Error('找不到这张图了。');

  return createImage({
    saveId: row.saveId,
    nodeId: row.nodeId,
    description: description === undefined ? row.description : description,
    source: row.source,
     afterParagraph: row.afterParagraph ?? null,
    replacesImageId: row.id,
  });
};

/**
 * 删一张图：元数据、原图、节点 imageIds 里的引用一起删，同一个事务。
 * 还在生成中的图也可以删（生成完发现记录没了，就不写了）。
 */
export const deleteImage = async (imageId) => {
  let removed = null;

  await db.transaction('rw', db.fictionImages, db.fictionImageFiles, db.fictionNodes, async () => {
    const row = await db.fictionImages.get(imageId);

    if (!row) return;

    if (row.fileId != null) await db.fictionImageFiles.delete(row.fileId);

    await db.fictionImages.delete(imageId);

    const node = await db.fictionNodes.get(row.nodeId);

    if (node) {
      await db.fictionNodes.update(row.nodeId, {
        imageIds: (node.imageIds || []).filter((id) => id !== imageId),
      });
    }

    removed = row;
  });

  if (removed) emitChanged(removed, 'deleted');

  return Boolean(removed);
};

/**
 * 进入游玩页时调用一次：把上次被打断（刷新页面、关掉应用）而一直停在「生成中」的图
 * 改成失败，界面才会显示可重试的按钮，而不是一直转圈。
 */
export const recoverInterruptedImages = async (saveId) => {
  const rows = await db.fictionImages.where('saveId').equals(saveId).toArray();
  const stuck = rows.filter((row) => row.status === FICTION_IMAGE_STATUS.PENDING && !inFlight.has(row.id));

  for (const row of stuck) {
    await patchImage(row.id, {
      status: FICTION_IMAGE_STATUS.ERROR,
      errorKind: FICTION_IMAGE_ERROR_KIND.OTHER,
      errorMessage: '上次生成被中断了，可以重试。',
    });
  }

  return stuck.length;
};

// ---------------- 自动配图 ----------------

/**
 * 自动配图：存档是「自动」模式、并且 AI 这一段给了 [IMAGE] 描述，就在后台生成。
 * 不等结果，也不会因为失败影响剧情（失败只会让这张图显示为失败）。
 */
export const startAutoImage = (node) => {
  if (!node?.id) return;

  const description = String(node.imagePrompt || '').trim();

  if (!description) return;

  getSave(node.saveId)
    .then((save) => {
      if (save?.imageMode !== FICTION_IMAGE_MODES.AUTO) return null;

      return createImage({
        saveId: node.saveId,
        nodeId: node.id,
        description,
        source: FICTION_IMAGE_SOURCE.AUTO,
      });
    })
    .catch((error) => console.warn(LOG_TAG, '启动自动配图失败：', error));
};

/**
 * 给 fictionAiService 的三个入口（开场、续写、重 roll）包一层用：
 * 新生成了一段（不是回到已有的那一段）就启动自动配图，结果原样返回。
 */
export const afterNodeCreated = (result) => {
  if (result && !result.reused) startAutoImage(result.node);

  return result;
};

// ---------------- 控制台调试 ----------------

// 例如：
//   await __fictionImage.listImagesBySave(存档id)
//   await __fictionImage.previewImage(图片id)    在新标签页打开原图
const previewImage = async (imageId) => {
  const blob = await getImageBlob(imageId);

  if (!blob) {
    console.info(LOG_TAG, '这张图没有原图（还在生成、失败了，或只有外链）。', await getImage(imageId));

    return null;
  }

  const url = URL.createObjectURL(blob);

  console.info(LOG_TAG, '原图地址（本次页面有效）：', url);
  window.open(url, '_blank');

  return url;
};

if (typeof window !== 'undefined') {
  window.__fictionImage = {
    listImagesBySave,
    listImagesByNode,
    createImage,
    retryImage,
    regenerateImage,
    deleteImage,
    previewImage,
  };
}

export default {
  FICTION_IMAGE_STATUS,
  FICTION_IMAGE_SOURCE,
  FICTION_IMAGE_ERROR_KIND,
  FICTION_IMAGE_CHANGED_EVENT,
  getImage,
  getImageBlob,
  listImagesByNode,
  listImagesBySave,
  createImage,
  retryImage,
  regenerateImage,
  deleteImage,
  recoverInterruptedImages,
  startAutoImage,
  afterNodeCreated,
};