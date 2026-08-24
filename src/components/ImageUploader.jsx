import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { compressImageFile } from '../utils/imageHelper'; // 请确保路径正确

/**
 * 通用图片上传压缩组件
 * 
 * @param {Function} onCompressedImage 压缩完成后的回调函数，参数为 compressedBase64 或 Blob
 * @param {string} label 上传框提示文案
 * @param {Object} compressOptions 压缩配置选项
 */
export const ImageUploader = ({ 
  onCompressedImage, 
  label = "选择并上传图片", 
  compressOptions = { maxWidth: 800, maxHeight: 800, quality: 0.75, outputType: 'base64' } 
}) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // 1. 调用压缩核心逻辑
      const compressedData = await compressImageFile(file, compressOptions);
      
      // 2. 将压缩后的数据传回父组件
      onCompressedImage(compressedData);
    } catch (error) {
      console.error("图片压缩失败:", error);
      alert("图片处理出错，请重试");
    } finally {
      setLoading(false);
      // 清空 input 确保同一个文件可以重复选择触发 change
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="compressed-image-input"
      />
      <label
        htmlFor="compressed-image-input"
        className="flex flex-col items-center justify-center w-full h-24 border border-dashed rounded-2xl cursor-pointer hover:bg-black/5 transition-all p-4 text-center"
        style={{
          borderColor: 'var(--card-border, rgba(0,0,0,0.12))',
          backgroundColor: 'var(--control-soft-bg, transparent)'
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-1.5 text-xs opacity-70">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>正在极限压缩图片...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-xs opacity-70">
            <ImageIcon className="w-5 h-5" />
            <span>{label}</span>
            <span className="text-[10px] opacity-50">(自动无损尺寸缩放，极速加载)</span>
          </div>
        )}
      </label>
    </div>
  );
};

export default ImageUploader;
