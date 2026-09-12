// src/services/mcp/healthCardParser.js
//
// 负责从 get_health_data 返回的 Markdown 文本中提取 Apple Health 关键指标

export const parseHealthMarkdown = (text = '') => {
  if (!text || typeof text !== 'string') return null;

  // 1. 睡眠提取（取最近一天）
  // 匹配类似: · 2026-09-11 [01:14 ~ 07:28]: 睡眠 6.2小时 (深睡 0.8h, 核心 4.0h, REM 1.4h)
  let sleep = null;
  const sleepLines = text.match(/·\s*(\d{4}-\d{2}-\d{2})\s*\[([^\]]+)\]:\s*睡眠\s*([\d.]+)小时\s*\(([^)]+)\)/g);
  if (sleepLines && sleepLines.length > 0) {
    const latestSleep = sleepLines[sleepLines.length - 1];
    const match = latestSleep.match(/·\s*(\d{4}-\d{2}-\d{2})\s*\[([^\]]+)\]:\s*睡眠\s*([\d.]+)小时\s*\(([^)]+)\)/);
    if (match) {
      const details = match[4];
      const deepMatch = details.match(/深睡\s*([\d.]+)h/);
      const coreMatch = details.match(/核心\s*([\d.]+)h/);
      const remMatch = details.match(/REM\s*([\d.]+)h/);
      sleep = {
        date: match[1],
        range: match[2],
        totalHours: parseFloat(match[3]),
        deep: deepMatch ? parseFloat(deepMatch[1]) : 0,
        core: coreMatch ? parseFloat(coreMatch[1]) : 0,
        rem: remMatch ? parseFloat(remMatch[1]) : 0,
      };
    }
  }

  // 2. 心血管数据
  const hrMatch = text.match(/心率:\s*平均\s*([\d.]+).*?最高\s*(\d+).*?最低\s*(\d+)/);
  const restingHrMatch = text.match(/静息心率:\s*平均\s*([\d.]+)/);
  const hrvMatch = text.match(/心率变异性\(HRV\):\s*平均\s*([\d.]+)\s*ms/);

  const cardio = {
    avgHr: hrMatch ? Math.round(parseFloat(hrMatch[1])) : null,
    maxHr: hrMatch ? parseInt(hrMatch[2], 10) : null,
    minHr: hrMatch ? parseInt(hrMatch[3], 10) : null,
    restingHr: restingHrMatch ? Math.round(parseFloat(restingHrMatch[1])) : null,
    hrv: hrvMatch ? Math.round(parseFloat(hrvMatch[1])) : null,
  };

  // 3. 活动与能量（取最近一天）
  // 匹配类似: 每日步数: ... 2026-09-11: 7850 count
  const extractLastDailyVal = (regex) => {
    const sectionMatch = text.match(regex);
    if (!sectionMatch) return null;
    const pairs = sectionMatch[1].match(/\d{4}-\d{2}-\d{2}:\s*([\d.]+)/g);
    if (!pairs) return null;
    const lastPair = pairs[pairs.length - 1];
    const valMatch = lastPair.match(/:\s*([\d.]+)/);
    return valMatch ? parseFloat(valMatch[1]) : null;
  };

  const steps = extractLastDailyVal(/每日步数:\s*([^c\n]+)/);
  const activeCalories = extractLastDailyVal(/活动能量\(千卡\):\s*([^k\n]+)/);
  const exerciseMin = extractLastDailyVal(/锻炼时长\(分钟\):\s*([^m\n]+)/);
  const standHours = extractLastDailyVal(/站立达标小时数:\s*([^c\n]+)/);

  // 4. 生理与体征
  const spo2Match = text.match(/血氧饱和度:\s*平均\s*([\d.]+)\s*%/);
  const respMatch = text.match(/呼吸频率:\s*平均\s*([\d.]+)/);
  const wristTempMatch = text.match(/睡眠手腕温度:\s*平均\s*([\d.]+)\s*degC/);

  return {
    kind: 'health',
    timestamp: Date.now(),
    sleep,
    cardio,
    activity: {
      steps: steps ? Math.round(steps) : null,
      activeCalories: activeCalories ? Math.round(activeCalories) : null,
      exerciseMin: exerciseMin ? Math.round(exerciseMin) : null,
      standHours: standHours ? Math.round(standHours) : null,
    },
    vitals: {
      spo2: spo2Match ? parseFloat(spo2Match[1]) : null,
      respRate: respMatch ? parseFloat(respMatch[1]) : null,
      wristTemp: wristTempMatch ? parseFloat(wristTempMatch[1]) : null,
    },
  };
};
