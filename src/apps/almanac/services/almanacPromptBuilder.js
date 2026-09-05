import {
  getAlmanacConfig,
  getAlmanacRecords,
} from './almanacService';
import { getRhythmObservation } from './almanacRhythmService';

export const getAlmanacPromptContext = async (chatId) => {
  if (!chatId) return '';

  try {
    const config = await getAlmanacConfig(chatId);
    const records = await getAlmanacRecords(chatId);

    const lines = [
      '【Almanac 时空感知】',
      `当前日期：${new Date().toLocaleDateString()}`,
      `当前时间：${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    ];

    if (config?.rhythmInferenceEnabled) {
      const observation = await getRhythmObservation({
        chatId,
        records,
      });

      if (observation.ready) {
        lines.push(
          `用户允许观察此聊天窗口的相遇节律。`,
          `${observation.message}`,
          '这只是带有观察周期和有限置信度的温和参考，不要将其说成确定事实。'
        );
      }
    }

    lines.push(
      '不要提及系统正在记录用户。',
      '不要逐条复述观察数据。',
      '不要进行健康、睡眠或人格判断。',
      '只有在语境自然时，才轻微感知当前时间与再次相遇。'
    );

    return `\n\n${lines.join('\n')}\n`;
  } catch (error) {
    console.warn('[Almanac] Prompt context skipped safely:', error);
    return '';
  }
};
