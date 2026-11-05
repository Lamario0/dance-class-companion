import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SongItem } from '../../types';
import { getYouTubeId } from '../ui/youtube';
import { useAnySheetOpen } from '../ui/BottomSheet';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, ListMusic, ChevronDown, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types + playlists                                                  */
/* ------------------------------------------------------------------ */

export interface Track {
  id: string;
  title: string;
  artist: string;
  videoId: string;
}
export interface Playlist {
  id: string;
  label: string;
  tracks: Track[];
}
export type RepeatMode = 'off' | 'all' | 'one';

// Same "up to 5 per category" rule the Media lists use, so the queue matches what's on screen.
const PER_LIST = 5;
const LISTS: { id: SongItem['category']; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'blues', label: 'Bluesy' },
  { id: 'practice', label: 'Practice' },
];

export const songsForCategory = (songs: SongItem[], cat: string) => songs.filter(s => s.category === cat).slice(0, PER_LIST);

export const buildPlaylists = (songs: SongItem[]): Playlist[] => {
  const toTrack = (s: SongItem): Track | null => {
    const videoId = getYouTubeId(s.url);
    return videoId ? { id: s.id, title: s.title, artist: s.artist, videoId } : null;
  };
  const lists = LISTS.map(l => ({
    id: l.id,
    label: l.label,
    tracks: songsForCategory(songs, l.id).map(toTrack).filter(Boolean) as Track[],
  }));
  const all = { id: 'all', label: 'All', tracks: lists.flatMap(l => l.tracks) };
  return [...lists, all].filter(l => l.tracks.length > 0);
};

const shuffled = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------------------------------------------------ */
/* YouTube IFrame API loader                                          */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;
const loadYouTubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise(resolve => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    });
  }
  return apiPromise;
};

/* ------------------------------------------------------------------ */
/* Context                                                            */
/* ------------------------------------------------------------------ */

interface MusicState {
  playlists: Playlist[];
  playlist: Playlist | null;
  /** play order: indices into playlist.tracks (shuffled when shuffle is on) */
  order: number[];
  pos: number;
  current: Track | null;
  isPlaying: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  expanded: boolean;
}

interface MusicApi extends MusicState {
  /** start (or switch to) a playlist, optionally at a given track */
  play: (playlistId: string, trackId?: string, opts?: { shuffle?: boolean }) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  close: () => void;
  setExpanded: (v: boolean) => void;
  /** warm up the YouTube player so the first tap can start playback immediately */
  prepare: () => void;
  playerRef: React.MutableRefObject<any>;
}

const MusicContext = createContext<MusicApi | null>(null);
export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside <MusicProvider>');
  return ctx;
};

export const MusicProvider: React.FC<{ songs: SongItem[]; children: React.ReactNode }> = ({ songs, children }) => {
  const playlists = useMemo(() => buildPlaylists(songs), [songs]);
  const [state, setState] = useState<Omit<MusicState, 'playlists' | 'current' | 'playlist'> & { playlistId: string | null }>({
    playlistId: null,
    order: [],
    pos: 0,
    isPlaying: false,
    repeat: 'off',
    shuffle: false,
    expanded: false,
  });

  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const readyRef = useRef<Promise<any> | null>(null);
  const pendingVideo = useRef<string | null>(null);
  const errorStreak = useRef(0);

  const playlist = playlists.find(p => p.id === state.playlistId) ?? null;
  const current = playlist ? playlist.tracks[state.order[state.pos]] ?? null : null;

  // Keep the latest state reachable from YouTube's event callbacks.
  const live = useRef({ state, playlist });
  live.current = { state, playlist };

  const ensurePlayer = useCallback(() => {
    if (readyRef.current) return readyRef.current;
    readyRef.current = loadYouTubeApi().then(
      YT =>
        new Promise(resolve => {
          if (!hostRef.current) return;
          // YouTube replaces this node with its iframe, so React never owns it.
          const el = document.createElement('div');
          hostRef.current.appendChild(el);
          playerRef.current = new YT.Player(el, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1, origin: window.location.origin },
            events: {
              onReady: () => {
                if (pendingVideo.current) {
                  playerRef.current.loadVideoById(pendingVideo.current);
                  pendingVideo.current = null;
                }
                resolve(playerRef.current);
              },
              onStateChange: (e: any) => {
                if (e.data === 1) {
                  errorStreak.current = 0;
                  setState(s => ({ ...s, isPlaying: true }));
                } else if (e.data === 2) {
                  setState(s => ({ ...s, isPlaying: false }));
                } else if (e.data === 0) {
                  onEnded();
                }
              },
              onError: () => {
                // Embedding disabled / removed video: skip it, but don't loop forever.
                const len = live.current.state.order.length;
                errorStreak.current += 1;
                if (errorStreak.current < len) advance(1, true);
                else setState(s => ({ ...s, isPlaying: false }));
              },
            },
          });
        }),
    );
    return readyRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVideo = useCallback((videoId: string) => {
    const p = playerRef.current;
    if (p?.loadVideoById) p.loadVideoById(videoId);
    else {
      pendingVideo.current = videoId;
      ensurePlayer();
    }
  }, [ensurePlayer]);

  /** step through the order; `auto` = called because a track ended or failed */
  const advance = (dir: 1 | -1, auto = false) => {
    const { state: s, playlist: pl } = live.current;
    if (!pl || !s.order.length) return;
    let pos = s.pos + dir;
    if (pos >= s.order.length) {
      if (auto && s.repeat === 'off') {
        setState(x => ({ ...x, isPlaying: false }));
        return;
      }
      pos = 0;
    } else if (pos < 0) {
      pos = s.order.length - 1;
    }
    setState(x => ({ ...x, pos }));
    loadVideo(pl.tracks[s.order[pos]].videoId);
  };

  const onEnded = () => {
    const { state: s } = live.current;
    if (s.repeat === 'one') {
      playerRef.current?.seekTo(0, true);
      playerRef.current?.playVideo();
    } else {
      advance(1, true);
    }
  };

  const play: MusicApi['play'] = (playlistId, trackId, opts) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl?.tracks.length) return;
    const shuffle = opts?.shuffle ?? state.shuffle;
    const startIdx = Math.max(0, trackId ? pl.tracks.findIndex(t => t.id === trackId) : 0);
    const natural = pl.tracks.map((_, i) => i);
    let order = natural;
    let pos = startIdx;
    if (shuffle) {
      // the chosen track plays first, the rest in random order
      const rest = shuffled(natural.filter(i => i !== startIdx));
      order = trackId ? [startIdx, ...rest] : shuffled(natural);
      pos = 0;
    }
    errorStreak.current = 0;
    setState(s => ({ ...s, playlistId, order, pos, shuffle }));
    loadVideo(pl.tracks[order[pos]].videoId);
  };

  const api: MusicApi = {
    playlists,
    playlist,
    order: state.order,
    pos: state.pos,
    current,
    isPlaying: state.isPlaying,
    repeat: state.repeat,
    shuffle: state.shuffle,
    expanded: state.expanded,
    play,
    toggle: () => {
      const p = playerRef.current;
      if (!p || !current) return;
      if (state.isPlaying) p.pauseVideo();
      else p.playVideo();
    },
    next: () => advance(1),
    prev: () => {
      const p = playerRef.current;
      // like most players: restart the song if we're more than a few seconds in
      if (p?.getCurrentTime && p.getCurrentTime() > 3) p.seekTo(0, true);
      else advance(-1);
    },
    cycleRepeat: () =>
      setState(s => ({ ...s, repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
    toggleShuffle: () =>
      setState(s => {
        if (!playlist) return { ...s, shuffle: !s.shuffle };
        const playingIdx = s.order[s.pos];
        const natural = playlist.tracks.map((_, i) => i);
        if (s.shuffle) return { ...s, shuffle: false, order: natural, pos: playingIdx };
        const order = [playingIdx, ...shuffled(natural.filter(i => i !== playingIdx))];
        return { ...s, shuffle: true, order, pos: 0 };
      }),
    close: () => {
      playerRef.current?.stopVideo?.();
      setState(s => ({ ...s, playlistId: null, order: [], pos: 0, isPlaying: false, expanded: false }));
    },
    setExpanded: (v: boolean) => setState(s => ({ ...s, expanded: v })),
    prepare: () => { ensurePlayer(); },
    playerRef,
  };

  return (
    <MusicContext.Provider value={api}>
      {children}
      <PlayerDock hostRef={hostRef} />
    </MusicContext.Provider>
  );
};

/* ------------------------------------------------------------------ */
/* Floating player dock (sits just above the bottom nav)              */
/* ------------------------------------------------------------------ */

const fmt = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const IconBtn: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  big?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, active, big, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    data-tip={label}
    className={`tip press relative grid shrink-0 place-items-center rounded-full ${
      big
        ? 'h-14 w-14 bg-text-hi text-surface-0 hover:bg-white'
        : `h-11 w-11 hover:bg-surface-2 ${active ? 'text-accent' : 'text-text-mid hover:text-text-hi'}`
    }`}
  >
    {children}
    {active && !big && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden="true" />}
  </button>
);

const PlayerDock: React.FC<{ hostRef: React.MutableRefObject<HTMLDivElement | null> }> = ({ hostRef }) => {
  const m = useMusic();
  const sheetOpen = useAnySheetOpen();
  const dockRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState({ t: 0, d: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const visible = !!m.current;

  // progress polling while a track is loaded
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      const p = m.playerRef.current;
      if (p?.getCurrentTime) setTime({ t: p.getCurrentTime() || 0, d: p.getDuration() || 0 });
    }, 500);
    return () => window.clearInterval(id);
  }, [visible, m.playerRef]);

  // publish the dock height so pages can pad their bottoms
  useEffect(() => {
    const el = dockRef.current;
    const root = document.documentElement;
    if (!el || !visible) {
      root.style.setProperty('--dock-h', '0px');
      return;
    }
    const ro = new ResizeObserver(() => {
      // collapsed height only: the expanded panel is an overlay, not page furniture
      if (!m.expanded) root.style.setProperty('--dock-h', `${el.offsetHeight + 8}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible, m.expanded]);

  useEffect(() => {
    if (!m.expanded) setShowQueue(false);
  }, [m.expanded]);

  const expanded = m.expanded && visible;
  const pct = time.d ? ((scrub ?? time.t) / time.d) * 100 : 0;
  const RepeatIcon = m.repeat === 'one' ? Repeat1 : Repeat;
  const repeatLabel = m.repeat === 'off' ? 'Repeat: off' : m.repeat === 'all' ? 'Repeat: playlist' : 'Repeat: this song';

  return (
    <>
      {/* tap-outside to collapse the expanded player */}
      <div
        aria-hidden="true"
        onClick={() => m.setExpanded(false)}
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        ref={dockRef}
        role="region"
        aria-label="Music player"
        className={`fixed inset-x-0 z-[35] mx-auto w-[calc(100%-2rem)] max-w-md transition-[transform,opacity,bottom] duration-[460ms] ease-[var(--ease-spring)] ${
          visible && !sheetOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+var(--nav-h))] opacity-0'
        }`}
        style={{ bottom: 'calc(var(--nav-h) + var(--chat-h, 0px) + 8px)' }}
      >
        <div
          className={`rounded-[var(--radius-lg)] border border-white/10 bg-surface-1/90 shadow-[var(--shadow-float)] backdrop-blur-xl backdrop-saturate-150 ${
            expanded
              ? 'max-h-[calc(100dvh-var(--nav-h)-var(--chat-h)-24px-env(safe-area-inset-top,0px))] overflow-y-auto overscroll-contain [scrollbar-width:thin]'
              : 'overflow-hidden'
          }`}
        >
          {/* thin progress line (collapsed) */}
          {!expanded && (
            <div className="h-[3px] bg-line/60" aria-hidden="true">
              <div className="h-full bg-gradient-to-r from-brand to-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
            </div>
          )}

          {expanded && (
            <div className="flex items-center justify-between gap-2 px-3 pt-2 animate-fade">
              <IconBtn label="Minimize player" onClick={() => m.setExpanded(false)}>
                <ChevronDown className="h-5 w-5" />
              </IconBtn>
              <p className="eyebrow truncate">Playing · {m.playlist?.label}</p>
              <IconBtn label="Close player" onClick={m.close}>
                <X className="h-5 w-5" />
              </IconBtn>
            </div>
          )}

          <div className={expanded ? 'px-4 pb-4' : 'flex items-center gap-3 p-2 pr-1.5'}>
            {/* The video stays in one DOM spot and only changes size, so playback never restarts. */}
            <div
              className={`relative shrink-0 overflow-hidden bg-black transition-[width,border-radius] duration-[420ms] ease-[var(--ease-calm)] ${
                expanded ? 'mt-1 aspect-video w-full rounded-[var(--radius-md)]' : 'aspect-video w-[88px] rounded-[var(--radius-sm)]'
              }`}
            >
              <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
              {/* collapsed: tapping the video expands instead of interacting with the tiny iframe */}
              {!expanded && (
                <button type="button" aria-label="Expand player" onClick={() => m.setExpanded(true)} className="absolute inset-0">
                  {m.current && (
                    <img src={`https://i.ytimg.com/vi/${m.current.videoId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => m.setExpanded(true)}
              disabled={expanded}
              className={`min-w-0 text-left ${expanded ? 'mt-4 block w-full cursor-default' : 'flex-1'}`}
            >
              <span className={`block truncate font-semibold text-text-hi ${expanded ? 'text-lg' : 'text-[15px]'}`}>
                {m.current?.title}
              </span>
              <span className="block truncate text-[13px] text-text-lo">{m.current?.artist}</span>
            </button>

            {!expanded && (
              <div className="flex items-center">
                <IconBtn label={m.isPlaying ? 'Pause' : 'Play'} onClick={m.toggle}>
                  {m.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </IconBtn>
                <IconBtn label="Next song" onClick={m.next}>
                  <SkipForward className="h-5 w-5 fill-current" />
                </IconBtn>
                <IconBtn label="Close player" onClick={m.close}>
                  <X className="h-5 w-5" />
                </IconBtn>
              </div>
            )}

            {expanded && (
              <div className="animate-fade">
                {/* seek bar */}
                <div className="mt-3">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(time.d))}
                    step={1}
                    value={Math.floor(scrub ?? time.t)}
                    onChange={e => setScrub(+e.target.value)}
                    onPointerUp={() => {
                      if (scrub != null) m.playerRef.current?.seekTo(scrub, true);
                      setTimeout(() => setScrub(null), 600);
                    }}
                    onKeyUp={() => {
                      if (scrub != null) m.playerRef.current?.seekTo(scrub, true);
                      setTimeout(() => setScrub(null), 600);
                    }}
                    aria-label="Seek"
                    className="seek w-full"
                    style={{ ['--pct' as any]: `${pct}%` }}
                  />
                  <div className="flex justify-between text-[12px] tabular-nums text-text-lo">
                    <span>{fmt(scrub ?? time.t)}</span>
                    <span>{fmt(time.d)}</span>
                  </div>
                </div>

                {/* transport */}
                <div className="mt-2 flex items-center justify-between">
                  <IconBtn label={m.shuffle ? 'Shuffle: on' : 'Shuffle: off'} onClick={m.toggleShuffle} active={m.shuffle}>
                    <Shuffle className="h-5 w-5" />
                  </IconBtn>
                  <IconBtn label="Previous song" onClick={m.prev}>
                    <SkipBack className="h-6 w-6 fill-current" />
                  </IconBtn>
                  <IconBtn big label={m.isPlaying ? 'Pause' : 'Play'} onClick={m.toggle}>
                    {m.isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
                  </IconBtn>
                  <IconBtn label="Next song" onClick={m.next}>
                    <SkipForward className="h-6 w-6 fill-current" />
                  </IconBtn>
                  <IconBtn label={repeatLabel} onClick={m.cycleRepeat} active={m.repeat !== 'off'}>
                    <RepeatIcon className="h-5 w-5" />
                  </IconBtn>
                </div>

                {/* playlist */}
                <div className="mt-3 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => setShowQueue(q => !q)}
                    aria-expanded={showQueue}
                    className="press flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 text-[15px] font-semibold text-text-mid hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2"><ListMusic className="h-5 w-5" /> Playlist</span>
                    <ChevronDown className={`h-5 w-5 transition-transform duration-300 ease-[var(--ease-spring)] ${showQueue ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-calm)] ${showQueue ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden" inert={!showQueue}>
                      <div role="radiogroup" aria-label="Choose a playlist" className="no-scrollbar flex gap-2 overflow-x-auto px-1 py-2">
                        {m.playlists.map(p => {
                          const on = p.id === m.playlist?.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => !on && m.play(p.id)}
                              className={`press shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold ring-1 ${
                                on ? 'bg-brand-strong/30 text-text-hi ring-brand/50' : 'text-text-mid ring-line hover:bg-surface-2'
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <ol className="max-h-52 overflow-y-auto overscroll-contain">
                        {m.order.map((trackIdx, i) => {
                          const t = m.playlist!.tracks[trackIdx];
                          const on = i === m.pos;
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => m.play(m.playlist!.id, t.id, { shuffle: false })}
                                aria-current={on ? 'true' : undefined}
                                className="press flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-left hover:bg-surface-2"
                              >
                                <span className="w-5 shrink-0 text-center text-[13px] tabular-nums text-text-lo">
                                  {on ? <EqBars playing={m.isPlaying} /> : i + 1}
                                </span>
                                <span className="min-w-0">
                                  <span className={`block truncate text-[15px] font-semibold ${on ? 'text-accent' : 'text-text-hi'}`}>{t.title}</span>
                                  <span className="block truncate text-[13px] text-text-lo">{t.artist}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

/** Little animated equalizer bars for "now playing". */
export const EqBars: React.FC<{ playing: boolean }> = ({ playing }) => (
  <span className={`eq inline-flex h-3.5 items-end gap-[2px] ${playing ? '' : 'eq-paused'}`} aria-label={playing ? 'Now playing' : 'Paused'} role="img">
    <span /><span /><span />
  </span>
);
