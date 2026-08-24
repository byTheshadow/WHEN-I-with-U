const cleanQuery = (query = '') =>
  String(query)
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .slice(0, 100);

export const searchOpenLandscapeImage = async (query) => {
  const searchQuery = cleanQuery(query) || 'quiet natural landscape';

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: `${searchQuery} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200'
  });

  const response = await fetch(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Wikimedia image search failed: ${response.status}`);
  }

  const data = await response.json();
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];

  const usablePage = pages.find((page) => {
    const imageInfo = page?.imageinfo?.[0];
    const imageUrl = imageInfo?.thumburl || imageInfo?.url || '';

    return /^https?:\/\//i.test(imageUrl);
  });

  if (!usablePage) return null;

  const imageInfo = usablePage.imageinfo[0];
  const metadata = imageInfo.extmetadata || {};

  const author =
    metadata.Artist?.value
      ?.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim() || '';

  const license =
    metadata.LicenseShortName?.value
      ?.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim() || '';

  return {
    imageUrl: imageInfo.thumburl || imageInfo.url,
    description: usablePage.title?.replace(/^File:/i, '') || searchQuery,
    attribution: {
      author,
      license,
      sourcePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(
        usablePage.title || ''
      )}`
    }
  };
};
