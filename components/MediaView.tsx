
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VideoItem, SongItem } from '../types';
import { VideoFacade } from './YouTubeEmbed';
import { getYouTubeThumb, getYouTubeId, isPlaylistUrl } from './ui/youtube';
import { Segmented } from './ui/Segmented';
import { EmptyState, NoteDoodle } from './ui/Doodles';
import { useMusic, songsForCategory, EqBars } from './music/MusicPlayer';
import { Search, X, ListVideo, ExternalLink, Flame, Music2, Headphones, Play, Shuffle } from 'lucide-react';

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

  const music = useMusic();
  // Load the YouTube player while the user browses, so the first tap on a song plays straight away.
  useEffect(() => { music.prepare(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                  <p className="py-6 text-text-lo">No tutorials match â€œ{query}â€.</p>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="songs-title" className="text-2xl font-extrabold tracking-tight">Music</h2>
          {music.playlists.some(p => p.id === 'all') && (
            <div className="flex gap-2">
              <button type="button" onClick={() => music.play('all', undefined, { shuffle: false })} className="btn-secondary press !min-h-11 !px-4 text-[15px]">
                <Play className="h-4 w-4 fill-current" /> Play all
              </button>
              <button type="button" onClick={() => music.play('all', undefined, { shuffle: true })} className="btn-secondary press !min-h-11 !px-4 text-[15px]">
                <Shuffle className="h-4 w-4" /> Shuffle
              </button>
            </div>
          )}
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
            <SongList songs={songsForCategory(songs, songTab)} listId={songTab} />
          </div>
        </div>

        {/* Desktop: three columns are fine */}
        <div className="hidden md:grid md:grid-cols-3 md:gap-6 md:items-start">
          {CATEGORIES.map(c => (
            <div key={c.value} className="card">
              <div className="flex items-center justify-between gap-2 pl-5 pr-2 pt-3 pb-1">
                <h3 className={`flex items-center gap-2 text-[15px] font-bold ${c.text}`}>
                  {c.icon} {c.label === 'New' ? 'New music' : c.label}
                </h3>
                {music.playlists.some(p => p.id === c.value) && (
                  <button
                    type="button"
                    onClick={() => music.play(c.value, undefined, { shuffle: false })}
                    aria-label={`Play ${c.label} playlist`}
                    data-tip={`Play ${c.label}`}
                    data-tip-align="end"
                    className="tip press grid h-11 w-11 place-items-center rounded-full text-text-mid hover:bg-surface-2 hover:text-text-hi"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                )}
              </div>
              <SongList songs={songsForCategory(songs, c.value)} listId={c.value} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const SongList: React.FC<{ songs: SongItem[]; listId: string }> = ({ songs, listId }) => {
  const music = useMusic();
  if (!songs.length)
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <NoteDoodle className="mb-3 h-9 w-9 text-brand-soft/70" />
        <p className="text-text-mid">No songs here yet — check back after class.</p>
      </div>
    );

  return (
    <ul className="stagger divide-y divide-line px-2 py-1">
      {songs.map((s, i) => {
        const playable = !!getYouTubeId(s.url);
        const isCurrent = music.current?.id === s.id;
        const inner = (
          <>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-text-mid">
              {isCurrent ? (
                <EqBars playing={music.isPlaying} />
              ) : playable ? (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-semibold ${isCurrent ? 'text-accent' : 'text-text-hi'}`}>{s.title}</span>
              <span className="block truncate text-[14px] text-text-lo">{s.artist}</span>
            </span>
          </>
        );
        const cls = 'press flex min-h-[60px] w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-surface-2 active:bg-surface-2';
        return (
          <li key={s.id} style={{ ['--i' as any]: i }}>
            {playable ? (
              <button
                type="button"
                className={cls}
                aria-label={isCurrent ? `${s.title} (now playing) — ${music.isPlaying ? 'pause' : 'play'}` : `Play ${s.title} by ${s.artist}`}
                onClick={() => (isCurrent ? music.toggle() : music.play(listId, s.id))}
              >
                {inner}
              </button>
            ) : (
              // Non-YouTube links (e.g. Spotify) can't play in-app, so they still open outside.
              <a href={s.url || undefined} target="_blank" rel="noopener" className={cls}>
                {inner}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
};
