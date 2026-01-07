
import React, { useState, useEffect } from 'react';
import { Tab, AppData } from './types';
import { fetchSheetData } from './services/dataService';
import { ClassesView } from './components/ClassesView';
import { MediaView } from './components/MediaView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { Library, Users, Loader2, Megaphone } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CLASSES);
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const fetchedData = await fetchSheetData();
      setData(fetchedData);
      setLoading(false);
    };
    loadData();
  }, []);

  const videoOfMonth = data?.videos.find(v => v.category === 'month');

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab(Tab.CLASSES)}>
            {/* High-fidelity Silhouette Logo from provided image */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-60 transition duration-700"></div>
              <div className="relative flex items-center justify-center w-12 h-12 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden p-1.5">
                <svg 
                  viewBox="0 0 100 100" 
                  className="w-full h-full group-hover:scale-110 transition-transform duration-300"
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="magentaPurpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#d946ef" />
                      <stop offset="100%" stopColor="#701a75" />
                    </linearGradient>
                  </defs>
                  {/* Re-drawn Silhouette of the couple from the image */}
                  <path 
                    d="M45,32 c1,0 2,-1 2,-2 c0,-1 -1,-2 -2,-2 c-2,0 -4,2 -4,5 c0,2 1,3 3,3 c2,0 3,-1 4,-3 c0,-2 -2,-4 -4,-4 M50,45 c2,-5 6,-8 10,-8 c4,0 7,4 7,8 c0,6 -10,12 -15,15 c-5,-3 -15,-9 -15,-15 c0,-4 3,-8 7,-8 c4,0 8,3 10,8 M38,35 c-2,-2 -5,-3 -8,-2 c-3,1 -5,4 -5,7 c0,3 2,5 5,6 c3,1 6,-1 8,-4 c2,-3 1,-7 -1,-9 M62,35 c2,-2 5,-3 8,-2 c3,1 5,4 5,7 c0,3 -2,5 -5,6 c-3,1 -6,-1 -8,-4 c-2,-3 -1,-7 1,-9 M50,55 c0,0 -5,10 -10,15 c-5,5 -10,5 -10,5 M50,55 c0,0 5,10 10,15 c5,5 10,5 10,5" 
                    fill="url(#magentaPurpleGradient)"
                  />
                  {/* Silhouette Detail (Main Body Shape) */}
                  <path 
                    d="M48.2,34.1c1,0.2,2.1,0.5,3.1,1.1c1.2,0.7,2,1.8,2.2,3.1c0.1,0.6,0.1,1.2,0.1,1.8c0,1-0.2,1.9-0.5,2.9 c-0.6,1.8-1.5,3.3-2.9,4.6c-0.3,0.3-0.6,0.5-0.9,0.7c-0.2,0.1-0.4,0.3-0.5,0.4c-0.6,0.5-1.2,1-1.7,1.5c-0.3,0.3-0.6,0.6-0.8,0.9 c-1,1.1-1.8,2.3-2.3,3.7c-0.5,1.5-0.7,3-0.5,4.6c0.1,0.6,0.1,1.2,0.3,1.8c0.3,1,0.8,1.9,1.4,2.7c0.8,1.1,1.9,1.9,3.1,2.5 c0.5,0.2,1,0.4,1.5,0.6l0.2,0.1c0.7,0.2,1.5,0.4,2.2,0.6c1.3,0.3,2.7,0.5,4,0.6c0.8,0.1,1.7,0.1,2.5,0c0.9-0.1,1.8-0.3,2.6-0.6 c1.1-0.4,2.1-1,2.9-1.8c0.7-0.7,1.2-1.5,1.5-2.3c0.3-0.7,0.4-1.5,0.4-2.2c0-0.6-0.1-1.2-0.2-1.8c-0.3-1.4-0.9-2.7-1.7-3.8 c-0.4-0.5-0.8-1-1.2-1.4c-0.5-0.5-1.1-0.9-1.7-1.3c-1-0.7-2.1-1.2-3.3-1.6c-1-0.3-2.1-0.6-3.1-0.8c-0.1,0-0.2-0.1-0.3-0.1 c0-0.1,0-0.1,0.1-0.2c0.2-0.2,0.4-0.4,0.6-0.6c0.5-0.6,1-1.1,1.4-1.7c0.4-0.6,0.7-1.2,1-1.9c0.3-0.9,0.5-1.8,0.5-2.7 c0-0.9-0.1-1.8-0.5-2.6c-0.5-1.2-1.4-2.1-2.5-2.8c-0.5-0.3-1-0.6-1.6-0.8C50,33.9,49.1,33.9,48.2,34.1L48.2,34.1z" 
                    fill="url(#magentaPurpleGradient)"
                  />
                  {/* Extended limbs and head for clear couple silhouette */}
                  <circle cx="48" cy="30" r="3.5" fill="url(#magentaPurpleGradient)" />
                  <circle cx="56" cy="37" r="3" fill="url(#magentaPurpleGradient)" />
                  <path d="M44 42 L35 34 M56 46 L68 54 M45 62 L38 78 M55 62 L62 78" stroke="url(#magentaPurpleGradient)" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-xl font-bold tracking-tight text-slate-100 hidden sm:block">
              Dance Class <span className="text-violet-500">Companion</span>
            </h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-slate-800 border border-slate-700 p-1 rounded-xl overflow-x-auto max-w-[220px] sm:max-w-none">
            <button
              onClick={() => setActiveTab(Tab.CLASSES)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === Tab.CLASSES 
                  ? 'bg-slate-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Classes
            </button>
            <button
              onClick={() => setActiveTab(Tab.MEDIA)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === Tab.MEDIA 
                  ? 'bg-slate-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Library className="w-4 h-4" />
              Media
            </button>
            <button
              onClick={() => setActiveTab(Tab.ANNOUNCEMENTS)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === Tab.ANNOUNCEMENTS
                  ? 'bg-slate-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              News
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
             <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
             <p className="text-slate-500 font-medium">Loading your dance studio...</p>
          </div>
        ) : !data ? (
           <div className="text-center p-12">
             <p className="text-red-400">Failed to load data.</p>
           </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === Tab.CLASSES && (
              <ClassesView classes={data.classes} videoOfMonth={videoOfMonth} />
            )}
            {activeTab === Tab.MEDIA && (
              <MediaView videos={data.videos} songs={data.songs} />
            )}
            {activeTab === Tab.ANNOUNCEMENTS && (
              <AnnouncementsView announcements={data.announcements} />
            )}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Dance Class Companion. Master the Basics. Dance Your Story.</p>
          <p className="text-slate-600 text-xs mt-2">Powered by Gemini AI & Google Sheets</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
