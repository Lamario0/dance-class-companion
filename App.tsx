
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tab, AppData } from './types';
import { fetchSheetData } from './services/dataService';
import { ClassesView } from './components/ClassesView';
import { MediaView } from './components/MediaView';
// News pulls in Firestore for the chat, so it loads on first visit instead of up front.
const AnnouncementsView = React.lazy(() =>
  import('./components/AnnouncementsView').then(m => ({ default: m.AnnouncementsView })),
);
import { CalculatorView } from './components/CalculatorView';
import { useSlotCards } from './services/useSlotCards';
import type { DanceClass } from './types';
import { BottomTabBar, TopNav, BASE_NAV, ADMIN_NAV } from './components/Navigation';
import { MusicProvider } from './components/music/MusicPlayer';
import { AuthProvider } from './components/auth/AuthProvider';
import { AccountButton, AccountSheet } from './components/auth/AccountSheet';
import { useAccount } from './components/auth/AuthProvider';
import { MenuButton, SideMenu } from './components/menu/SideMenu';
import { LeaveGuardProvider } from './components/menu/LeaveGuard';
import { apiUrl } from './services/platform';
import { useAndroidBackButton } from './components/menu/backButton';
import { NotebookPen, Users, QrCode, CalendarCheck, ClipboardList, GraduationCap, BellRing } from 'lucide-react';
// The Notes page pulls in Firestore, so it loads on first visit.
const NotesPage = React.lazy(() => import('./components/notes/NotesUI').then(m => ({ default: m.NotesPage })));

// Admin page: loads on first visit (admins only).
const StudentsPage = React.lazy(() => import('./components/admin/StudentsPage').then(m => ({ default: m.StudentsPage })));
// Attendance: all three pull in Firestore (and the slots page the QR library), so they load on first visit.
const SlotsPage = React.lazy(() => import('./components/admin/SlotsPage').then(m => ({ default: m.SlotsPage })));
const ClassAttendancePage = React.lazy(() => import('./components/admin/ClassAttendancePage').then(m => ({ default: m.ClassAttendancePage })));
const LevelsPage = React.lazy(() => import('./components/admin/LevelsPage').then(m => ({ default: m.LevelsPage })));
const NotificationsPage = React.lazy(() => import('./components/admin/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const AttendancePage = React.lazy(() => import('./components/attendance/AttendancePage').then(m => ({ default: m.AttendancePage })));
const CheckInView = React.lazy(() => import('./components/attendance/CheckInView').then(m => ({ default: m.CheckInView })));

/** Slot id when the page was opened from a class QR (/checkin/<slotId>); '' for a malformed id. */
const CHECKIN_SLOT = (() => {
  const m = /^\/checkin\/([^/]*)\/?$/.exec(window.location.pathname);
  if (!m) return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(m[1]) ? m[1] : '';
})();

/** Header titles for menu pages (they aren't nav tabs). */
const MENU_PAGES = [
  { tab: Tab.NOTES, label: 'Notes', title: 'My notes', icon: NotebookPen },
  { tab: Tab.STUDENTS, label: 'Students', title: 'Students & roles', icon: Users },
  { tab: Tab.SLOTS, label: 'Slots', title: 'Class slots', icon: QrCode },
  { tab: Tab.ATTENDANCE, label: 'Attendance', title: 'My attendance', icon: CalendarCheck },
  { tab: Tab.CLASS_ATTENDANCE, label: 'Attendance', title: 'Attendance', icon: ClipboardList },
  { tab: Tab.LEVELS, label: 'Levels', title: 'Levels', icon: GraduationCap },
  { tab: Tab.NOTIFICATIONS, label: 'Notify', title: 'Notifications', icon: BellRing },
  { tab: Tab.CHECKIN, label: 'Check in', title: 'Check in', icon: CalendarCheck },
];
const MENU_TABS = MENU_PAGES.map(p => p.tab);

/**
 * Lives inside AuthProvider (App itself sits above it): leaves a menu page when
 * the account can no longer see it (signed out; admin role gone for Students).
 */
/** Tells App (which sits above AuthProvider) whether a verified admin account is signed in. */
const ReportAdmin: React.FC<{ onChange: (admin: boolean) => void }> = ({ onChange }) => {
  const { user, loading, isAdmin } = useAccount();
  useEffect(() => {
    if (!loading) onChange(!!user && isAdmin);
  }, [user, loading, isAdmin, onChange]);
  return null;
};

const LeaveMenuPageWhenNotAllowed: React.FC<{ tab: Tab; onLeave: () => void }> = ({ tab, onLeave }) => {
  const { user, loading, isAdmin } = useAccount();
  useEffect(() => {
    if (loading) return;
    const needsUser = tab === Tab.NOTES || tab === Tab.ATTENDANCE;
    const needsAdmin = tab === Tab.STUDENTS || tab === Tab.SLOTS || tab === Tab.CLASS_ATTENDANCE || tab === Tab.LEVELS || tab === Tab.NOTIFICATIONS;
    if ((needsUser && !user) || (needsAdmin && (!user || !isAdmin))) onLeave();
  }, [tab, loading, user, isAdmin, onLeave]);
  return null;
};
import { BottomSheet } from './components/ui/BottomSheet';
import { ToastProvider } from './components/ui/Toast';
import { PushBridge } from './components/notify/PushBridge';
import { requestChat } from './services/chatPresence';
const NotificationBell = React.lazy(() => import('./components/notify/NotificationBell'));
import { useAppLinks } from './services/appLinks';
import { EmptyState, DancingDots } from './components/ui/Doodles';
import { RotateCw } from 'lucide-react';

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

const EMPTY_SONGS: AppData['songs'] = [];

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

const NO_CLASSES: DanceClass[] = [];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(CHECKIN_SLOT !== null ? Tab.CHECKIN : Tab.CLASSES);
  // Which slot the check-in screen is for: from the address bar on the web, or (slice 4,
  // Android app) from an app link or the in-app scanner. `n` remounts it for each scan.
  const [checkin, setCheckin] = useState<{ slot: string | null; n: number }>({ slot: CHECKIN_SLOT || null, n: 0 });
  // Leaving the check-in screen drops /checkin/<id> from the address bar, so a reload doesn't check in again.
  useEffect(() => {
    if (activeTab !== Tab.CHECKIN && window.location.pathname.startsWith('/checkin/')) {
      window.history.replaceState(null, '', '/');
    }
  }, [activeTab]);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [data, setData] = useState<AppData | null>(null);
  // One card per active class slot (falls back to the worksheet's cards until slots load).
  const classCards = useSlotCards(data?.classes ?? NO_CLASSES);
  const [loading, setLoading] = useState(true);

  // Hidden Calculator States
  const [logoClicks, setLogoClicks] = useState(0);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  // Calculator passcode (dance-party attendance). Chat moderation uses the admin account role instead.
  const [passcodeOk, setPasscodeOk] = useState(false);
  // A signed-in admin account opens the calculator without the passcode.
  const [accountAdmin, setAccountAdmin] = useState(false);
  const isAuthenticated = passcodeOk || accountAdmin;
  // Signing an admin out while on the calculator returns to Classes.
  useEffect(() => {
    if (activeTab === Tab.CALCULATOR && !isAuthenticated) setActiveTab(Tab.CLASSES);
  }, [activeTab, isAuthenticated]);
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

  // Leaving the Notes page with unsaved edits asks first (nav tabs, the menu, signing out).
  const notesDirty = useRef(false);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const guardLeave = useCallback((action: () => void) => {
    if (activeTabRef.current === Tab.NOTES && notesDirty.current) setPendingLeave(() => action);
    else action();
  }, []);
  const setNotesDirty = useCallback((dirty: boolean) => { notesDirty.current = dirty; }, []);
  // Reload / closing the tab / browser back off the site: the browser's own "Leave site?" prompt.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeTabRef.current === Tab.NOTES && notesDirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
  const leaveGuard = React.useMemo(() => ({ guardLeave, setNotesDirty }), [guardLeave, setNotesDirty]);

  // Left menu (signed-in users)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  useAndroidBackButton(menuOpen, closeMenu);

  // Slice 6: notifications - the bell refreshes when one arrives; a tapped one opens its tab.
  const [pushPulse, setPushPulse] = useState(0);
  const bumpPush = useCallback(() => setPushPulse(p => p + 1), []);
  const openChat = () => { requestChat(); navigateTo(Tab.ANNOUNCEMENTS); };
  const openNotifyTab = (tab?: string) => {
    if (tab === 'news') openChat();
    else if (tab === 'classes') navigateTo(Tab.CLASSES);
    else if (tab === 'media') navigateTo(Tab.MEDIA);
  };

  const navigateTo = (tab: Tab) => {
    // We allow navigation without logging out the admin
    if (tab === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    guardLeave(() => {
      setDirection(MENU_TABS.includes(tab) || tabIndex(tab) >= tabIndex(activeTab) ? 'right' : 'left');
      setActiveTab(tab);
      window.scrollTo({ top: 0 });
    });
  };
  // Slice 4 (Android app): a class link or an in-app scan opens that check-in.
  // Unsaved notes ask first; if the student stays, nothing changes.
  const openCheckin = (slot: string) => {
    setMenuOpen(false);
    const show = () => setCheckin(c => ({ slot, n: c.n + 1 }));
    if (activeTab === Tab.CHECKIN) return show();
    guardLeave(() => {
      show();
      setDirection('right');
      setActiveTab(Tab.CHECKIN);
      window.scrollTo({ top: 0 });
    });
  };
  useAppLinks(openCheckin);


  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);

    if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);

    if (newCount === 3) {
      setLogoClicks(0);
      // Guard only (calculator behaviour unchanged): leaving Notes with unsaved edits asks first.
      guardLeave(() => {
        if (isAuthenticated) {
          setDirection('right');
          setActiveTab(Tab.CALCULATOR);
        } else {
          setShowPasswordPrompt(true);
        }
      });
    } else {
      clickTimeoutRef.current = window.setTimeout(() => setLogoClicks(0), 500);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginPending(true);
    setLoginError(false);
    try {
      const response = await fetch(apiUrl('/api/admin-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (!response.ok) throw new Error('Incorrect password');
      setPasscodeOk(true);
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
  // Attendance pages don't use the Sheets content: a QR scan must work even if the class data is slow or down.
  const sheetFree = activeTab === Tab.CHECKIN || activeTab === Tab.SLOTS || activeTab === Tab.ATTENDANCE || activeTab === Tab.CLASS_ATTENDANCE || activeTab === Tab.LEVELS || activeTab === Tab.NOTIFICATIONS;
  const loadFailed =
    !!data && !data.classes.length && !data.videos.length && !data.songs.length && !data.announcements.length;
  const current = navItems.find(i => i.tab === activeTab) ?? MENU_PAGES.find(p => p.tab === activeTab) ?? BASE_NAV[0];

  return (
    <ToastProvider>
     <AuthProvider>
     <LeaveGuardProvider value={leaveGuard}>
     <MusicProvider songs={data?.songs ?? EMPTY_SONGS}>
      {/* Signing out on the Notes page returns to Classes. */}
      <ReportAdmin onChange={setAccountAdmin} />
      <PushBridge onPulse={bumpPush} onOpen={d => (d.kind === 'chat' ? openChat() : openNotifyTab(d.tab))} />
      <LeaveMenuPageWhenNotAllowed tab={activeTab} onLeave={() => { notesDirty.current = false; setActiveTab(Tab.CLASSES); }} />
      <div id="app-shell" className="min-h-screen bg-surface-0 font-sans text-text-hi flex flex-col">
        {/* Header — slim on mobile: logo (secret triple-tap) + page title */}
        <header
          className="sticky top-0 z-30 border-b border-line/60 bg-surface-0/80 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="mx-auto flex h-14 md:h-16 max-w-5xl items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <MenuButton open={menuOpen} onClick={() => setMenuOpen(true)} buttonRef={menuButtonRef} />
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
            <div className="flex items-center gap-2">
              <TopNav items={navItems} active={activeTab} onChange={navigateTo} />
              <React.Suspense fallback={<span className="h-11 w-11" aria-hidden />}>
                <NotificationBell pulse={pushPulse} onOpenChat={openChat} onOpenTab={openNotifyTab} />
              </React.Suspense>
              <AccountButton onClick={() => setAccountOpen(true)} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 md:pt-10 pb-10 md:pb-16">
          {loading && !sheetFree ? (
            <LoadingSkeleton />
          ) : (!data || loadFailed) && !sheetFree ? (
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
                <ClassesView classes={classCards} videoOfMonth={videoOfMonth} onRequireAccount={() => setAccountOpen(true)} />
              )}
              {activeTab === Tab.MEDIA && (
                <MediaView videos={data.videos} songs={data.songs} />
              )}
              {activeTab === Tab.NOTES && (
                <React.Suspense
                  fallback={
                    <div className="flex items-center gap-3 py-6 text-text-mid">
                      <DancingDots label="Loading your notes" />
                      <span>Loading your notes…</span>
                    </div>
                  }
                >
                  <NotesPage onOpenAccount={() => setAccountOpen(true)} />
                </React.Suspense>
              )}
              {activeTab === Tab.STUDENTS && (
                <React.Suspense
                  fallback={
                    <div className="flex items-center gap-3 py-6 text-text-mid">
                      <DancingDots label="Loading students" />
                      <span>Loading students…</span>
                    </div>
                  }
                >
                  <StudentsPage />
                </React.Suspense>
              )}
              {(activeTab === Tab.SLOTS || activeTab === Tab.ATTENDANCE || activeTab === Tab.CLASS_ATTENDANCE || activeTab === Tab.LEVELS || activeTab === Tab.NOTIFICATIONS || activeTab === Tab.CHECKIN) && (
                <React.Suspense
                  fallback={
                    <div className="flex items-center gap-3 py-6 text-text-mid">
                      <DancingDots label="Loading" />
                      <span>Loading…</span>
                    </div>
                  }
                >
                  {activeTab === Tab.SLOTS && <SlotsPage />}
                  {activeTab === Tab.ATTENDANCE && <AttendancePage />}
                  {activeTab === Tab.CLASS_ATTENDANCE && <ClassAttendancePage />}
                  {activeTab === Tab.LEVELS && <LevelsPage />}
                  {activeTab === Tab.NOTIFICATIONS && <NotificationsPage />}
                  {activeTab === Tab.CHECKIN && (
                    <CheckInView
                      key={checkin.n}
                      slotId={checkin.slot}
                      onOpenAccount={openAccount}
                      onCloseAccount={closeAccount}
                      onDone={() => navigateTo(Tab.CLASSES)}
                    />
                  )}
                </React.Suspense>
              )}
              {activeTab === Tab.ANNOUNCEMENTS && (
                <React.Suspense
                  fallback={
                    <div className="flex items-center gap-3 py-6 text-text-mid">
                      <DancingDots label="Loading news" />
                      <span>Loading studio news…</span>
                    </div>
                  }
                >
                  <AnnouncementsView announcements={data.announcements} onOpenAccount={() => setAccountOpen(true)} />
                </React.Suspense>
              )}
              {activeTab === Tab.CALCULATOR && isAuthenticated && (
                <CalculatorView />
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        {/* bottom padding clears the floating nav, music player and chat bar */}
        <footer className="border-t border-line/60 pt-8 pb-[calc(var(--nav-h)+var(--dock-h)+var(--chat-h)+24px)]">
          <div className="mx-auto max-w-5xl px-4 text-center text-[14px] text-text-lo">
            <p>© {new Date().getFullYear()} Dance Class Companion · Master the basics. Dance your story.</p>
            <p className="mt-2">Version {__APP_VERSION__}</p>
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
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />

      <SideMenu
        open={menuOpen}
        onClose={closeMenu}
        returnFocusTo={menuButtonRef}
        onNotes={() => { setMenuOpen(false); navigateTo(Tab.NOTES); }}
        onStudents={() => { setMenuOpen(false); navigateTo(Tab.STUDENTS); }}
        onSlots={() => { setMenuOpen(false); navigateTo(Tab.SLOTS); }}
        onAttendance={() => { setMenuOpen(false); navigateTo(Tab.ATTENDANCE); }}
        onClassAttendance={() => { setMenuOpen(false); navigateTo(Tab.CLASS_ATTENDANCE); }}
        onLevels={() => { setMenuOpen(false); navigateTo(Tab.LEVELS); }}
        onNotifications={() => { setMenuOpen(false); navigateTo(Tab.NOTIFICATIONS); }}
        onScanned={openCheckin}
        // Focus the hamburger first, so the account sheet returns focus there (not to the gone drawer item).
        onAccount={() => { menuButtonRef.current?.focus(); setMenuOpen(false); setAccountOpen(true); }}
      />

      {/* "Discard your changes?" when leaving the Notes page with unsaved edits */}
      <BottomSheet open={pendingLeave !== null} onClose={() => setPendingLeave(null)} title="Discard your changes?" size="sm">
        <p className="text-text-mid">Your edits to this note haven't been saved.</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => setPendingLeave(null)} className="btn-primary press flex-1">Keep editing</button>
          <button
            type="button"
            onClick={() => { const action = pendingLeave; notesDirty.current = false; setPendingLeave(null); action?.(); }}
            className="btn-secondary press flex-1"
          >
            Discard
          </button>
        </div>
      </BottomSheet>
     </MusicProvider>
     </LeaveGuardProvider>
     </AuthProvider>
    </ToastProvider>
  );
};

export default App;
