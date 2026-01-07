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
      // In a real scenario, we might pull a URL from localStorage here
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
          <div className="flex items-center gap-3">
            {/* Logo Image - User should ensure 'logo.png' exists in the public directory */}
            <img 
              src="/logo.png" 
              alt="Dance Class Companion Logo" 
              className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1"
              onError={(e) => {
                // Fallback to text/css logo if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            {/* Fallback Logo (Hidden by default if image loads) */}
            <div className="hidden w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-violet-900/20">
              D
            </div>
            
            <h1 className="text-xl font-bold tracking-tight text-slate-100 hidden sm:block">Dance Class <span className="text-violet-500">Companion</span></h1>
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
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Dance Class Companion. Keep dancing!</p>
          <p className="text-slate-600 text-xs mt-2">Powered by Gemini AI & Google Sheets</p>
        </div>
      </footer>
    </div>
  );
};

export default App;