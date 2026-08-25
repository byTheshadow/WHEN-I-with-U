import db from '../../../db';
import { generateBackupData, restoreBackupData } from '../../../services/backupService';

// UTF-8 编码传输支持，规避 Base64 中文乱码问题
const utf8ToB64 = (str) => btoa(unescape(encodeURIComponent(str)));
const b64ToUtf8 = (str) => decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));

/**
 * 载入 GitHub 配置
 */
export const getGitHubConfig = async () => {
  const keys = [
    'github_backup_token',
    'github_backup_owner',
    'github_backup_repo',
    'github_backup_branch',
    'github_backup_path',
    'github_backup_last_time',
    'github_backup_last_status',
  ];

  const list = await db.settings.where('key').anyOf(keys).toArray();
  const config = {};
  list.forEach((item) => {
    config[item.key] = item.value;
  });

  return {
    token: config.github_backup_token || '',
    owner: config.github_backup_owner || '',
    repo: config.github_backup_repo || '',
    branch: config.github_backup_branch || 'main',
    path: config.github_backup_path || 'backups/when-i-with-u.json',
    lastTime: config.github_backup_last_time || null,
    lastStatus: config.github_backup_last_status || null,
  };
};

/**
 * 保存配置
 */
export const saveGitHubConfig = async (config) => {
  await db.transaction('rw', db.settings, async () => {
    const data = [
      { key: 'github_backup_owner', value: config.owner.trim() },
      { key: 'github_backup_repo', value: config.repo.trim() },
      { key: 'github_backup_branch', value: config.branch.trim() },
      { key: 'github_backup_path', value: config.path.trim() },
    ];

    // 如果未更改 Token（仍显示占位符）则不更新数据库中的明文 token
    if (config.token && config.token !== '••••••••••••••••') {
      data.push({ key: 'github_backup_token', value: config.token.trim() });
    }

    if (config.lastTime !== undefined) {
      data.push({ key: 'github_backup_last_time', value: config.lastTime });
    }

    if (config.lastStatus !== undefined) {
      data.push({ key: 'github_backup_last_status', value: config.lastStatus });
    }

    await db.settings.bulkPut(data);
  });
};

/**
 * 连接检验与权限测试
 */
export const testGitHubConnection = async (token, owner, repo) => {
  if (!token || !owner || !repo) {
    throw new Error('连通测试失败：必须填写完整 Token、Owner 与 Repository。');
  }

  let finalToken = token;
  if (token === '••••••••••••••••') {
    const record = await db.settings.get('github_backup_token');
    finalToken = record?.value || '';
  }

  if (!finalToken) {
    throw new Error('未检出有效的 GitHub 授权 Token。');
  }

  const response = await fetch(`https://api.github.com/repos/${owner.trim()}/${repo.trim()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${finalToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('访问认证失败。请检查 Token 是否有效。');
    }
    if (response.status === 404) {
      throw new Error('未找到指定仓库。请核对仓库名或检查 Token 的 Scope 权限。');
    }
    const errObj = await response.json().catch(() => ({}));
    throw new Error(errObj.message || `API 连接失败，状态码: ${response.status}`);
  }

  return true;
};

/**
 * 自动获取远端文件 SHA 并推送备份
 */
export const backupToGitHub = async () => {
  const config = await getGitHubConfig();
  const tokenRecord = await db.settings.get('github_backup_token');
  const token = tokenRecord?.value;

  if (!token || !config.owner || !config.repo) {
    throw new Error('备份终止：GitHub 配置存在空白项');
  }

  // 1. 获取现有文件的 sha 值，以满足 GitHub PUT API 的更新覆盖要求
  let sha = null;
  const getUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.branch}`;

  const getRes = await fetch(getUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (getRes.ok) {
    const fileData = await getRes.json();
    sha = fileData.sha;
  } else if (getRes.status !== 404) {
    const errObj = await getRes.json().catch(() => ({}));
    throw new Error(`获取云端快照失败: ${errObj.message || getRes.status}`);
  }

  // 2. 生成最新备份，内部已自动剔除 token 配置
  const backupObj = await generateBackupData();
  const jsonStr = JSON.stringify(backupObj, null, 2);
  const base64Content = utf8ToB64(jsonStr);

  // 3. 执行推送上传
  const putUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  const payload = {
    message: `backup: WHEN I with U archive at ${new Date().toISOString()}`,
    content: base64Content,
    branch: config.branch,
  };

  if (sha) {
    payload.sha = sha;
  }

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(payload),
  });

  if (!putRes.ok) {
    const errObj = await putRes.json().catch(() => ({}));
    throw new Error(`备份同步失败: ${errObj.message || putRes.status}`);
  }

  const nowStr = new Date().toISOString();
  await saveGitHubConfig({
    ...config,
    lastTime: nowStr,
    lastStatus: 'success',
  });

  return nowStr;
};

/**
 * 从 GitHub 同步并覆盖本地
 */
export const restoreFromGitHub = async () => {
  const config = await getGitHubConfig();
  const tokenRecord = await db.settings.get('github_backup_token');
  const token = tokenRecord?.value;

  if (!token || !config.owner || !config.repo) {
    throw new Error('恢复终止：GitHub 配置存在空白项');
  }

  const getUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.branch}`;

  const getRes = await fetch(getUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!getRes.ok) {
    if (getRes.status === 404) {
      throw new Error(`未在指定路径找到备份文件：${config.path}`);
    }
    const errObj = await getRes.json().catch(() => ({}));
    throw new Error(`无法载入云端文件: ${errObj.message || getRes.status}`);
  }

  const fileData = await getRes.json();
  if (!fileData.content) {
    throw new Error('云端备份文件内容空白');
  }

  const decodedStr = b64ToUtf8(fileData.content);
  const backupObj = JSON.parse(decodedStr);

  // 执行覆盖恢复
  await restoreBackupData(backupObj);
};
