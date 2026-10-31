
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VideoItem, SongItem } from '../types';
import { VideoFacade } from './YouTubeEmbed';
import { getYouTubeThumb, isPlaylistUrl } from './ui/youtube';
import { Segmented } from './ui/Segmented';
import { EmptyState, NoteDoodle } from './ui/Doodles';
import { Search, X, ListVideo, ExternalLink, Flame, Music2, Headphones } from 'lucide-react';

interface MediaViewProps {
  videos: VideoItem[];
  songs: SongItem[];
}

type SongCat = SongItem['category'];

// Static lookup (Tailwind can't see dynamically-built class names).
const CATEGORIES: { value: SongCat; label: string; icon: React.ReactNode; text: string; dot: string }[] = [
  { value: 'new', label: 'New', icon: <Flame className="h-4 w-4" />, text: 'text-violet-300', dot: 'bg-violet-400' },
  { value: 'blues', label: 'Bluesy', icon: <Music2 className="h-4 w-4" />, text: 'text-sky-300', dot: 'bg-sky-400' },
  { value: 'practice', label: 'Practice', icon: <Headphones className="h-4 w-4" />, text: 'text-emerald-300', dot: 'bg-emerald-400' },
];

export const MediaView: React.FC<MediaViewProps> = ({ videos, songs }) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [songTab, setSongTab] = useState<SongCat>('new');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const tutorials = useMemo(() => videos.filter(v => v.category === 'tutorial'), [videos]);

  useEffect(() => {
    if (tutorials.length > 0 && !selectedVideoId) {
      const playlist = tutorials.find(t => t.id === 'tut-playlist');
      setSelectedVideoId(playlist ? playlist.id : tutorials[0].id);
    }
  }, [tutorials, selectedVideoId]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const selectedVideo = tutorials.find(v => v.id === selectedVideoId);
  const isPlaylist = selectedVideo?.id === 'tut-playlist' || selectedVideo?.url.includes('list=');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tutorials.filter(t => t.title.toLowerCase().includes(q)) : tutorials;
  }, [tutorials, query]);

  // getSongsByCategory now allows up to 5 as per user request
  const getSongsByCategory = (cat: string) => songs.filter(s => s.category === cat).slice(0, 5);

  return (
    <div className="space-y-10">
      {/* ---------------- Tutorials ---------------- */}
      <section aria-labelledby="tutorials-title">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h2 id="tutorials-title" className={`text-2xl font-extrabold tracking-tight transition-opacity duration-200 ${searchOpen ? 'max-sm:opacity-0 max-sm:w-0 max-sm:overflow-hidden' : ''}`}>
            Tutorials
          </h2>
          {tutorials.length > 6 && (
            <div
              className={`relative flex h-11 items-center justify-end overflow-hidden rounded-full transition-[width,background-color] duration-[420ms] ease-[var(--ease-spring)] ${
                searchOpen ? 'w-full sm:w-72 bg-surface-1 ring-1 ring-line' : 'w-11'
              }`}
            >
              <button
                type="button"
                onClick={() => setSearchOpen(o => !o)}
                aria-label={searchOpen ? 'Close search' : 'Search tutorials'}
                aria-expanded={searchOpen}
                data-tip={searchOpen ? undefined : 'Search tutorials'}
                data-tip-align="end"
                className={`press absolute grid h-11 w-11 place-items-center rounded-full text-text-mid hover:text-text-hi transition-[left] duration-[420ms] ease-[var(--ease-spring)] ${
                  searchOpen ? 'left-0' : 'left-0 tip hover:bg-surface-1'
                }`}
              >
                <Search className="h-5 w-5" />
              </button>
              {searchOpen && (
                <>
                  <input
                    ref={searchRef}
                    type="text"
                    enterKeyHint="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && (setQuery(''), setSearchOpen(false))}
                    placeholder="Find a pattern"
                    aria-label="Filter tutorials"
                    className="h-full w-full bg-transparent pl-11 pr-11 text-[16px] text-text-hi outline-none placeholder:text-text-lo animate-fade"
                  />
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setSearchOpen(false); }}
                    aria-label="Clear search"
                    className="press absolute right-0 grid h-11 w-11 place-items-center rounded-full text-text-lo hover:text-text-hi"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {tutorials.length === 0 ? (
          <div className="card">
            <EmptyState compact title="No tutorials linked yet." body="Check back after class." />
          </div>
        ) : (
          <>
            {/* One scroll direction: horizontal carousel of thumbnails */}
            {tutorials.length > 1 && (
              <div
                role="listbox"
                aria-label="Choose a tutorial"
                className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-1 scroll-px-4"
              >
                {filtered.map((v, i) => {
                  const selected = v.id === selectedVideoId;
                  const thumb = getYouTubeThumb(v.url, 'mq');
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setSelectedVideoId(v.id)}
                      className="press group w-40 shrink-0 snap-start text-left animate-rise"
                      style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                    >
                      <span
                        className={`relative block aspect-video overflow-hidden rounded-md bg-surface-2 ring-2 ring-offset-2 ring-offset-surface-0 transition-shadow duration-200 ${
                          selected ? 'ring-brand' : 'ring-transparent'
                        }`}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-900/70 to-fuchsia-900/40">
                            <ListVideo className="h-7 w-7 text-brand-soft" />
                          </span>
                        )}
                        {isPlaylistUrl(v.url) && (
                          <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-black/70 px-1.5 py-0.5 text-[12px] font-semibold text-white">
                            Playlist
                          </span>
                        )}
                      </span>
                      <span className={`mt-2 block truncate text-[15px] font-semibold ${selected ? 'text-text-hi' : 'text-text-mid'}`}>
                        {v.title}
                      </span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-6 text-text-lo">No tutorials match “{query}”.</p>
                )}
              </div>
            )}

            {selectedVideo && (
              <div className="card overflow-hidden">
                <VideoFacade key={selectedVideo.id} url={selectedVideo.url} title={selectedVideo.title} />
                <div className="px-5 py-4">
                  <p className="eyebrow">{isPlaylist ? 'Pattern library' : 'Now showing'}</p>
                  <h3 className="mt-0.5 text-lg font-bold">{selectedVideo.title}</h3>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------------- Songs ---------------- */}
      <section aria-labelledby="songs-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="songs-title" className="text-2xl font-extrabold tracking-tight">Music</h2>
        </div>

        {/* Mobile: one list at a time */}
        <div className="md:hidden">
          <Segmented
            idPrefix="songs"
            label="Song category"
            value={songTab}
            onChange={setSongTab}
            options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
            className="mb-4"
          />
          <div id="songs-panel" role="tabpanel" aria-labelledby={`songs-tab-${songTab}`} key={songTab} className="card animate-fade">
            <SongList songs={getSongsByCategory(songTab)} />
          </div>
        </div>

        {/* Desktop: three columns are fine */}
        <div className="hidden md:grid md:grid-cols-3 md:gap-6 md:items-start">
          {CATEGORIES.map(c => (
            <div key={c.value} className="card">
              <h3 className={`flex items-center gap-2 px-5 pt-5 pb-2 text-[15px] font-bold ${c.text}`}>
                {c.icon} {c.label === 'New' ? 'New music' : c.label}
              </h3>
              <SongList songs={getSongsByCategory(c.value)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const SourceBadge: React.FC<{ url: string }> = ({ url }) => {
  if (url.includes('spotify.com'))
    return <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">Spotify</span>;
  if (url.includes('youtube.com') || url.includes('youtu.be'))
    return <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[12px] font-semibold text-rose-300 ring-1 ring-rose-500/30">YouTube</span>;
  return <ExternalLink className="h-4 w-4 text-text-lo" aria-label="Open link" />;
};

const SongList: React.FC<{ songs: SongItem[] }> = ({ songs }) =>
  songs.length > 0 ? (
    <ul className="stagger divide-y divide-line px-2 py-1">
      {songs.map((s, i) => (
        <li key={s.id} style={{ ['--i' as any]: i }}>
          <a
            href={s.url || undefined}
            target="_blank"
            rel="noopener"
            className="press flex min-h-[60px] items-center justify-between gap-3 rounded-sm px-3 py-2.5 hover:bg-surface-2 active:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-text-hi">{s.title}</span>
              <span className="block truncate text-[14px] text-text-lo">{s.artist}</span>
            </span>
            {s.url && <SourceBadge url={s.url} />}
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <NoteDoodle className="mb-3 h-9 w-9 text-brand-soft/70" />
      <p className="text-text-mid">No songs here yet — check back after class.</p>
    </div>
  );
