import React from 'react';
import { DanceClass, VideoItem } from '../types';
import { YouTubeEmbed } from './YouTubeEmbed';
import { PatternAssistant } from './PatternAssistant';
import { Calendar, GraduationCap, StickyNote, Video } from 'lucide-react';

interface ClassesViewProps {
  classes: DanceClass[];
  videoOfMonth?: VideoItem;
}

export const ClassesView: React.FC<ClassesViewProps> = ({ classes, videoOfMonth }) => {
  return (
    <div className="space-y-12 pb-20">
      
      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.slice(0, 4).map((cls) => (
          <div key={cls.id} className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex flex-col hover:border-slate-700 transition-colors group">
            <div className="bg-slate-800 p-4 flex items-center justify-between group-hover:bg-slate-750 transition-colors border-b border-slate-700/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-400" />
                {cls.name}
              </h3>
            </div>
            
            <div className="p-5 flex-1 flex flex-col gap-4">
              {/* Content Section */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-violet-400 font-semibold text-sm uppercase tracking-wide">
                  <GraduationCap className="w-5 h-5" />
                  Content
                </div>
                <ul className="space-y-2">
                  {cls.content.split(',').map((item, idx) => {
                    const cleanItem = item.trim();
                    if (!cleanItem) return null;
                    return (
                      <li key={idx} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg text-sm text-slate-300 border border-slate-700/50">
                        <span>{cleanItem}</span>
                        <PatternAssistant pattern={cleanItem} className={cls.name} />
                      </li>
                    );
                  })}
                </ul>
              </div>

              <hr className="border-slate-800" />

              {/* Notes Section */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 text-sky-400 font-semibold text-sm uppercase tracking-wide">
                  <StickyNote className="w-4 h-4" />
                  Notes
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-sky-900/20 p-3 rounded-lg border border-sky-800/30">
                  {cls.notes}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video of the Month Section (Moved to Bottom) */}
      <section className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-800 flex items-center gap-3 bg-slate-800/50">
            <div className="p-2 bg-violet-900/30 text-violet-300 rounded-lg">
                <Video className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Video of the Month</h2>
        </div>
        <div className="p-6 md:p-8">
          {videoOfMonth ? (
            <div className="max-w-4xl mx-auto">
              <YouTubeEmbed url={videoOfMonth.url} className="w-full aspect-video rounded-2xl shadow-lg ring-1 ring-white/5" title={videoOfMonth.title} />
              <h3 className="mt-4 text-lg font-semibold text-slate-200 text-center">{videoOfMonth.title}</h3>
            </div>
          ) : (
            <div className="text-center p-12 text-slate-500">
              No video selected for this month.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};