// src/apps/pebbling/pebbleTypes.js
// 全站零 Emoji 铁律：使用 lucide-react 矢量图标

import { Sparkles, Droplets, Sun, Moon, HeartHandshake, Shield } from 'lucide-react';

export const PEBBLE_TYPES = {
  'stream-pebble': {
    id: 'stream-pebble',
    name: '河流润石',
    subtitle: 'Stream Pebble',
    desc: '平静安稳、温润如水的日常点滴分享',
    icon: Sparkles,
    stoneColor: 'rgba(148, 163, 184, 0.25)', // 石头本身特有的矿石光泽（极淡）
    borderColor: 'rgba(148, 163, 184, 0.4)',
    glowColor: 'rgba(148, 163, 184, 0.15)',
  },
  'sea-glass': {
    id: 'sea-glass',
    name: '蒂芙尼海玻璃',
    subtitle: 'Sea Glass',
    desc: '偶然捡拾的小确幸、清澈治愈的灵感',
    icon: Droplets,
    stoneColor: 'rgba(45, 212, 191, 0.2)',
    borderColor: 'rgba(45, 212, 191, 0.45)',
    glowColor: 'rgba(45, 212, 191, 0.2)',
  },
  'amber-fossil': {
    id: 'amber-fossil',
    name: '暖琥珀',
    subtitle: 'Amber Fossil',
    desc: '想要永久凝固珍藏的温馨时光',
    icon: Sun,
    stoneColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    glowColor: 'rgba(245, 158, 11, 0.2)',
  },
  'moon-stone': {
    id: 'moon-stone',
    name: '沉静月石',
    subtitle: 'Moonstone',
    desc: '深夜的喃喃自语、心底轻诉的秘密',
    icon: Moon,
    stoneColor: 'rgba(129, 140, 248, 0.22)',
    borderColor: 'rgba(129, 140, 248, 0.45)',
    glowColor: 'rgba(129, 140, 248, 0.2)',
  },
  'rose-quartz': {
    id: 'rose-quartz',
    name: '盐晶粉晶',
    subtitle: 'Rose Quartz',
    desc: '柔软的问候、轻声撒娇与感谢',
    icon: HeartHandshake,
    stoneColor: 'rgba(244, 114, 182, 0.22)',
    borderColor: 'rgba(244, 114, 182, 0.45)',
    glowColor: 'rgba(244, 114, 182, 0.2)',
  },
  'volcanic-ore': {
    id: 'volcanic-ore',
    name: '黑曜火山石',
    subtitle: 'Volcanic Ore',
    desc: '倾诉烦恼与低谷、坚固温热的陪伴',
    icon: Shield,
    stoneColor: 'rgba(100, 116, 139, 0.3)',
    borderColor: 'rgba(100, 116, 139, 0.5)',
    glowColor: 'rgba(71, 85, 105, 0.25)',
  }
};
