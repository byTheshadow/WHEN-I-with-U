// src/apps/newspaper/newspaperSearchService.js

/**
 * 健壮的多代理抓取机制
 */
async function fetchWithFallbackProxies(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  const proxies = [
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://corsproxy.io/?${encoded}`,
    `https://api.codetabs.com/v1/proxy?quest=${encoded}`
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { headers: { 'Accept': 'application/rss+xml, text/xml, */*' } });
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('<rss') || text.includes('<item')) {
          return text;
        }
      }
    } catch (e) {
      console.warn(`代理 ${proxy} 请求失败，尝试下一个...`);
    }
  }
  throw new Error('所有检索代理均暂时不可用');
}

/**
 * Google News RSS 解析
 */
async function fetchGoogleNewsRSS(query) {
  const encodedQuery = encodeURIComponent(query);
  const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  
  const xmlText = await fetchWithFallbackProxies(rssUrl);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.querySelectorAll('item');
  
  const results = [];
  const count = Math.min(items.length, 4);
  
  for (let i = 0; i < count; i++) {
    const item = items[i];
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const cleanDesc = description.replace(/<[^>]*>/g, '').trim();
    
    results.push({
      title: title.split(' - ')[0] || title,
      source: title.split(' - ')[1] || '新闻源',
      snippet: cleanDesc,
      url: link
    });
  }
  
  return results;
}

/**
 * Tavily API 检索
 */
async function fetchTavilySearch(query, apiKey) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'basic',
      max_results: 4
    })
  });

  if (!response.ok) throw new Error('Tavily 搜索失败');
  const data = await response.json();
  return (data.results || []).map(r => ({
    title: r.title,
    source: 'Web',
    snippet: r.content,
    url: r.url
  }));
}

/**
 * 统一搜索入口
 */
export async function searchLatestNews(topic, settings = {}) {
  const query = topic || '科技 艺术 世界观察';
  
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
    console.warn('RSS 代理抓取失败，进入 AI 深度观察降级模式：', e);
    return [];
  }
}
