// src/apps/ephemera/EphemeraCastModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, RotateCw } from 'lucide-react';
import { ephemeraService } from './ephemeraService';
import { ephemeraAiService } from './ephemeraAiService';
import GlassCard from '../../components/GlassCard';

export const EphemeraCastModal = ({ onClose, onFinished, editingItem, characters }) => {
  const [templateType, setTemplateType] = useState('ticket'); // 'ticket' | 'receipt' | 'table' | 'bookmark'
  const [characterId, setCharacterId] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  
  // 电影票专属
  const [seatNo, setSeatNo] = useState('ROW 01 / SEAT 01');
  const [category, setCategory] = useState('LATE NIGHT');

  // 收据专属 (Items 解析为数组)
  const [itemsRaw, setItemsRaw] = useState(
    "深夜长谈 : 120分钟\n共同阅读 : 1本书\n情绪温度 : +100%"
  );

  // 表格专属
  const [weather, setWeather] = useState('Fine');

  // 书签专属
  const [quote, setQuote] = useState('我只愿倾听你的潮汐。');

  // AI 悄悄话生成状态
  const [aiComment, setAiComment] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewFlipped, setPreviewFlipped] = useState(false);

  // 编辑态回填
  useEffect(() => {
    if (editingItem) {
      setTemplateType(editingItem.templateType);
      setCharacterId(editingItem.characterId || '');
      setTitle(editingItem.title);
      setDetails(editingItem.content?.details || '');
      setAiComment(editingItem.aiComment || '');

      if (editingItem.templateType === 'ticket') {
        setSeatNo(editingItem.content?.seatNo || 'ROW 01 / SEAT 01');
        setCategory(editingItem.content?.category || 'LATE NIGHT');
      } else if (editingItem.templateType === 'receipt') {
        const rows = editingItem.content?.items || [];
        const rawStr = rows.map((r) => `${r.label} : ${r.value}`).join('\n');
        setItemsRaw(rawStr);
      } else if (editingItem.templateType === 'table') {
        setWeather(editingItem.content?.weather || 'Fine');
      } else if (editingItem.templateType === 'bookmark') {
        setQuote(editingItem.content?.quote || '我只愿倾听你的潮汐。');
      }
    } else {
      // 默认选择第一个角色
      if (characters && characters.length > 0) {
        setCharacterId(characters[0].id);
      }
    }
  }, [editingItem, characters]);

  // 解析小票条目
  const parseItems = (raw) => {
    return raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split(':');
        return {
          label: parts[0]?.trim() || '时光片段',
          value: parts[1]?.trim() || '封存'
        };
      });
  };

  const getActiveCharName = () => {
    const char = characters.find((c) => c.id === Number(characterId));
    return char ? char.name : '守护人';
  };

  // 请求独立 AI 生成寄语
  const triggerAiGeneration = async () => {
    if (!title || !details) {
      alert('请先填写事件主题和时光详情，以便 AI 生成寄语');
      return;
    }
    setIsGenerating(true);
    setPreviewFlipped(true); // 翻面预览以展示生成状态
    
    const charName = getActiveCharName();
    const result = await ephemeraAiService.generateAiComment(
      templateType,
      charName,
      title,
      details
    );
    
    setAiComment(result);
    setIsGenerating(false);
  };

  const handleSave = async () => {
    if (!title) {
      alert('请填写事件标题');
      return;
    }

    const contentObj = { details };

    if (templateType === 'ticket') {
      contentObj.seatNo = seatNo;
      contentObj.category = category;
    } else if (templateType === 'receipt') {
      contentObj.items = parseItems(itemsRaw);
    } else if (templateType === 'table') {
      contentObj.weather = weather;
    } else if (templateType === 'bookmark') {
      contentObj.quote = quote;
    }

    const payload = {
      id: editingItem ? editingItem.id : undefined,
      templateType,
      characterId: Number(characterId),
      title,
      content: contentObj,
      aiComment: aiComment || `[${getActiveCharName()}]：「风将这一页吹过，但石子留下了温度。」`,
      createdAt: editingItem ? editingItem.createdAt : Date.now()
    };

    try {
      await ephemeraService.saveEphemera(payload);
      onFinished();
    } catch (e) {
      alert('铸造失败，请检查数据结构');
    }
  };

  const charName = getActiveCharName();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-overlay)] backdrop-blur-sm">
      <div
        className="w-full max-w-[400px] max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-y-auto animate-scale-up"
        style={{
          backgroundColor: 'var(--modal-bg)',
          borderColor: 'var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="font-serif text-sm font-bold">印铸记忆票券</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--control-soft-bg)] transition-colors"
          >
            <X className="h-4 w-4 opacity-60" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          
          {/* 实时排版预览区域 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] uppercase tracking-widest opacity-40 font-semibold">Live Preview</span>
              <button
                type="button"
                onClick={() => setPreviewFlipped(!previewFlipped)}
                className="text-[10px] flex items-center gap-1 font-semibold text-[var(--accent-color)] opacity-70 hover:opacity-100 transition-opacity"
              >
                <RotateCw className="h-3 w-3" />
                <span>{previewFlipped ? '查看正面' : '查看背面'}</span>
              </button>
            </div>

            {/* 3D Container inside Cast Modal */}
            <div className="ephemera-perspective w-full h-[290px]">
              <div className={`ephemera-card-inner ${previewFlipped ? 'is-flipped' : ''}`}>
                {/* PREVIEW FRONT */}
                <div className="ephemera-card-front flex flex-col justify-between p-5 border text-left">
                  {templateType === 'ticket' && (
                    <div className="h-full flex flex-col justify-between relative">
                      <div className="ticket-notch-left" />
                      <div className="ticket-notch-right" />
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] uppercase tracking-widest opacity-40">Admit One</span>
                        <span className="text-[9px] font-mono opacity-50">2026/08/24</span>
                      </div>
                      <div className="my-3 text-center">
                        <h4 className="text-base font-serif font-bold tracking-tight mb-1 line-clamp-1">
                          {title || '未命名时光'}
                        </h4>
                        <p className="text-[10px] text-[var(--text-sub)] italic line-clamp-2 px-2">
                          {details || '在这里落笔描写共同度过的时刻...'}
                        </p>
                      </div>
                      <div className="border-t border-dashed my-1.5 opacity-50" style={{ borderColor: 'var(--card-border)' }} />
                      <div className="flex items-center justify-between text-[10px]">
                        <div>
                          <span className="block text-[7px] uppercase tracking-wider opacity-40">With</span>
                          <span className="font-serif font-bold text-[var(--text-sub)]">{charName}</span>
                        </div>
                        <div className="px-1.5 py-0.5 border rounded border-[var(--card-border)] bg-[var(--bg-surface)] font-mono text-[8px]">
                          {seatNo || 'ROW 01 / SEAT 01'}
                        </div>
                        <div className="text-right">
                          <span className="block text-[7px] uppercase tracking-wider opacity-40">Class</span>
                          <span className="font-mono text-[8px] uppercase">{category || 'LATE NIGHT'}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-center items-center gap-0.5 opacity-80">
                        {[...Array(20)].map((_, i) => (
                          <span
                            key={i}
                            className="ticket-barcode-line"
                            style={{
                              width: i % 3 === 0 ? '3px' : '1px',
                              height: '18px',
                              marginRight: '1px'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {templateType === 'receipt' && (
                    <div className="h-full flex flex-col justify-between receipt-paper relative pt-4 pb-2 px-2">
                      <div className="text-center font-mono space-y-1">
                        <h4 className="text-xs font-bold tracking-wide">{title || '日常账目'}</h4>
                        <p className="text-[8px] opacity-40">2026/08/24 23:15</p>
                      </div>
                      <div className="font-mono text-[9px] my-2 space-y-1 opacity-80 border-t border-b border-dashed py-2" style={{ borderColor: 'var(--card-border)' }}>
                        {parseItems(itemsRaw).map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.label}</span>
                            <span>{item.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-center pb-1">
                        <p className="text-[8px] font-mono tracking-tighter opacity-60">
                          GUARDIAN: {charName.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  )}

                  {templateType === 'table' && (
                    <div className="h-full flex flex-col justify-between ledger-double-border p-3 relative">
                      <div className="absolute right-2 top-2 px-2 py-1 vintage-stamp text-[9px] font-bold border-2">
                        RECORDED
                      </div>
                      <div className="space-y-2.5">
                        <div className="border-b pb-1" style={{ borderColor: 'var(--card-border)' }}>
                          <span className="text-[8px] font-serif uppercase tracking-widest opacity-40 block">Time & Date</span>
                          <span className="text-[10px] font-mono">2026/08/24 23:15</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] border-b pb-1" style={{ borderColor: 'var(--card-border)' }}>
                          <div>
                            <span className="text-[8px] font-serif uppercase tracking-widest opacity-40 block">Subject</span>
                            <span>{charName}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-serif uppercase tracking-widest opacity-40 block">Atmosphere</span>
                            <span className="font-mono">{weather || 'Fine'}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[8px] font-serif uppercase tracking-widest opacity-40 block mb-0.5">Memorandum</span>
                          <p className="text-[10px] leading-relaxed text-[var(--text-sub)] font-serif italic line-clamp-2">
                            {details || '落笔于此的记忆详情...'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-[8px] opacity-40 uppercase tracking-widest">
                        {title || 'MEMORANDUM'}
                      </div>
                    </div>
                  )}

                  {templateType === 'bookmark' && (
                    <div className="h-full flex flex-col justify-between items-center py-2 px-4 relative">
                      <div className="w-full">
                        <div className="bookmark-hole" />
                        <div className="bookmark-tassel" />
                      </div>
                      <div className="text-center my-auto py-1">
                        <p className="ephemera-serif text-base font-bold leading-relaxed px-1 italic">
                          “ {quote || '我只愿倾听你的潮汐。'} ”
                        </p>
                      </div>
                      <div className="w-full text-center space-y-0.5 border-t pt-1.5" style={{ borderColor: 'var(--card-border)' }}>
                        <h4 className="text-[10px] font-serif font-bold">{title || '时光标签'}</h4>
                        <p className="text-[8px] opacity-40 font-mono">
                          {charName} &nbsp;|&nbsp; 2026/08/24
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* PREVIEW BACK */}
                <div className="ephemera-card-back flex flex-col justify-between p-6 border text-left">
                  <div className="flex justify-between items-start border-b pb-2" style={{ borderColor: 'var(--card-border)' }}>
                    <span className="text-[8px] font-serif uppercase tracking-widest opacity-40">时光寄语</span>
                    <span className="text-[8px] font-serif italic opacity-40">{charName} 的手抄笔迹</span>
                  </div>

                  <div className="my-auto py-2">
                    {isGenerating ? (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] italic">
                        <span>正在凝集时光笔迹</span>
                        <div className="flex gap-0.5">
                          <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                          <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                          <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                        </div>
                      </div>
                    ) : (
                      <p className="ephemera-serif text-xs leading-relaxed text-[var(--text-sub)] italic">
                        {aiComment || '暂无寄语。可在下方请求守护人实时在票卡背面为你手写留存悄悄话。'}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-end border-t pt-2 text-[8px] opacity-40 font-mono" style={{ borderColor: 'var(--card-border)' }}>
                    <span>DRAFT</span>
                    <span>2026/08/24</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 表单输入控件 */}
          <div className="space-y-4 text-xs">
            
            {/* 模板选择 */}
            <div className="space-y-1.5">
              <label className="block font-medium opacity-70">票券版面类型</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'ticket', name: '戏剧票' },
                  { id: 'receipt', name: '收据单' },
                  { id: 'table', name: '旧账册' },
                  { id: 'bookmark', name: '书签' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTemplateType(t.id);
                      setPreviewFlipped(false);
                    }}
                    className={`py-1.5 px-1 rounded-xl border text-center transition-all ${
                      templateType === t.id
                        ? 'border-[var(--accent-color)] bg-[var(--control-soft-bg)] font-bold'
                        : 'border-[var(--card-border)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 角色绑定选择 */}
            <div className="space-y-1.5">
              <label className="block font-medium opacity-70">绑定见证角色</label>
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)]"
                style={{ borderColor: 'var(--card-border)' }}
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {characters.length === 0 && <option value="">默认伴侣</option>}
              </select>
            </div>

            {/* 核心公共标题 */}
            <div className="space-y-1.5">
              <label className="block font-medium opacity-70">事件主题名称</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：共同度过的一个深夜、共读那一首诗"
                className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)]"
                style={{ borderColor: 'var(--card-border)' }}
                maxLength={24}
              />
            </div>

            {/* 版式专属配置项 */}
            {templateType === 'ticket' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-medium opacity-70">座位席号</label>
                  <input
                    type="text"
                    value={seatNo}
                    onChange={(e) => setSeatNo(e.target.value)}
                    placeholder="ROW 03 / SEAT 24"
                    className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)] font-mono text-[10px]"
                    style={{ borderColor: 'var(--card-border)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-medium opacity-70">场次分类</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="LATE NIGHT"
                    className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)] font-mono text-[10px]"
                    style={{ borderColor: 'var(--card-border)' }}
                  />
                </div>
              </div>
            )}

            {templateType === 'receipt' && (
              <div className="space-y-1.5">
                <label className="block font-medium opacity-70">明细项目 (格式为 标签:数值，每行一条)</label>
                <textarea
                  value={itemsRaw}
                  onChange={(e) => setItemsRaw(e.target.value)}
                  placeholder="例如：&#13;深夜倾听 : 120分钟&#13;共同阅读 : 1本书"
                  className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)] font-mono text-[10px]"
                  style={{ borderColor: 'var(--card-border)' }}
                  rows={4}
                />
              </div>
            )}

            {templateType === 'table' && (
              <div className="space-y-1.5">
                <label className="block font-medium opacity-70">天气与物理环境描述</label>
                <input
                  type="text"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  placeholder="Rainy / Fine / Foggy"
                  className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)]"
                  style={{ borderColor: 'var(--card-border)' }}
                />
              </div>
            )}

            {templateType === 'bookmark' && (
              <div className="space-y-1.5">
                <label className="block font-medium opacity-70">书签金句/语录印文</label>
                <input
                  type="text"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="印刻在书签正面的文学语句"
                  className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)] font-serif"
                  style={{ borderColor: 'var(--card-border)' }}
                />
              </div>
            )}

            {/* 时光详情 */}
            <div className="space-y-1.5">
              <label className="block font-medium opacity-70">时光片段手记 / 时光详情</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="在此写下你们共同经历了什么，情绪如何，这会作为生成 AI 寄语的参照依据..."
                className="w-full p-2.5 rounded-xl border outline-none bg-[var(--card-bg)]"
                style={{ borderColor: 'var(--card-border)' }}
                rows={3}
                maxLength={300}
              />
            </div>

            {/* 手写笔迹生成入口 */}
            <div className="pt-2">
              <button
                type="button"
                onClick={triggerAiGeneration}
                disabled={isGenerating}
                className="w-full py-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]"
                style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
              >
                <Sparkles className="h-4 w-4" />
                <span>{isGenerating ? '正在印写寄语...' : '生成/重刷 AI 悄悄话笔迹'}</span>
              </button>
            </div>
            
            <div className="flex items-start gap-1.5 text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] p-2.5 rounded-xl leading-relaxed">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                悄悄话是 AI 角色针对该时光手手写留存的背面见证。保存前请先生成；如未生成或 API 欠费，将默认使用系统降级配赠的温情小语。
              </span>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--card-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-[var(--bg-surface)]"
            style={{ borderColor: 'var(--card-border)' }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold rounded-xl text-[var(--accent-foreground)] bg-[var(--accent-color)]"
          >
            铸造时光
          </button>
        </div>
      </div>
    </div>
  );
};

export default EphemeraCastModal;
