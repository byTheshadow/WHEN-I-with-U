import { formatMelodyText, getPitch } from './harpNotes';
import { DEFAULT_TIMBRE, describeTune, getTimbreLabel, normalizeTimbreId } from './harpTimbres';

// ============================================================
// 星光小竖琴 —— 旋律的文字描述（纯函数，不碰数据库、不碰 aiService）。
// 单独成文件是为了 aiService.js 能引用它而不形成循环依赖。
// 角色听不到音频，这段描述就是它"听到"的全部内容。
// ============================================================

// 平均间隔 -> 节奏说法（间隔为 0 的是和弦里同时响的音，不参与平均）
const describeTempo = (delays) => {
  const gaps = (delays || []).slice(1).filter((value) => Number.isFinite(value) && value > 0);
  if (!gaps.length) return '节奏平缓';
  const average = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  if (average < 320) return '节奏轻快';
  if (average < 700) return '节奏适中';
  return '节奏舒缓';
};

// 音符编号 -> 音域说法（低八度 / 高八度）
const describeRange = (notes) => {
  const list = (notes || []).filter((index) => getPitch(index));
  if (!list.length) return '';
  const high = list.filter((index) => getPitch(index).high).length;
  if (high === 0) return '音域偏低';
  if (high === list.length) return '音域偏高';
  return high / list.length >= 0.5 ? '音域偏高' : '高低音都有';
};

// 有没有和弦（间隔为 0 的音）
const hasChord = (delays) =>
  (delays || []).some((value, k) => k > 0 && value === 0);

// timbre 可选：不是经典竖琴时，在描述最后补一句"音色是八音盒"
export const describeMelody = ({ notes, delays, timbre, tune }) => {
  const count = (notes || []).length;
  const timbreId = normalizeTimbreId(timbre);
  const tuneText = describeTune(tune);
  const timbreBase = timbreId && timbreId !== DEFAULT_TIMBRE ? `音色是${getTimbreLabel(timbreId)}` : '';
  const timbreText = [timbreBase, tuneText].filter(Boolean).map((piece) => `，${piece}`).join('');
  const chordText = hasChord(delays) ? '，里面有和弦' : '';
  return `${count} 个音，${describeTempo(delays)}，${describeRange(notes)}${chordText}${timbreText}`;
};

// 给 aiService.js 的 formatMsgContentForPrompt 用：把一条 harp_melody 消息
// 变成一句话。sender 为 user 是用户弹给角色听，为 character 是角色弹给用户听。
export const describeMelodyForPrompt = (msg) => {
  const meta = msg?.metadata || {};
  const notes = Array.isArray(meta.notes) ? meta.notes : [];
  const delays = Array.isArray(meta.delays) ? meta.delays : [];
  const name = meta.name || '无名旋律';
  const summary = describeMelody({ notes, delays, timbre: meta.timbre, tune: meta.tune });
  const score = formatMelodyText(notes, delays);
  const scoreNote = '简谱（带 ↑ 的是高八度，用 + 连起来的是同时弹响的和弦）';

  if (msg?.sender === 'character') {
    return `[你在"星光小竖琴"里为用户弹了一段旋律「${name}」：${summary}。${scoreNote}：${score}]`;
  }

  return `[用户在"星光小竖琴"里弹了一段旋律给你听，名字是「${name}」：${summary}。${scoreNote}：${score}。你听不到声音，只能根据这些描述去感受，请自然地回应这段旋律。]`;
};