
import React, { useEffect, useRef, useState } from 'react';
import { DanceClass, VideoItem } from '../types';
import { VideoFacade } from './YouTubeEmbed';
import { EmptyState, NoteDoodle, SparkleDoodle, FootprintsDoodle, SwirlDoodle } from './ui/Doodles';

/** Instructor notes in a fixed-height box that scrolls; a soft fade hints there's more below. */
const InstructorNotes: React.FC<{ notes: string }> = ({ notes }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [notes]);

  return (
    <blockquote className="mt-4 border-l-2 border-sky-400/60 pl-4 text-[15px] leading-relaxed text-text-mid">
      <p className="mb-1 text-[13px] font-semibold text-sky-300">From your instructor</p>
      <div
        ref={ref}
        tabIndex={0}
        aria-label="Instructor notes"
        className="max-h-[7.5rem] overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent] focus-visible:outline-offset-4"
        style={fade ? { maskImage: 'linear-gradient(to bottom, #000 70%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent)' } : undefined}
      >
        {notes}
      </div>
    </blockquote>
  );
};

interface ClassesViewProps {
  classes: DanceClass[];
  videoOfMonth?: VideoItem;
}

/** Notes that carry no information are hidden entirely. */
const hasRealNotes = (notes?: string) => {
  const n = (notes ?? '').trim().toLowerCase().replace(/[.!\s]+$/, '');
  return !!n && n !== '-' && n !== 'no notes for this week' && n !== 'no notes';
};

const PageHeading: React.FC = () => (
  <div className="relative mb-6 md:mb-8">
    {/* doodles trail off away from the headline, never touching text */}
    <NoteDoodle className="absolute right-1 -top-2 h-7 w-7 text-brand-soft/70" delay={100} />
    <SparkleDoodle className="absolute right-11 -top-1 h-4 w-4 text-accent/80" delay={220} />
    <div className="hidden md:block" aria-hidden="true">
      <FootprintsDoodle className="absolute right-20 top-8 h-8 w-8 text-text-lo/60" delay={320} />
      <SwirlDoodle className="absolute right-44 -top-1 h-6 w-6 text-brand/50" delay={400} still />
    </div>
    <p className="eyebrow">Class recap</p>
    <h2 className="mt-1 text-[28px] md:text-4xl font-extrabold tracking-tight leading-tight">
      This week's{' '}
      <span className="inline-block animate-bounce-once bg-gradient-to-r from-brand-soft to-accent bg-clip-text text-transparent motion-fade-only">
        patterns
      </span>
    </h2>
  </div>
);

export const ClassesView: React.FC<ClassesViewProps> = ({ classes, videoOfMonth }) => {
  return (
    <div className="space-y-10">
      <PageHeading />

      {/* auto-rows-fr: every card is as tall as the tallest one; long notes scroll inside */}
      {classes.length > 0 ? (
        <div className="stagger grid auto-rows-fr gap-4 md:grid-cols-2 md:gap-6">
          {classes.map((cls, i) => {
            const patterns = cls.content.split(',').map(s => s.trim()).filter(Boolean);
            return (
              <article key={cls.id} className="card flex h-full min-h-0 flex-col p-5 md:p-6" style={{ ['--i' as any]: i }}>
                <h3 className="text-[21px] font-bold leading-snug text-text-hi">{cls.name}</h3>

                <p className="eyebrow mt-4 mb-1">This week's pattern</p>
                <ul className="divide-y divide-line">
                  {patterns.map((item, idx) => (
                    <li key={idx} className="flex min-h-[48px] items-center py-1.5">
                      <span className="font-medium text-text-mid">{item}</span>
                    </li>
                  ))}
                </ul>

                {hasRealNotes(cls.notes) && <InstructorNotes notes={cls.notes} />}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState doodle="feet" title="No classes posted this week — see you on the floor soon." />
        </div>
      )}

      {/* Video of the Month — single hero card, thumbnail first */}
      <section aria-labelledby="vom-title" className="card overflow-hidden animate-rise md:mx-auto md:max-w-3xl" style={{ animationDelay: `${Math.min(classes.length, 4) * 50 + 80}ms` }}>
        {videoOfMonth ? (
          <>
            <VideoFacade url={videoOfMonth.url} title={videoOfMonth.title} label="the video of the month" />
            <div className="px-5 py-4 md:px-6">
              <p className="eyebrow text-accent/90">Video of the month</p>
              <h2 id="vom-title" className="mt-0.5 truncate text-lg font-bold">{videoOfMonth.title}</h2>
            </div>
          </>
        ) : (
          <>
            <h2 id="vom-title" className="sr-only">Video of the month</h2>
            <EmptyState compact doodle="sparkle" title="The stage is set — no video of the month just yet." />
          </>
        )}
      </section>
    </div>
  );
};
