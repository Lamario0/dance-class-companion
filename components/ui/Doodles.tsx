import React from 'react';

/**
 * Hand-drawn doodle set (one style: 2px round strokes, slightly wobbly paths).
 * Purely decorative — always aria-hidden. Pop in on mount, then idle-bob.
 * Motion is disabled under prefers-reduced-motion via the `.doodle` rule in index.css.
 */

type DoodleProps = {
  className?: string;
  /** stagger the pop-in (ms) */
  delay?: number;
  /** disable the idle bob */
  still?: boolean;
  style?: React.CSSProperties;
};

const wrap = (
  svg: React.ReactNode,
  { className = '', delay = 0, still = false, style }: DoodleProps,
  viewBox = '0 0 32 32'
) => (
  <span
    aria-hidden="true"
    className={`doodle pointer-events-none inline-block animate-pop ${className}`}
    style={{ animationDelay: `${delay}ms`, ...style }}
  >
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block h-full w-full ${still ? '' : 'doodle animate-bob'}`}
      style={still ? undefined : { animationDelay: `${delay + 500}ms` }}
    >
      {svg}
    </svg>
  </span>
);

export const NoteDoodle = (p: DoodleProps) =>
  wrap(
    <>
      <path d="M12 23.5c0 2-1.8 3.4-3.9 3.4S5 25.7 5.3 23.9c.3-1.9 2.3-3.1 4.2-2.9 1.3.1 2.5.9 2.5 2.5Z" />
      <path d="M12 23.5V7.2c4.6-.7 9-2.2 13.3-4.1v16.1" />
      <path d="M25.3 19.2c0 2-1.8 3.3-3.9 3.3s-3.1-1.2-2.8-3c.3-1.8 2.3-3 4.2-2.8 1.3.1 2.5.9 2.5 2.5Z" />
      <path d="M12.1 11.6c4.4-.8 8.8-2.2 13.1-4" />
    </>,
    p
  );

export const SparkleDoodle = (p: DoodleProps) =>
  wrap(
    <>
      <path d="M16 3.5c.6 5.9 2.4 9.6 12 12.4-9.4 2.6-11.3 6.3-12 12.6-.9-6.4-2.8-10-12-12.6 9.3-2.9 11.2-6.5 12-12.4Z" />
    </>,
    p
  );

export const FootprintsDoodle = (p: DoodleProps) =>
  wrap(
    <>
      <path d="M8.6 17.8c-2.6.3-4.3-2.6-4.4-6.1C4 7.9 5.4 4.6 7.9 4.4c2.6-.2 3.8 3 3.7 6.6-.1 3.4-.6 6.5-3 6.8Z" />
      <path d="M6.2 21.2c.6 2.4 4.4 2 4.6-.4" />
      <path d="M23.4 25.8c2.6.3 4.3-2.6 4.4-6.1.2-3.8-1.2-7.1-3.7-7.3-2.6-.2-3.8 3-3.7 6.6.1 3.4.6 6.5 3 6.8Z" />
      <path d="M25.8 29.2c-.6.1-4.4-.2-4.6-.4" />
    </>,
    p
  );

export const SwirlDoodle = (p: DoodleProps) =>
  wrap(
    <>
      <path d="M4 20c2.5 5.5 9.8 7.3 14.6 4.4 4.6-2.8 5.5-9.5 1.6-12.5-3.4-2.6-8.7-.6-8.7 3.5 0 3.2 3.9 4.5 5.9 2.3" />
      <path d="M24.5 6.5c1.4 1 2.6 2.4 3.4 3.9" />
    </>,
    p
  );

/** Dancing-feet loading indicator: three little bouncing music-note dots. */
export const DancingDots: React.FC<{ label?: string; dotClass?: string }> = ({ label = 'Loading', dotClass = 'bg-brand-soft' }) => (
  <span role="status" aria-label={label} className="inline-flex items-end gap-1.5 h-6">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        aria-hidden="true"
        className={`block h-2.5 w-2.5 rounded-full ${dotClass} animate-dot`}
        style={{ animationDelay: `${i * 140}ms` }}
      />
    ))}
  </span>
);

/** Designed empty / error state: doodle + one friendly sentence + optional action. */
export const EmptyState: React.FC<{
  doodle?: 'notes' | 'feet' | 'swirl' | 'sparkle';
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
}> = ({ doodle = 'notes', title, body, action, compact }) => {
  const Main =
    doodle === 'feet' ? FootprintsDoodle : doodle === 'swirl' ? SwirlDoodle : doodle === 'sparkle' ? SparkleDoodle : NoteDoodle;
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-8 px-4' : 'py-14 px-6'}`}>
      <div className="relative mb-4">
        <Main className={`${compact ? 'h-10 w-10' : 'h-14 w-14'} text-brand-soft`} />
        <SparkleDoodle className="absolute -right-5 -top-2 h-4 w-4 text-accent" delay={150} />
        <SparkleDoodle className="absolute -left-4 bottom-0 h-3 w-3 text-brand" delay={250} still />
      </div>
      <p className="font-semibold text-text-hi max-w-xs">{title}</p>
      {body && <p className="mt-1 text-[15px] text-text-lo max-w-xs">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
