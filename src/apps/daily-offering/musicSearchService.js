const normalizeArtworkUrl = (url = '') =>
  String(url)
    .replace('100x100bb', '600x600bb')
    .replace('100x100-75', '600x600-75');

export const searchItunesTrack = async (title = '', artist = '') => {
  const query = [title, artist].filter(Boolean).join(' ').trim();

  if (!query) return null;

  const params = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    limit: '5',
    country: 'US'
  });

  const response = await fetch(
    `https://itunes.apple.com/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`iTunes search failed: ${response.status}`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  if (!results.length) return null;

  const normalizedTitle = String(title).toLowerCase();
  const normalizedArtist = String(artist).toLowerCase();

  const bestMatch =
    results.find((item) => {
      const trackName = String(item.trackName || '').toLowerCase();
      const artistName = String(item.artistName || '').toLowerCase();

      return (
        trackName.includes(normalizedTitle) ||
        normalizedTitle.includes(trackName) ||
        artistName.includes(normalizedArtist)
      );
    }) || results[0];

  return {
    title: bestMatch.trackName || title,
    artist: bestMatch.artistName || artist,
    album: bestMatch.collectionName || '',
    artworkUrl: normalizeArtworkUrl(bestMatch.artworkUrl100 || ''),
    previewUrl: bestMatch.previewUrl || '',
    externalUrl: bestMatch.trackViewUrl || bestMatch.collectionViewUrl || ''
  };
};
