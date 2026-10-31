
import React from 'react';
import { DanceClass, VideoItem } from '../types';
import { VideoFacade } from './YouTubeEmbed';
import { PatternAssistant } from './PatternAssistant';
import { EmptyState, NoteDoodle, SparkleDoodle, FootprintsDoodle, SwirlDoodle } from './ui/Doodles';

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

      {classes.length > 0 ? (
        <div className="stagger grid gap-4 md:grid-cols-2 md:gap-6 md:items-start">
          {classes.map((cls, i) => {
            const patterns = cls.content.split(',').map(s => s.trim()).filter(Boolean);
            return (
              <article key={cls.id} className="card p-5 md:p-6" style={{ ['--i' as any]: i }}>
                <h3 className="text-[21px] font-bold leading-snug text-text-hi">{cls.name}</h3>

                <p className="eyebrow mt-4 mb-1">This week's pattern</p>
                <ul className="divide-y divide-line">
                  {patterns.map((item, idx) => (
                    <li key={idx} className="flex min-h-[52px] items-center justify-between gap-3 py-1.5">
                      <span className="font-medium text-text-mid">{item}</span>
                      <PatternAssistant pattern={item} className={cls.name} />
                    </li>
                  ))}
                </ul>

                {hasRealNotes(cls.notes) && (
                  <blockquote className="mt-4 border-l-2 border-sky-400/60 pl-4 text-[15px] leading-relaxed text-text-mid">
                    <p className="mb-1 text-[13px] font-semibold text-sky-300">From your instructor</p>
                    {cls.notes}
                  </blockquote>
                )}
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
