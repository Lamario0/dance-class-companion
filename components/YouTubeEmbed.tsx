
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

    // 1. Check for Playlist
    const playlistMatch = cleanUrl.match(/[?&]list=([^#&?]+)/);
    if (playlistMatch && playlistMatch[1]) {
      return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}`;
    }

    // 2. Direct ID check (Standard IDs are 11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return `https://www.youtube.com/embed/${cleanUrl}`;
    }

    // 3. Robust Regex Extraction for all YouTube formats
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/|live\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = cleanUrl.match(regExp);

    if (match && match[1]) {
        if (match[1].length >= 10 && match[1].length <= 12) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }
    }
    
    return null;
  }, [url]);

  if (!embedSource) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 text-slate-500 rounded-lg border border-slate-700 border-dashed p-8 ${className}`}>
        <div className="text-center">
            <p className="font-medium text-slate-400">Invalid YouTube URL</p>
            <p className="text-xs mt-1 text-slate-500 max-w-[200px] truncate mx-auto">{url || "Empty URL"}</p>
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
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};
