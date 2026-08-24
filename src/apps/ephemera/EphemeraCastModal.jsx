// src/apps/ephemera/EphemeraCastModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import EphemeraPreview from './EphemeraPreview';
import ephemeraService from './ephemeraService';
import { ephemeraAiService } from './ephemeraAiService';

const createDefaults = (templateType = 'ticket') => ({
  templateType,
  characterId: '',
  title: '',
  aiComment: '',
  content: {
    venue: 'THE EPHEMERA THEATRE',
    ticketNo: 'NO. 0017',
    ticketTitle: '',
    subtitle: 'A QUIET NIGHT, HELD TOGETHER',
    description: '',
    withName: '',
    dateText: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
    session: '23:17 — 04:08',
    admitText: 'ADMIT ONE',
    seat: 'R.04\nS.24',
    stubDetail: 'NIGHT\nSESSION\nARCHIVE',

    shopName: 'THE MIDNIGHT COUNTER',
    location: 'PRIVATE HOURS / ROOM OF TWO',
    receiptNo: 'RECEIPT 000127',
    receiptTitle: '',
    items: [
      { label: '深夜长谈', value: '120 MIN' },
      { label: '共同阅读', value: '01 BOOK' }
    ],
    totalLabel: 'TOTAL RETAINED',
    totalValue: 'ONE NIGHT',
    note: '这笔账无需结清。它会留在我们往后的夜里。',
    footer: '',

    archiveCode: 'ARCHIVE / EPH-026-081',
    status: 'FILED',
    ledgerTitle: '',
    dateTime: '',
    subject: '',
    atmosphere: '微雨，安静，灯光偏暗',
    category: 'PRIVATE RECORD / 01',
    memo: '',
    filedText: '',

    quote: '我只愿倾听你的潮汐。',
    bookmarkTitle: '',
    bookmarkMeta: '',
    backDate: ''
  }
});

const TextField = ({ label, value, onChange, multiline = false, placeholder = '' }) => {
  const Component = multiline ? 'textarea' : 'input';

  return (
    <label className="ep-form-field">
      <span>{label}</span>
      <Component
        type={multiline ? undefined : 'text'}
        value={value || ''}
        placeholder={placeholder}
        rows={multiline ? 4 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
};

export const EphemeraCastModal = ({
  editingItem,
  characters = [],
  onClose,
  onSaved
}) => {
  const [form, setForm] = useState(() => createDefaults());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (editingItem) {
      setForm({
        ...createDefaults(editingItem.templateType),
        ...editingItem,
        content: {
          ...createDefaults(editingItem.templateType).content,
          ...(editingItem.content || {})
        }
      });
      return;
    }

    const initial = createDefaults('ticket');

    if (characters[0]?.id) {
      initial.characterId = characters[0].id;
      initial.content.withName = characters[0].name || '';
      initial.content.subject = characters[0].name || '';
    }

    setForm(initial);
  }, [editingItem, characters]);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === Number(form.characterId)),
    [characters, form.characterId]
  );

  const characterName = selectedCharacter?.name || form.content.withName || '守护人';

  const updateContent = (key, value) => {
    setForm((previous) => ({
      ...previous,
      content: {
        ...previous.content,
        [key]: value
      }
    }));
  };

  const changeTemplate = (templateType) => {
    setForm((previous) => ({
      ...previous,
      templateType
    }));
  };

  const updateReceiptItem = (index, key, value) => {
    setForm((previous) => {
      const items = [...previous.content.items];
      items[index] = { ...items[index], [key]: value };

      return {
        ...previous,
        content: {
          ...previous.content,
          items
        }
      };
    });
  };

  const addReceiptItem = () => {
    setForm((previous) => ({
      ...previous,
      content: {
        ...previous.content,
        items: [...previous.content.items, { label: '新的片段', value: '—' }]
      }
    }));
  };

  const removeReceiptItem = (index) => {
    setForm((previous) => ({
      ...previous,
      content: {
        ...previous.content,
        items: previous.content.items.filter((_, itemIndex) => itemIndex !== index)
      }
    }));
  };

  const handleCharacterChange = (value) => {
    const nextCharacter = characters.find((character) => character.id === Number(value));

    setForm((previous) => ({
      ...previous,
      characterId: value ? Number(value) : '',
      content: {
        ...previous.content,
        withName: previous.content.withName || nextCharacter?.name || '',
        subject: previous.content.subject || nextCharacter?.name || ''
      }
    }));
  };

  const handleGenerate = async () => {
    const details =
      form.content.description ||
      form.content.memo ||
      form.content.quote ||
      form.content.note ||
      form.title;

    if (!form.title.trim() && !details.trim()) {
      setErrorText('请至少填写事件标题或一段时光记录，再生成寄语。');
      return;
    }

    setErrorText('');
    setIsGenerating(true);

    try {
      const comment = await ephemeraAiService.generateAiComment(
        form.templateType,
        characterName,
        form.title || form.content.ticketTitle || form.content.ledgerTitle,
        details
      );

      setForm((previous) => ({
        ...previous,
        aiComment: comment
      }));
    } catch (error) {
      console.error('生成时光寄语失败：', error);
      setErrorText('寄语生成暂时不可用，但你仍可手动写下寄语并保存票券。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    const resolvedTitle =
      form.title ||
      form.content.ticketTitle ||
      form.content.receiptTitle ||
      form.content.ledgerTitle ||
      form.content.bookmarkTitle ||
      '未命名时光';

    setIsSaving(true);
    setErrorText('');

    try {
      await ephemeraService.save({
        id: form.id,
        templateType: form.templateType,
        characterId: form.characterId ? Number(form.characterId) : null,
        title: resolvedTitle,
        content: form.content,
        aiComment: form.aiComment,
        createdAt: form.createdAt || Date.now(),
        updatedAt: Date.now()
      });

      await onSaved();
    } catch (error) {
      console.error('保存时光票券失败：', error);
      setErrorText('票券未能保存，请稍后重试。');
    } finally {
      setIsSaving(false);
    }
  };

  const previewItem = {
    ...form,
    title:
      form.title ||
      form.content.ticketTitle ||
      form.content.receiptTitle ||
      form.content.ledgerTitle ||
      form.content.bookmarkTitle ||
      '未命名时光'
  };

  return (
    <div className="ep-modal-layer">
      <button
        type="button"
        aria-label="关闭编辑器"
        className="ep-modal-backdrop"
        onClick={onClose}
      />

      <section className="ep-cast-modal">
        <header className="ep-cast-head">
          <div>
            <span>THE EPHEMERA PRESS</span>
            <h3>{editingItem ? '修订这张票券' : '印铸新的时光'}</h3>
          </div>

          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="ep-cast-scroll">
          <section className="ep-live-preview">
            <span>LIVE TYPESETTING</span>
            <EphemeraPreview item={previewItem} characterName={characterName} />
          </section>

          <section className="ep-form-section">
            <div className="ep-template-picker">
              {[
                ['ticket', '戏剧票'],
                ['receipt', '生活小票'],
                ['table', '旧账册'],
                ['bookmark', '文学书签']
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={form.templateType === id ? 'is-active' : ''}
                  onClick={() => changeTemplate(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <TextField
              label="票券名称 / 仅用于归档"
              value={form.title}
              onChange={(value) => setForm((previous) => ({ ...previous, title: value }))}
              placeholder="例如：共同熬过的一个深夜"
            />

            <label className="ep-form-field">
              <span>共同见证的角色</span>
              <select value={form.characterId || ''} onChange={(event) => handleCharacterChange(event.target.value)}>
                {characters.length === 0 && <option value="">默认伴侣</option>}
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>

            {form.templateType === 'ticket' && (
              <section className="ep-template-fields">
                <TextField label="剧场名称" value={form.content.venue} onChange={(value) => updateContent('venue', value)} />
                <TextField label="票券编号" value={form.content.ticketNo} onChange={(value) => updateContent('ticketNo', value)} />
                <TextField label="票面标题" value={form.content.ticketTitle} onChange={(value) => updateContent('ticketTitle', value)} />
                <TextField label="英文副标题" value={form.content.subtitle} onChange={(value) => updateContent('subtitle', value)} />
                <TextField label="事件说明" multiline value={form.content.description} onChange={(value) => updateContent('description', value)} />
                <TextField label="共同人物" value={form.content.withName} onChange={(value) => updateContent('withName', value)} />
                <TextField label="日期文字" value={form.content.dateText} onChange={(value) => updateContent('dateText', value)} />
                <TextField label="场次时间" value={form.content.session} onChange={(value) => updateContent('session', value)} />
                <TextField label="入场文字" value={form.content.admitText} onChange={(value) => updateContent('admitText', value)} />
                <TextField label="座位编号" multiline value={form.content.seat} onChange={(value) => updateContent('seat', value)} />
                <TextField label="副券说明" multiline value={form.content.stubDetail} onChange={(value) => updateContent('stubDetail', value)} />
              </section>
            )}

            {form.templateType === 'receipt' && (
              <section className="ep-template-fields">
                <TextField label="小票抬头" value={form.content.shopName} onChange={(value) => updateContent('shopName', value)} />
                <TextField label="地址/副标题" value={form.content.location} onChange={(value) => updateContent('location', value)} />
                <TextField label="小票编号" value={form.content.receiptNo} onChange={(value) => updateContent('receiptNo', value)} />
                <TextField label="日期文字" value={form.content.dateText} onChange={(value) => updateContent('dateText', value)} />
                <TextField label="小票标题" value={form.content.receiptTitle} onChange={(value) => updateContent('receiptTitle', value)} />

                <div className="ep-receipt-editor">
                  <span>小票明细</span>

                  {form.content.items.map((row, index) => (
                    <div className="ep-receipt-editor-row" key={index}>
                      <input
                        value={row.label}
                        onChange={(event) => updateReceiptItem(index, 'label', event.target.value)}
                        placeholder="项目名称"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateReceiptItem(index, 'value', event.target.value)}
                        placeholder="数值"
                      />
                      <button type="button" onClick={() => removeReceiptItem(index)}>
                        移除
                      </button>
                    </div>
                  ))}

                  <button type="button" className="ep-text-action" onClick={addReceiptItem}>
                    新增一行
                  </button>
                </div>

                <TextField label="汇总标签" value={form.content.totalLabel} onChange={(value) => updateContent('totalLabel', value)} />
                <TextField label="汇总内容" value={form.content.totalValue} onChange={(value) => updateContent('totalValue', value)} />
                <TextField label="底部手写短句" multiline value={form.content.note} onChange={(value) => updateContent('note', value)} />
                <TextField label="底部落款" value={form.content.footer} onChange={(value) => updateContent('footer', value)} />
              </section>
            )}

            {form.templateType === 'table' && (
              <section className="ep-template-fields">
                <TextField label="档案编号" value={form.content.archiveCode} onChange={(value) => updateContent('archiveCode', value)} />
                <TextField label="归档状态" value={form.content.status} onChange={(value) => updateContent('status', value)} />
                <TextField label="档案标题" value={form.content.ledgerTitle} onChange={(value) => updateContent('ledgerTitle', value)} />
                <TextField label="时间记录" multiline value={form.content.dateTime} onChange={(value) => updateContent('dateTime', value)} />
                <TextField label="观察对象" value={form.content.subject} onChange={(value) => updateContent('subject', value)} />
                <TextField label="环境记录" value={form.content.atmosphere} onChange={(value) => updateContent('atmosphere', value)} />
                <TextField label="分类文字" value={form.content.category} onChange={(value) => updateContent('category', value)} />
                <TextField label="档案手记" multiline value={form.content.memo} onChange={(value) => updateContent('memo', value)} />
                <TextField label="页脚左侧" value={form.content.footer} onChange={(value) => updateContent('footer', value)} />
                <TextField label="页脚右侧" value={form.content.filedText} onChange={(value) => updateContent('filedText', value)} />
              </section>
            )}

            {form.templateType === 'bookmark' && (
              <section className="ep-template-fields">
                <TextField label="书签正文" multiline value={form.content.quote} onChange={(value) => updateContent('quote', value)} />
                <TextField label="书签标题" value={form.content.bookmarkTitle} onChange={(value) => updateContent('bookmarkTitle', value)} />
                <TextField label="书签页脚" value={form.content.bookmarkMeta} onChange={(value) => updateContent('bookmarkMeta', value)} />
              </section>
            )}

            <section className="ep-ai-section">
              <div>
                <span>背面寄语 / 可手动编辑</span>
                <button type="button" onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? <LoaderCircle size={14} className="ep-spin" /> : <Sparkles size={14} />}
                  {isGenerating ? '正在印写' : '生成或重写'}
                </button>
              </div>

              <textarea
                rows="4"
                value={form.aiComment}
                placeholder="角色会在这里留下寄语。你也可以不调用 AI，直接写下想保留的文字。"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    aiComment: event.target.value
                  }))
                }
              />

              <TextField
                label="寄语背面日期"
                value={form.content.backDate}
                onChange={(value) => updateContent('backDate', value)}
              />
            </section>

            {errorText && <p className="ep-form-error">{errorText}</p>}
          </section>
        </div>

        <footer className="ep-cast-foot">
          <button type="button" onClick={onClose}>
            取消
          </button>

          <button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <LoaderCircle size={15} className="ep-spin" /> : <Save size={15} />}
            {editingItem ? '保存修订' : '收入票夹'}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default EphemeraCastModal;
