export const healingQuotes = [
  "时间顺流而下，生活逆水行舟，但在此刻，你可以安静停泊。",
  "屋檐下落下的雨滴，都在替这个世界诉说温柔。",
  "愿你今天的心情，像风吹过树林一样松弛自在。",
  "即便迷茫，也要记得在自己的小宇宙里闪闪发光。",
  "不必急于求成，慢下来的每一秒都是生活赐予的诗意。",
  "在无声的岁月里，总有一抹光芒在为你守候。",
  "喝一口温水，伸个懒腰，感受当下空气的呼吸。"
];

export const getRandomQuote = () => {
  const index = Math.floor(Math.random() * healingQuotes.length);
  return healingQuotes[index];
};

export default { healingQuotes, getRandomQuote };
