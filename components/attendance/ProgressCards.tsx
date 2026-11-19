// My attendance > progress (attendance slice 5): one card per dance the student
// has attended, with classes and months toward the next level.
import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Footprints } from 'lucide-react';
import { useSyllabus } from '../../services/useSyllabus';
import { subscribeLevels, subscribeLevelSettings, useDanceIndex, useToday, type Levels } from '../../services/levelsService';
import { allProgress, LEVEL_NAMES, DEFAULT_SETTINGS, type LevelSettings, type Progress } from '../../services/levels';
import type { Checkin } from '../../services/attendanceService';

const Bar: React.FC<{ value: number; of: number; label: string }> = ({ value, of, label }) => {
  const pct = of <= 0 ? 100 : Math.min(100, Math.round((value / of) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span className="text-text-mid">{label}</span>
        <span className="font-semibold text-text-hi">{Math.min(value, of)} of {of}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={of} aria-valuenow={Math.min(value, of)}>
        <div className="h-full rounded-full bg-brand-soft transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Card: React.FC<{ p: Progress }> = ({ p }) => {
  const nextName = p.next ? LEVEL_NAMES[p.next] : null;
  return (
    <li className="card p-5">
      <p className="eyebrow">{p.dance}</p>
      <h3 className="mt-0.5 text-[22px] font-extrabold tracking-tight">{LEVEL_NAMES[p.level]}</h3>
      {p.needsAB ? (
        <p className="mt-3 flex items-center gap-2 text-[16px] text-text-mid"><Footprints className="h-4 w-4 shrink-0 text-brand-soft" /> Start with AB: your {p.dance} classes count once you've taken it.</p>
      ) : !p.next ? (
        <p className="mt-3 text-[16px] text-text-mid">
          {p.level === 'ADV' ? "You're in Advanced Concepts. Keep dancing!" : `You're at the highest level set for you in ${p.dance}. Your instructor can change that.`}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-text-lo">Toward {nextName}{p.inviteOnly ? ' (by invite)' : ''}</p>
          <div className="mt-4 flex flex-col gap-3">
            <Bar value={p.counted} of={p.classesNeeded} label={`${p.level === '100' ? '100' : '200'}-level classes`} />
            <Bar value={p.months} of={p.monthsNeeded} label="Months" />
          </div>
          {p.ready && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-soft/10 px-3 py-2 text-[15px] font-semibold text-brand-soft">
              <Sparkles className="h-4 w-4 shrink-0" />
              {p.inviteOnly ? "You've met the minimum. Your instructor will let you know about an invite." : `Ready for ${nextName}! Your instructor will confirm.`}
            </p>
          )}
        </>
      )}
    </li>
  );
};

export const ProgressCards: React.FC<{ uid: string; rows: Checkin[] }> = ({ uid, rows }) => {
  const syllabus = useSyllabus();
  const { danceOf, abDances, loaded } = useDanceIndex(syllabus);
  const today = useToday();
  const [levels, setLevels] = useState<Levels | null>(null);
  const [settings, setSettings] = useState<LevelSettings>(DEFAULT_SETTINGS);

  useEffect(() => subscribeLevels(uid, setLevels, () => setLevels({})), [uid]);
  useEffect(() => subscribeLevelSettings(setSettings), []);

  const progress = useMemo(
    () => (levels && loaded ? allProgress(rows, danceOf, abDances, levels, settings, today).progress : null),
    [rows, danceOf, abDances, levels, settings, today, loaded],
  );

  if (!progress?.length) return null;
  return (
    <section aria-label="Progress">
      <h3 className="mb-3 font-bold">Your levels</h3>
      <ul className="flex flex-col gap-4">
        {progress.map(p => <Card key={p.dance} p={p} />)}
      </ul>
    </section>
  );
};
