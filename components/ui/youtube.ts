// UI-only helpers for deriving YouTube IDs / thumbnails from the URLs in the sheet.
// Mirrors the parsing in YouTubeEmbed so thumbnails match what the player loads.

export const getYouTubeId = (url?: string): string | null => {
  if (!url) return null;
  const clean = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const m = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^?&"'>]+)/);
  if (m && m[1] && m[1].substring(0, 11).length === 11) return m[1].substring(0, 11);
  return null;
};

export const isPlaylistUrl = (url?: string) => !!url && /[?&]list=/.test(url);

export const getYouTubeThumb = (url?: string, quality: 'hq' | 'mq' = 'hq'): string | null => {
  if (isPlaylistUrl(url)) {
    // A playlist link that also carries a v= id still has a usable cover image.
    const v = url!.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return v ? `https://i.ytimg.com/vi/${v[1]}/${quality}default.jpg` : null;
  }
  const id = getYouTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/${quality}default.jpg` : null;
};
