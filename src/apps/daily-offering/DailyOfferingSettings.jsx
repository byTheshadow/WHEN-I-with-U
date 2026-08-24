import React, { useEffect, useRef, useState } from 'react';
import {
  ImagePlus,
  Images,
  MailOpen,
  Trash2,
  Upload
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import {
  addDailyOfferingImage,
  compressLocalImage,
  deleteDailyOfferingImage,
  getDailyOfferingConfig,
  getDailyOfferingImages,
  getOfferingCharacters,
  saveDailyOfferingConfig
} from './dailyOfferingService';

export const DailyOfferingSettings = () => {
  const uploadInputRef = useRef(null);

  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [images, setImages] = useState([]);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sourceType, setSourceType] = useState('url');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompressing, setIsCompressing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const refreshData = async () => {
    const [config, nextCharacters, nextImages] = await Promise.all([
      getDailyOfferingConfig(),
      getOfferingCharacters(),
      getDailyOfferingImages()
    ]);

    setSelectedCharacterId(
      config.characterId === null || config.characterId === undefined
        ? ''
        : String(config.characterId)
    );
    setCharacters(nextCharacters);
    setImages(nextImages);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await refreshData();
      } catch (error) {
        console.error('Unable to load daily offering settings:', error);
        triggerGlobalToast({
          title: '今日留物',
          content: '设置暂时无法读取，请稍后再试。',
          duration: 4000
        });
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const handleCharacterChange = async (event) => {
    const nextValue = event.target.value;
    const characterId = nextValue ? Number(nextValue) : null;

    setSelectedCharacterId(nextValue);

    try {
      await saveDailyOfferingConfig({ characterId });

      triggerGlobalToast({
        title: '今日留物',
        content: characterId ? '署名角色已更新，明天开始生效。' : '今日留物已暂时停用。',
        duration: 3600
      });
    } catch (error) {
      console.error('Unable to save daily offering character:', error);
      triggerGlobalToast({
        title: '今日留物',
        content: '角色设置未能保存。',
        duration: 4000
      });
    }
  };

  const handleLocalImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setIsCompressing(true);

    try {
      const compressedDataUrl = await compressLocalImage(file);
      setImageUrl(compressedDataUrl);
      setSourceType('local');

      if (!description.trim()) {
        setDescription(file.name.replace(/\.[^.]+$/, '').slice(0, 180));
      }

      triggerGlobalToast({
        title: '图片已准备好',
        content: '本地图片已压缩，补充描述后即可放入图片盒。',
        duration: 3600
      });
    } catch (error) {
      triggerGlobalToast({
        title: '图片处理失败',
        content: error?.message || '请重新选择图片。',
        duration: 4000
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleAddImage = async () => {
    try {
      await addDailyOfferingImage({
        description,
        url: imageUrl,
        sourceType
      });

      setDescription('');
      setImageUrl('');
      setSourceType('url');

      await refreshData();

      triggerGlobalToast({
        title: '已放入图片盒',
        content: '角色之后可以从这张画面中挑选今日留物。',
        duration: 3600
      });
    } catch (error) {
      triggerGlobalToast({
        title: '暂时无法加入',
        content: error?.message || '请检查图片信息。',
        duration: 4000
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete?.id) return;

    try {
      await deleteDailyOfferingImage(pendingDelete.id);
      setPendingDelete(null);
      await refreshData();

      triggerGlobalToast({
        title: '图片已移出',
        content: '它不会再被用于之后的今日留物。',
        duration: 3600
      });
    } catch (error) {
      triggerGlobalToast({
        title: '删除失败',
        content: '图片暂时未能移出图片盒。',
        duration: 4000
      });
    }
  };

  return (
    <>
      <GlassCard className="daily-offering-settings space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <MailOpen className="h-4 w-4" strokeWidth={1.6} />
          <span>今日留物</span>
        </div>

        <p className="text-xs leading-5 opacity-60">
          每天首次进入主页时，由一位角色留下一段旋律或一张画面。
          它不会被收藏，也没有回看入口。
        </p>

        <div className="space-y-1.5">
          <label className="text-[11px] opacity-60">为这封信署名</label>

          <select
            value={selectedCharacterId}
            onChange={handleCharacterChange}
            disabled={isLoading}
            className="daily-offering-settings__field"
          >
            <option value="">暂不设置角色</option>

            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name || '未命名角色'}
              </option>
            ))}
          </select>
        </div>

        {characters.length === 0 && !isLoading && (
          <p className="daily-offering-settings__hint">
            目前还没有可署名的角色。创建角色后，这里会出现选择项。
          </p>
        )}

        <div className="daily-offering-settings__divider" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Images className="h-4 w-4" strokeWidth={1.6} />
            <span>私人图片盒</span>
          </div>

          <span className="text-[11px] opacity-50">{images.length} / 20</span>
        </div>

        <p className="text-xs leading-5 opacity-60">
          可以填写图片描述与 URL，也可以上传本地图片。上传后会自动压缩并保存在当前设备。
        </p>

        {images.length < 20 && (
          <div className="space-y-2.5">
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={180}
              placeholder="这张画面留给你的描述……"
              className="daily-offering-settings__field"
            />

            <input
              value={sourceType === 'url' ? imageUrl : ''}
              onChange={(event) => {
                setImageUrl(event.target.value);
                setSourceType('url');
              }}
              placeholder="https://example.com/image.jpg"
              className="daily-offering-settings__field"
            />

            {imageUrl && sourceType === 'local' && (
              <div className="daily-offering-settings__local-ready">
                <span>本地图片已压缩，等待放入图片盒。</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isCompressing}
                className="daily-offering-settings__soft-button"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{isCompressing ? '正在压缩' : '上传本地图片'}</span>
              </button>

              <button
                type="button"
                onClick={handleAddImage}
                disabled={isCompressing || !description.trim() || !imageUrl.trim()}
                className="daily-offering-settings__solid-button"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>放入图片盒</span>
              </button>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLocalImageSelect}
            />
          </div>
        )}

        {images.length === 0 ? (
          <p className="daily-offering-settings__hint">
            图片盒暂时是空的。角色仍可以带来一张开放图片库中的风景。
          </p>
        ) : (
          <div className="daily-offering-settings__image-list">
            {images.map((image) => (
              <article key={image.id} className="daily-offering-settings__image-item">
                <img src={image.url} alt="" />

                <p>{image.description}</p>

                <button
                  type="button"
                  onClick={() => setPendingDelete(image)}
                  aria-label={`移出图片：${image.description}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </article>
            ))}
          </div>
        )}
      </GlassCard>

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="移出图片盒"
        message="这张图片不会再被角色用于之后的今日留物。此操作无法撤销。"
        confirmText="确认移出"
        cancelText="保留"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
};

export default DailyOfferingSettings;
