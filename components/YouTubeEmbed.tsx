import React, { useMemo } from 'react';

interface YouTubeEmbedProps {
  url: string;
  className?: string;
  title?: string;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ url, className = "", title = "Video" }) => {
  const videoId = useMemo(() => {
    if (!url) return null;
    const cleanUrl = url.trim();

    // 1. Direct ID check (Standard IDs are 11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return cleanUrl;
    }

    // 2. Robust Regex Extraction for all YouTube formats
    // Covers: youtube.com/watch?v=ID, youtu.be/ID, /embed/, /shorts/, /live/, etc.
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/|live\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = cleanUrl.match(regExp);

    if (match && match[1]) {
        // IDs are typically 11 chars, but we allow 10-12 to be safe against slight variations
        if (match[1].length >= 10 && match[1].length <= 12) {
            return match[1];
        }
    }
    
    return null;
  }, [url]);

  if (!videoId) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 text-slate-500 rounded-lg border border-slate-700 border-dashed p-8 ${className}`}>
        <div className="text-center">
            <p className="font-medium text-slate-400">Invalid Video URL</p>
            <p className="text-xs mt-1 text-slate-500 max-w-[200px] truncate mx-auto">{url || "Empty URL"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl shadow-md bg-black ${className}`}>
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        // Removed origin parameter as it causes Error 153 in some environments. Added referrerPolicy.
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};