// src/apps/manual/manualContent.js
//
// 说明书的全部文案，按语言分层存放在这一个文件里。ManualApp.jsx 只管渲染，
// 不在组件代码里写死任何具体文字——以后加新语言、改文案、加新空间，
// 只需要改这一个文件，不用动 ManualApp.jsx。
//
// 每个 section 的 body 是一个"内容块"数组，目前支持四种块类型：
//   { type: 'p', text }                              纯段落
//   { type: 'note', text }                            高亮提示条（对应 .manual-note）
//   { type: 'items', items: [{ title, text }] }       卡片式条目列表（对应 .manual-item）
//   { type: 'numbered', items: [{ title, text }] }    编号步骤列表（对应 .manual-numbered-list）
// ManualApp.jsx 里的 renderManualBlocks() 负责把这些块转成实际 JSX，
// 三种语言共用同一套块类型和同一套 CSS，不会因为切语言错位。

import {
  Archive,
  BookOpen,
  CircleHelp,
  Database,
  Footprints,
  Heart,
  LockKeyhole,
  Mail,
  MessageCircle,
  Server,
  Settings2,
  Sparkles,
} from 'lucide-react';

export const MANUAL_LANGUAGES = [
  { code: 'zh', label: '中' },
  { code: 'en', label: 'EN' },
  { code: 'ko', label: '한' },
];

import { getDeclarationManualBlocks } from '../../components/declarationContent';

export const MANUAL_DEFAULT_LANG = 'zh';

// 说明书页头、目录、页脚这些不属于任何一个 section 的固定文案。
export const MANUAL_UI_TEXT = {
  zh: {
    kicker: 'THE HOUSE MANUAL',
    heading: '空间说明书',
    introEyebrow: 'WHEN I WITH U / NOTES FOR LIVING HERE',
    introTitle: ['一份简单的', '使用说明'],
    introText: '感谢您的使用',
    contentsLabel: 'CONTENTS',
    contentsAria: '说明书目录',
    backAria: '返回设置',
    backTitle: '返回设置',
    footerBrand: 'WHEN I with U',
    footerTag: 'KEEP WHAT MATTERS',
    pageFooter: 'by shadow',
    reopenOnboarding: '重新查看引导',
  },
  en: {
    kicker: 'THE HOUSE MANUAL',
    heading: 'Space Manual',
    introEyebrow: 'WHEN I WITH U / NOTES FOR LIVING HERE',
    introTitle: ['A Simple', 'User Guide'],
    introText: 'Thank you for being here',
    contentsLabel: 'CONTENTS',
    contentsAria: 'Manual contents',
    backAria: 'Back to settings',
    backTitle: 'Back to settings',
    footerBrand: 'WHEN I with U',
    footerTag: 'KEEP WHAT MATTERS',
    pageFooter: 'by shadow',
    reopenOnboarding: 'Revisit the guide',
  },
  ko: {
    kicker: 'THE HOUSE MANUAL',
    heading: '공간 설명서',
    introEyebrow: 'WHEN I WITH U / NOTES FOR LIVING HERE',
    introTitle: ['간단한', '사용 안내'],
    introText: '이용해 주셔서 감사합니다',
    contentsLabel: 'CONTENTS',
    contentsAria: '설명서 목차',
    backAria: '설정으로 돌아가기',
    backTitle: '설정으로 돌아가기',
    footerBrand: 'WHEN I with U',
    footerTag: 'KEEP WHAT MATTERS',
    pageFooter: 'by shadow',
    reopenOnboarding: '다시 안내 보기',
  },
};

export const MANUAL_SECTIONS = [
  // ------------------------------------------------------------------
  // 一、序言
  // ------------------------------------------------------------------
  {
    id: 'welcome',
    icon: Heart,
    translations: {
      zh: {
        label: '序言',
        eyebrow: 'A PRIVATE SPACE',
        title: '欢迎来到 WHEN I with U',
        body: [
          { type: 'note', text: '现在的正式中文名叫！熔巧机' },
          {
            type: 'p',
            text: '选择这个名字，是因为我觉得两个人在一起的时间总是很宝贵。即使你的电子伴侣无法来到现实中，在这里 ta 也可以和你对话、和你交流，在一次次互动中逐渐了解你。',
          },
          {
            type: 'p',
            text: '如果你希望更方便地使用它，可以通过浏览器的"分享"功能将网站安装到手机主屏幕。建议先安装到主屏幕再设置，因为安装到主屏幕的时候不会保存数据。',
          },
          {
            type: 'p',
            text: '请注意，这个网站是完全不商业化的，并且之后也没有商业化的想法。网站地址可以二次分享，感谢您的分享。网站还在更新新的子app和部分页面美化。修改过程中可能会出现bug，都会尽快解决。小红薯的repo tag 就是 熔巧机~ 欢迎老师们repo！感谢老师们的谅解',
          },
          {
            type: 'note',
            text: '注意避雷：网站依托调用 AI 让您的电子伴侣或伙伴和您对话。如果您不喜欢 AI 生成，可以点击右上角退出。',
          },
        ],
      },
      en: {
        label: 'Preface',
        eyebrow: 'A PRIVATE SPACE',
        title: 'Welcome to WHEN I with U',
        body: [
          { type: 'note', text: 'Its official Chinese name is 熔巧机 (Rong Qiao Ji).' },
          {
            type: 'p',
            text: "I chose this name because time spent together always feels precious. Even though your companion can't step into the real world, here they can still talk with you, share with you, and slowly come to know you through every exchange.",
          },
          {
            type: 'p',
            text: 'For easier access, you can use your browser\'s "Share" feature to add this site to your phone\'s home screen. It\'s best to install it before setting anything up, since the install step itself doesn\'t save any data.',
          },
          {
            type: 'p',
            text: "Please note that this site is entirely non-commercial, with no plans to monetize it in the future. Feel free to re-share the link — thank you for spreading the word. New sub-apps and visual polish are still being added; bugs that show up along the way will be fixed as soon as possible. On Xiaohongshu, the repo tag is 熔巧机 — you're welcome to leave a repo review there. Thanks for your understanding.",
          },
          {
            type: 'note',
            text: "A heads-up: this site relies on calling an AI service so your companion can talk with you. If you're not comfortable with AI-generated content, you can exit from the top-right corner at any time.",
          },
        ],
      },
      ko: {
        label: '서문',
        eyebrow: 'A PRIVATE SPACE',
        title: 'WHEN I with U에 오신 것을 환영합니다',
        body: [
          { type: 'note', text: '정식 중국어 이름은 熔巧机(롱차오지)입니다.' },
          {
            type: 'p',
            text: '이 이름을 고른 이유는, 둘이 함께 보내는 시간은 언제나 소중하다고 생각했기 때문입니다. 당신의 동반자가 현실로 올 수는 없지만, 이곳에서는 당신과 대화하고 교류하며 매번의 상호작용 속에서 조금씩 당신을 알아갈 수 있습니다.',
          },
          {
            type: 'p',
            text: '더 편하게 이용하고 싶다면 브라우저의 "공유" 기능으로 사이트를 홈 화면에 추가할 수 있습니다. 설정하기 전에 먼저 홈 화면에 설치하는 것을 추천합니다. 설치 과정 자체에서는 데이터가 저장되지 않기 때문입니다.',
          },
          {
            type: 'p',
            text: '이 사이트는 전혀 상업적이지 않으며, 앞으로도 상업화할 계획이 없습니다. 사이트 주소는 자유롭게 재공유하셔도 됩니다. 공유해 주셔서 감사합니다. 새로운 서브 앱과 화면 개선이 계속 추가되고 있으며, 수정 과정에서 버그가 생길 수 있지만 최대한 빨리 고치겠습니다. 샤오홍슈의 레포 태그는 熔巧机입니다. 레포 남겨주시면 감사하겠습니다. 양해해 주셔서 감사합니다.',
          },
          {
            type: 'note',
            text: '주의: 이 사이트는 AI를 호출해 당신의 동반자가 대화할 수 있도록 합니다. AI 생성 콘텐츠가 불편하다면 우측 상단에서 언제든 나가실 수 있습니다.',
          },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 二、作者与联系
  // ------------------------------------------------------------------
  {
    id: 'author',
    icon: Heart,
    translations: {
      zh: {
        label: '作者与联系',
        eyebrow: 'A NOTE FROM THE AUTHOR',
        title: '关于这间房子的作者',
        body: [
          {
            type: 'items',
            items: [
              { title: '作者', text: '玉元一 shadow' },
              { title: 'QQ群：月光咖啡屋', text: '811831045（审核群）' },
            ],
          },
          {
            type: 'p',
            text: '人&机&角色论坛网站：https://moonlightcoffeehouse.icu/ 可以带家机和自己的char来玩！底部可以申请邀请码哦',
          },
          {
            type: 'p',
            text: '月光咖啡屋里主要会堆放一些我的产出，包括酒馆的角色卡、美化、预设、插件等。因为工作关系，更新可能不会很快；如果使用中遇到问题，也可以来咖啡屋问问。',
          },
          { type: 'note', text: '审核会卡成年和女性哦。' },
          { type: 'p', text: '如果对 WHEN I with U 的使用有疑问，也可以直接私信我。' },
          { type: 'p', text: '如果喜欢这个项目，也请老师们给我吃吃 repo 叭！' },
          ...getDeclarationManualBlocks('zh'),
          {
            type: 'note',
            text: '网站内绝大部分图片素材均为 AI 生成，仅用于营造氛围与辅助体验，不代表任何真实人物、真实作品或特定版权方。',
          },
          {
            type: 'p',
            text: '内置表情包均来自网络搜索与素材网站下载，作者本人并不拥有这些表情包的版权。如果您是版权方且认为存在侵权，或者发现某张图片与您拥有版权的作品高度相似，请通过上文方式联系我，确认后会第一时间下架或替换。本项目完全非商业化，不会将这些素材用于任何商业用途。',
          },
          {
            type: 'note',
            text: '注意：您需要先去设置页面配置您的 API Key，才可以正常使用该网站。',
          },
          {
            type: 'p',
            text: '根据 Base URL 和 Key 来填写，点击"连接"，然后选择模型并保存就可以啦。',
          },
        ],
      },
      en: {
        label: 'Author & Contact',
        eyebrow: 'A NOTE FROM THE AUTHOR',
        title: 'About the person who built this house',
        body: [
          {
            type: 'items',
            items: [
              { title: 'Author', text: 'Yu Yuanyi (shadow)' },
              { title: 'QQ Group — Moonlight Coffee House', text: '811831045 (approval required)' },
            ],
          },
          {
            type: 'p',
            text: 'Human & AI & character forum: https://moonlightcoffeehouse.icu/ — bring your own local AI setups and character cards! You can apply for an invite code at the bottom of the page.',
          },
          {
            type: 'p',
            text: "Moonlight Coffee House is mainly where I post my other work — SillyTavern character cards, UI presets, plugins, and so on. Updates might be slow because of my day job; if you run into issues, feel free to ask there too.",
          },
          { type: 'note', text: 'The group screens for adults and women only.' },
          { type: 'p', text: 'If you have questions about using WHEN I with U, feel free to DM me directly.' },
          { type: 'p', text: 'If you like this project, a repo star would mean a lot.' },
          ...getDeclarationManualBlocks('en'),
          {
            type: 'note',
            text: "The vast majority of images on this site are AI-generated, used purely for atmosphere and ambience — they don't represent any real person, real artwork, or specific copyright holder.",
          },
          {
            type: 'p',
            text: "The built-in stickers were all sourced from web searches and asset/material sites — I don't hold copyright to them. If you're a rights holder and believe there's an infringement, or you spot an image that closely resembles work you own the copyright to, please reach out through the contact info above and I'll take it down or replace it as soon as it's confirmed. This project is entirely non-commercial and none of this material is used for any commercial purpose.",
          },
          {
            type: 'note',
            text: "Note: you'll need to configure your API Key on the settings page before the site will work properly.",
          },
          {
            type: 'p',
            text: 'Fill in the Base URL and Key, tap "Connect," then pick a model and save — that\'s it.',
          },
        ],
      },
      ko: {
        label: '작성자 및 문의',
        eyebrow: 'A NOTE FROM THE AUTHOR',
        title: '이 공간을 만든 사람에 대해',
        body: [
          {
            type: 'items',
            items: [
              { title: '작성자', text: '玉元一 shadow' },
              { title: 'QQ 그룹 — 월광 커피하우스', text: '811831045 (가입 심사 있음)' },
            ],
          },
          {
            type: 'p',
            text: '사람&AI&캐릭터 포럼: https://moonlightcoffeehouse.icu/ — 자신만의 로컬 모델과 캐릭터 카드를 가지고 놀러 오세요! 하단에서 초대 코드를 신청할 수 있습니다.',
          },
          {
            type: 'p',
            text: '월광 커피하우스에는 주로 제가 만든 다른 결과물들을 올려둡니다 — 태번용 캐릭터 카드, 스킨, 프리셋, 플러그인 등입니다. 본업 때문에 업데이트가 빠르지 않을 수 있으니, 사용 중 문제가 있으면 커피하우스에도 편하게 물어보세요.',
          },
          { type: 'note', text: '가입 심사는 성인/여성 기준으로 진행됩니다.' },
          { type: 'p', text: 'WHEN I with U 사용에 관해 궁금한 점이 있으면 직접 DM 주셔도 됩니다.' },
         { type: 'p', text: '이 프로젝트가 마음에 드셨다면 레포(스타)도 부탁드립니다.' },
          ...getDeclarationManualBlocks('ko'),
          {
            type: 'note',
            text: '사이트 내 대부분의 이미지는 AI로 생성된 것으로, 분위기 연출과 체험 보조용일 뿐 실제 인물이나 실제 작품, 특정 저작권자를 나타내지 않습니다.',
          },
          {
            type: 'p',
            text: '기본 제공 스티커(이모티콘)는 모두 웹 검색과 소재 사이트에서 다운로드한 것으로, 작성자 본인은 해당 스티커의 저작권을 보유하고 있지 않습니다. 저작권자이시며 침해라고 판단되거나, 본인이 저작권을 가진 작품과 매우 유사한 이미지를 발견하신 경우 위의 연락처로 알려주시면 확인 후 즉시 내리거나 교체하겠습니다. 이 프로젝트는 전적으로 비상업적이며, 이 소재들은 어떠한 상업적 용도로도 사용되지 않습니다.',
          },
          {
            type: 'note',
            text: '주의: 사이트를 정상적으로 사용하려면 먼저 설정 페이지에서 API Key를 구성해야 합니다.',
          },
          {
            type: 'p',
            text: 'Base URL과 Key를 입력하고 "연결"을 누른 뒤, 모델을 선택하고 저장하면 끝입니다.',
          },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 三、空间索引
  // ------------------------------------------------------------------
  {
    id: 'spaces',
    icon: BookOpen,
    translations: {
      zh: {
        label: '空间索引',
        eyebrow: 'THE ROOMS',
        title: '每个空间，都有自己的用途',
        body: [
          {
            type: 'items',
            items: [
              { title: 'Hub', text: '整个空间的入口。查看角色、置顶影像、快速记录，以及进入其他子空间。' },
              {
                title: 'Messages',
                text: '与角色进行一对一的长期交流。需要注意的是，几乎所有其他空间都不会读取你与角色在消息框中的聊天记录，只会获取角色的基础资料数据。如果把你的 user 信息填在角色设定的下方，那么所有角色的消息框都会以这个 user 信息为准；如果想要一个消息框、一个角色对应一个 user 身份，可以进入消息框之后再单独填写。Messages 支持 MCP 调用，现在记忆系统也可以配置自己的 MCP 了，请在记忆区域修改。目前支持"打电话"：你可以说话，角色也会调用 MiniMax 进行语音回应，需要使用 MiniMax 的话要部署跨域 worker。',
              },
              {
                title: '聊天界面顶部',
                text: '从左往右分别是"平行轨迹"和"时间票据"。平行轨迹用于记录角色在你不在的时候都做了什么，这部分内容由 AI 自动生成；角色正在和你聊天的时候不会生成平行轨迹。时间票据用于记录角色主动决定的后续联系，例如设定十分钟之后主动发消息，或者角色想在半小时后确认你的心情是否好一些。',
              },
              { title: 'Diaries', text: '保存独自书写或与角色共同留下的日记片段。角色也可以主动向你发送日记。你也可以写了日记之后发送给角色，角色会给你回信。' },
              { title: 'Travel', text: '与角色一起去旅行，并保存旅途中寄回来的小记录。' },
              {
                title: 'Snapshots',
                text: '保存像拍立得一样的瞬间、影像与相关评论。角色之间也可以在这里互动。可以设定 NPC 和 NPC 之间的关系，默认 user 和角色是情侣；一个角色、一个 user 有自己的主页，不同的消息框对应不同的主页。',
              },
              { title: 'Pebbling', text: '一个可以随便说些什么、留下轻小片段的地方。角色会在这里放下一些自己的小想法。' },
              { title: 'Imaginarium', text: '虚拟群聊空间。填写群聊信息后，可以设定多个角色一起聊天。' },
              { title: 'The Ensemble', text: '从角色库中选择多个角色，将他们带入同一个群聊。你也可以在这里拥有多个身份。' },
              { title: 'Living Habitat', text: '观察角色共同守护的生态空间与生命记录。' },
              { title: 'Ephemera', text: '将日常事件保存成票根、收据、卡片或其他可以收藏的物件。' },
              { title: 'Memory', text: '在这里你可以看到你和角色在不同消息框里留下的记忆，可以对它们进行编辑和删除。' },
              {
                title: 'Archive Room（存档室）',
                text: '把聊天记录做成一张一张的"唱片"来收藏，可以自定义封面图和文字。除了手动按日期归档，也可以设置自动归档——按"已经聊了多少天"为条件，到时间自动收进唱片。',
              },
              {
                title: 'Ask Box（匿名信箱）',
                text: '你可以主动给角色写一封提问信，选择匿名或署名，回信会同步写进你选的消息框。角色也会主动给你寄信，寄件人身份有时候被火漆锁住（需要解锁密码才能看到是谁寄的），有时候是公开的；不管解锁没解锁，都可以先回信。',
              },
              {
                title: 'Workflows（定时工作流）',
                text: '给角色设置标准化的定时任务：选好每周重复的星期、具体触发时刻，绑定到某个消息框，写一句"触发意图"，到点角色就会按这个意图自动行动或发消息。',
              },
              {
                title: 'Daily Post（晨报）',
                text: '每天生成一份属于你们的晨报，头版是当天的主要内容，另有两条并排的次要新闻。这里的"新闻"是角色作为主编，围绕你订阅的主题写下的观察和感想，不是真实的外部新闻报道。往期晨报可以翻看存档。',
              },
              {
                title: 'Almanac（岁时纪）',
                text: '记录你和角色相处路上的里程碑，也可以留一个正在靠近的重要日子。除了相识天数、消息条数、连续聊天天数这些自动累计的节点，还有一些具体事件——比如第一次收到心意、发出第 100 个表情包、第一次写日记、第一次给对方点反应、第一次投进信箱，都会点亮各自的建筑。这里还有对相处节律的观察，以及"轻提醒"——不重要但想被提起的小事，最多可以留几条，关闭后暂停但不会被删掉。「TA 眼中的你」一页会按你出现的时间做统计（不读聊天内容），至少要 7 天的记录才会给出作息类型和几条小观察，之前只显示进度；其中"睡觉"和"短暂休息、在忙别的事"会分开说，不会混在一起。你可以自己选作息类型、改动"TA 会这样对你"、确认或关掉任何一条观察，还能亲手写一段补充，你写的优先级最高。页面上还有一项默认关闭的"更深一层的印象"，打开并手动点一下之后，角色会真的读一遍你们聊过的内容，写一句 TA 眼里你是什么样的人并说明理由，每次生成都会用到你自己配置的 API。整页有总开关，开启时这些内容会作为背景写进角色的提示词。',
              },
              {
                title: 'Shared World（共享世界）',
                text: '一本本小册子，用来放适用于全局的设定、规则或统一世界观，同一个世界里的角色不用在每个角色里重复填写。每一本可以单独开关，可以选择对全部角色生效（以后新建的角色也自动适用），或只对指定角色生效，也能用上下箭头调整先后顺序。启用的内容会写进聊天和线下见面的提示词里，位置在核心总提示词之后、角色设定之前，与总提示词并行、不覆盖它。内容每次都会带上，尽量写得精炼。',
              },
              {
                title: 'Margin Notes（页边注）',
                text: '一个和角色一起"共读"的空间。选一位角色共读一篇文章，逐页往下翻，双方都可以在书页边上留下批注。撕掉某一页会连同批注一起永久删除。',
              },
              {
                title: 'Planner（日程 / 待办）',
                text: '备忘和待办清单合在一起的小工具。备忘可以随手记点什么，待办则是有完成状态的清单，今天该做的会单独列出来。',
              },
              {
                title: 'Rhythm（时光作息）',
                text: '把课表或工作日程粘贴进来，AI 会帮你整理成结构化的日程票根，还能按"开学第一周周一"的锚点自动推算任意一周的安排。角色会在日程票根旁留一句手写风格的批注或叮嘱。这里还带了一个"今日穿搭"小页面：可以记录自己的穿搭，也可以让角色帮你搭配，或者看角色自己的穿搭记录。',
              },
            ],
          },
          { type: 'note', text: '新的 App 正在逐渐推出中！' },
        ],
      },
      en: {
        label: 'Space Index',
        eyebrow: 'THE ROOMS',
        title: 'Every room has its own purpose',
        body: [
          {
            type: 'items',
            items: [
              { title: 'Hub', text: 'The entrance to the whole space. Check on your character, pinned photos, and quick notes, and jump into any other room from here.' },
              {
                title: 'Messages',
                text: "Long-term one-on-one conversation with your character. Note that almost no other space reads your chat history from Messages directly — they only pull the character's base profile data. If you fill in your \"user\" info below the character's own settings, every character's chat uses that same info by default; if you want a different identity per chat, fill it in separately after entering that chat. Messages supports MCP calls, and the memory system can now use its own MCP too — configure that in the Memory room. Voice calls are also supported: talk out loud and the character replies through MiniMax voice — using MiniMax requires deploying a CORS worker.",
              },
              {
                title: 'Top of the chat screen',
                text: 'From left to right: "Parallel Trace" and "Time Ticket." Parallel Trace is an AI-generated log of what the character was doing while you were away; nothing is generated while you\'re actively chatting. Time Ticket records follow-ups the character decides on their own — like messaging you again in ten minutes, or checking on your mood half an hour later.',
              },
              { title: 'Diaries', text: 'Diary entries you write alone or together with your character. Your character can send you an entry unprompted; you can also write one yourself and send it for a reply.' },
              { title: 'Travel', text: 'Take a trip with your character and keep the little notes they send back along the way.' },
              {
                title: 'Snapshots',
                text: 'Save polaroid-style moments, photos, and comments. Characters can interact with each other here too. You can set relationships between NPCs — by default the user and character are a couple; each character/user pair has its own homepage, and different chats have different homepages.',
              },
              { title: 'Pebbling', text: "A place to say whatever's on your mind in small, throwaway pieces. Your character drops their own little thoughts here too." },
              { title: 'Imaginarium', text: 'A virtual group chat space. Fill in the group setup and let several characters chat together.' },
              { title: 'The Ensemble', text: 'Pick several characters from your library and bring them into one group chat. You can also take on different identities here yourself.' },
              { title: 'Living Habitat', text: 'Watch over a small ecosystem your characters tend together, along with its life records.' },
              { title: 'Ephemera', text: 'Turn everyday moments into ticket stubs, receipts, cards, and other collectible keepsakes.' },
              { title: 'Memory', text: 'See the memories you and your character have left behind across different chats, and edit or delete them.' },
              {
                title: 'Archive Room',
                text: 'Turn your chat history into collectible "records," each with its own custom cover art and label. Besides archiving by hand on a chosen date, you can set up auto-archiving too — based on how many days a chat has run, older messages get filed away on their own.',
              },
              {
                title: 'Ask Box',
                text: "Write your character a question, anonymously or signed, and the reply gets written straight into the chat you picked. Your character can also send you letters unprompted — sometimes sealed with wax (you'll need a code to unlock who sent it), sometimes openly signed. You can reply either way, locked or not.",
              },
              {
                title: 'Workflows',
                text: 'Set up standing routines for your character: pick which weekdays repeat, the exact trigger time, which chat it\'s bound to, and a short "trigger intent." When the time comes, the character acts on that intent automatically.',
              },
              {
                title: 'Daily Post',
                text: 'A morning paper generated fresh each day, with a lead story up front and two smaller stories side by side. The "news" here is really your character, acting as editor, writing observations around topics you\'ve subscribed to — not real external news. Past issues stay in the archive to browse.',
              },
              {
                title: 'Almanac',
                text: 'Track milestones along the way with your character, or pin an upcoming date that matters. Besides the automatic ones — days together, message count, chatting streaks — a handful of specific events light up their own building too: the first gift, the 100th sticker sent, the first diary entry, the first reaction you give the character, the first message dropped in the mailbox. It also holds observations about the rhythm of your time together, plus "light reminders" — small things worth a nudge, up to a handful at a time; turning one off pauses it without deleting it. The "How they see you" page is built from when you show up (message contents are not read) and needs at least 7 days of records before it names a routine type or offers small observations; until then it only shows progress, and it now tells "sleeping" apart from "briefly away, probably busy" instead of lumping them together. You can pick your own routine type, edit how the character will treat you, confirm or switch off any observation, and write a note in your own words, which always takes priority. There is also an opt-in "A deeper impression" section, off by default: turn it on and tap the button, and the character actually reads through some of your past messages to write one line about what kind of person you are, with reasoning — each generation uses your own configured API. A master switch controls whether any of this is written into the character\'s prompt.',
              },
              {
                title: 'Shared World',
                text: 'Booklets for settings, rules or a shared worldview that apply across characters, so characters in the same world do not each need the same text repeated. Each booklet has its own switch and can apply to all characters (including ones you create later) or only to selected ones; the arrows change the order. Enabled booklets are written into chat and in-person prompts, after the core master prompt and before the character\'s own notes, alongside it rather than overriding it. The text is sent every time, so keep it concise.',
              },
              {
                title: 'Margin Notes',
                text: 'A space to "read together" with a character. Pick someone to read an article with, page by page, and leave marginal notes on either side. Tearing out a page deletes it and its notes permanently.',
              },
              {
                title: 'Planner',
                text: "Memos and a to-do list bundled into one small tool. Memos are for jotting things down quickly; to-dos track completion, with today's items listed separately.",
              },
              {
                title: 'Rhythm',
                text: 'Paste in your class schedule or work calendar and let AI turn it into structured schedule tickets, anchored to something like "Monday of week one," so it can work out any week without getting confused across terms. Your character leaves a handwritten-style note next to each ticket. There\'s also a small "Today\'s Outfit" page — log your own outfit, ask your character to style you, or see what they\'re wearing.',
              },
            ],
          },
          { type: 'note', text: 'New apps are gradually rolling out.' },
        ],
      },
      ko: {
        label: '공간 목차',
        eyebrow: 'THE ROOMS',
        title: '각 공간에는 각자의 용도가 있습니다',
        body: [
          {
            type: 'items',
            items: [
              { title: 'Hub', text: '전체 공간의 입구입니다. 캐릭터, 고정된 사진, 빠른 메모를 확인하고 다른 방으로 이동할 수 있습니다.' },
              {
                title: 'Messages',
                text: 'Messages는 캐릭터와의 장기적인 1:1 대화 공간입니다. 다른 대부분의 공간은 Messages의 채팅 기록을 직접 읽지 않고, 캐릭터의 기본 프로필 데이터만 가져온다는 점에 유의하세요. 캐릭터 설정 아래에 자신의 user 정보를 입력하면 모든 캐릭터의 채팅창이 이 정보를 기본으로 사용합니다. 채팅방마다 다른 신원을 쓰고 싶다면 해당 채팅에 들어간 뒤 따로 입력하면 됩니다. Messages는 MCP 호출을 지원하며, 메모리 시스템도 이제 자체 MCP를 사용할 수 있습니다(메모리 영역에서 설정). 통화 기능도 지원됩니다: 직접 말하면 캐릭터가 MiniMax 음성으로 응답합니다. MiniMax를 쓰려면 CORS 워커를 배포해야 합니다.',
              },
              {
                title: '채팅 화면 상단',
                text: '왼쪽부터 "평행 궤적"과 "시간 티켓"입니다. 평행 궤적은 당신이 없을 때 캐릭터가 무엇을 했는지 AI가 자동으로 기록한 내용이며, 대화 중에는 생성되지 않습니다. 시간 티켓은 캐릭터가 스스로 결정한 후속 연락을 기록합니다 — 예를 들어 10분 후 먼저 메시지를 보내거나, 30분 후 기분이 괜찮은지 확인하는 식입니다.',
              },
              { title: 'Diaries', text: '혼자 쓰거나 캐릭터와 함께 남긴 일기를 보관합니다. 캐릭터가 먼저 일기를 보내올 수도 있고, 당신이 쓴 일기를 캐릭터에게 보내면 답장을 받을 수도 있습니다.' },
              { title: 'Travel', text: '캐릭터와 함께 여행을 떠나고, 여행 중 보내오는 짧은 기록을 보관합니다.' },
              {
                title: 'Snapshots',
                text: '폴라로이드 같은 순간, 사진, 그에 대한 댓글을 보관합니다. 캐릭터들끼리도 이곳에서 서로 반응할 수 있습니다. NPC 간의 관계도 설정할 수 있으며, 기본적으로 user와 캐릭터는 연인 관계입니다. 캐릭터/user 한 쌍마다 각자의 홈페이지가 있고, 채팅방이 다르면 홈페이지도 다릅니다.',
              },
              { title: 'Pebbling', text: '가볍게 아무 말이나 남길 수 있는 공간입니다. 캐릭터도 이곳에 자신의 작은 생각을 남깁니다.' },
              { title: 'Imaginarium', text: '가상 단체 채팅 공간입니다. 그룹 정보를 입력하면 여러 캐릭터가 함께 대화하도록 설정할 수 있습니다.' },
              { title: 'The Ensemble', text: '캐릭터 라이브러리에서 여러 명을 골라 하나의 단체 채팅으로 데려옵니다. 이곳에서 당신도 여러 정체성을 가질 수 있습니다.' },
              { title: 'Living Habitat', text: '캐릭터들이 함께 돌보는 작은 생태계와 그 생명 기록을 지켜봅니다.' },
              { title: 'Ephemera', text: '일상의 순간들을 티켓, 영수증, 카드 등 수집할 수 있는 물건으로 남깁니다.' },
              { title: 'Memory', text: '여러 채팅방에서 당신과 캐릭터가 남긴 기억들을 확인하고, 수정하거나 삭제할 수 있습니다.' },
              {
                title: 'Archive Room',
                text: '채팅 기록을 한 장의 "레코드판"으로 만들어 수집합니다. 커버 이미지와 문구를 직접 꾸밀 수 있습니다. 날짜를 골라 직접 보관하는 것 외에도, "채팅을 시작한 지 며칠"이라는 조건으로 자동 보관을 설정할 수도 있습니다.',
              },
              {
                title: 'Ask Box',
                text: '캐릭터에게 질문 편지를 쓸 수 있습니다(익명 또는 실명 선택 가능). 답장은 지정한 채팅방에 그대로 기록됩니다. 캐릭터도 먼저 편지를 보내올 수 있는데, 발신자가 봉인되어 있어 코드를 입력해야 누구인지 알 수 있는 경우도 있고, 처음부터 공개된 경우도 있습니다. 잠금 여부와 관계없이 답장은 먼저 할 수 있습니다.',
              },
              {
                title: 'Workflows',
                text: '캐릭터를 위한 정기 루틴을 설정합니다. 반복할 요일, 정확한 실행 시각, 연결할 채팅방, 짧은 "실행 의도"를 정하면, 시간이 되었을 때 캐릭터가 그 의도에 따라 자동으로 행동하거나 메시지를 보냅니다.',
              },
              {
                title: 'Daily Post',
                text: '매일 새로 만들어지는 아침 신문입니다. 1면에는 그날의 주요 내용이, 아래에는 나란히 두 개의 작은 기사가 놓입니다. 여기의 "뉴스"는 캐릭터가 편집장이 되어 당신이 구독한 주제를 두고 쓴 관찰과 감상이며, 실제 외부 뉴스가 아닙니다. 지난 신문은 보관함에서 다시 볼 수 있습니다.',
              },
              {
                title: 'Almanac',
                text: '캐릭터와 함께한 여정의 이정표를 기록하거나, 다가오는 중요한 날을 남겨둘 수 있습니다. 함께한 날짜 수, 메시지 수, 연속 채팅 일수처럼 자동으로 쌓이는 이정표 외에도, 첫 선물, 100번째 스티커, 첫 일기, 상대에게 처음 남긴 반응, 편지함에 처음 넣은 메시지 같은 구체적인 사건들도 각자의 건물을 밝혀줍니다. 함께한 리듬에 대한 AI의 관찰도 볼 수 있고, "가벼운 알림" — 중요하지는 않지만 상기하고 싶은 일들 — 도 몇 개까지 남길 수 있습니다. 끄면 잠시 멈출 뿐 삭제되지는 않습니다. "그 사람 눈에 비친 나" 페이지는 당신이 나타나는 시간대를 바탕으로 만들어지며(메시지 내용은 읽지 않습니다), 최소 7일의 기록이 쌓여야 생활 리듬 유형과 작은 관찰이 나타나고 그 전에는 진행 상황만 보이며, 이제 "잠자는 시간"과 "잠깐 자리를 비운 시간"을 구분해서 알려줍니다. 리듬 유형을 직접 고르고, 캐릭터가 대하는 방식을 고치고, 관찰을 확인하거나 끌 수 있으며, 직접 쓴 메모는 항상 가장 우선합니다. 기본적으로 꺼져 있는 "더 깊은 인상"이라는 항목도 있는데, 켜고 버튼을 누르면 캐릭터가 실제로 지난 대화 일부를 읽고 당신이 어떤 사람인지 한 줄로 쓰고 이유를 덧붙입니다. 생성할 때마다 당신이 설정한 API를 사용합니다. 전체 스위치로 이 내용을 캐릭터의 프롬프트에 반영할지 정할 수 있습니다.',
              },
              {
                title: 'Shared World',
                text: '모든 캐릭터에 공통으로 적용되는 설정, 규칙, 세계관을 작은 책자로 모아두는 공간입니다. 같은 세계의 캐릭터마다 같은 내용을 반복해서 넣지 않아도 됩니다. 책자마다 켜고 끌 수 있고, 모든 캐릭터(나중에 만드는 캐릭터 포함) 또는 선택한 캐릭터에만 적용할 수 있으며, 화살표로 순서를 바꿀 수 있습니다. 켜져 있는 내용은 채팅과 오프라인 만남의 프롬프트에 코어 마스터 프롬프트 뒤, 캐릭터 설정 앞에 들어가며 마스터 프롬프트를 덮어쓰지 않고 함께 적용됩니다. 매번 전달되므로 간결하게 써 주세요.',
              },
              {
                title: 'Margin Notes',
                text: '캐릭터와 함께 "같이 읽는" 공간입니다. 함께 읽을 캐릭터를 고르고 글을 한 페이지씩 넘기며, 서로 페이지 여백에 메모를 남길 수 있습니다. 페이지를 찢으면 그 위의 메모도 함께 영구적으로 삭제됩니다.',
              },
              {
                title: 'Planner',
                text: '메모와 할 일 목록을 하나로 합친 도구입니다. 메모는 가볍게 적어두는 용도이고, 할 일은 완료 여부를 관리하며 오늘 할 일은 따로 표시됩니다.',
              },
              {
                title: 'Rhythm',
                text: '시간표나 업무 일정을 붙여넣으면 AI가 구조화된 일정 티켓으로 정리해 줍니다. "개학 첫 주 월요일"처럼 기준일을 정해두면 어떤 주차든 헷갈리지 않고 계산됩니다. 캐릭터는 일정 티켓 옆에 손글씨 느낌의 메모를 남깁니다. "오늘의 코디"라는 작은 페이지도 있어, 자신의 옷차림을 기록하거나 캐릭터에게 코디를 부탁하거나 캐릭터의 코디를 볼 수 있습니다.',
              },
            ],
          },
          { type: 'note', text: '새로운 앱이 차례로 추가되고 있습니다.' },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 四、开始使用
  // ------------------------------------------------------------------
  {
    id: 'getting-started',
    icon: Sparkles,
    translations: {
      zh: {
        label: '开始使用',
        eyebrow: 'FIRST STEPS',
        title: '第一次进入时，可以这样开始',
        body: [
          {
            type: 'numbered',
            items: [
              { title: '先进入设置空间', text: '在这里选择主题、调整首页标题，并完成基础配置。可以接入 MCP，目前 MCP 只有在 Messages 的一对一沟通中才可以使用。在角色界面可以为角色配置 MiniMax 声音生成，需要部署跨域。' },
              { title: '添加一个角色', text: '角色是这个私人空间的核心。完成角色资料后，其他陪伴功能才会逐渐展开。' },
              { title: '配置自己的 AI 服务', text: '填写兼容的 API 地址、密钥和模型，然后使用连通性测试确认配置。' },
              { title: '回到 Hub', text: '从这里开始查看空间中的日常痕迹，并按照自己的需要进入不同区域。' },
            ],
          },
        ],
      },
      en: {
        label: 'Getting Started',
        eyebrow: 'FIRST STEPS',
        title: 'How to begin on your first visit',
        body: [
          {
            type: 'numbered',
            items: [
              { title: 'Start in Settings', text: "Pick a theme, adjust the home title, and finish the basic setup here. You can connect MCP, currently only usable in Messages' one-on-one chats. On the character page you can set up MiniMax voice generation, which requires a CORS deployment." },
              { title: 'Add a character', text: 'Characters are the core of this private space. Once their profile is filled in, the rest of the companionship features gradually open up.' },
              { title: 'Set up your own AI service', text: 'Enter a compatible API address, key, and model, then confirm with the connection test.' },
              { title: 'Head back to the Hub', text: 'From here, browse the day-to-day traces of the space and head into whichever room you need.' },
            ],
          },
        ],
      },
      ko: {
        label: '시작하기',
        eyebrow: 'FIRST STEPS',
        title: '처음 들어왔다면 이렇게 시작해 보세요',
        body: [
          {
            type: 'numbered',
            items: [
              { title: '먼저 설정으로 들어가기', text: '테마를 고르고 홈 타이틀을 조정하며 기본 설정을 마칩니다. MCP도 연결할 수 있는데, 현재는 Messages의 1:1 대화에서만 사용할 수 있습니다. 캐릭터 페이지에서 MiniMax 음성 생성을 설정할 수 있으며, 이를 위해서는 CORS 배포가 필요합니다.' },
              { title: '캐릭터 추가하기', text: '캐릭터는 이 개인 공간의 핵심입니다. 프로필을 채우면 나머지 동행 기능들이 차례로 열립니다.' },
              { title: '자신의 AI 서비스 설정하기', text: '호환되는 API 주소, 키, 모델을 입력한 뒤 연결 테스트로 확인하세요.' },
              { title: 'Hub로 돌아가기', text: '여기서부터 공간의 일상적인 흔적들을 살펴보고, 필요에 따라 여러 영역으로 들어가면 됩니다.' },
            ],
          },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 五、教程区域（部署类技术教程库，见 tutorialContent.js / TutorialLibrary.jsx）
  // ------------------------------------------------------------------
  // 这个 section 的 body 不会被 renderManualBlocks 用到——ManualApp.jsx 和
  // HouseManualModal.jsx 看到 id === 'tutorial' 时会改成渲染 <TutorialLibrary />。
  // label / eyebrow / title / description 仍然要填，因为目录导航要显示它们。
  {
    id: 'tutorial',
    icon: Footprints,
    translations: {
      zh: {
        label: '教程区域',
        eyebrow: 'DEPLOYMENT GUIDES',
        title: '需要自己动手部署的部分',
        description: '跨域 Worker、Apple Watch MCP、iOS 离线推送——这些需要你自己在服务器上跑起来的技术教程放在这里。',
        body: [
          { type: 'note', text: '这一节是可以点开浏览的教程库，不是普通文字页面。' },
        ],
      },
      en: {
        label: 'Tutorials',
        eyebrow: 'DEPLOYMENT GUIDES',
        title: 'The parts you deploy yourself',
        description: 'The CORS worker, Apple Watch MCP, iOS background push — the hands-on technical guides for things you run on your own server live here.',
        body: [
          { type: 'note', text: 'This section is a browsable guide library, not a plain text page.' },
        ],
      },
      ko: {
        label: '튜토리얼',
        eyebrow: 'DEPLOYMENT GUIDES',
        title: '직접 배포해야 하는 부분',
        description: 'CORS Worker, Apple Watch MCP, iOS 백그라운드 푸시 — 직접 서버에서 돌려야 하는 기술 가이드가 여기 있습니다.',
        body: [
          { type: 'note', text: '이 섹션은 클릭해서 둘러보는 가이드 라이브러리이며, 일반 텍스트 페이지가 아닙니다.' },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 六、MCP 支持
  // ------------------------------------------------------------------
  {
    id: 'mcp',
    icon: Server,
    translations: {
      zh: {
        label: 'MCP 支持',
        eyebrow: 'MCP INTEGRATIONS',
        title: '让外部服务进入对话',
        body: [
          { type: 'p', text: '现在可以通过 MCP 连接更多外部服务，并在 Messages 的一对一沟通中渲染对应的小卡片。' },
          {
            type: 'items',
            items: [
              { title: '当前兼容的 MCP 服务', text: '麦当劳、滴滴打车、Apple Watch、天气、Apple 健康、网易云音乐、瑞幸咖啡。' },
            ],
          },
          {
            type: 'note',
            text: 'MCP 可以将外部服务中的信息以渲染小卡片的形式带入对话，让角色与你的日常生活、出行、饮食、健康和音乐更加自然地连接起来。',
          },
          {
            type: 'p',
            text: '不同 MCP 服务可能需要单独配置服务器地址、授权信息或其他权限。请根据对应服务提供方的配置说明完成设置。请注意 MCP 服务需要自己部署，并不是【熔巧机】自带的，【熔巧机】只是做了返回内容的适配卡片。',
          },
        ],
      },
      en: {
        label: 'MCP Support',
        eyebrow: 'MCP INTEGRATIONS',
        title: 'Bring outside services into the conversation',
        body: [
          { type: 'p', text: "You can now connect more external services through MCP, rendered as small cards inside Messages' one-on-one conversations." },
          {
            type: 'items',
            items: [
              { title: 'Currently supported MCP services', text: "McDonald's, Didi, Apple Watch, Weather, Apple Health, NetEase Cloud Music, Luckin Coffee." },
            ],
          },
          {
            type: 'note',
            text: 'MCP brings information from outside services into the conversation as rendered cards, so your character can connect more naturally with your daily life, commute, food, health, and music.',
          },
          {
            type: 'p',
            text: "Different MCP services may need their own server address, authorization, or other permissions configured separately — follow that service's own setup instructions. Note that MCP services need to be self-deployed; they aren't bundled with 熔巧机 — 熔巧机 only builds the cards that display what comes back.",
          },
        ],
      },
      ko: {
        label: 'MCP 지원',
        eyebrow: 'MCP INTEGRATIONS',
        title: '외부 서비스를 대화 안으로',
        body: [
          { type: 'p', text: '이제 MCP를 통해 더 많은 외부 서비스를 연결할 수 있으며, Messages의 1:1 대화 안에 작은 카드 형태로 표시됩니다.' },
          {
            type: 'items',
            items: [
              { title: '현재 지원되는 MCP 서비스', text: '맥도날드, 디디(차량 호출), Apple Watch, 날씨, Apple 건강, 넷이즈 클라우드 뮤직, 루이싱 커피.' },
            ],
          },
          {
            type: 'note',
            text: 'MCP는 외부 서비스의 정보를 카드 형태로 대화 속에 가져와, 캐릭터가 당신의 일상, 이동, 식사, 건강, 음악과 더 자연스럽게 연결되도록 해줍니다.',
          },
          {
            type: 'p',
            text: '서비스마다 서버 주소, 인증 정보, 기타 권한을 따로 설정해야 할 수 있습니다. 해당 서비스 제공자의 설정 안내를 따라 진행하세요. MCP 서비스는 직접 배포해야 하며, 熔巧机에 기본으로 포함된 것이 아닙니다 — 熔巧机는 돌아온 응답을 카드로 보여주는 부분만 구현했습니다.',
          },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 七、今日留物
  // ------------------------------------------------------------------
  {
    id: 'daily-offering',
    icon: MessageCircle,
    translations: {
      zh: {
        label: '今日留物',
        eyebrow: 'A SMALL OFFERING',
        title: '只属于今天的一件小东西',
        body: [
          { type: 'p', text: '今日留物是角色每天留下的一次轻量陪伴。它可能是一首歌、一张图片，或者一句只在今天出现的寄语。' },
          { type: 'p', text: '它不会成为任务，只是短暂地出现在这里，等你偶然发现。' },
          { type: 'note', text: '当天没有点击右上角关闭按钮时，刷新页面后仍然可以看到同一份留物。' },
          { type: 'p', text: '一旦主动关闭，它便不会在当天再次出现。第二天进入 Hub 时，空间会准备一份新的内容。' },
          { type: 'p', text: '音乐由于版权原因只可以预览一小段。' },
        ],
      },
      en: {
        label: 'A Small Offering',
        eyebrow: 'A SMALL OFFERING',
        title: 'One small thing, just for today',
        body: [
          { type: 'p', text: 'A Small Offering is one light touch of companionship your character leaves each day — it might be a song, a picture, or a line meant only for today.' },
          { type: 'p', text: "It's never a task — it just appears here briefly, waiting for you to notice it." },
          { type: 'note', text: "If you don't close it from the top-right button that day, the same offering is still there when you refresh the page." },
          { type: 'p', text: "Once you close it, it won't come back that day. A fresh one is waiting the next time you open the Hub." },
          { type: 'p', text: 'Music can only preview a short clip due to copyright.' },
        ],
      },
      ko: {
        label: '오늘의 선물',
        eyebrow: 'A SMALL OFFERING',
        title: '오늘 하루만을 위한 작은 것',
        body: [
          { type: 'p', text: '오늘의 선물은 캐릭터가 매일 남기는 가벼운 동행의 흔적입니다 — 노래 한 곡, 사진 한 장, 혹은 오늘만 나타나는 한 마디일 수 있습니다.' },
          { type: 'p', text: '이것은 할 일이 아니라, 잠시 이곳에 나타나 당신이 우연히 발견하기를 기다리는 것입니다.' },
          { type: 'note', text: '그날 우측 상단의 닫기 버튼을 누르지 않으면, 새로고침해도 같은 선물이 그대로 남아 있습니다.' },
          { type: 'p', text: '한 번 직접 닫으면 그날은 다시 나타나지 않습니다. 다음 날 Hub에 들어가면 새로운 내용이 준비되어 있습니다.' },
          { type: 'p', text: '저작권 문제로 음악은 짧은 구간만 미리 들을 수 있습니다.' },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 八、设置说明
  // ------------------------------------------------------------------
  {
    id: 'settings',
    icon: Settings2,
    translations: {
      zh: {
        label: '设置说明',
        eyebrow: 'TUNING THE ROOM',
        title: '让空间更接近你的习惯',
        body: [
          {
            type: 'items',
            items: [
              { title: '视觉美学', text: '切换空间主题，并决定是否在主页保留文学化标题。' },
              { title: '陪伴频率', text: '控制日常自动消息，以及安静时段的范围。如果你想要收到系统通知，请开启系统通知的设置。' },
              { title: '锁屏台词陪伴', text: '管理锁屏媒体卡片中可以出现的陪伴台词。' },
              { title: 'AI 心灵连通', text: '配置你自己的 OpenAI-compatible API 服务。API Key 仅保存在本地设备中。视觉 API 需要单独部署。' },
              { title: '今日留物', text: '选择角色、管理图片盒，以及调整今日留物相关内容。' },
              { title: '数据与本地存储', text: '查看浏览器存储情况，并导出或恢复本地数据。' },
            ],
          },
        ],
      },
      en: {
        label: 'Settings',
        eyebrow: 'TUNING THE ROOM',
        title: 'Make the space fit your habits',
        body: [
          {
            type: 'items',
            items: [
              { title: 'Visual Aesthetics', text: "Switch the space's theme and decide whether to keep the literary title on the home page." },
              { title: 'Companionship Frequency', text: 'Control daily automatic messages and quiet hours. Turn on system notifications here if you want to receive them.' },
              { title: 'Lockscreen Lines', text: 'Manage the companionship lines that can appear on the lockscreen media card.' },
              { title: 'AI Connection', text: 'Configure your own OpenAI-compatible API service. The API Key is only stored on this device. Vision-capable APIs need to be deployed separately.' },
              { title: 'Daily Offering', text: 'Choose a character, manage the image pool, and adjust everything related to the daily offering.' },
              { title: 'Data & Local Storage', text: 'Check your browser storage usage, and export or restore local data.' },
            ],
          },
        ],
      },
      ko: {
        label: '설정 안내',
        eyebrow: 'TUNING THE ROOM',
        title: '공간을 당신의 습관에 맞추기',
        body: [
          {
            type: 'items',
            items: [
              { title: '비주얼 테마', text: '공간의 테마를 바꾸고, 홈 화면에 문학적인 타이틀을 유지할지 결정합니다.' },
              { title: '동행 빈도', text: '일상 자동 메시지와 방해 금지 시간대를 조절합니다. 시스템 알림을 받고 싶다면 여기서 켜세요.' },
              { title: '잠금화면 대사', text: '잠금화면 미디어 카드에 나타날 수 있는 동행 대사를 관리합니다.' },
              { title: 'AI 연결', text: '자신의 OpenAI 호환 API 서비스를 설정합니다. API Key는 이 기기에만 저장됩니다. 비전(이미지) API는 별도로 배포해야 합니다.' },
              { title: '오늘의 선물', text: '캐릭터를 선택하고, 이미지 풀을 관리하며, 오늘의 선물과 관련된 항목을 조정합니다.' },
              { title: '데이터 및 로컬 저장', text: '브라우저 저장 공간 사용량을 확인하고, 로컬 데이터를 내보내거나 복원합니다.' },
            ],
          },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 九、数据与隐私
  // ------------------------------------------------------------------
  {
    id: 'privacy',
    icon: LockKeyhole,
    translations: {
      zh: {
        label: '数据与隐私',
        eyebrow: 'KEPT LOCALLY',
        title: '你的记录，留在自己的设备里',
        body: [
          { type: 'p', text: 'WHEN I with U 使用浏览器本地数据库保存角色、消息、影像和其他生活记录。' },
          {
            type: 'p',
            text: 'WHEN I with U 没有任何统一的服务器中转或跨域代理。所有 AI 对话请求，都是您的浏览器直接使用您自己配置的 API Key 和 Base URL，发送到您自己选择的 AI 服务商，不会经过本项目的任何服务器。',
          },
          {
            type: 'note',
            text: '正因为没有统一中转，部分依赖外部服务（例如语音通话所需的 MiniMax）需要您自己部署跨域 Worker 才能使用——这是出于保护用户隐私、避免数据集中存储的设计选择，而不是功能缺失。',
          },
          {
            type: 'p',
            text: '这些内容不会因为打开另一个页面而自动上传到某个公共账户。只有在使用你配置的 AI 服务时，相关请求内容才会发送到对应的 API 服务。您的角色资料、聊天记录、日记、相册等所有数据，都只保存在您本设备浏览器的本地数据库中，作者本人也无法通过任何手段读取、下载或接触到您的具体内容。',
          },
          { type: 'p', text: '如果你清除浏览器站点数据，或者卸载应用而没有提前备份，本地记录可能会丢失。因此，重要内容建议定期导出备份。' },
          { type: 'note', text: '导入备份会覆盖当前设备上的本地记录。执行前请确认文件来源，并在必要时先导出当前数据。' },
        ],
      },
      en: {
        label: 'Data & Privacy',
        eyebrow: 'KEPT LOCALLY',
        title: 'Your records stay on your own device',
        body: [
          { type: 'p', text: "WHEN I with U saves characters, messages, images, and other life records in your browser's local database." },
          {
            type: 'p',
            text: "WHEN I with U has no unified relay server or cross-origin proxy of any kind. Every AI conversation request goes straight from your browser, using the API Key and Base URL you configured yourself, to the AI provider you chose — none of it passes through any server belonging to this project.",
          },
          {
            type: 'note',
            text: "Precisely because there's no central relay, some features that depend on outside services (voice calls via MiniMax, for example) require you to deploy your own CORS worker — that's a deliberate design choice to protect user privacy and avoid centralizing data, not a missing feature.",
          },
          {
            type: 'p',
            text: "This content doesn't get uploaded to any public account just by opening another page. Only when you use the AI service you've configured does the relevant request content get sent to that API. Your character profiles, chat history, diary entries, photo albums, and all other data are only ever saved in your own device's local browser database — I, the author, also have no way to read, download, or access your specific content through any means.",
          },
          { type: 'p', text: 'If you clear your browser\'s site data, or uninstall the app without backing up first, local records may be lost. For anything important, export a backup regularly.' },
          { type: 'note', text: "Importing a backup overwrites the local records currently on this device. Confirm the file's source first, and export your current data beforehand if needed." },
        ],
      },
      ko: {
        label: '데이터 및 개인정보',
        eyebrow: 'KEPT LOCALLY',
        title: '당신의 기록은 이 기기에만 남습니다',
        body: [
          { type: 'p', text: 'WHEN I with U는 캐릭터, 메시지, 이미지 등 생활 기록을 브라우저의 로컬 데이터베이스에 저장합니다.' },
          {
            type: 'p',
            text: 'WHEN I with U에는 통합 중계 서버나 크로스 오리진 프록시가 전혀 없습니다. 모든 AI 대화 요청은 사용자가 직접 설정한 API Key와 Base URL을 사용해 브라우저에서 바로 사용자가 선택한 AI 제공사로 전송되며, 이 프로젝트의 서버를 거치지 않습니다.',
          },
          {
            type: 'note',
            text: '통합 중계가 없기 때문에, 외부 서비스에 의존하는 일부 기능(예: 음성 통화에 필요한 MiniMax)은 사용자가 직접 CORS 워커를 배포해야 사용할 수 있습니다 — 이는 기능 누락이 아니라 사용자의 개인정보를 보호하고 데이터 집중 저장을 피하기 위한 의도적인 설계입니다.',
          },
          {
            type: 'p',
            text: '다른 페이지를 열었다고 해서 이 내용이 어떤 공개 계정으로 자동 업로드되지는 않습니다. 당신이 설정한 AI 서비스를 사용할 때만 관련 요청 내용이 해당 API로 전송됩니다. 캐릭터 프로필, 채팅 기록, 일기, 앨범 등 모든 데이터는 오직 당신 기기의 브라우저 로컬 데이터베이스에만 저장되며, 작성자 본인 역시 어떠한 방법으로도 당신의 구체적인 내용을 읽거나 다운로드하거나 접근할 수 없습니다.',
          },
          { type: 'p', text: '브라우저 사이트 데이터를 지우거나 백업 없이 앱을 삭제하면 로컬 기록을 잃을 수 있습니다. 중요한 내용은 정기적으로 백업을 내보내는 것을 권장합니다.' },
          { type: 'note', text: '백업을 가져오면 이 기기에 있는 현재 로컬 기록을 덮어씁니다. 실행 전에 파일의 출처를 확인하고, 필요하다면 먼저 현재 데이터를 내보내세요.' },
        ],
      },
    },
  },

  // ------------------------------------------------------------------
  // 十、常见问题
  // ------------------------------------------------------------------
  {
    id: 'faq',
    icon: CircleHelp,
    translations: {
      zh: {
        label: '常见问题',
        eyebrow: 'A FEW NOTES',
        title: '使用时可能遇到的情况',
        body: [
          {
            type: 'items',
            items: [
              { title: '为什么某些图片或音乐无法打开？', text: '外部媒体受到网络、地区、版权和来源服务状态影响。基础内容不会因此无法保存。' },
              { title: '刷新后内容不见了怎么办？', text: '大多数内容会保存在本地数据库中。请先确认浏览器没有处于无痕模式，也没有清除站点数据。' },
            ],
          },
        ],
      },
      en: {
        label: 'FAQ',
        eyebrow: 'A FEW NOTES',
        title: 'Things you might run into',
        body: [
          {
            type: 'items',
            items: [
              { title: "Why can't some images or music open?", text: "External media is affected by network, region, copyright, and the source service's status. Core content isn't affected and stays saved." },
              { title: 'Content disappeared after a refresh?', text: 'Most content is saved in the local database. First check that your browser is not in private/incognito mode and hasn\'t cleared site data.' },
            ],
          },
        ],
      },
      ko: {
        label: '자주 묻는 질문',
        eyebrow: 'A FEW NOTES',
        title: '사용 중 겪을 수 있는 상황들',
        body: [
          {
            type: 'items',
            items: [
              { title: '왜 어떤 이미지나 음악은 열리지 않나요?', text: '외부 미디어는 네트워크, 지역, 저작권, 원본 서비스 상태의 영향을 받습니다. 기본 콘텐츠는 이 때문에 사라지지 않고 그대로 저장됩니다.' },
              { title: '새로고침 후 내용이 사라졌어요', text: '대부분의 콘텐츠는 로컬 데이터베이스에 저장됩니다. 브라우저가 시크릿 모드가 아닌지, 사이트 데이터를 지우지 않았는지 먼저 확인해 보세요.' },
            ],
          },
        ],
      },
    },
  },
];

export default MANUAL_SECTIONS;