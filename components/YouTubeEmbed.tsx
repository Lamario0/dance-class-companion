
import React, { useMemo, useState } from 'react';
import { Play, ListVideo } from 'lucide-react';
import { getYouTubeThumb, isPlaylistUrl } from './ui/youtube';
import { NoteDoodle } from './ui/Doodles';

interface YouTubeEmbedProps {
  url: string;
  className?: string;
  title?: string;
  autoplay?: boolean;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ url, className = "", title = "Video", autoplay = false }) => {
  const embedSource = useMemo(() => {
    if (!url) return null;
    const cleanUrl = url.trim();

    // 1. Playlist check
    const playlistMatch = cleanUrl.match(/[?&]list=([^#&?]+)/);
    if (playlistMatch && playlistMatch[1]) {
      return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}`;
    }

    // 2. Direct ID check
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return `https://www.youtube.com/embed/${cleanUrl}`;
    }

    // 3. Complex URL patterns
    const videoIdMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^?&"'>]+)/);

    if (videoIdMatch && videoIdMatch[1]) {
      const id = videoIdMatch[1].substring(0, 11);
      if (id.length === 11) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }

    return null;
  }, [url]);

  if (!embedSource) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 text-text-lo rounded-md p-8 ${className}`}>
        <div className="text-center">
            <p className="font-medium text-text-mid">This video link doesn't look right</p>
            <p className="text-[13px] mt-1 text-text-lo truncate max-w-[220px] mx-auto">{url || "No link yet"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        src={`${embedSource}${embedSource.includes('?') ? '&' : '?'}rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

/**
 * Thumbnail-first player: shows the YouTube poster + a play button and only
 * swaps in the (heavy) iframe on tap. Much faster first paint on phones.
 */
export const VideoFacade: React.FC<{ url: string; title: string; className?: string; label?: string }> = ({
  url,
  title,
  className = '',
  label,
}) => {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumb = getYouTubeThumb(url);
  const playlist = isPlaylistUrl(url);

  if (playing) return <YouTubeEmbed url={url} title={title} autoplay className={`aspect-video w-full ${className}`} />;

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${label ?? title}`}
      className={`group relative block aspect-video w-full overflow-hidden bg-surface-2 ${className}`}
    >
      {thumb && !thumbFailed ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          onError={() => setThumbFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-calm)] group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-900/70 via-surface-2 to-fuchsia-900/50">
          {playlist ? <ListVideo className="h-12 w-12 text-brand-soft/70" /> : <NoteDoodle className="h-12 w-12 text-brand-soft/70" still />}
        </span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" aria-hidden="true" />
      <span
        className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-surface-0 shadow-[var(--shadow-float)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110 group-active:scale-95"
        aria-hidden="true"
      >
        <Play className="ml-1 h-7 w-7 fill-current" />
      </span>
    </button>
  );
};
