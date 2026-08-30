import React, { useState } from 'react';
import {
  ArrowLeft,
  bat,
  ChevronRight,
  CircleHelp,
  Database,
  Heart,
  LockKeyhole,
  MessageCircle,
  Settings2,
  Sparkles,
} from 'lucide-react';

const MANUAL_SECTIONS = [
  {
    id: 'welcome',
    label: '序言',
    eyebrow: 'A PRIVATE SPACE',
    title: '欢迎来到 WHEN I with U',
    icon: Heart,
    content: (
      <>
        <p>
          选择这个名字，是因为我觉得两个人在一起的时间总是非常宝贵。
          希望这个网站可以陪伴你度过一些美好的时光。
        </p>
        <p>
          如果你希望更方便地使用它，可以通过浏览器的“分享”功能将网站安装到手机主屏幕。
        </p>
      </>
    ),
  },
  {
    id: 'author',
    label: '作者与联系',
    eyebrow: 'A NOTE FROM THE AUTHOR',
    title: '关于这间房子的作者',
    icon: bat,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="作者"
          description="玉元一 shadow"
        />
        <ManualItem
          title="小红书"
          description="shadowmfn"
        />
        <ManualItem
          title="QQ群：月光咖啡屋"
          description="811831045（审核群）"
        />

        <p>
          月光咖啡屋里主要会堆放一些我的产出，包括酒馆的角色卡、美化、预设、插件等。
          因为工作关系，更新可能不会很快；如果使用中遇到问题，也可以来咖啡屋问问。
        </p>

        <div className="manual-note">
          <span className="manual-note__line" />
          <p>
            审核会卡成年和女性哦。
          </p>
        </div>

        <p>
          如果对 WHEN I with U 的使用有疑问，也可以直接私信我的小红书。
        </p>

        <p>
          网站链接可以二转分享。由于担心被认为是引流，另一个小红书账号暂不方便提及，但也是我本人在使用。
        </p>

        <p>
          如果喜欢这个项目，也请老师们给我吃吃 repo 叭！
        </p>
      </div>
    ),
  },
  {
    id: 'spaces',
    label: '空间索引',
    eyebrow: 'THE ROOMS',
    title: '每个空间，都有自己的用途',
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="Hub"
          description="整个空间的入口。查看角色、置顶影像、快速记录，以及进入其他子空间。"
        />
        <ManualItem
          title="Messages"
          description="与角色进行一对一的长期交流。需要注意的是，几乎所有其他空间都不会读取你与角色在消息框中的聊天记录，只会获取角色的基础资料数据。"
        />
        <ManualItem
          title="Diaries"
          description="保存独自书写或与角色共同留下的日记片段。角色也可以主动向你发送日记。"
        />
        <ManualItem
          title="Travel"
          description="与角色一起去旅行，并保存旅途中寄回来的小记录。"
        />
        <ManualItem
          title="Snapshots"
          description="保存像拍立得一样的瞬间、影像与相关评论。角色之间也可以在这里互动。"
        />
        <ManualItem
          title="Pebbling"
          description="一个可以随便说些什么、留下轻小片段的地方。"
        />
        <ManualItem
          title="Imaginarium"
          description="虚拟群聊空间。填写群聊信息后，可以设定多个角色一起聊天。"
        />
        <ManualItem
          title="The Ensemble"
          description="从角色库中选择多个角色，将他们带入同一个群聊。你也可以在这里拥有多个身份。"
        />
        <ManualItem
          title="Living Habitat"
          description="观察角色共同守护的生态空间与生命记录。"
        />
        <ManualItem
          title="Ephemera"
          description="将日常事件保存成票根、收据、卡片或其他可以收藏的物件。"
        />
      </div>
    ),
  },
  {
    id: 'getting-started',
    label: '开始使用',
    eyebrow: 'FIRST STEPS',
    title: '第一次进入时，可以这样开始',
    icon: Sparkles,
    content: (
      <ol className="manual-numbered-list">
        <li>
          <strong>先进入设置空间</strong>
          <span>在这里选择主题、调整首页标题，并完成基础配置。</span>
        </li>
        <li>
          <strong>添加一个角色</strong>
          <span>角色是这个私人空间的核心。完成角色资料后，其他陪伴功能才会逐渐展开。</span>
        </li>
        <li>
          <strong>配置自己的 AI 服务</strong>
          <span>填写兼容的 API 地址、密钥和模型，然后使用连通性测试确认配置。</span>
        </li>
        <li>
          <strong>回到 Hub</strong>
          <span>从这里开始查看空间中的日常痕迹，并按照自己的需要进入不同区域。</span>
        </li>
      </ol>
    ),
  },
  {
    id: 'daily-offering',
    label: '今日留物',
    eyebrow: 'A SMALL OFFERING',
    title: '只属于今天的一件小东西',
    icon: MessageCircle,
    content: (
      <>
        <p>
          今日留物是角色每天留下的一次轻量陪伴。它可能是一首歌、一张图片，或者一句只在今天出现的寄语。
        </p>
        <p>
          它不会成为任务，只是短暂地出现在这里，等你偶然发现。
        </p>
        <div className="manual-note">
          <span className="manual-note__line" />
          <p>当天没有点击右上角关闭按钮时，刷新页面后仍然可以看到同一份留物。</p>
        </div>
        <p>
          一旦主动关闭，它便不会在当天再次出现。第二天进入 Hub 时，空间会准备一份新的内容。
        </p>
      </>
    ),
  },
  {
    id: 'settings',
    label: '设置说明',
    eyebrow: 'TUNING THE ROOM',
    title: '让空间更接近你的习惯',
    icon: Settings2,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="视觉美学"
          description="切换空间主题，并决定是否在主页保留文学化标题。"
        />
        <ManualItem
          title="陪伴频率"
          description="控制日常自动消息，以及安静时段的范围。"
        />
        <ManualItem
          title="锁屏台词陪伴"
          description="管理锁屏媒体卡片中可以出现的陪伴台词。"
        />
        <ManualItem
          title="AI 心灵连通"
          description="配置你自己的 OpenAI-compatible API 服务。API Key 仅保存在本地设备中。"
        />
        <ManualItem
          title="今日留物"
          description="选择角色、管理图片盒，以及调整今日留物相关内容。"
        />
        <ManualItem
          title="数据与本地存储"
          description="查看浏览器存储情况，并导出或恢复本地数据。"
        />
      </div>
    ),
  },
  {
    id: 'privacy',
    label: '数据与隐私',
    eyebrow: 'KEPT LOCALLY',
    title: '你的记录，留在自己的设备里',
    icon: LockKeyhole,
    content: (
      <>
        <p>
          WHEN I with U 使用浏览器本地数据库保存角色、消息、影像和其他生活记录。
        </p>
        <p>
          这些内容不会因为打开另一个页面而自动上传到某个公共账户。只有在使用你配置的 AI 服务时，相关请求内容才会发送到对应的 API 服务。
        </p>
        <p>
          如果你清除浏览器站点数据，或者卸载应用而没有提前备份，本地记录可能会丢失。因此，重要内容建议定期导出备份。
        </p>
        <div className="manual-note">
          <Database className="h-4 w-4 shrink-0" strokeWidth={1.6} />
          <p>导入备份会覆盖当前设备上的本地记录。执行前请确认文件来源，并在必要时先导出当前数据。</p>
        </div>
      </>
    ),
  },
  {
    id: 'faq',
    label: '常见问题',
    eyebrow: 'A FEW NOTES',
    title: '使用时可能遇到的情况',
    icon: CircleHelp,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="没有配置 API，可以使用吗？"
          description="可以。空间中的本地记录功能仍然可以使用，涉及 AI 的部分会等待你完成配置。"
        />
        <ManualItem
          title="为什么某些图片或音乐无法打开？"
          description="外部媒体受到网络、地区、版权和来源服务状态影响。基础内容不会因此无法保存。"
        />
        <ManualItem
          title="刷新后内容不见了怎么办？"
          description="大多数内容会保存在本地数据库中。请先确认浏览器没有处于无痕模式，也没有清除站点数据。"
        />
        <ManualItem
          title="如何保护自己的 API Key？"
          description="不要在公共设备上保存密钥，也不要将包含密钥的备份文件发送给他人。"
        />
      </div>
    ),
  },
];

function ManualItem({ title, description }) {
  return (
    <div className="manual-item">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export const ManualApp = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('welcome');

  const currentSection =
    MANUAL_SECTIONS.find((section) => section.id === activeSection) ||
    MANUAL_SECTIONS[0];

  const SectionIcon = currentSection.icon;

  return (
    <div className="manual-page">
      <header className="manual-header">
        <button
          type="button"
          onClick={onBack}
          className="manual-back-button"
          aria-label="返回设置"
          title="返回设置"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
        </button>

        <div className="manual-header__title">
          <span>THE HOUSE MANUAL</span>
          <h1>空间说明书</h1>
        </div>

        <div className="manual-header__mark">
          <BookOpen className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </header>

      <section className="manual-intro">
        <p className="manual-intro__eyebrow">
          WHEN I WITH U / NOTES FOR LIVING HERE
        </p>

        <h2>
          一份简单的
          <br />
          使用说明
        </h2>

        <p>
          这不是规则清单，只是一些帮助你认识这间房子的文字。
        </p>
      </section>

      <nav className="manual-index" aria-label="说明书目录">
        <div className="manual-index__label">CONTENTS</div>

        <div className="manual-index__list">
          {MANUAL_SECTIONS.map((section, index) => {
            const Icon = section.icon;
            const isActive = section.id === activeSection;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`manual-index__item ${
                  isActive ? 'manual-index__item--active' : ''
                }`}
              >
                <span className="manual-index__number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{section.label}</span>
                <ChevronRight
                  className="ml-auto h-3.5 w-3.5"
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <article
        className="manual-article animate-fade-in-up"
        key={currentSection.id}
      >
        <div className="manual-article__topline">
          <span>{currentSection.eyebrow}</span>
          <span>
            {String(
              MANUAL_SECTIONS.indexOf(currentSection) + 1,
            ).padStart(2, '0')}
          </span>
        </div>

        <div className="manual-article__icon">
          <SectionIcon className="h-5 w-5" strokeWidth={1.4} />
        </div>

        <h2>{currentSection.title}</h2>

        <div className="manual-article__body">
          {currentSection.content}
        </div>

        <div className="manual-article__footer">
          <span>WHEN I with U</span>
          <span>—</span>
          <span>KEEP WHAT MATTERS</span>
        </div>
      </article>

      <p className="manual-page__footer">by shadow</p>
    </div>
  );
};

export default ManualApp;

