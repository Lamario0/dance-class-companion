
import React from 'react';
import { DanceClass, VideoItem } from '../types';
import { YouTubeEmbed } from './YouTubeEmbed';
import { PatternAssistant } from './PatternAssistant';
import { Calendar, BookOpen, PenTool, Video, ChevronRight } from 'lucide-react';

interface ClassesViewProps {
  classes: DanceClass[];
  videoOfMonth?: VideoItem;
}

export const ClassesView: React.FC<ClassesViewProps> = ({ classes, videoOfMonth }) => {
  return (
    <div className="space-y-12 pb-20">
      
      {/* Classes Grid - Dynamically show cards based on actual data found */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {classes.length > 0 ? (
          classes.map((cls) => (
            <div key={cls.id} className="bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-800/50 overflow-hidden flex flex-col hover:border-violet-500/30 transition-all duration-300 group hover:shadow-violet-900/10">
              <div className="bg-slate-800/50 p-6 flex items-center justify-between group-hover:bg-slate-800 transition-colors border-b border-slate-700/30">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <Calendar className="w-5 h-5 text-violet-400" />
                  </div>
                  {cls.name}
                </h3>
              </div>
              
              <div className="p-7 flex-1 flex flex-col gap-6">
                {/* Content Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4 text-violet-400 font-bold text-xs uppercase tracking-[0.2em]">
                    <BookOpen className="w-4 h-4" />
                    Latest Pattern
                  </div>
                  <div className="grid gap-2">
                    {cls.content.split(',').map((item, idx) => {
                      const cleanItem = item.trim();
                      if (!cleanItem) return null;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-2xl text-sm text-slate-300 border border-slate-800/50 group/item hover:border-slate-700 transition-colors">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-slate-600 group-hover/item:text-violet-500 transition-colors" />
                            <span className="font-medium">{cleanItem}</span>
                          </div>
                          <PatternAssistant pattern={cleanItem} className={cls.name} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes Section */}
                <div className="flex-1 mt-auto">
                  <div className="flex items-center gap-2 mb-3 text-sky-400 font-bold text-xs uppercase tracking-[0.2em]">
                    <PenTool className="w-4 h-4" />
                    Instructor Notes
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed bg-sky-900/10 p-5 rounded-2xl border border-sky-800/20 relative italic">
                     <div className="absolute top-2 right-4 text-sky-900/30 text-4xl font-serif">"</div>
                    {cls.notes}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-800">
             <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-800" />
             <p className="text-slate-500 font-medium">No active classes found for this week.</p>
          </div>
        )}
      </div>

      {/* Video of the Month Section */}
      <section className="bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-800 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] -z-10"></div>
        <div className="p-8 md:p-10 border-b border-slate-800 flex items-center justify-between bg-slate-800/20 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-900/20">
                  <Video className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-100 tracking-tight">VIDEO OF THE MONTH</h2>
                <p className="text-slate-500 text-sm font-medium">Curated selection for your growth</p>
              </div>
            </div>
        </div>
        <div className="p-8 md:p-12">
          {videoOfMonth ? (
            <div className="max-w-4xl mx-auto">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <YouTubeEmbed url={videoOfMonth.url} className="w-full aspect-video rounded-3xl shadow-2xl relative z-10" title={videoOfMonth.title} />
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
              <Video className="w-12 h-12 mx-auto mb-4 text-slate-800" />
              <p className="text-slate-500 font-medium">The stage is set... no video featured just yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
