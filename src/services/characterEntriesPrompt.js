// 角色编辑器里填的「世界书条目」(character.worldBookEntries) 和
// 「知识库条目」(character.knowledgeEntries) 的提示词拼接。
//
// 这两组条目由 CharacterEditor 存进角色记录，但主聊天提示词原本只读
// 旧的字符串字段 character.worldBook 和全局表 db.worldBooks，所以编辑器里
// 填的内容 AI 一直读不到。这里把已启用的条目并进 character.worldBook 的文本
// 里，这样所有读 character.worldBook 的提示词拼装代码不用改就能看到它们。
//
// 不会修改传进来的 character 对象，返回的是浅拷贝。

const isEntryEnabled = (entry) => (
  entry
  && entry.isEnabled !== false
  && entry.isEnabled !== 0
);

const formatEntries = (entries) => (
  (Array.isArray(entries) ? entries : [])
    .filter(isEntryEnabled)
    .map((entry) => ({
      title: String(entry.title || '').trim(),
      content: String(entry.content || '').trim(),
    }))
    .filter((entry) => entry.content)
    .map((entry) => (
      entry.title ? `  - ${entry.title}: ${entry.content}` : `  - ${entry.content}`
    ))
);

export const buildCharacterEntriesText = (character) => {
  if (!character) return '';

  const worldLines = formatEntries(character.worldBookEntries);
  const knowledgeLines = formatEntries(character.knowledgeEntries);
  const parts = [];

  if (worldLines.length > 0) {
    parts.push(`角色世界书条目:\n${worldLines.join('\n')}`);
  }

  if (knowledgeLines.length > 0) {
    parts.push(`角色知识库:\n${knowledgeLines.join('\n')}`);
  }

  return parts.join('\n');
};

export const withCharacterEntriesInWorldBook = (character) => {
  const entriesText = buildCharacterEntriesText(character);
  if (!entriesText) return character;

  const base = String(character.worldBook || '').trim();

  return {
    ...character,
    worldBook: base ? `${base}\n${entriesText}` : entriesText,
  };
};