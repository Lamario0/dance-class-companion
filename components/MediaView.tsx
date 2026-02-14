
import React, { useState, useMemo, useEffect } from 'react';
import { VideoItem, SongItem } from '../types';
import { YouTubeEmbed } from './YouTubeEmbed';
import { Play, Music2, Headphones, Flame, Disc, ListMusic, ChevronDown, Radio } from 'lucide-react';

interface MediaViewProps {
  videos: VideoItem[];
  songs: SongItem[];
}

export const MediaView: React.FC<MediaViewProps> = ({ videos, songs }) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  
  const tutorials = useMemo(() => videos.filter(v => v.category === 'tutorial'), [videos]);

  useEffect(() => {
    if (tutorials.length > 0 && !selectedVideoId) {
      const playlist = tutorials.find(t => t.id === 'tut-playlist');
      setSelectedVideoId(playlist ? playlist.id : tutorials[0].id);
    }
  }, [tutorials, selectedVideoId]);

  const selectedVideo = tutorials.find(v => v.id === selectedVideoId);
  const isPlaylist = selectedVideo?.id === 'tut-playlist' || selectedVideo?.url.includes('list=');

  // getSongsByCategory now allows up to 5 as per user request
  const getSongsByCategory = (cat: string) => songs.filter(s => s.category === cat).slice(0, 5);

  return (
    <div className="space-y-8 pb-24">
      {/* Main Video Section */}
      <section className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-6 md:p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isPlaylist ? 'bg-emerald-500/10 text-emerald-400' : 'bg-violet-500/10 text-violet-400'}`}>
              {isPlaylist ? <ListMusic className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                {isPlaylist ? "Pattern Library" : "Tutorial Video"}
              </h2>
              <p className="text-slate-500 text-sm font-medium">
                {tutorials.length} resources available
              </p>
            </div>
          </div>

          {tutorials.length > 1 && (
            <div className="relative min-w-[240px]">
              <select 
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-3.5 px-5 pr-12 rounded-2xl appearance-none focus:border-violet-500 outline-none font-bold text-sm cursor-pointer hover:bg-slate-900 transition-colors"
              >
                {tutorials.map(v => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="bg-black aspect-video flex items-center justify-center relative">
          {selectedVideo ? (
            <YouTubeEmbed 
              url={selectedVideo.url} 
              title={selectedVideo.title} 
              className="w-full h-full" 
            />
          ) : (
            <div className="text-slate-700 flex flex-col items-center gap-4">
              <Play className="w-16 h-16 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">No Videos Linked</p>
            </div>
          )}
        </div>
        
        {selectedVideo && !isPlaylist && (
          <div className="p-6 bg-slate-800/30 text-center">
            <h3 className="text-slate-200 font-bold">{selectedVideo.title}</h3>
          </div>
        )}
      </section>

      {/* Song Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SongColumn title="New Music" icon={<Flame/>} songs={getSongsByCategory('new')} color="violet" />
        <SongColumn title="Bluesy" icon={<Music2/>} songs={getSongsByCategory('blues')} color="sky" />
        <SongColumn title="Practice" icon={<Headphones/>} songs={getSongsByCategory('practice')} color="emerald" />
      </div>
    </div>
  );
};

const SongLinkIcon = ({ url, className }: { url: string; className?: string }) => {
  const isSpotify = url.includes('spotify.com');
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  
  if (isSpotify) return <Radio className={`${className} text-emerald-500`} />;
  if (isYouTube) return <Play className={`${className} text-rose-500 fill-current`} />;
  return <Disc className={`${className} text-slate-700 group-hover:text-violet-500 transition-colors`} />;
};

const SongColumn = ({ title, icon, songs, color }: any) => (
  <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col min-h-[340px]">
    <div className={`p-5 flex items-center gap-3 font-black uppercase tracking-widest text-xs border-b border-slate-800 bg-slate-800/20 text-${color}-400`}>
      {icon} {title}
    </div>
    <div className="p-3 space-y-1 flex-1">
      {songs.length > 0 ? (
        songs.map((s: any) => (
          <a key={s.id} href={s.url} target="_blank" rel="noopener" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 transition-colors group">
            <div className="overflow-hidden pr-2">
              <p className="text-sm font-bold text-slate-200 truncate">{s.title}</p>
              <p className="text-[10px] text-slate-500 truncate">{s.artist}</p>
            </div>
            <SongLinkIcon url={s.url} className="w-4 h-4 shrink-0" />
          </a>
        ))
      ) : (
        <div className="h-full flex items-center justify-center p-8 text-center">
          <p className="text-slate-600 text-[10px] font-medium uppercase tracking-widest">Awaiting Playlist</p>
        </div>
      )}
    </div>
  </div>
);
