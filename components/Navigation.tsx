import React from 'react';
import { Tab } from '../types';
import { Footprints, Clapperboard, Megaphone, ShieldCheck } from 'lucide-react';
import { useAnySheetOpen } from './ui/BottomSheet';

export interface NavItem {
  tab: Tab;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const BASE_NAV: NavItem[] = [
  { tab: Tab.CLASSES, label: 'Classes', title: "This week's classes", icon: Footprints },
  { tab: Tab.MEDIA, label: 'Media', title: 'Videos & music', icon: Clapperboard },
  { tab: Tab.ANNOUNCEMENTS, label: 'News', title: 'Studio news', icon: Megaphone },
];
export const ADMIN_NAV: NavItem = { tab: Tab.CALCULATOR, label: 'Admin', title: 'Instructor tools', icon: ShieldCheck };

interface NavProps {
  items: NavItem[];
  active: Tab;
  onChange: (t: Tab) => void;
}

/** Mobile (< md): floating pill tab bar with a springy sliding indicator. */
export const BottomTabBar: React.FC<NavProps> = ({ items, active, onChange }) => {
  const sheetOpen = useAnySheetOpen();
  const index = Math.max(0, items.findIndex(i => i.tab === active));
  return (
    <nav
      aria-label="Main"
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-4 transition-transform duration-[420ms] ease-[var(--ease-calm)] ${
        sheetOpen ? 'translate-y-[150%]' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="tablist"
        className="relative mx-auto grid max-w-md rounded-full border border-white/10 bg-surface-1/80 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl backdrop-saturate-150"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-1.5 rounded-full bg-brand-strong/25 ring-1 ring-brand/40 transition-transform duration-[460ms] ease-[var(--ease-spring)]"
          style={{ width: `calc((100% - 0.75rem) / ${items.length})`, transform: `translateX(${index * 100}%)` }}
        />
        {items.map(item => {
          const isActive = item.tab === active;
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => onChange(item.tab)}
              className={`press relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full ${
                isActive ? 'text-text-hi' : 'text-text-lo'
              }`}
            >
              <Icon className={`h-[22px] w-[22px] transition-transform duration-300 ease-[var(--ease-spring)] ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.25 : 2} />
              <span className="text-[12px] font-semibold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/** Desktop (≥ md): top nav using the same tokens and sliding indicator. */
export const TopNav: React.FC<NavProps> = ({ items, active, onChange }) => {
  const index = Math.max(0, items.findIndex(i => i.tab === active));
  return (
    <nav aria-label="Main" className="hidden md:block">
      <div
        role="tablist"
        className="relative grid rounded-full border border-line bg-surface-1 p-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, 7.5rem)` }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 w-[7.5rem] rounded-full bg-surface-2 ring-1 ring-white/5 transition-transform duration-[460ms] ease-[var(--ease-spring)]"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {items.map(item => {
          const isActive = item.tab === active;
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.tab)}
              className={`press relative z-10 flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-semibold ${
                isActive ? 'text-text-hi' : 'text-text-lo hover:text-text-mid'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
