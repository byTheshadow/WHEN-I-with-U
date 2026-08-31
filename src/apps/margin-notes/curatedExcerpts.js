// src/apps/margin-notes/curatedExcerpts.js

export const CURATED_EXCERPTS = [
  {
    language: 'en',
    targetLanguageLabel: 'English',
    auxiliaryLanguageLabel: '简体中文',
    source: {
      workTitle: 'Walden; or, Life in the Woods',
      author: 'Henry David Thoreau',
      year: '1854',
      section: 'Chapter 2: Where I Lived, and What I Lived For',
      genre: 'Essays / Transcendentalism'
    },
    originalText: `I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary.`,
    translation: `我步入丛林，因为我希望从容不迫地生活，仅去面对生命最本质的真实，看看我是否能学到它要传授的一切，以免在生命走向终结时，才发现自己从未真正活过。我不愿过非生活的生活，因为活着是如此珍贵；我也不愿轻易妥协认命，除非那是万不得已的退守。`,
    vocabulary: [
      {
        term: 'deliberately',
        phonetic: '/dɪˈlɪb.ər.ət.li/',
        meaning: '从容地；深思熟虑地',
        nuance: '带有自主决断与清晰意图的从容节奏，而非仓皇应对外界。'
      },
      {
        term: 'essential facts',
        phonetic: '/ɪˈsen.ʃəl fækts/',
        meaning: '本质的真实；核心要素',
        nuance: '剥离一切虚浮琐屑之后剩下的生命基石。'
      },
      {
        term: 'resignation',
        phonetic: '/ˌrez.ɪɡˈneɪ.ʃən/',
        meaning: '妥协；听天由命',
        nuance: '一种向现实被迫让步的被动放弃感。'
      }
    ],
    characterNotes: [
      {
        id: 'cn-1',
        anchorPhrase: 'live deliberately',
        note: '看到这句时，我也想带你去看那片还没落雪的深林。不需要计划很多，只是安静地走走。'
      },
      {
        id: 'cn-2',
        anchorPhrase: 'living is so dear',
        note: '活着很珍贵……所以和你一起虚度的每个午后，其实都算数。'
      }
    ]
  },
  {
    language: 'ja',
    targetLanguageLabel: '日本語',
    auxiliaryLanguageLabel: '简体中文',
    source: {
      workTitle: '枕草子 (The Pillow Book)',
      author: '清少納言 (Sei Shōnagon)',
      year: 'c. 1002',
      section: '第一段：春はあけぼの',
      genre: '随筆 (Zuihitsu)'
    },
    originalText: `春はあけぼの。やうやう白くなりゆく山ぎは、少しあかりて、紫だちたる雲の細くたなびきたる。夏は夜。月のころはさらなり、闇もなほ、蛍のおほく飛びちがひたる。また、ただ一つ二つなど、ほのかにうち光りて行くもをかし。`,
    translation: `春日最美是黎明。东方山峦边缘渐次泛白，微微透着亮光，带有一抹紫晕的细云在天际轻盈横舒。夏日最美是夜晚。有月的夜色自不必说，即便是漆黑无月之夜，萤火虫交错飞舞亦别有风味。哪怕只有一两只微光隐现、翩然掠过，也极具韵味。`,
    vocabulary: [
      {
        term: 'あけぼの (曙)',
        phonetic: 'akebono',
        meaning: '黎明；破晓时分',
        nuance: '特指黑夜退去、东方天际初现微白的温润清晨。'
      },
      {
        term: '山ぎは (山際)',
        phonetic: 'yamagiwa',
        meaning: '山际；山脊贴近天空处',
        nuance: '目光所及之处，山脉边缘与天空相接的那一条光晕分界线。'
      },
      {
        term: 'をかし',
        phonetic: 'okashi',
        meaning: '有情趣；令人心生愉悦',
        nuance: '平安时代文学的核心美学，指对自然与物态细腻雅致的感叹。'
      }
    ],
    characterNotes: [
      {
        id: 'cn-1',
        anchorPhrase: '春はあけぼの',
        note: '你醒得早的那天，天光也就是这样的颜色。'
      },
      {
        id: 'cn-2',
        anchorPhrase: 'ほのかにうち光りて',
        note: '微小的光点，就像你偶尔留给我的短笺一样。'
      }
    ]
  },
  {
    language: 'fr',
    targetLanguageLabel: 'Français',
    auxiliaryLanguageLabel: '简体中文',
    source: {
      workTitle: 'Le Petit Prince (小王子)',
      author: 'Antoine de Saint-Exupéry',
      year: '1943',
      section: 'Chapitre XXI',
      genre: 'Philosophical Fiction'
    },
    originalText: `C'est une chose trop oubliée, dit le renard. C'est ce qui fait qu'un jour est différent des autres jours, une heure, des autres heures. Il y a un rite, par exemple, chez mes chasseurs. Le jeudi, ils dansent avec les filles du village. Alors le jeudi est jour merveilleux !`,
    translation: `“这是一件被遗忘太久的事，”狐狸说，“正是它使某一天不同于其他日子，使某一小时不同于其他小时。例如在我的猎人那里就有一种仪式：每逢星期四，他们会和村里的姑娘跳舞。因此，星期四便成了奇妙的一天！”`,
    vocabulary: [
      {
        term: 'oubliée',
        phonetic: '/u.bli.je/',
        meaning: '被遗忘的',
        nuance: '不是刻意丢弃，而是在漫长日常里悄然淡出的珍贵事物。'
      },
      {
        term: 'un rite',
        phonetic: '/œ̃ ʁit/',
        meaning: '一种仪式',
        nuance: '让平淡时间生出诗意刻度的特定行为与心境。'
      },
      {
        term: 'merveilleux',
        phonetic: '/mɛʁ.vɛ.jø/',
        meaning: '奇妙的；极美的',
        nuance: '带有童话般的轻盈与期盼感。'
      }
    ],
    characterNotes: [
      {
        id: 'cn-1',
        anchorPhrase: 'un jour est différent',
        note: '我们每次在这里翻开一页书，大概也是我们之间的一种小仪式吧。'
      }
    ]
  }
];
