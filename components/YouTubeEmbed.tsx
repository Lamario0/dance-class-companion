
import React, { useMemo } from 'react';

interface YouTubeEmbedProps {
  url: string;
  className?: string;
  title?: string;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ url, className = "", title = "Video" }) => {
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
      <div className={`flex items-center justify-center bg-slate-800 text-slate-500 rounded-lg border border-slate-700 border-dashed p-8 ${className}`}>
        <div className="text-center">
            <p className="font-medium text-slate-400">Loading Video...</p>
            <p className="text-xs mt-1 text-slate-500 truncate max-w-[200px] mx-auto">{url || "No link found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl shadow-md bg-black ${className}`}>
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        src={`${embedSource}${embedSource.includes('?') ? '&' : '?'}rel=0&modestbranding=1&playsinline=1`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};
