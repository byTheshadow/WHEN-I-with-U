// src/apps/fiction/WizardStepCast.jsx
//
// 向导第 2 步：角色编排。
// 我的设定（姓名、头像、身份经历、其他补充）、主角色（必填）、
// 导入已有角色（最多 3 个，存档里的副本）、存档专属 NPC（只放一定要出场的人）。
//
// 导入角色的编辑是「即改即存」：改的是 form 里的副本，不碰聊天里的原角色。
// 新建主角色、NPC 用本地草稿 + 保存按钮，因为要先填名字才有意义。

import React, { useRef, useState } from 'react';
import { Camera, Check, Plus } from 'lucide-react';

import AppearanceField from './AppearanceField';
import FictionSheetPortal from './FictionSheetPortal';

import {
  MAX_IMPORTED,
  MAX_NPCS,
  TEXT_FIELD_MAX,
  countImportedEdits,
  fileToAvatarDataUrl,
  importCharactersByIds,
  listImportableCharacters,
  makeId,
  resetImportedCopy,
} from './fictionWizardService';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

const joinSetting = (...parts) => parts.map((part) => String(part ?? '').trim()).filter(Boolean).join('\n');

const str = (value) => String(value ?? '').trim();

const initialOf = (name) => Array.from(str(name))[0] || '?';

const FieldLabel = ({ children, tag = '可留空', required = false }) => (
  <div className="fic-w-label-row">
    <span className="fic-w-label">{children}</span>
    <span className={`fic-w-tag ${required ? 'is-req' : ''}`}>{required ? '必填' : tag}</span>
  </div>
);

const SheetShell = (props) => (
  <FictionSheetPortal>
    <SheetShellBase {...props} />
  </FictionSheetPortal>
);

const SheetShellBase = ({ title, meta, onClose, footer, children }) => (
  <>
    <button type="button" className="fic-btn-reset fic-mask" aria-label="关闭" onClick={onClose} />
    <div className="fic-sheet fic-w-sheet" role="dialog" aria-label={title}>
      <div className="fic-sheet-grab" />
      <div className="fic-sheet-name">{title}</div>
      {meta ? <div className="fic-sheet-meta">{meta}</div> : null}
      <div className="fic-w-sheet-scroll">{children}</div>
      {footer ? <div className="fic-sheet-actions">{footer}</div> : null}
    </div>
  </>
);

const WizardStepCast = ({ form, onChange, onToast }) => {
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pickerList, setPickerList] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const avatarInputRef = useRef(null);

  const imported = Array.isArray(form.importedCharacters) ? form.importedCharacters : [];
  const npcs = Array.isArray(form.npcs) ? form.npcs : [];
  const persona = { name: '', avatar: '', identity: '', appearance: '', extra: '', ...(form.persona || {}) };
  const main = form.mainCharacter;

  const mainImported = main?.source === 'imported'
    ? imported.find((item) => item.localId === main.importedId) || null
    : null;
  const mainCustom = main?.source === 'custom' && str(main.name) ? main : null;
  const hasMain = Boolean(mainImported || mainCustom);
  const mainName = mainImported ? mainImported.name : (mainCustom?.name || '');
  const mainBio = mainImported ? mainImported.bio : (mainCustom?.bio || '');
  const mainEdits = mainImported ? countImportedEdits(mainImported) : 0;
  const slots = Math.max(0, MAX_IMPORTED - imported.length);

  const closeSheet = () => {
    if (busy) return;

    setSheet(null);
    setDraft(null);
  };

  // ---------- 我的设定 ----------

  const patchPersona = (patch) => onChange({ persona: { ...persona, ...patch } });

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    if (!String(file.type).startsWith('image/')) {
      onToast?.('请选择一张图片');
      return;
    }

    try {
      patchPersona({ avatar: await fileToAvatarDataUrl(file) });
    } catch (error) {
      console.warn('[Fiction] 读取头像失败：', error);
      onToast?.('读取图片失败，请换一张试试');
    }
  };

  // ---------- 导入角色 ----------

  const openPicker = async () => {
    if (slots <= 0) {
      onToast?.(`最多导入 ${MAX_IMPORTED} 个角色`);
      return;
    }

    setPicked([]);
    setPickerList(null);
    setSheet({ type: 'picker' });

    try {
      setPickerList(await listImportableCharacters());
    } catch (error) {
      console.warn('[Fiction] 读取角色列表失败：', error);
      setPickerList([]);
      onToast?.('读取角色列表失败');
    }
  };

  const togglePicked = (id) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= slots) return prev;

      return [...prev, id];
    });
  };

  const confirmPicker = async () => {
    if (busy || picked.length === 0) return;

    setBusy(true);

    try {
      const copies = await importCharactersByIds(picked.slice(0, slots));

      if (copies.length === 0) {
        onToast?.('没有读到所选角色');
      } else {
        const patch = { importedCharacters: [...imported, ...copies] };

        if (!hasMain) patch.mainCharacter = { source: 'imported', importedId: copies[0].localId };

        onChange(patch);
        onToast?.(hasMain ? '已导入' : '已导入，并设为主角色');
      }

      setSheet(null);
      setDraft(null);
    } catch (error) {
      console.warn('[Fiction] 导入角色失败：', error);
      onToast?.('导入失败，请再试一次');
    } finally {
      setBusy(false);
    }
  };

  const updateImported = (localId, patch) => {
    onChange({
      importedCharacters: imported.map((item) => (
        item.localId === localId ? { ...item, ...patch } : item
      )),
    });
  };

  const removeImported = (localId) => {
    const patch = { importedCharacters: imported.filter((item) => item.localId !== localId) };

    if (main?.source === 'imported' && main.importedId === localId) patch.mainCharacter = null;

    onChange(patch);
    setSheet(null);
    setDraft(null);
  };

  const setMainImported = (localId) => {
    onChange({ mainCharacter: { source: 'imported', importedId: localId } });
    setSheet(null);
    setDraft(null);
  };

  // ---------- 新建主角色 ----------

  const openCustomMain = (seed) => {
    setDraft({
      name: seed?.name || '',
      bio: seed?.bio || '',
      extraNotes: seed?.extraNotes || '',
      appearance: seed?.appearance || '',
    });
    setSheet({ type: 'customMain' });
  };

  const saveCustomMain = () => {
    if (!str(draft?.name)) {
      onToast?.('给主角色起个名字');
      return;
    }

    onChange({
      mainCharacter: {
        source: 'custom',
        name: str(draft.name),
        bio: str(draft.bio),
        extraNotes: str(draft.extraNotes),
        appearance: str(draft.appearance),
      },
    });
    setSheet(null);
    setDraft(null);
  };

  const editMain = () => {
    if (mainImported) {
      setSheet({ type: 'imported', localId: mainImported.localId });
      return;
    }

    if (mainCustom) openCustomMain(mainCustom);
  };

  // ---------- NPC ----------

  const openNpc = (npc) => {
    setDraft({ id: npc?.id || null, name: npc?.name || '', desc: npc?.desc || '', appearance: npc?.appearance || '' });
    setSheet({ type: 'npc' });
  };

  const saveNpc = () => {
    const name = str(draft?.name);

    if (!name) {
      onToast?.('给这个 NPC 起个名字');
      return;
    }

    const next = {
      id: draft.id || makeId('npc'),
      name,
      desc: str(draft.desc),
      appearance: str(draft.appearance),
    };

    onChange({
      npcs: draft.id
        ? npcs.map((item) => (item.id === draft.id ? next : item))
        : [...npcs, next],
    });
    setSheet(null);
    setDraft(null);
  };

  const deleteNpc = () => {
    onChange({ npcs: npcs.filter((item) => item.id !== draft?.id) });
    setSheet(null);
    setDraft(null);
  };

  // ---------- 抽屉 ----------

  const renderSheet = () => {
    if (!sheet) return null;

    if (sheet.type === 'picker') {
      const importedSourceIds = new Set(imported.map((item) => item.sourceCharacterId));

      return (
        <SheetShell
          title="导入已有角色"
          meta={`还能导入 ${slots} 个 · 导入的是副本，不会改到聊天里的原角色`}
          onClose={closeSheet}
          footer={(
            <>
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn is-solid"
                disabled={busy || picked.length === 0}
                onClick={confirmPicker}
              >
                {busy ? '正在导入' : `导入所选${picked.length ? `（${picked.length}）` : ''}`}
              </button>
              <button type="button" className="fic-btn-reset fic-sheet-btn" disabled={busy} onClick={closeSheet}>
                取消
              </button>
            </>
          )}
        >
          {pickerList === null && <div className="fic-w-rowhint">正在读取角色…</div>}
          {pickerList && pickerList.length === 0 && (
            <div className="fic-w-rowhint">聊天里还没有角色，可以先新建一个主角色。</div>
          )}
          {pickerList && pickerList.length > 0 && (
            <div className="fic-w-rows">
              {pickerList.map((item) => {
                const already = importedSourceIds.has(item.id);
                const on = picked.includes(item.id);
                const full = !on && picked.length >= slots;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on || already}
                    disabled={already || full}
                    className="fic-btn-reset fic-w-pick"
                    onClick={() => togglePicked(item.id)}
                  >
                    <span className={`fic-w-check ${on || already ? 'is-on' : ''}`} aria-hidden="true">
                      {(on || already) && <Check size={14} strokeWidth={2.2} />}
                    </span>
                    <span className="fic-w-pick-text">
                      <span className="fic-w-pick-name">{item.name}</span>
                      <span className="fic-w-pick-sub">
                        {already ? '已导入' : (item.bio || '没有填写人设')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SheetShell>
      );
    }

    if (sheet.type === 'chooseMain') {
      const others = imported.filter((item) => item.localId !== mainImported?.localId);

      return (
        <SheetShell
          title="更换主角色"
          meta={mainCustom ? '换成别人后，当前新建的主角色会被替换掉' : '选一个已导入的角色，或新建一个'}
          onClose={closeSheet}
          footer={(
            <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeSheet}>
              取消
            </button>
          )}
        >
          <div className="fic-w-rows">
            {others.map((item) => (
              <button
                key={item.localId}
                type="button"
                className="fic-btn-reset fic-w-pick"
                onClick={() => setMainImported(item.localId)}
              >
                <span className="fic-w-initial is-small">{initialOf(item.name)}</span>
                <span className="fic-w-pick-text">
                  <span className="fic-w-pick-name">{item.name}</span>
                  <span className="fic-w-pick-sub">已导入的角色</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              className="fic-btn-reset fic-w-pick"
              onClick={() => openCustomMain(null)}
            >
              <span className="fic-w-initial is-small is-dashed">
                <Plus size={16} aria-hidden="true" />
              </span>
              <span className="fic-w-pick-text">
                <span className="fic-w-pick-name">新建一个角色</span>
                <span className="fic-w-pick-sub">只存在这份存档里</span>
              </span>
            </button>
          </div>
        </SheetShell>
      );
    }

    if (sheet.type === 'imported') {
      const item = imported.find((entry) => entry.localId === sheet.localId);

      if (!item) return null;

      const edits = countImportedEdits(item);
      const isMain = main?.source === 'imported' && main.importedId === item.localId;

      return (
        <SheetShell
          title={item.sourceName || item.name || '导入的角色'}
          meta="这是一份副本，改动只留在这份存档里"
          onClose={closeSheet}
          footer={(
            <>
              {!isMain && (
                <button
                  type="button"
                  className="fic-btn-reset fic-sheet-btn is-solid"
                  onClick={() => setMainImported(item.localId)}
                >
                  设为主角色
                </button>
              )}
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn is-danger"
                onClick={() => removeImported(item.localId)}
              >
                移除这个角色
              </button>
              <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeSheet}>
                完成
              </button>
            </>
          )}
        >
          <label className="fic-w-sub-label" htmlFor="fic-imp-name">名字</label>
          <input
            id="fic-imp-name"
            type="text"
            className="fic-w-input"
            value={item.name}
            maxLength={30}
            onChange={(event) => updateImported(item.localId, { name: event.target.value })}
          />

          <label className="fic-w-sub-label" htmlFor="fic-imp-bio">人设</label>
          <textarea
            id="fic-imp-bio"
            className="fic-w-textarea"
            rows={7}
            value={item.bio}
            maxLength={TEXT_FIELD_MAX}
            onChange={(event) => updateImported(item.localId, { bio: event.target.value })}
          />

          <AppearanceField
            id="fic-imp-appearance"
            value={item.appearance || ''}
            name={item.name}
            setting={joinSetting(item.bio, item.extraNotes)}
            background={form.background}
            onChange={(text) => updateImported(item.localId, { appearance: text })}
          />

          <label className="fic-w-sub-label" htmlFor="fic-imp-extra">补充设定</label>
          <textarea
            id="fic-imp-extra"
            className="fic-w-textarea"
            rows={4}
            value={item.extraNotes}
            maxLength={TEXT_FIELD_MAX}
            onChange={(event) => updateImported(item.localId, { extraNotes: event.target.value })}
          />

          {edits > 0 && (
            <button
              type="button"
              className="fic-btn-reset fic-w-file-btn"
              onClick={() => {
                onChange({
                  importedCharacters: imported.map((entry) => (
                    entry.localId === item.localId ? resetImportedCopy(entry) : entry
                  )),
                });
                onToast?.('已恢复原人设');
              }}
            >
              恢复原人设（已微调 {edits} 处）
            </button>
          )}
        </SheetShell>
      );
    }

    if (sheet.type === 'customMain' && draft) {
      return (
        <SheetShell
          title="新建主角色"
          meta="故事跟着 TA 的视角走，只存在这份存档里"
          onClose={closeSheet}
          footer={(
            <>
              <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={saveCustomMain}>
                保存
              </button>
              <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeSheet}>
                取消
              </button>
            </>
          )}
        >
          <label className="fic-w-sub-label" htmlFor="fic-main-name">名字</label>
          <input
            id="fic-main-name"
            type="text"
            className="fic-w-input"
            value={draft.name}
            maxLength={30}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />

          <label className="fic-w-sub-label" htmlFor="fic-main-bio">人设</label>
          <textarea
            id="fic-main-bio"
            className="fic-w-textarea"
            rows={6}
            value={draft.bio}
            maxLength={TEXT_FIELD_MAX}
            placeholder="性格、外貌、经历、说话方式……写到哪算哪。"
            onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
          />

          <AppearanceField
            id="fic-main-appearance"
            value={draft.appearance || ''}
            name={draft.name}
            setting={joinSetting(draft.bio, draft.extraNotes)}
            background={form.background}
            onChange={(text) => setDraft({ ...draft, appearance: text })}
          />

          <label className="fic-w-sub-label" htmlFor="fic-main-extra">补充设定</label>
          <textarea
            id="fic-main-extra"
            className="fic-w-textarea"
            rows={4}
            value={draft.extraNotes}
            maxLength={TEXT_FIELD_MAX}
            placeholder="可留空。比如口头禅、禁忌、和其他人的关系。"
            onChange={(event) => setDraft({ ...draft, extraNotes: event.target.value })}
          />
        </SheetShell>
      );
    }

    if (sheet.type === 'npc' && draft) {
      return (
        <SheetShell
          title={draft.id ? '编辑 NPC' : '添加 NPC'}
          meta="一定会出场的人。剧情里 AI 还会按需要自己引入新角色"
          onClose={closeSheet}
          footer={(
            <>
              <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={saveNpc}>
                保存
              </button>
              {draft.id && (
                <button type="button" className="fic-btn-reset fic-sheet-btn is-danger" onClick={deleteNpc}>
                  删除这个 NPC
                </button>
              )}
              <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeSheet}>
                取消
              </button>
            </>
          )}
        >
          <label className="fic-w-sub-label" htmlFor="fic-npc-name">名字</label>
          <input
            id="fic-npc-name"
            type="text"
            className="fic-w-input"
            value={draft.name}
            maxLength={30}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />

          <label className="fic-w-sub-label" htmlFor="fic-npc-desc">一句话描述</label>
          <textarea
            id="fic-npc-desc"
            className="fic-w-textarea"
            rows={3}
            value={draft.desc}
            maxLength={200}
            placeholder="身份、性格、和主角的关系，一两句就够。"
            onChange={(event) => setDraft({ ...draft, desc: event.target.value })}
          />

          <AppearanceField
            id="fic-npc-appearance"
            value={draft.appearance || ''}
            name={draft.name}
            setting={draft.desc}
            background={form.background}
            rows={2}
            placeholder="发色发型、体型、常穿的衣服……"
            onChange={(text) => setDraft({ ...draft, appearance: text })}
          />
        </SheetShell>
      );
    }

    return null;
  };

  return (
    <div className="fic-w-body">
      {/* ---------- 我的设定 ---------- */}
      <section className="fic-w-field">
        <FieldLabel>我的设定</FieldLabel>

        <div className="fic-w-persona-row">
          <button
            type="button"
            className="fic-btn-reset fic-w-avatar-btn"
            aria-label={persona.avatar ? '更换头像' : '选择头像'}
            onClick={() => avatarInputRef.current?.click()}
          >
            {persona.avatar
              ? <img className="fic-w-avatar-img" src={persona.avatar} alt="" />
              : <Camera size={20} strokeWidth={1.5} aria-hidden="true" />}
          </button>
          <input
            type="text"
            className="fic-w-input fic-w-persona-name"
            value={persona.name}
            maxLength={30}
            placeholder="你在故事里的名字"
            onChange={(event) => patchPersona({ name: event.target.value })}
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarFile}
          />
        </div>
        {persona.avatar && (
          <button
            type="button"
            className="fic-btn-reset fic-w-text-btn"
            onClick={() => patchPersona({ avatar: '' })}
          >
            移除头像
          </button>
        )}

        <textarea
          className="fic-w-textarea"
          rows={3}
          value={persona.identity}
          maxLength={TEXT_FIELD_MAX}
          placeholder="身份经历：你是谁、从哪来、做过什么。"
          onChange={(event) => patchPersona({ identity: event.target.value })}
        />
        <AppearanceField
          id="fic-persona-appearance"
          variant="persona"
          rows={2}
          value={persona.appearance}
          name={persona.name}
          setting={joinSetting(persona.identity, persona.extra)}
          background={form.background}
          onChange={(text) => patchPersona({ appearance: text })}
        />
        <textarea
          className="fic-w-textarea"
          rows={3}
          value={persona.extra}
          maxLength={TEXT_FIELD_MAX}
          placeholder="其他补充：性格、习惯、随身物品、不想被写到的事。"
          onChange={(event) => patchPersona({ extra: event.target.value })}
        />
        <div className="fic-w-hint">这是你在故事里的样子，不一定是真实的你。</div>
      </section>

      {/* ---------- 主角色 ---------- */}
      <section className="fic-w-field">
        <FieldLabel required>主角色</FieldLabel>

        {hasMain ? (
          <div className="fic-w-card">
            <div className="fic-w-card-top">
              <span className="fic-w-initial">{initialOf(mainName)}</span>
              <span className="fic-w-card-text">
                <span className="fic-w-card-name">{mainName}</span>
                <span className="fic-w-card-sub">故事跟着 TA 的视角走</span>
              </span>
            </div>
            {mainBio && <p className="fic-w-card-bio">{mainBio}</p>}
            <div className="fic-w-badges">
              {mainImported && (
                <span className="fic-w-badge">
                  导入 · {mainEdits > 0 ? `已微调 ${mainEdits} 处` : '保留原人设'}
                </span>
              )}
              {mainCustom && <span className="fic-w-badge">存档内新建</span>}
            </div>
            <div className="fic-w-card-actions">
              <button type="button" className="fic-btn-reset fic-w-outline-btn" onClick={editMain}>
                编辑
              </button>
              <button
                type="button"
                className="fic-btn-reset fic-w-outline-btn"
                onClick={() => setSheet({ type: 'chooseMain' })}
              >
                更换
              </button>
            </div>
          </div>
        ) : (
          <div className="fic-w-card is-empty">
            <div className="fic-w-card-empty-text">还没有主角色。</div>
            <div className="fic-w-card-actions">
              <button type="button" className="fic-btn-reset fic-w-outline-btn" onClick={openPicker}>
                导入已有角色
              </button>
              <button
                type="button"
                className="fic-btn-reset fic-w-outline-btn"
                onClick={() => openCustomMain(null)}
              >
                新建角色
              </button>
            </div>
          </div>
        )}
        <div className="fic-w-hint">主角色不是你，是故事里被跟随的那个人。</div>
      </section>

      {/* ---------- 导入已有角色 ---------- */}
      <section className="fic-w-field">
        <FieldLabel tag={`${imported.length} / ${MAX_IMPORTED}`}>导入已有角色</FieldLabel>

        {imported.length > 0 && (
          <ol className="fic-w-rows">
            {imported.map((item) => {
              const isMain = main?.source === 'imported' && main.importedId === item.localId;
              const edits = countImportedEdits(item);

              return (
                <li key={item.localId}>
                  <button
                    type="button"
                    className="fic-btn-reset fic-w-pick"
                    onClick={() => setSheet({ type: 'imported', localId: item.localId })}
                  >
                    <span className="fic-w-initial is-small">{initialOf(item.name)}</span>
                    <span className="fic-w-pick-text">
                      <span className="fic-w-pick-name">{item.name || '未命名角色'}</span>
                      <span className="fic-w-pick-sub">
                        {isMain ? '已设为主角色' : '以 NPC 身份登场'}
                        {edits > 0 ? ` · 已微调 ${edits} 处` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <button
          type="button"
          className="fic-btn-reset fic-w-add-btn"
          disabled={slots <= 0}
          onClick={openPicker}
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          {slots <= 0 ? `已导入 ${MAX_IMPORTED} 个` : '从聊天里导入角色'}
        </button>
        <div className="fic-w-hint">导入的是一份副本，在这里的微调不会改到聊天里的原角色。</div>
      </section>

      {/* ---------- 存档专属 NPC ---------- */}
      <section className="fic-w-field">
        <FieldLabel tag={`${npcs.length} / ${MAX_NPCS}`}>存档专属 NPC</FieldLabel>

        {npcs.length > 0 && (
          <ol className="fic-w-rows">
            {npcs.map((npc, index) => (
              <li key={npc.id}>
                <button type="button" className="fic-btn-reset fic-w-pick" onClick={() => openNpc(npc)}>
                  <span className="fic-w-roman">{ROMAN[index] || index + 1}</span>
                  <span className="fic-w-pick-text">
                    <span className="fic-w-pick-name">{npc.name}</span>
                    {npc.desc && <span className="fic-w-pick-sub">{npc.desc}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          className="fic-btn-reset fic-w-add-btn"
          disabled={npcs.length >= MAX_NPCS}
          onClick={() => openNpc(null)}
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          添加 NPC
        </button>
        <div className="fic-w-hint">只放一定要出场的人。剧情里 AI 会按需要自己引入新角色。</div>
      </section>

      {renderSheet()}
    </div>
  );
};

export default WizardStepCast;