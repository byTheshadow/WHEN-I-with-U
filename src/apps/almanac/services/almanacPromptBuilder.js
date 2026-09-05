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

   import {
  getAlmanacConfig,
  getAlmanacRecords,
  getDeviceTimeZone,
  getUserTimeZone,
  isUsingDeviceTimeZone,
} from './almanacService';

import { getRhythmObservation } from './almanacRhythmService';
import {
  buildAlmanacUnderstandingPrompt,
} from './almanacObservationService';

const formatUserLocalDateTime = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(date);
};

export const getAlmanacPromptContext = async (chatId) => {
  if (!chatId) return '';

  try {
    const config = await getAlmanacConfig(chatId);
    const records = await getAlmanacRecords(chatId);
    const timeZone = getUserTimeZone(config);
    const now = new Date();

    const lines = [
      '【Almanac 时空感知】',
      `user 所在地时间：${formatUserLocalDateTime(now, timeZone)}`,
      `当前采用的时区：${timeZone}`,
    ];

    if (isUsingDeviceTimeZone(config)) {
      lines.push(
        '当前时区参考来自设备设置，user 可以在 Almanac 设置中确认所在地时间。',
      );
    }

    if (config?.rhythmInferenceEnabled) {
      const observation = await getRhythmObservation({
        chatId,
        records,
      });

      if (observation.ready) {
        lines.push(
          'user 允许观察这个聊天窗口的相处节律。',
          `${observation.message}`,
          '可以把它作为温和参考，帮助 char 更自然地理解和尊重 user。',
        );
      }
    }

    const understandingPrompt =
      buildAlmanacUnderstandingPrompt(records);

    if (understandingPrompt) {
      lines.push(understandingPrompt);
    }

    lines.push(
      '可以根据这些观察调整陪伴方式、语气和节奏。',
      '可以让 user 按自己的方式相处，并在 user 主动表达需求时给予回应。',
      '可以自然地记住“如何更好地陪伴 user”，而不是急于纠正 user 的生活节奏。',
      '请不要直接提及 Almanac、统计、记录或数据来源。',
      '请不要把观察自动当作健康、睡眠或人格结论。',
    );

    return `\n\n${lines.join('\n')}\n`;
  } catch (error) {
    console.warn('[Almanac] Prompt context skipped safely:', error);
    return '';
  }
};


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
