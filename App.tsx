
import React, { useState, useEffect, useRef } from 'react';
import { Tab, AppData } from './types';
import { fetchSheetData } from './services/dataService';
import { ClassesView } from './components/ClassesView';
import { MediaView } from './components/MediaView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { CalculatorView } from './components/CalculatorView';
import { Library, Users, Loader2, Megaphone, Lock, ShieldAlert, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CLASSES);
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  // Hidden Calculator States
  const [logoClicks, setLogoClicks] = useState(0);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const fetchedData = await fetchSheetData();
      setData(fetchedData);
      setLoading(false);
    };
    loadData();
  }, []);

  const navigateTo = (tab: Tab) => {
    // We allow navigation without logging out the admin
    setActiveTab(tab);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab(Tab.CLASSES);
  };

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);

    if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
    
    if (newCount === 3) {
      setLogoClicks(0);
      if (isAuthenticated) {
        setActiveTab(Tab.CALCULATOR);
      } else {
        setShowPasswordPrompt(true);
      }
    } else {
      clickTimeoutRef.current = window.setTimeout(() => setLogoClicks(0), 500);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'bluebird') {
      setIsAuthenticated(true);
      setShowPasswordPrompt(false);
      setActiveTab(Tab.CALCULATOR);
      setLoginError(false);
      setPasswordInput('');
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  const videoOfMonth = data?.videos.find(v => v.category === 'month');

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 h-16 flex items-center justify-between gap-1 sm:gap-4">
          
          {/* Logo & Header Text - Header text visible on desktop (sm+) */}
          <div className="flex items-center gap-2 group cursor-pointer flex-shrink-0" onClick={handleLogoClick}>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-60 transition duration-700"></div>
              <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-xl overflow-hidden p-1">
                <svg viewBox="0 0 100 100" className="w-full h-full group-hover:scale-110 transition-transform duration-300" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#d946ef" />
                      <stop offset="100%" stopColor="#701a75" />
                    </linearGradient>
                  </defs>
                  <path d="M45,32 c1,0 2,-1 2,-2 c0,-1 -1,-2 -2,-2 c-2,0 -4,2 -4,5 c0,2 1,3 3,3 c2,0 3,-1 4,-3 c0,-2 -2,-4 -4,-4 M50,45 c2,-5 6,-8 10,-8 c4,0 7,4 7,8 c0,6 -10,12 -15,15 c-5,-3 -15,-9 -15,-15 c0,-4 3,-8 7,-8 c4,0 8,3 10,8 M38,35 c-2,-2 -5,-3 -8,-2 c-3,1 -5,4 -5,7 c0,3 2,5 5,6 c3,1 6,-1 8,-4 c2,-3 1,-7 -1,-9 M62,35 c2,-2 5,-3 8,-2 c3,1 5,4 5,7 c0,3 -2,5 -5,6 c-3,1 -6,-1 -8,-4 c-2,-3 -1,-7 1,-9 M50,55 c0,0 -5,10 -10,15 c-5,5 -10,5 -10,5 M50,55 c0,0 5,10 10,15 c5,5 10,5 10,5" fill="url(#logoGrad)"/>
                </svg>
              </div>
            </div>
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-100 hidden sm:block">
              Dance Class <span className="text-violet-500">Companion</span>
            </h1>
          </div>
          
          {/* Navigation - Right aligned for desktop, full-width scaled for mobile */}
          <nav className="flex items-center gap-0.5 sm:gap-1.5 bg-slate-800 border border-slate-700 p-0.5 sm:p-1 rounded-lg sm:rounded-xl flex-1 sm:flex-none justify-end min-w-0">
            <button
              onClick={() => navigateTo(Tab.CLASSES)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap min-w-0 ${
                activeTab === Tab.CLASSES ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 h-4 shrink-0" />
              <span>Classes</span>
            </button>
            <button
              onClick={() => navigateTo(Tab.MEDIA)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap min-w-0 ${
                activeTab === Tab.MEDIA ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Library className="w-3.5 h-3.5 sm:w-4 h-4 shrink-0" />
              <span>Media</span>
            </button>
            <button
              onClick={() => navigateTo(Tab.ANNOUNCEMENTS)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap min-w-0 ${
                activeTab === Tab.ANNOUNCEMENTS ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5 sm:w-4 h-4 shrink-0" />
              <span>News</span>
            </button>
            {isAuthenticated && (
              <>
                <button
                  onClick={() => navigateTo(Tab.CALCULATOR)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap min-w-0 ${
                    activeTab === Tab.CALCULATOR ? 'bg-violet-600 text-white shadow-sm' : 'text-violet-400/60 hover:text-violet-400'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 sm:w-4 h-4 shrink-0" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap min-w-0 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Exit</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Password Prompt Overlay */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl max-w-sm w-full p-10 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-violet-400 border border-violet-500/20">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Restricted Access</h2>
            <p className="text-slate-500 text-sm mb-8">Please enter the admin passcode to access party tools.</p>
            <form onSubmit={handlePasswordSubmit}>
              <input 
                type="password" 
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={`w-full bg-slate-950 border ${loginError ? 'border-rose-500' : 'border-slate-800'} rounded-2xl px-5 py-4 text-center text-xl tracking-[0.5em] focus:border-violet-500 outline-none mb-6 transition-colors`}
              />
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPasswordInput('');
                    setLoginError(false);
                  }}
                  className="flex-1 py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-violet-600 text-white font-bold rounded-2xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/20"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <AnnouncementsView announcements={data.announcements} isAdmin={isAuthenticated} />
            )}
            {activeTab === Tab.CALCULATOR && isAuthenticated && (
              <CalculatorView />
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
