import { useEffect, useState } from 'react';
import db from '../db';
import './OnboardingGate.css';
import DeclarationBlock from './DeclarationBlock';

const I18N = {
  zh: {
    code: 'zh',
    label: '中',
    brand: '熔巧机 · WELCOME',
    title: '感谢您使用【熔巧机】',
    intro: '这是一个完全非商业化的小手机，之后也没有商业化的打算，欢迎把链接分享给朋友～',
    notes: [
      '请确保您已经成年哦。',
      '熔巧机不自带任何角色人设和 API，需要您根据自己的需要填写。',
      '如果遇到问题，可以查看接下来的说明；之后也可以在「设置」页面再次找到它，或者来咖啡屋询问。',
    ],
    request: '请您输入下面这句话进入熔巧机，感谢您的配合！',
    consentText: '【我已知情并同意】',
    inputLabel: '请完整输入',
    buttonNormal: '进入熔巧机',
    buttonSaving: '正在进入…',
    readyHint: '好啦，可以进入了',
    matchHint: '输入内容完全匹配后即可继续',
    errRead: '暂时无法读取确认状态，请刷新页面后再试。',
    errSave: '保存失败了，请再试一次。',
    footer: '祝您使用愉快 ♡',
    loadingLabel: '正在准备熔巧机',
  },
  en: {
    code: 'en',
    label: 'EN',
    brand: 'RONGQIAOJI · WELCOME',
    title: 'Thank you for using RongQiaoJi',
    intro: 'This is an entirely non-commercial virtual phone project with no plans for monetization. Feel free to share the link with friends~',
    notes: [
      'Please ensure you are of legal adult age.',
      'RongQiaoJi does not come with preset characters or APIs; please configure them according to your needs.',
      'If you have questions, check the guide next, revisit it in Settings later, or ask in the cafe community.',
    ],
    request: 'Please enter the exact phrase below to proceed:',
    consentText: '[I have read and agree]',
    inputLabel: 'Please enter precisely',
    buttonNormal: 'Enter RongQiaoJi',
    buttonSaving: 'Entering…',
    readyHint: 'All set, you can proceed now',
    matchHint: 'Exact match required to proceed',
    errRead: 'Unable to read consent status. Please refresh.',
    errSave: 'Failed to save. Please try again.',
    footer: 'Have a delightful journey ♡',
    loadingLabel: 'Preparing RongQiaoJi',
  },
  ko: {
    code: 'ko',
    label: '한',
    brand: '롱챠오지 · WELCOME',
    title: '【롱챠오지】를 이용해 주셔서 감사합니다',
    intro: '이곳은 완전 비상업적으로 운영되는 가상 폰이며, 상업화 계획은 없습니다. 친구들에게도 편하게 공유해 주세요～',
    notes: [
      '성인 이용자인지 먼저 확인해 주세요.',
      '롱챠오지는 기본 캐릭터 설정과 API를 제공하지 않으니, 필요에 맞게 직접 입력해 주세요.',
      '이용 중 궁금한 점은 다음 안내를 확인하시거나 설정 페이지, 또는 카페에 문의해 주세요.',
    ],
    request: '아래 문구를 그대로 입력하시면 입장하실 수 있습니다:',
    consentText: '[확인하였으며 동의합니다]',
    inputLabel: '정확히 입력해 주세요',
    buttonNormal: '롱챠오지 입장',
    buttonSaving: '입장 중…',
    readyHint: '확인되었습니다. 입장하실 수 있습니다',
    matchHint: '문구가 완전히 일치해야 계속할 수 있습니다',
    errRead: '확인 상태를 불러오지 못했습니다. 새로고침해 주세요.',
    errSave: '저장에 실패했습니다. 다시 시도해 주세요.',
    footer: '즐거운 시간 되시기를 바랍니다 ♡',
    loadingLabel: '롱챠오지 준비 중',
  },
};

function getInitialLang() {
  const saved = localStorage.getItem('onboarding_lang');
  if (saved && I18N[saved]) return saved;

  const navLang = (navigator.language || '').toLowerCase();
  if (navLang.startsWith('ko')) return 'ko';
  if (navLang.startsWith('en')) return 'en';
  return 'zh';
}

function getNowIso() {
  return new Date().toISOString();
}

// 2026-10：读取"是否已确认"状态时的本地镜像兜底。
//
// 背景：这个状态本来只存在 db.settings 的 onboardingConsent 一条记录里。
// 但 iOS Safari 在内存紧张时会把标签页整个杀掉／静默断开 IndexedDB 连接，
// 用户重新进来时如果恰好撞上这次读取失败，原来的逻辑会直接把人当成"从没
// 确认过"，弹回最初的确认页——哪怕这个人早就确认过、只是这次读取碰巧抽了
// 风。读取失败的根因（系统在内存紧张时杀页面/断连接）没法在代码层面根除，
// 但"读取失败 = 当没确认过处理"这个二选一的应对方式是我们自己选的，能改。
//
// 做法：读取时先重试几次（应对真正瞬时的抖动，常见于那一下子重连）；重试
// 仍然失败，就退一步看本地 localStorage 里有没有镜像过"已确认"——有就放行
// 不再弹确认页，只是静默记一条 warning；两边都拿不到才真的显示确认页。
// 镜像只在"确认成功"时写一次，不参与真正的权威判断（权威状态仍然是
// db.settings），纯粹是读取失败时的最后一道保险。
const CONSENT_READ_RETRY_COUNT = 2; // 不含首次尝试
const CONSENT_READ_RETRY_DELAY_MS = 400; // 间隔基数，逐次递增
const CONSENT_LOCAL_MIRROR_KEY = 'onboardingConsentMirror';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readConsentMirror() {
  try {
    return localStorage.getItem(CONSENT_LOCAL_MIRROR_KEY) === '1';
  } catch {
    // 隐私模式等场景下 localStorage 可能不可用，当作没有镜像处理。
    return false;
  }
}

function writeConsentMirror() {
  try {
    localStorage.setItem(CONSENT_LOCAL_MIRROR_KEY, '1');
  } catch {
    // 写入失败不影响主流程，顶多下次没有这道兜底。
  }
}

export default function OnboardingGate({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const t = I18N[lang];

  useEffect(() => {
    let active = true;

    async function checkConsent() {
      let lastError = null;

      for (let attempt = 0; attempt <= CONSENT_READ_RETRY_COUNT; attempt += 1) {
        try {
          const setting = await db.settings.get('onboardingConsent');
          const hasAccepted = setting?.value?.accepted === true;

          if (hasAccepted) {
            // 顺手把权威状态镜像一份到本地，给以后万一读取失败时兜底用。
            // 这里也会把这次更新之前就已经确认过的老用户悄悄补一份镜像。
            writeConsentMirror();
          }

          if (active) {
            setAccepted(hasAccepted);
            setLoading(false);
          }
          return;
        } catch (readError) {
          lastError = readError;
          if (attempt < CONSENT_READ_RETRY_COUNT) {
            // eslint-disable-next-line no-await-in-loop
            await wait(CONSENT_READ_RETRY_DELAY_MS * (attempt + 1));
          }
        }
      }

      console.error('读取首次确认状态失败（已重试仍失败）：', lastError);

      // 重试用尽了还是读不到——看看本地是否留有"已确认过"的镜像，
      // 有就放行，避免让真正确认过的用户被当成新用户弹回确认页。
      if (readConsentMirror()) {
        console.warn('读取首次确认状态失败，但本地镜像显示已确认过，放行。');
        if (active) {
          setAccepted(true);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setError(t.errRead);
        setLoading(false);
      }
    }

    checkConsent();

    return () => {
      active = false;
    };
  }, [t.errRead]);

  function switchLang(code) {
    setLang(code);
    localStorage.setItem('onboarding_lang', code);
    setInputValue('');
    setError('');
  }

  async function handleConfirm() {
    if (inputValue.trim() !== t.consentText || saving) return;

    setSaving(true);
    setError('');

    try {
      await db.settings.put({
        key: 'onboardingConsent',
        value: {
          accepted: true,
          acceptedAt: getNowIso(),
          lang,
        },
      });

      writeConsentMirror();
      setAccepted(true);
    } catch (writeError) {
      console.error('保存首次确认状态失败：', writeError);
      setError(t.errSave);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="onboarding-loading" aria-label={t.loadingLabel}>
        <span className="onboarding-loading-dot" />
      </div>
    );
  }

  if (accepted) {
    return children;
  }

  const isMatched = inputValue.trim() === t.consentText;

  return (
    <main className={`onboarding-page lang-${lang}`}>
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        {/* 顶部栏：品牌标识与多语言极简切换 */}
        <div className="onboarding-header">
          <div className="onboarding-brand">
            <span className="onboarding-brand-mark" />
            <span>{t.brand}</span>
          </div>

          <div className="onboarding-lang-group" role="group" aria-label="Language selector">
            {Object.values(I18N).map((item) => (
              <button
                key={item.code}
                type="button"
                className={`onboarding-lang-item${lang === item.code ? ' is-active' : ''}`}
                onClick={() => switchLang(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <h1 id="onboarding-title">{t.title}</h1>

        <p className="onboarding-intro">{t.intro}</p>

        <div className="onboarding-note">
          {t.notes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </div>

        <DeclarationBlock lang={lang} />

        <p className="onboarding-request">{t.request}</p>

        <label className="onboarding-label" htmlFor="onboarding-consent-input">
          {t.inputLabel}
        </label>

        <input
          id="onboarding-consent-input"
          className="onboarding-input"
          type="text"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleConfirm();
            }
          }}
          placeholder={t.consentText}
          autoComplete="off"
          spellCheck="false"
          disabled={saving}
        />

        <button
          className="onboarding-button"
          type="button"
          disabled={!isMatched || saving}
          onClick={handleConfirm}
        >
          {saving ? t.buttonSaving : t.buttonNormal}
        </button>

        <p
          className={`onboarding-hint${isMatched ? ' is-ready' : ''}${error ? ' is-error' : ''}`}
          aria-live="polite"
        >
          {error || (isMatched ? t.readyHint : t.matchHint)}
        </p>

        <p className="onboarding-footer">{t.footer}</p>
      </section>
    </main>
  );
}