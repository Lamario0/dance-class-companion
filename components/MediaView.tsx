
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VideoItem, SongItem } from '../types';
import { YouTubeEmbed } from './YouTubeEmbed';
import { Play, Music2, Headphones, Flame, Disc, Search, Mic, X, Loader2, ListMusic } from 'lucide-react';
import { parseVoiceSearch } from '../services/geminiService';

interface MediaViewProps {
  videos: VideoItem[];
  songs: SongItem[];
}

export const MediaView: React.FC<MediaViewProps> = ({ videos, songs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Derived state for tutorials
  const tutorials = useMemo(() => videos.filter(v => v.category === 'tutorial'), [videos]);
  
  // Default to the playlist if it exists
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  useEffect(() => {
    if (tutorials.length > 0 && !selectedVideoId) {
      // Prioritize the playlist URL if found
      const playlist = tutorials.find(t => t.id === 'tut-playlist');
      setSelectedVideoId(playlist ? playlist.id : tutorials[0].id);
    }
  }, [tutorials, selectedVideoId]);

  const selectedVideo = tutorials.find(v => v.id === selectedVideoId);

  // Derived state for songs
  const getSongsByCategory = (cat: string) => songs.filter(s => s.category === cat).slice(0, 5);
  const newSongs = getSongsByCategory('new');
  const bluesSongs = getSongsByCategory('blues');
  const practiceSongs = getSongsByCategory('practice');

  // Search Logic
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return songs.filter(song => 
      song.title.toLowerCase().includes(lowerQuery) || 
      song.artist.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, songs]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop()); // Stop microphone access
        
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        // Send to Gemini
        const text = await parseVoiceSearch(base64Audio, blob.type || 'audio/webm');
        setSearchQuery(text);
        setIsProcessing(false);
      };
    } catch (e) {
      console.error("Audio processing failed", e);
      setIsProcessing(false);
    }
  };

  const isPlaylist = selectedVideo?.id === 'tut-playlist' || selectedVideo?.url.includes('list=');

  return (
    <div className="space-y-8 pb-20">
      
      {/* Search Bar Section */}
      <section className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-3 border border-slate-700 rounded-xl leading-5 bg-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors sm:text-sm"
            placeholder="Search for songs by title or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`relative flex items-center justify-center h-12 w-12 rounded-full transition-all duration-200 ${
            isRecording 
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50 scale-110' 
              : isProcessing
                ? 'bg-slate-700 text-slate-400 cursor-wait'
                : 'bg-slate-800 text-violet-400 hover:bg-slate-700 hover:text-violet-300 border border-slate-700'
          }`}
          title="Search by Voice"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Mic className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
              {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              )}
            </>
          )}
        </button>
      </section>

      {/* Search Results */}
      {searchQuery && (
        <section className="animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-5 h-5 text-violet-400" />
              Search Results
            </h2>
            <span className="text-sm text-slate-500">
              Found {filteredSongs.length} song{filteredSongs.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {filteredSongs.length > 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <ul className="divide-y divide-slate-800">
                {filteredSongs.map(song => (
                  <li key={song.id} className="hover:bg-slate-800/50 transition-colors">
                     <a 
                      href={song.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-violet-900/30 flex items-center justify-center text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                          <Music2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200 group-hover:text-white">{song.title}</p>
                          <p className="text-sm text-slate-400">{song.artist}</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 capitalize">
                        {song.category}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
             <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-12 text-center text-slate-500">
               <Music2 className="w-12 h-12 mx-auto mb-4 text-slate-700" />
               <p>No songs found matching "{searchQuery}"</p>
               <button onClick={() => setSearchQuery('')} className="mt-2 text-violet-400 hover:text-violet-300 text-sm font-medium">Clear Search</button>
             </div>
          )}
        </section>
      )}

      {/* Default Content (Tutorials & Categories) */}
      <div className={searchQuery ? 'opacity-50 transition-opacity' : ''}>
        {/* Tutorials Section */}
        <section className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <div className="p-2 bg-violet-900/30 text-violet-300 rounded-lg">
                {isPlaylist ? <ListMusic className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </div>
              {isPlaylist ? "Class Tutorial Playlist" : "Video Tutorials"}
            </h2>
            
            {tutorials.length > 1 ? (
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-slate-700 focus:border-violet-500 transition-colors"
                  value={selectedVideoId}
                  onChange={(e) => setSelectedVideoId(e.target.value)}
                >
                  {tutorials.map(v => (
                    <option key={v.id} value={v.id}>{v.title}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            ) : tutorials.length === 1 ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-400 text-sm font-medium border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                {tutorials[0].title}
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 italic">No tutorials configured in Google Sheets yet.</div>
            )}
          </div>

          <div className="p-6 bg-black flex justify-center border-t border-slate-800 min-h-[300px]">
            {selectedVideo ? (
              <YouTubeEmbed url={selectedVideo.url} title={selectedVideo.title} className="w-full max-w-3xl aspect-video rounded-xl shadow-2xl ring-1 ring-white/10" />
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">Select a video to play</div>
            )}
          </div>
        </section>

        {/* Music Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SongList title="New Songs" icon={<Flame className="w-5 h-5" />} songs={newSongs} color="violet" />
          <SongList title="Blues Songs" icon={<Music2 className="w-5 h-5" />} songs={bluesSongs} color="sky" />
          <SongList title="Practice Songs" icon={<Headphones className="w-5 h-5" />} songs={practiceSongs} color="emerald" />
        </div>
      </div>
    </div>
  );
};

interface SongListProps {
  title: string;
  icon: React.ReactNode;
  songs: SongItem[];
  color: 'violet' | 'sky' | 'emerald';
}

const SongList: React.FC<SongListProps> = ({ title, icon, songs, color }) => {
  const colorStyles = {
    violet: 'text-violet-300 bg-violet-900/20 border-violet-800/30',
    sky: 'text-sky-300 bg-sky-900/20 border-sky-800/30',
    emerald: 'text-emerald-300 bg-emerald-900/20 border-emerald-800/30',
  };

  const linkStyles = {
    violet: 'hover:bg-slate-800 hover:text-violet-400',
    sky: 'hover:bg-slate-800 hover:text-sky-400',
    emerald: 'hover:bg-slate-800 hover:text-emerald-400',
  };

  return (
    <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 flex flex-col h-full">
      <div className={`p-4 border-b ${colorStyles[color]} rounded-t-2xl flex items-center gap-2 font-bold`}>
        {icon}
        {title}
      </div>
      <div className="p-2 flex-1">
        {songs.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">No songs added yet.</div>
        ) : (
          <ul className="space-y-1">
            {songs.map(song => (
              <li key={song.id}>
                <a 
                  href={song.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`group flex items-center justify-between p-3 rounded-lg transition-all ${linkStyles[color]}`}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-semibold text-slate-200 text-sm truncate">{song.title}</span>
                    <span className="text-xs text-slate-400 truncate">{song.artist}</span>
                  </div>
                  <div className="text-slate-600 group-hover:text-current transition-colors">
                    <Disc className="w-4 h-4" />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
