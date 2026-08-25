import db from '../db';

const BACKUP_FORMAT = 'when-i-with-u-backup';
const BACKUP_VERSION = 1;

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

export const serializeBackupValue = async (value) => {
  if (value instanceof Blob) {
    return {
      __whenIWithUType: 'blob',
      type: value.type || 'application/octet-stream',
      dataUrl: await readBlobAsDataUrl(value),
    };
  }

  if (value instanceof Date) {
    return {
      __whenIWithUType: 'date',
      value: value.toISOString(),
    };
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => serializeBackupValue(item)));
  }

  if (value && typeof value === 'object') {
    const serializedObject = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      serializedObject[key] = await serializeBackupValue(nestedValue);
    }
    return serializedObject;
  }

  return value;
};

export const restoreBackupValue = async (value) => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => restoreBackupValue(item)));
  }

  if (value && typeof value === 'object') {
    if (value.__whenIWithUType === 'blob' && typeof value.dataUrl === 'string') {
      return dataUrlToBlob(value.dataUrl, value.type);
    }

    if (value.__whenIWithUType === 'date' && typeof value.value === 'string') {
      return new Date(value.value);
    }

    const restoredObject = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      restoredObject[key] = await restoreBackupValue(nestedValue);
    }

    return restoredObject;
  }

  return value;
};

/**
 * 动态抓取当前定义的所有 Dexie 表并导出备份
 * 自动剔除敏感的 GitHub Token
 */
export const generateBackupData = async () => {
  const data = {};
  const allTables = db.tables.map((t) => t.name);

  for (const tableName of allTables) {
    let records = await db.table(tableName).toArray();

    // 安全隔离：导出时绝不泄露 GitHub Token 的设定
    if (tableName === 'settings') {
      records = records.filter((r) => r.key !== 'github_backup_token');
    }

    data[tableName] = await Promise.all(
      records.map((record) => serializeBackupValue(record)),
    );
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
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
  const importTables = Object.keys(backup.data);
  const currentTables = db.tables.map((t) => t.name);

  // 1. 预解析需要导入的各表记录
  for (const tableName of importTables) {
    if (!currentTables.includes(tableName)) continue; // 丢弃不属于当前客户端架构的多余表

    restoredData[tableName] = await Promise.all(
      backup.data[tableName].map((record) => restoreBackupValue(record)),
    );
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
};
