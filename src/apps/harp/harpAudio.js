import { getPitch } from './harpNotes';
import { DEFAULT_TIMBRE, normalizeTimbreId } from './harpTimbres';
import { renderPluckSamples } from './harpPluckSynth';

// ============================================================
// 星光小竖琴 —— 发声（Web Audio 现场合成，没有任何音频文件）。
//
// 三种音色，发声参数全部集中在下面的 TIMBRE_VOICES 里，想调音色只改这张表：
//   harp     经典竖琴：三个泛音叠加，起音极快，再送进两条回声拖出梦幻尾音。
//   musicbox 八音盒：基音加两个短促的金属泛音，余音短，回声很轻。
//   pluck    拨弦：Karplus-Strong 算法在 JS 里算出波形（见 harpPluckSynth.js），
//            放进 AudioBuffer 缓存，每根弦只算一次。
// 越高的音衰减越快（length / ring 随音符编号变短）。
//
// 共用一条效果总线：dry（3600Hz 低通，柔和）、bright（8000Hz 低通，保留
// 金属泛音）、两条回声。每种音色用 dry 选走哪条干声，用 echoA/echoB 调回声送多少。
//
// AudioContext 只能在用户手势之后创建/恢复，所以 ensureHarpAudio() 要在
// 点击/按下的事件处理函数里调用。整个模块共用一个 AudioContext，页面卸载
// 时调 releaseHarpAudio() 关掉，不在后台占着音频设备。
//
// 音色选择：playHarpNote(index, timbre) 传了 timbre 就用它（重听旧旋律时用），
// 不传就用 setHarpTimbre() 设置的"当前音色"（现场弹奏时用）。
// ============================================================

// partials：[倍频, 音量, 占总时长的比例]
// attack：起音时间（秒）；detunePerMultiple：高次泛音每倍频的微失谐（音分）
// echoA / echoB：送进两条回声的量（1 = 原来的竖琴）；level：整体音量
const TIMBRE_VOICES = {
  harp: {
    kind: 'partials',
    length: (index) => 2.6 - index * 0.12,
    partials: [
      [1, 0.34, 1.0],
      [2, 0.12, 0.55],
      [3, 0.05, 0.3],
    ],
    attack: 0.006,
    detunePerMultiple: 3,
    dry: 'soft',
    echoA: 1,
    echoB: 1,
    level: 1,
  },
  musicbox: {
    kind: 'partials',
    length: (index) => 1.5 - index * 0.05,
    partials: [
      [1, 0.3, 1.0],
      [4, 0.1, 0.22],
      [6.27, 0.04, 0.1],
    ],
    attack: 0.002,
    detunePerMultiple: 0,
    dry: 'bright',
    echoA: 0.35,
    echoB: 0.2,
    level: 1,
  },
  pluck: {
    kind: 'buffer',
    ring: (index) => 2.4 - index * 0.1,
    damping: (index) => 0.3 - index * 0.025,
    dry: 'bright',
    echoA: 0.22,
    echoB: 0.12,
    level: 0.55,
  },
};

let audioCtx = null;
let bus = null;
let currentTimbre = DEFAULT_TIMBRE;
let pluckBuffers = {};

export const setHarpTimbre = (timbre) => {
  currentTimbre = normalizeTimbreId(timbre) || DEFAULT_TIMBRE;
};

export const getHarpTimbre = () => currentTimbre;

export const ensureHarpAudio = () => {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;

      const ctx = new Ctor();

      const master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);

      const dry = ctx.createBiquadFilter();
      dry.type = 'lowpass';
      dry.frequency.value = 3600;
      dry.connect(master);

      const bright = ctx.createBiquadFilter();
      bright.type = 'lowpass';
      bright.frequency.value = 8000;
      bright.connect(master);

      const makeEcho = (time, feedback, cutoff) => {
        const delay = ctx.createDelay(1.5);
        delay.delayTime.value = time;
        const fb = ctx.createGain();
        fb.gain.value = feedback;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = cutoff;
        delay.connect(lp);
        lp.connect(fb);
        fb.connect(delay);
        lp.connect(master);
        return delay;
      };

      bus = {
        dry,
        bright,
        echoA: makeEcho(0.34, 0.4, 2400),
        echoB: makeEcho(0.53, 0.3, 1800),
      };
      audioCtx = ctx;
      pluckBuffers = {};
    } catch (error) {
      console.warn('[harp] 创建 AudioContext 失败:', error);
      audioCtx = null;
      bus = null;
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
};

// 拨弦的波形：第一次要这根弦时算出来，之后复用。
const getPluckBuffer = (index, voice) => {
  const cached = pluckBuffers[index];
  if (cached) return cached;

  const note = getPitch(index);
  // 余音和阻尼按"画面上点亮的那根弦"算，4、7 两个没有弦的音借用相邻的弦
  const ring = voice.ring(note.light);
  const samples = renderPluckSamples({
    sampleRate: audioCtx.sampleRate,
    freq: note.freq,
    seconds: ring + 0.1,
    damping: voice.damping(note.light),
    ringSeconds: ring,
    seed: 101 + index * 17,
  });

  const buffer = audioCtx.createBuffer(1, samples.length, audioCtx.sampleRate);
  buffer.copyToChannel(samples, 0);
  pluckBuffers[index] = buffer;
  return buffer;
};

export const playHarpNote = (index, timbre) => {
  // index 0-9 是十根弦，10-13 是 4、7 两个音（角色作曲用，见 harpNotes.js）
  const note = getPitch(index);
  if (!audioCtx || !bus || !note) return;

  const timbreId = timbre ? normalizeTimbreId(timbre) || DEFAULT_TIMBRE : currentTimbre;
  const voice = TIMBRE_VOICES[timbreId] || TIMBRE_VOICES[DEFAULT_TIMBRE];

  try {
    const now = audioCtx.currentTime;

    const out = audioCtx.createGain();
    out.gain.value = voice.level;
    out.connect(voice.dry === 'bright' ? bus.bright : bus.dry);

    const sendA = audioCtx.createGain();
    sendA.gain.value = voice.echoA;
    out.connect(sendA);
    sendA.connect(bus.echoA);

    const sendB = audioCtx.createGain();
    sendB.gain.value = voice.echoB;
    out.connect(sendB);
    sendB.connect(bus.echoB);

    if (voice.kind === 'buffer') {
      const source = audioCtx.createBufferSource();
      source.buffer = getPluckBuffer(index, voice);
      source.connect(out);
      source.start(now);
      return;
    }

    const length = voice.length(note.light);
    voice.partials.forEach(([multiple, volume, share]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq * multiple;
      if (multiple > 1 && voice.detunePerMultiple) {
        osc.detune.value = voice.detunePerMultiple * multiple;
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + voice.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length * share);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + length * share + 0.05);
    });
  } catch (error) {
    console.warn('[harp] 播放音符失败:', error);
  }
};

export const releaseHarpAudio = () => {
  if (audioCtx) {
    audioCtx.close().catch(() => {});
  }
  audioCtx = null;
  bus = null;
  pluckBuffers = {};
};