// src/apps/hub/hubPageLayouts/shared/useHubProfileData.js
//
// 资料卡（db.profile）和图片墙（db.pinnedGallery）的只读订阅，两个都是
// 头部版式用的同一份数据，所以新版式只读不写，换版式不会丢内容。
// 图片都是 base64 数据地址，取不到时对应字段是空字符串。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../../../db';

const PROFILE_ID = 'main';
const GALLERY_ID = 'main';

const EMPTY = {
  name: '',
  avatar: '',
  banner: '',
  galleryTitle: '',
  galleryCaption: '',
  photos: ['', '', ''],
};

const asImage = (value) => (typeof value === 'string' ? value : '');

const load = async () => {
  const [profile, gallery] = await Promise.all([
    db.profile.get(PROFILE_ID),
    db.pinnedGallery.get(GALLERY_ID),
  ]);

  const photos = Array.isArray(gallery?.photos)
    ? gallery.photos.slice(0, 3).map((photo) => asImage(photo?.url))
    : [];
  while (photos.length < 3) photos.push('');

  return {
    name: typeof profile?.name === 'string' ? profile.name : '',
    avatar: asImage(profile?.avatar),
    banner: asImage(profile?.banner),
    galleryTitle: typeof gallery?.title === 'string' ? gallery.title : '',
    galleryCaption: typeof gallery?.caption === 'string' ? gallery.caption : '',
    photos,
  };
};

export const useHubProfileData = () => {
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    const subscription = liveQuery(load).subscribe({
      next: (next) => setData(next || EMPTY),
      error: (error) => {
        console.warn('[HubProfile] 读取资料卡和图片墙失败：', error);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return data;
};

export default useHubProfileData;
