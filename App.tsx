
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tab, AppData } from './types';
import { fetchSheetData } from './services/dataService';
import { ClassesView } from './components/ClassesView';
import { MediaView } from './components/MediaView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { CalculatorView } from './components/CalculatorView';
import { BottomTabBar, TopNav, BASE_NAV, ADMIN_NAV } from './components/Navigation';
import { BottomSheet } from './components/ui/BottomSheet';
import { ToastProvider } from './components/ui/Toast';
import { EmptyState, DancingDots } from './components/ui/Doodles';
import { LogOut, RotateCw } from 'lucide-react';

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d946ef" />
        <stop offset="100%" stopColor="#701a75" />
      </linearGradient>
    </defs>
    <path d="M45,32 c1,0 2,-1 2,-2 c0,-1 -1,-2 -2,-2 c-2,0 -4,2 -4,5 c0,2 1,3 3,3 c2,0 3,-1 4,-3 c0,-2 -2,-4 -4,-4 M50,45 c2,-5 6,-8 10,-8 c4,0 7,4 7,8 c0,6 -10,12 -15,15 c-5,-3 -15,-9 -15,-15 c0,-4 3,-8 7,-8 c4,0 8,3 10,8 M38,35 c-2,-2 -5,-3 -8,-2 c-3,1 -5,4 -5,7 c0,3 2,5 5,6 c3,1 6,-1 8,-4 c2,-3 1,-7 -1,-9 M62,35 c2,-2 5,-3 8,-2 c3,1 5,4 5,7 c0,3 -2,5 -5,6 c-3,1 -6,-1 -8,-4 c-2,-3 -1,-7 1,-9 M50,55 c0,0 -5,10 -10,15 c-5,5 -10,5 -10,5 M50,55 c0,0 5,10 10,15 c5,5 10,5 10,5" fill="url(#logoGrad)"/>
  </svg>
);

/** "Warming up the dance floor…" skeleton of the class cards. */
const LoadingSkeleton: React.FC = () => (
  <div aria-busy="true">
    <div className="mb-6 flex items-center gap-3 text-text-mid">
      <DancingDots label="Loading classes" />
      <span className="font-medium">Warming up the dance floor…</span>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map(i => (
        <div key={i} className="card p-6 animate-pulse motion-reduce:animate-none">
          <div className="h-6 w-2/3 rounded-sm bg-surface-2" />
          <div className="mt-6 h-3 w-28 rounded-sm bg-surface-2" />
          {[0, 1, 2, 3].map(r => (
            <div key={r} className="mt-5 h-4 rounded-sm bg-surface-2" style={{ width: `${80 - r * 12}%` }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CLASSES);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  // Hidden Calculator States
  const [logoClicks, setLogoClicks] = useState(0);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const fetchedData = await fetchSheetData();
    setData(fetchedData);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navItems = isAuthenticated ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV;
  const tabIndex = (t: Tab) => navItems.findIndex(i => i.tab === t);

  const navigateTo = (tab: Tab) => {
    // We allow navigation without logging out the admin
    if (tab === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setDirection(tabIndex(tab) >= tabIndex(activeTab) ? 'right' : 'left');
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setDirection('left');
    setActiveTab(Tab.CLASSES);
  };

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);

    if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);

    if (newCount === 3) {
      setLogoClicks(0);
      if (isAuthenticated) {
        setDirection('right');
        setActiveTab(Tab.CALCULATOR);
      } else {
        setShowPasswordPrompt(true);
      }
    } else {
      clickTimeoutRef.current = window.setTimeout(() => setLogoClicks(0), 500);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginPending(true);
    setLoginError(false);
    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (!response.ok) throw new Error('Incorrect password');
      setIsAuthenticated(true);
      setShowPasswordPrompt(false);
      setDirection('right');
      setActiveTab(Tab.CALCULATOR);
      setPasswordInput('');
    } catch {
      setLoginError(true);
      setPasswordInput('');
    } finally {
      setLoginPending(false);
    }
  };

  const closePasswordPrompt = useCallback(() => {
    setShowPasswordPrompt(false);
    setPasswordInput('');
    setLoginError(false);
  }, []);

  const videoOfMonth = data?.videos.find(v => v.category === 'month');
  // fetchSheetData resolves to empty lists when the sheet can't be reached.
  const loadFailed =
    !!data && !data.classes.length && !data.videos.length && !data.songs.length && !data.announcements.length;
  const current = navItems.find(i => i.tab === activeTab) ?? BASE_NAV[0];

  return (
    <ToastProvider>
      <div id="app-shell" className="min-h-screen bg-surface-0 font-sans text-text-hi flex flex-col">
        {/* Header — slim on mobile: logo (secret triple-tap) + page title */}
        <header
          className="sticky top-0 z-30 border-b border-line/60 bg-surface-0/80 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="mx-auto flex h-14 md:h-16 max-w-5xl items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={handleLogoClick}
                aria-label="Dance Class Companion"
                className="press -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-sm"
              >
                <span className="grid h-9 w-9 place-items-center rounded-sm bg-white p-1 shadow-sm">
                  <Logo className="h-full w-full" />
                </span>
              </button>
              <h1 className="truncate text-[17px] font-bold tracking-tight md:hidden">{current.title}</h1>
              <p className="hidden text-lg font-bold tracking-tight md:block">
                Dance Class <span className="text-brand-soft">Companion</span>
              </p>
            </div>
            <TopNav items={navItems} active={activeTab} onChange={navigateTo} />
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 md:pt-10 pb-10 md:pb-16">
          {loading ? (
            <LoadingSkeleton />
          ) : !data || loadFailed ? (
            <div className="card mx-auto max-w-md">
              <EmptyState
                doodle="feet"
                title="Couldn't reach the studio."
                body="Check your connection and try again."
                action={
                  <button onClick={loadData} className="btn-primary press">
                    <RotateCw className="h-4 w-4" />
                    <span className="slide-label"><span>Try again</span><span aria-hidden="true">Try again</span></span>
                  </button>
                }
              />
            </div>
          ) : (
            <div key={activeTab} className={direction === 'right' ? 'enter-right' : 'enter-left'}>
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
                <>
                  <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between gap-3">
                    <p className="text-text-lo text-[15px]">Instructor mode is on.</p>
                    <button onClick={handleLogout} className="btn-secondary press !min-h-11 shrink-0 whitespace-nowrap text-rose-300 hover:!bg-rose-500/15">
                      <LogOut className="h-4 w-4" />
                      Exit admin
                    </button>
                  </div>
                  <CalculatorView />
                </>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-line/60 py-8 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:pb-8">
          <div className="mx-auto max-w-5xl px-4 text-center text-[14px] text-text-lo">
            <p>© {new Date().getFullYear()} Dance Class Companion · Master the basics. Dance your story.</p>
            <p className="mt-2">
              <a href="/privacy.html" className="inline-block py-3 underline underline-offset-4 hover:text-text-mid">Privacy Policy</a>
            </p>
          </div>
        </footer>
      </div>

      <BottomTabBar items={navItems} active={activeTab} onChange={navigateTo} />

      {/* Instructor passcode — bottom sheet on mobile, dialog on desktop */}
      <BottomSheet
        open={showPasswordPrompt}
        onClose={closePasswordPrompt}
        title="Instructor tools"
        size="sm"
      >
        <p className="text-text-mid">Enter the instructor passcode.</p>
        <form onSubmit={handlePasswordSubmit} className="mt-5">
          <label htmlFor="admin-passcode" className="sr-only">Passcode</label>
          <input
            id="admin-passcode"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            aria-invalid={loginError}
            aria-describedby={loginError ? 'admin-passcode-error' : undefined}
            className={`input text-center text-xl tracking-[0.4em] ${loginError ? '!border-rose-500' : ''}`}
          />
          {loginError && (
            <p id="admin-passcode-error" className="mt-2 text-[14px] text-rose-300 animate-fade">
              That's not it — give it another try.
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={closePasswordPrompt} className="btn-secondary press flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loginPending} className="btn-primary press flex-1">
              {loginPending ? <DancingDots label="Checking" dotClass="bg-white" /> : 'Unlock'}
            </button>
          </div>
        </form>
      </BottomSheet>
    </ToastProvider>
  );
};

export default App;
