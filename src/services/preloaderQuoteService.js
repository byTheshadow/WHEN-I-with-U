import db from '../db';
import { getRandomInspiration } from '../data/dailyInspirations';

export const PRELOADER_QUOTE_SETTING_KEY = 'preloaderQuoteConfig';
export const PRELOADER_QUOTE_CACHE_KEY =
  'when-i-with-u-preloader-quote-config';

export const DEFAULT_PRELOADER_QUOTE_CONFIG = {
  activeCategoryId: '',
  categories: [],
};

const createId = () =>
  `quote-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizePreloaderQuoteConfig = (value) => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PRELOADER_QUOTE_CONFIG;
  }

  const categories = Array.isArray(value.categories)
    ? value.categories
        .map((category) => ({
          id: String(category.id || createId()),
          name: String(category.name || '').trim(),
          quotes: Array.isArray(category.quotes)
            ? category.quotes
                .map((quote) => String(quote || '').trim())
                .filter(Boolean)
            : [],
        }))
        .filter((category) => category.name)
    : [];

  const activeCategoryExists = categories.some(
    (category) => category.id === value.activeCategoryId,
  );

  return {
    activeCategoryId: activeCategoryExists ? value.activeCategoryId : '',
    categories,
  };
};

const writeCache = (config) => {
  try {
    window.localStorage.setItem(
      PRELOADER_QUOTE_CACHE_KEY,
      JSON.stringify(config),
    );
  } catch {
    // localStorage 不可用时，正式加载页仍会从 Dexie 读取。
  }
};

export const readPreloaderQuoteConfigFromCache = () => {
  try {
    const cached = window.localStorage.getItem(PRELOADER_QUOTE_CACHE_KEY);

    if (!cached) {
      return DEFAULT_PRELOADER_QUOTE_CONFIG;
    }

    return normalizePreloaderQuoteConfig(JSON.parse(cached));
  } catch {
    return DEFAULT_PRELOADER_QUOTE_CONFIG;
  }
};

export const savePreloaderQuoteConfig = async (config) => {
  const normalizedConfig = normalizePreloaderQuoteConfig(config);

  // 先写缓存，使下一次打开应用时能尽早显示。
  writeCache(normalizedConfig);

  await db.settings.put({
    key: PRELOADER_QUOTE_SETTING_KEY,
    value: normalizedConfig,
  });

  return normalizedConfig;
};

export const loadPreloaderQuoteConfig = async () => {
  try {
    const setting = await db.settings.get(PRELOADER_QUOTE_SETTING_KEY);

    if (setting?.value) {
      const normalizedConfig = normalizePreloaderQuoteConfig(setting.value);
      writeCache(normalizedConfig);
      return normalizedConfig;
    }
  } catch (error) {
    console.error('Unable to load preloader quote config:', error);
  }

  return readPreloaderQuoteConfigFromCache();
};

const pickRandom = (items) => {
  if (!items.length) return '';

  return items[Math.floor(Math.random() * items.length)];
};

export const getPreloaderQuoteSync = () => {
  const config = readPreloaderQuoteConfigFromCache();
  const activeCategory = config.categories.find(
    (category) => category.id === config.activeCategoryId,
  );

  return pickRandom(activeCategory?.quotes || []) || getRandomInspiration();
};

export const getPreloaderQuote = async () => {
  const config = await loadPreloaderQuoteConfig();
  const activeCategory = config.categories.find(
    (category) => category.id === config.activeCategoryId,
  );

  return pickRandom(activeCategory?.quotes || []) || getRandomInspiration();
};

export const createPreloaderQuoteCategory = (name) => ({
  id: createId(),
  name: name.trim(),
  quotes: [],
});
