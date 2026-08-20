
// 图片转 Base64 Helper
export const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

// 本地存储空间估算
export const estimateStorageUsage = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
    const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
    return { usedMB, quotaMB };
  }
  return { usedMB: '未知', quotaMB: '未知' };
};

export default { convertFileToBase64, estimateStorageUsage };
