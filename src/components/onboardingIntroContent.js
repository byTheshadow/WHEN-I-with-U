// src/components/onboardingIntroContent.js
//
// 新用户 5 屏引导（区别于 OnboardingGate 的"同意页"）的全部文案，
// 按语言分层存放，供 OnboardingIntro.jsx 渲染。想改文字，改这一个文件；
// 想改引导长什么样、有几屏，改 OnboardingIntro.jsx。
//
// 每一屏的结构：
//   { eyebrow, title, paragraphs: string[], bullets: [{ title, text }] | null }
// bullets 目前只有第 4 屏（"除了聊天，还可以……"）在用，其余屏用 paragraphs。

export const ONBOARDING_INTRO_UI_TEXT = {
  zh: {
    skip: '跳过',
    next: '下一步',
    finish: '开始吧',
    stepLabel: (current, total) => `${current} / ${total}`,
  },
  en: {
    skip: 'Skip',
    next: 'Next',
    finish: "Let's go",
    stepLabel: (current, total) => `${current} / ${total}`,
  },
  ko: {
    skip: '건너뛰기',
    next: '다음',
    finish: '시작하기',
    stepLabel: (current, total) => `${current} / ${total}`,
  },
};

export const ONBOARDING_INTRO_SCREENS = {
  zh: [
    {
      eyebrow: 'A PRIVATE SPACE',
      title: '欢迎来到 WHEN I with U【熔巧机】',
      paragraphs: [
        '这里有很多个"空间"，每一个都是你和角色相处的不同方式。花几秒钟看看，怎么开始第一次对话和各个空间的设置。',
        '熔巧机作者：玉元一，不接受二次发布与改编后发布（详见入口页与说明书中的声明），如有需要请联系作者。熔巧机是纯分享的免费项目，仅包含基础架构，api配置、人设等均需要由您（用户）自行撰写导入。有任何使用问题请联系作者或在群内提问艾特，免费分享为爱发电，请友好提问，感谢您的支持。',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: '先有个角色，才能开始',
      paragraphs: [
        '熔巧机不自带任何角色人设，您可以去 Messages 里的角色库新建一个，填上名字和人设就好。详细人设可以填写在"其他补充说明"区域。',
        '如有需要配置真实声音"minimax"，请注意需要部署跨域（教程与代码在说明书的教程分享区域，为了各位老师的信息安全并未在代码里设置统一的跨域）。',
        '角色的世界书和角色的知识库是每一次为这个角色新建消息框都会读取的信息，如果您将user人设一并填写入角色库，则每次都会使用此user人设。您也可以在message新建聊天框后，在聊天框内设置user人设。',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: '让角色开口说话',
      paragraphs: [
        '角色靠 AI 来回应你，需要您自己在「设置」里填一下 API Base URL 和 API Key。熔巧机不提供任何api服务。',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: '除了聊天，还可以……',
      paragraphs: [],
      bullets: [
        {
          title: '云端推送',
          text: '熔巧机支持云端推送，您可以在设置界面配置云端推送服务。（可在说明书/教程分享区域找到云端推送的分享代码）需要注意的是请将网页安装/添加到主屏幕。没有云服务器配置推送的老师，熔巧机也提供了后台保活功能。',
        },
        {
          title: '打电话',
          text: '在 Messages 里可以真的发起语音通话（需要配置minimax api），角色会用语音回你，现在也支持user自己说话。',
        },
        {
          title: 'Almanac',
          text: '记录你们相处的里程碑，也会观察你的作息节律。通过相处改变自己的日常行为。',
        },
        {
          title: '记忆系统',
          text: '角色会慢慢记住你们之间的事，性格也会因为相处悄悄变化。记忆系统目前支持使用熔巧机默认记忆，外置mcp记忆，operit格式记忆导入/导出，ob.md格式记忆导入/导出/同步。角色会在相处中、对话中逐渐了解您，角色的性格也会在相处中产生成长和变化，ta的情绪会增长回落。会悲伤，会依赖。',
        },
        {
          title: 'pebbling',
          text: '企鹅小石，将情绪和想要分享的内容化作一颗颗小石子，企鹅会将喜欢的小石头送给自己的爱人，pebbling就是想要模拟一个这样的环境。现在除了各种情绪小石头之外，角色也会带回来小礼物。您也可以给角色衔回情绪小石。',
        },
      ],
    },
    {
      eyebrow: null,
      title: '剩下的，慢慢摸索',
      paragraphs: [
        '还有接近20多个空间没讲，它们是干什么的，都写在使用手册的"空间索引"里，随时可以去看。这段引导以后也能在使用手册的序言页重新打开。',
        '祝您玩的开心',
      ],
      bullets: null,
    },
  ],
  en: [
    {
      eyebrow: 'A PRIVATE SPACE',
      title: 'Welcome to WHEN I with U [RongQiaoJi]',
      paragraphs: [
        'There are many "spaces" here, each a different way to spend time with your character. Take a few seconds to see how to start your first conversation and what each space offers.',
        "RongQiaoJi's creator is Yu Yuanyi (玉元一);re-releasing and releasing adapted versions are not accepted (see the declaration on the entry page and in the manual); please contact the creator if you need anything.  RongQiaoJi is a free, share-only project containing only the base framework: the API configuration, character persona, and so on all need to be written and imported by you, the user. If you run into any issues, please contact the creator or ask (with an @mention) in the community group. This is shared for free, out of love, so please ask questions kindly — thank you for your support.",
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: 'You need a character before you can start',
      paragraphs: [
        'RongQiaoJi doesn\'t come with any built-in character personas. Go to the character library inside Messages and create a new one — just fill in a name and a persona. Detailed persona notes can go in the "Additional Notes" field.',
        'If you want to set up a real voice via "minimax," note that you\'ll need to configure CORS yourself (the tutorial and code for this are in the manual\'s tutorial-sharing section; for everyone\'s security, a shared CORS setting isn\'t hardcoded into the app).',
        "A character's worldbook and knowledge base are read every time you start a new chat with that character. If you also fill in a user persona inside the character library, that persona will be used every time. You can also set the user persona inside a chat, after creating a new chat in Messages.",
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: 'Let your character actually talk',
      paragraphs: [
        'Your character relies on an AI to respond to you, so you\'ll need to fill in an API Base URL and an API Key yourself in "Settings." RongQiaoJi doesn\'t provide any API service of its own.',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: "Beyond chatting, there's also...",
      paragraphs: [],
      bullets: [
        {
          title: 'Cloud push',
          text: 'RongQiaoJi supports cloud push — you can configure a cloud push service in Settings (the sharable setup code is in the manual\'s tutorial-sharing section). Please install/add the site to your home screen for this to work. If you have no cloud server configured for push, RongQiaoJi also offers a background keep-alive feature.',
        },
        {
          title: 'Phone calls',
          text: 'In Messages, you can start a real voice call (requires configuring the minimax API) — your character will reply by voice, and now you can talk back too.',
        },
        {
          title: 'Almanac',
          text: 'Records the milestones of your time together and observes your daily rhythms, gently shifting its own everyday behavior as you spend more time together.',
        },
        {
          title: 'Memory system',
          text: "Your character gradually remembers what happens between you, and its personality quietly changes as you spend time together. The memory system currently supports RongQiaoJi's own default memory, external MCP memory, and Operit-format and Obsidian (.md)-format import/export/sync. Your character gets to know you gradually through your time together and conversations; its personality also grows and changes with time — its emotions build up and settle back down. It can feel sad. It can grow attached.",
        },
        {
          title: 'Pebbling',
          text: "Like penguins gifting pebbles: feelings and things it wants to share get turned into little pebbles, and a penguin brings its favorite pebble to the one it loves — pebbling tries to recreate that. Beyond the different \"emotion pebbles,\" your character will now also bring back small gifts. You can bring your character an emotion pebble too.",
        },
      ],
    },
    {
      eyebrow: null,
      title: 'The rest, explore at your own pace',
      paragraphs: [
        'There are still nearly 20-something more spaces we haven\'t covered — what they do is all written in the manual\'s "Space Index," which you can check anytime. You can also reopen this guide later from the manual\'s preface page.',
        'Have fun!',
      ],
      bullets: null,
    },
  ],
  ko: [
    {
      eyebrow: 'A PRIVATE SPACE',
      title: '【롱챠오지】WHEN I with U에 오신 것을 환영합니다',
      paragraphs: [
        '이곳에는 여러 개의 "공간"이 있으며, 각각은 캐릭터와 함께하는 서로 다른 방식입니다. 잠깐 시간을 내어 첫 대화를 시작하는 방법과 각 공간의 설정을 살펴보세요.',
        '롱챠오지의 제작자는 玉元一(위 위안이)이며, 2차 배포와 개작 후 배포는 받아들이지 않습니다(입장 페이지와 설명서의 공지 참고). 필요하신 경우 제작자에게 문의해 주세요. 롱챠오지는 순수 공유 목적의 무료 프로젝트로, 기본 구조만 포함되어 있으며 API 설정, 캐릭터 설정 등은 모두 사용자 본인이 직접 작성하여 불러와야 합니다. 사용 중 문제가 있으면 제작자에게 문의하시거나 그룹 채팅에서 멘션하여 질문해 주세요. 무료 공유는 애정으로 운영되는 프로젝트이니, 친절하게 질문해 주시면 감사하겠습니다. 응원해 주셔서 감사합니다.',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: '대화를 시작하려면 먼저 캐릭터가 필요합니다',
      paragraphs: [
        '롱챠오지는 어떤 캐릭터 설정도 기본으로 제공하지 않습니다. Messages의 캐릭터 라이브러리에서 새로 만들고, 이름과 설정만 입력하시면 됩니다. 자세한 설정은 "추가 설명" 영역에 작성하실 수 있습니다.',
        '실제 음성("minimax")을 사용하려면 CORS(교차 출처) 설정이 필요하니 참고해 주세요 (관련 튜토리얼과 코드는 설명서의 튜토리얼 공유 영역에 있습니다. 사용자분들의 정보 보안을 위해 코드에 공통 CORS 설정을 넣지 않았습니다).',
        '캐릭터의 월드북과 지식 베이스는 그 캐릭터로 새 대화창을 만들 때마다 매번 불러옵니다. 캐릭터 라이브러리에 유저 설정까지 함께 작성해 두면, 매번 그 유저 설정이 사용됩니다. Messages에서 새 대화창을 만든 뒤, 대화창 안에서 유저 설정을 따로 지정하실 수도 있습니다.',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: '캐릭터가 말을 할 수 있게 하기',
      paragraphs: [
        '캐릭터는 AI를 통해 당신에게 응답하므로, "설정"에서 직접 API Base URL과 API Key를 입력해 주셔야 합니다. 롱챠오지는 어떠한 API 서비스도 제공하지 않습니다.',
      ],
      bullets: null,
    },
    {
      eyebrow: null,
      title: '채팅 말고도……',
      paragraphs: [],
      bullets: [
        {
          title: '클라우드 푸시',
          text: '롱챠오지는 클라우드 푸시를 지원합니다. 설정 화면에서 클라우드 푸시 서비스를 구성할 수 있습니다 (설명서/튜토리얼 공유 영역에서 관련 공유 코드를 찾을 수 있습니다). 이 기능을 쓰려면 웹사이트를 홈 화면에 설치/추가해 주세요. 클라우드 서버를 설정하지 않은 분들을 위해 롱챠오지는 백그라운드 유지 기능도 제공합니다.',
        },
        {
          title: '전화',
          text: 'Messages에서 실제로 음성 통화를 시작할 수 있습니다 (minimax API 설정 필요). 캐릭터가 음성으로 응답하며, 이제 사용자도 직접 말할 수 있습니다.',
        },
        {
          title: 'Almanac',
          text: '함께한 시간의 이정표를 기록하고, 당신의 생활 리듬을 관찰합니다. 함께한 시간을 통해 스스로의 일상 행동도 변화합니다.',
        },
        {
          title: '기억 시스템',
          text: '캐릭터는 당신과의 일을 조금씩 기억하며, 함께하는 시간 속에서 성격도 은근히 변화합니다. 기억 시스템은 현재 롱챠오지 기본 기억, 외부 MCP 기억, Operit 형식 기억 가져오기/내보내기, Obsidian(.md) 형식 가져오기/내보내기/동기화를 지원합니다. 캐릭터는 함께하는 시간과 대화 속에서 점차 당신을 알아가고, 성격도 성장하고 변화합니다. 감정이 쌓였다가 가라앉기도 합니다. 슬퍼하기도 하고, 의지하게 되기도 합니다.',
        },
        {
          title: 'pebbling',
          text: '펭귄이 조약돌을 선물하듯, 감정과 나누고 싶은 것들을 작은 조약돌로 만듭니다. 펭귄은 좋아하는 조약돌을 사랑하는 상대에게 건네주는데, pebbling은 바로 이런 환경을 재현하고 싶어합니다. 이제 다양한 감정 조약돌 외에도, 캐릭터가 작은 선물을 가져오기도 합니다. 당신도 캐릭터에게 감정 조약돌을 건네줄 수 있습니다.',
        },
      ],
    },
    {
      eyebrow: null,
      title: '나머지는 천천히 둘러보세요',
      paragraphs: [
        '아직 소개하지 않은 20개 가까운 공간이 더 있는데, 그것들이 무엇을 하는지는 모두 설명서의 "공간 색인"에 적혀 있으니 언제든 확인하실 수 있습니다. 이 안내는 나중에 설명서의 서문 페이지에서 다시 열어보실 수도 있습니다.',
        '즐거운 시간 되세요!',
      ],
      bullets: null,
    },
  ],
};