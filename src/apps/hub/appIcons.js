// src/apps/hub/appIcons.js
//
// 把 appRegistry.js 里的图标名（字符串）映射成真正的 lucide 组件。
//
// 为什么不直接在注册表里 import 组件：注册表要保持纯数据，方便任何版式
// 引用、也方便在 node 里直接检查。图标统一在这里按名字显式 import，不用
// lucide-react 的 `icons` 全量对象，避免把整套图标打进包里。这里列的图标
// 都是 appGridItems.jsx 和 AppGrid.jsx 已经在用的，不会增加打包体积。
//
// 新增应用用了新图标：先在这里 import 并加进映射，再写进 appRegistry.js。

import {
  Archive,
  BookMarked,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  Compass,
  Dices,
  FolderArchive,
  Gamepad2,
  Gift,
  Globe,
  Heart,
  Hourglass,
  Leaf,
  Map as MapIcon,
  Medal,
  MailOpen,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Palette,
  PhoneCall,
  Plane,
  Repeat,
  ScrollText,
  Shell,
  Sparkles,
  Ticket,
  Users,
  Waves,
} from 'lucide-react';

// 键是 lucide 的名字（和 appRegistry.js 的 icon 字段一致），所以 Map 这个
// 键对应的是 MapIcon（避免和 JS 自带的 Map 同名冲突）。
export const APP_ICON_COMPONENTS = {
  Archive,
  BookMarked,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  Compass,
  Dices,
  FolderArchive,
  Gamepad2,
  Gift,
  Globe,
  Heart,
  Hourglass,
  Leaf,
  Map: MapIcon,
  Medal,
  MailOpen,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Palette,
  PhoneCall,
  Plane,
  Repeat,
  ScrollText,
  Shell,
  Sparkles,
  Ticket,
  Users,
  Waves,
};

// 找不到图标名时用这个兜底，避免版式因为一个拼错的名字整页崩掉。
const FALLBACK_ICON = BookOpen;

export const getAppIcon = (name) => APP_ICON_COMPONENTS[name] || FALLBACK_ICON;

export default getAppIcon;