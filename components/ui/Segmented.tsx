import React from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  /** id prefix used to link tabs to panels */
  idPrefix: string;
}

/** Segmented control with a springy sliding active indicator. */
export function Segmented<T extends string>({ options, value, onChange, label, className = '', idPrefix }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    (e.currentTarget.querySelectorAll('button')[next] as HTMLButtonElement)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative grid rounded-full bg-surface-1 border border-line p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-full bg-surface-2 ring-1 ring-white/5 transition-transform duration-[420ms] ease-[var(--ease-spring)]"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${o.value}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`press relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] font-semibold ${
              active ? 'text-text-hi' : 'text-text-lo hover:text-text-mid'
            }`}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
            {typeof o.count === 'number' && (
              <span className={`text-[12px] tabular-nums ${active ? 'text-brand-soft' : 'text-text-lo'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
