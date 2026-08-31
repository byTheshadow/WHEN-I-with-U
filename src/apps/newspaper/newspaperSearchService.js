// src/apps/newspaper/newspaperSearchService.js

/**
 * 免 Key 代理抓取 Google News RSS
 */
async function fetchGoogleNewsRSS(query) {
  const encodedQuery = encodeURIComponent(query);
  const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  
  // 使用公开免费 CORS 代理
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('网络检索代理请求失败');
  
  const data = await response.json();
  const xmlText = data.contents;
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.querySelectorAll('item');
  
  const results = [];
  const count = Math.min(items.length, 5);
  
  for (let i = 0; i < count; i++) {
    const item = items[i];
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    
    // 清理 HTML 标签
    const cleanDesc = description.replace(/<[^>]*>/g, '').trim();
    
    results.push({
      title: title.split(' - ')[0] || title,
      source: title.split(' - ')[1] || '新闻源',
      pubDate,
      snippet: cleanDesc,
      url: link
    });
  }
  
  return results;
}

/**
 * 使用 Tavily API 检索
 */
async function fetchTavilySearch(query, apiKey) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'basic',
      max_results: 5
    })
  });

  if (!response.ok) throw new Error('Tavily 搜索请求失败');

  const data = await response.json();
  return (data.results || []).map(r => ({
    title: r.title,
    source: 'Web',
    snippet: r.content,
    url: r.url
  }));
}

/**
 * 统一检索分发
 */
export async function searchLatestNews(topic, settings = {}) {
  const query = topic || '科技 艺术 思想 每日新闻';
  
  if (settings.tavilyKey && settings.tavilyKey.trim()) {
    try {
      return await fetchTavilySearch(query, settings.tavilyKey.trim());
    } catch (e) {
      console.warn('Tavily 检索失败，回退到 RSS：', e);
    }
  }
  
  try {
    return await fetchGoogleNewsRSS(query);
  } catch (e) {
    console.warn('RSS 检索失败：', e);
    return [];
  }
}
