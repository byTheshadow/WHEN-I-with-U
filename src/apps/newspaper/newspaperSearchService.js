// src/apps/newspaper/newspaperSearchService.js

/**
 * 带快速超时的 fetch 辅助函数
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * 1. 原生开放资讯源：Hacker News / 科技开放 API (完全免 Key & 原生支持 CORS)
 */
async function fetchOpenTechNews() {
  try {
    const res = await fetchWithTimeout('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!res.ok) return [];
    const ids = await res.json();
    const topIds = ids.slice(0, 3);
    
    const items = await Promise.all(
      topIds.map(async (id) => {
        try {
          const itemRes = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return await itemRes.json();
        } catch {
          return null;
        }
      })
    );

    return items.filter(Boolean).map(item => ({
      title: item.title,
      source: 'Global Tech Feed',
      snippet: `Article URL: ${item.url || 'HN Dispatch'} (Score: ${item.score || 0})`,
      url: item.url || ''
    }));
  } catch {
    return [];
  }
}

/**
 * 2. 原生开放百科每日事件 (原生 CORS，无跨域拦截)
 */
async function fetchWikipediaFeatured() {
  try {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const res = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`);
    if (!res.ok) return [];
    const data = await res.json();
    const events = (data.events || []).slice(0, 3);
    return events.map(e => ({
      title: `${e.year}年: ${e.text.slice(0, 60)}...`,
      source: 'World History Archive',
      snippet: e.text,
      url: e.pages?.[0]?.content_urls?.desktop?.page || ''
    }));
  } catch {
    return [];
  }
}

/**
 * 3. Tavily API 检索 (用户配置了 Key 时优先)
 */
async function fetchTavilySearch(query, apiKey) {
  const res = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'basic',
      max_results: 3
    })
  }, 4000);

  if (!res.ok) throw new Error('Tavily 搜索失败');
  const data = await res.json();
  return (data.results || []).map(r => ({
    title: r.title,
    source: 'Web',
    snippet: r.content,
    url: r.url
  }));
}

/**
 * 统一搜索入口：永远不会因 CORS 崩溃或长久卡住
 */
export async function searchLatestNews(topic, settings = {}) {
  // 如果用户配了专属 Key
  if (settings.tavilyKey && settings.tavilyKey.trim()) {
    try {
      const tavilyResults = await fetchTavilySearch(topic, settings.tavilyKey.trim());
      if (tavilyResults.length > 0) return tavilyResults;
    } catch (e) {
      console.warn('Tavily 检索失败，切换至免 Key 原生接口');
    }
  }

  // 尝试原生 CORS 资讯源
  const openNews = await fetchOpenTechNews();
  if (openNews.length > 0) return openNews;

  // 尝试原生历史档案
  const wikiNews = await fetchWikipediaFeatured();
  if (wikiNews.length > 0) return wikiNews;

  // 兜底返回空数组，平滑触发主编深度思考模式
  return [];
}
