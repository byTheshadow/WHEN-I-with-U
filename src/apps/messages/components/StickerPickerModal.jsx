import React, { useEffect, useState } from 'react';
import {
  Smile,
  Plus,
  Trash2,
  X,
  Check,
  Upload,
  List,
  AlertCircle,
} from 'lucide-react';
import {
  getAllStickers,
  addCustomSticker,
  batchAddCustomStickers,
  deleteSticker,
} from '../../../services/stickerService';

export const StickerPickerModal = ({ isOpen, onClose, onSelectSticker }) => {
  const [stickers, setStickers] = useState([]);

  // 'list' | 'add' | 'batch'
  const [tab, setTab] = useState('list');

  // 单个添加
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 批量导入
  const [batchText, setBatchText] = useState('');
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadStickers();
      setTab('list');
      setBatchResult(null);
    }
  }, [isOpen]);

  const loadStickers = async () => {
    const list = await getAllStickers();
    setStickers(list);
  };

  const changeTab = (nextTab) => {
    setTab(nextTab);

    // 切换到批量页之外时清除结果提示
    if (nextTab !== 'batch') {
      setBatchResult(null);
    }
  };

  /**
   * 单个添加表情包
   */
  const handleAdd = async (event) => {
    event.preventDefault();

    if (!newName.trim() || !newUrl.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addCustomSticker(newName, newUrl);

      setNewName('');
      setNewUrl('');
      changeTab('list');

      await loadStickers();
    } catch (err) {
      console.error('Failed to add sticker:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 批量导入表情包
   */
  const handleBatchImport = async () => {
    if (!batchText.trim()) {
      setBatchResult({
        type: 'error',
        message: '请先粘贴需要导入的表情包内容。',
      });
      return;
    }

    setIsBatchImporting(true);
    setBatchResult(null);

    try {
      const result = await batchAddCustomStickers(batchText);

      setBatchResult({
        type: result.added.length > 0 ? 'success' : 'warning',
        ...result,
      });

      // 有成功导入的贴纸时，立即刷新选择器列表
      if (result.added.length > 0) {
        await loadStickers();
        setBatchText('');
      }
    } catch (err) {
      console.error('Failed to batch import stickers:', err);

      setBatchResult({
        type: 'error',
        message: err?.message || '批量导入失败，请稍后重试。',
      });
    } finally {
      setIsBatchImporting(false);
    }
  };

  /**
   * 删除自定义表情包
   */
  const handleDelete = async (event, id) => {
    event.stopPropagation();

    await deleteSticker(id);
    await loadStickers();
  };

  const renderTabButton = (targetTab, label, Icon) => {
    const isActive = tab === targetTab;

    return (
      <button
        type="button"
        onClick={() => changeTab(targetTab)}
        className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1"
        style={{
          backgroundColor: isActive
            ? 'var(--accent-color)'
            : 'var(--control-soft-bg)',
          color: isActive
            ? 'var(--accent-foreground)'
            : 'var(--text-main)',
        }}
      >
        <Icon className="w-3 h-3" />
        {label}
      </button>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div
        className="fixed inset-0 transition-opacity"
        style={{
          backgroundColor: 'var(--modal-overlay, rgba(0,0,0,0.4))',
        }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-5 shadow-2xl backdrop-blur-2xl transition-all space-y-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
          borderStyle: 'solid',
          color: 'var(--text-main)',
        }}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between pb-2 border-b"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center gap-2">
            <Smile
              className="w-4 h-4"
              style={{ color: 'var(--accent-color)' }}
            />
            <h3 className="font-bold text-xs">表情包库</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="关闭表情包库"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {renderTabButton('list', '表情库', List)}
          {renderTabButton('add', '添加', Plus)}
          {renderTabButton('batch', '批量导入', Upload)}
        </div>

        {/* 表情包列表 */}
        {tab === 'list' && (
          <div className="grid grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {stickers.length === 0 && (
              <div className="col-span-4 py-8 text-center text-xs opacity-50">
                暂无表情包
              </div>
            )}

            {stickers.map((sticker) => (
              <div
                key={sticker.id}
                onClick={() => {
                  onSelectSticker(sticker);
                  onClose();
                }}
                className="group relative flex flex-col items-center justify-center p-1.5 rounded-2xl cursor-pointer transition-all hover:scale-105 border border-transparent hover:border-[var(--card-border)]"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                }}
                title={sticker.name}
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  className="w-12 h-12 object-cover rounded-xl"
                  loading="lazy"
                />

                <span className="text-[9px] truncate w-full text-center mt-1 opacity-70">
                  {sticker.name}
                </span>

                {sticker.category === 'custom' && (
                  <button
                    type="button"
                    onClick={(event) => handleDelete(event, sticker.id)}
                    className="absolute -top-1 -right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-sub)',
                    }}
                    title="删除自定义表情"
                    aria-label={`删除表情包：${sticker.name}`}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 单个添加 */}
        {tab === 'add' && (
          <form onSubmit={handleAdd} className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] opacity-60 block mb-1">
                表情含义 / 名称（让 AI 能够感知情绪）
              </label>

              <input
                type="text"
                placeholder="例如：摸头安慰 / 傲娇生气"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="w-full p-2.5 rounded-xl text-xs outline-none border"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)',
                }}
                required
              />
            </div>

            <div>
              <label className="text-[10px] opacity-60 block mb-1">
                图片 URL 链接
              </label>

              <input
                type="url"
                placeholder="https://..."
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                className="w-full p-2.5 rounded-xl text-xs outline-none border"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)',
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
              }}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '保存中...' : '保存表情包'}</span>
            </button>
          </form>
        )}

        {/* 批量导入 */}
        {tab === 'batch' && (
          <div className="space-y-3 pt-1">
            <div
              className="rounded-xl p-2.5 text-[10px] leading-relaxed"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                color: 'var(--text-sub)',
              }}
            >
              <p className="font-bold mb-1" style={{ color: 'var(--text-main)' }}>
                推荐格式：每个表情占两行
              </p>

              <pre className="whitespace-pre-wrap font-sans opacity-80">
{`含义：开心
url：https://example.com/happy.gif

含义：摸摸头
url：https://example.com/pat.gif`}
              </pre>

              <p className="mt-1 opacity-70">
                也支持简写：<code>开心：https://example.com/happy.gif</code>
              </p>
            </div>

            <textarea
              rows={9}
              value={batchText}
              onChange={(event) => setBatchText(event.target.value)}
              disabled={isBatchImporting}
              placeholder={`含义：开心
url：https://example.com/happy.gif

含义：摸摸头
url：https://example.com/pat.gif`}
              className="w-full resize-y p-2.5 rounded-xl text-xs outline-none border leading-relaxed disabled:opacity-60"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)',
              }}
            />

            <button
              type="button"
              onClick={handleBatchImport}
              disabled={isBatchImporting || !batchText.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {isBatchImporting ? '正在导入...' : '开始批量导入'}
              </span>
            </button>

            {/* 导入成功 / 警告 */}
            {(batchResult?.type === 'success' ||
              batchResult?.type === 'warning') && (
              <div
                className="rounded-xl border p-2.5 text-[10px] leading-relaxed"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-sub)',
                }}
              >
                {batchResult.added?.length > 0 && (
                  <p style={{ color: 'var(--text-main)' }}>
                    已成功导入 <strong>{batchResult.added.length}</strong> 个表情包。
                  </p>
                )}

                {batchResult.added?.length === 0 && (
                  <p style={{ color: 'var(--text-main)' }}>
                    没有可导入的新表情包。
                  </p>
                )}

                {batchResult.skipped?.length > 0 && (
                  <p className="mt-1">
                    跳过 {batchResult.skipped.length} 个重复图片链接。
                  </p>
                )}

                {batchResult.invalidLines?.length > 0 && (
                  <p className="mt-1">
                    有 {batchResult.invalidLines.length} 行格式或链接无效。
                  </p>
                )}
              </div>
            )}

            {/* 导入失败 */}
            {batchResult?.type === 'error' && (
              <div
                className="rounded-xl border p-2.5 text-[10px] flex gap-1.5 items-start"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-sub)',
                }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{batchResult.message}</span>
              </div>
            )}

            {/* 无效行详细说明 */}
            {batchResult?.invalidLines?.length > 0 && (
              <details
                className="rounded-xl border p-2.5 text-[10px]"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <summary className="cursor-pointer opacity-70">
                  查看无效内容（{batchResult.invalidLines.length} 行）
                </summary>

                <ul className="mt-2 space-y-1.5 opacity-70">
                  {batchResult.invalidLines.map((item, index) => (
                    <li key={`${item.line}-${index}`}>
                      <span className="font-bold">第 {item.line} 行：</span>
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPickerModal;
