import db from '../db';

const BACKUP_FORMAT = 'when-i-with-u-backup';
const BACKUP_VERSION = 1;
const BACKUP_EXCLUDED_TABLES = ['imageGenerationFiles', 'fictionImageFiles'];

const readBlobAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read local image data.'));
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (
  dataUrl,
  fallbackType = 'application/octet-stream',
) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new Blob([blob], { type: blob.type || fallbackType });
};

// 2026-10：序列化失败的占位标记——不是正常的数据内容，只是告诉恢复逻辑
// "这里原本有东西，但导出时读取失败了"，避免恢复时把它当成一段正常文字/
// 空对象悄悄保留下来，也方便排查到底是哪类内容在用户的设备上读取失败。
const BLOB_READ_FAILURE_MARKER = '__whenIWithUBlobReadFailed';

export const serializeBackupValue = async (value, warnings = null) => {
  if (value instanceof Blob) {
    try {
      return {
        __whenIWithUType: 'blob',
        type: value.type || 'application/octet-stream',
        dataUrl: await readBlobAsDataUrl(value),
      };
    } catch (error) {
      // 本地存储里的这一份二进制内容已经读不出来了（常见于浏览器已经
      // 把底层数据驱逐/损坏，但记录本身的引用还在）。不让这一个字段
      // 拖垮整次导出——跳过它，记一条警告，其余内容正常导出。
      console.warn('[backupService] Blob 读取失败，已跳过：', error);
      warnings?.push({ type: 'blob-read-failed', message: error?.message || String(error) });
      return { __whenIWithUType: BLOB_READ_FAILURE_MARKER };
    }
  }

  if (value instanceof Date) {
    return {
      __whenIWithUType: 'date',
      value: value.toISOString(),
    };
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => serializeBackupValue(item, warnings)));
  }

  if (value && typeof value === 'object') {
    const serializedObject = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      serializedObject[key] = await serializeBackupValue(nestedValue, warnings);
    }
    return serializedObject;
  }

  return value;
};

export const restoreBackupValue = async (value, warnings = null) => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => restoreBackupValue(item, warnings)));
  }

  if (value && typeof value === 'object') {
    if (value.__whenIWithUType === BLOB_READ_FAILURE_MARKER) {
      // 导出时就已经读不到这份二进制内容了，恢复时自然也没有东西可还原——
      // 原样传回这个标记，而不是伪装成一个能用的空 Blob。
      return null;
    }

    if (value.__whenIWithUType === 'blob' && typeof value.dataUrl === 'string') {
      try {
        return await dataUrlToBlob(value.dataUrl, value.type);
      } catch (error) {
        // 备份文件里这一段 dataUrl 本身已经损坏/不完整（比如用户手动编辑过
        // 导出的 JSON，或者传输过程中被截断）。不让这一个字段拖垮整次恢复，
        // 跳过它、记一条警告，其余字段正常恢复。
        console.warn('[backupService] 备份内的 Blob 数据已损坏，已跳过：', error);
        warnings?.push({ type: 'blob-restore-failed', message: error?.message || String(error) });
        return null;
      }
    }

    if (value.__whenIWithUType === 'date' && typeof value.value === 'string') {
      return new Date(value.value);
    }

    const restoredObject = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      restoredObject[key] = await restoreBackupValue(nestedValue, warnings);
    }

    return restoredObject;
  }

  return value;
};

/**
 * 动态抓取当前定义的所有 Dexie 表并导出备份
 * 自动剔除敏感的 GitHub Token
 *
 * 2026-10 加固：单条记录（甚至整张表）读取/序列化失败不再让整次导出直接
 * 报错中断——跳过出问题的部分，记一条警告，其余数据正常导出完整返回。
 * 调用方可以看 backup.exportWarnings 来判断要不要提醒用户。
 */
export const generateBackupData = async () => {
  const data = {};
  const warnings = [];
 const allTables = db.tables
  .map((t) => t.name)
  .filter((name) => !BACKUP_EXCLUDED_TABLES.includes(name));

  for (const tableName of allTables) {
    try {
      let records = await db.table(tableName).toArray();

      // 安全隔离：导出时绝不泄露 GitHub Token 的设定
      if (tableName === 'settings') {
        records = records.filter((r) => r.key !== 'github_backup_token');
      }

      const results = await Promise.allSettled(
        records.map((record) => serializeBackupValue(record, warnings)),
      );

      const serializedRecords = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          serializedRecords.push(result.value);
        } else {
          console.warn(
            `[backupService] 表 ${tableName} 第 ${index} 条记录导出失败，已跳过：`,
            result.reason,
          );
          warnings.push({
            type: 'record-export-failed',
            table: tableName,
            message: result.reason?.message || String(result.reason),
          });
        }
      });

      data[tableName] = serializedRecords;
    } catch (error) {
      // 整张表读取本身失败了（比较罕见，比如该表已损坏）——跳过这张表，
      // 其余表继续正常导出，而不是让用户拿到一个完全空的备份文件。
      console.warn(`[backupService] 表 ${tableName} 整体读取失败，已跳过：`, error);
      warnings.push({
        type: 'table-export-failed',
        table: tableName,
        message: error?.message || String(error),
      });
      data[tableName] = [];
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    exportWarnings: warnings,
  };
};

/**
 * 安全恢复备份数据
 * 采用全表事务，且自动防止 GitHub 配置在恢复时丢失
 */
export const restoreBackupData = async (backup) => {
  if (!backup || typeof backup !== 'object') {
    throw new Error('无效的备份数据结构');
  }

  if (backup.format !== BACKUP_FORMAT) {
    throw new Error('当前文件并非 WHEN I with U 的备份格式');
  }

  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('备份文件内未发现数据主体');
  }

  // 校验合法性：确保至少包含核心的 profile 结构
  if (!backup.data.profile || !Array.isArray(backup.data.profile)) {
    throw new Error('备份文件已损毁或不完整：未找到个人档案数据');
  }

  const restoredData = {};
  const restoreWarnings = [];
  const importTables = Object.keys(backup.data);
  const currentTables = db.tables.map((t) => t.name);

  // 1. 预解析需要导入的各表记录
  // 2026-10 加固：单条记录解析失败（比如备份文件里某段数据已损坏）不再让
  // 整张表的恢复直接报错中断——跳过那一条，其余记录正常恢复。
  for (const tableName of importTables) {
    if (!currentTables.includes(tableName)) continue; // 丢弃不属于当前客户端架构的多余表

    const sourceRecords = Array.isArray(backup.data[tableName]) ? backup.data[tableName] : [];
    const results = await Promise.allSettled(
      sourceRecords.map((record) => restoreBackupValue(record, restoreWarnings)),
    );

    const restoredRecords = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        restoredRecords.push(result.value);
      } else {
        console.warn(
          `[backupService] 表 ${tableName} 第 ${index} 条记录恢复失败，已跳过：`,
          result.reason,
        );
        restoreWarnings.push({
          type: 'record-restore-failed',
          table: tableName,
          message: result.reason?.message || String(result.reason),
        });
      }
    });

    restoredData[tableName] = restoredRecords;
  }

  // 2. 提取并保留当前的 GitHub 备份状态参数，防止在事务清空时被洗掉
  const gitKeys = [
    'github_backup_token',
    'github_backup_owner',
    'github_backup_repo',
    'github_backup_branch',
    'github_backup_path',
    'github_backup_last_time',
    'github_backup_last_status',
  ];
  const preservedGitSettings = [];

  for (const key of gitKeys) {
    const item = await db.settings.get(key);
    if (item) {
      preservedGitSettings.push(item);
    }
  }

  // 3. 执行单次事务恢复
  await db.transaction('rw', db.tables, async () => {
    // 清空现存所有数据
    await Promise.all(db.tables.map((table) => table.clear()));

    // 写入恢复的数据
    for (const tableName of importTables) {
      if (restoredData[tableName] && restoredData[tableName].length > 0) {
        await db.table(tableName).bulkPut(restoredData[tableName]);
      }
    }

    // 重新压回保留的本地 GitHub 连通参数
    if (preservedGitSettings.length > 0) {
      await db.settings.bulkPut(preservedGitSettings);
    }
  });

  return { restoreWarnings };
};