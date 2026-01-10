
import React from 'react';
import { Announcement } from '../types';
import { Megaphone, Calendar, Bell } from 'lucide-react';

interface AnnouncementsViewProps {
  announcements: Announcement[];
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ announcements }) => {

  // Helper to detect URLs and wrap them in anchor tags
  const renderTextWithLinks = (text: string) => {
    // Regex matches http://, https://, or www. followed by non-whitespace characters
    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
    
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        // Ensure standard protocol for www. links
        const href = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a 
            key={index} 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-violet-400 hover:text-violet-300 font-medium hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-800 flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-800">
           <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl ring-1 ring-rose-500/20">
             <Megaphone className="w-6 h-6" />
           </div>
           <div>
             <h2 className="text-2xl font-bold text-white">Announcements</h2>
             <p className="text-slate-400 text-sm">Latest updates from the studio</p>
           </div>
        </div>

        <div className="divide-y divide-slate-800/50">
          {announcements.length > 0 ? (
            announcements.map((ann) => (
              <div key={ann.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-col sm:flex-row gap-4">
                   {/* Date Badge */}
                   {ann.date && (
                     <div className="flex-shrink-0">
                       <div className="inline-flex flex-col items-center justify-center min-w-[80px] px-3 py-2 bg-slate-950 rounded-lg border border-slate-800 text-center">
                         <Calendar className="w-4 h-4 text-rose-400 mb-1" />
                         <span className="text-sm font-bold text-slate-200">{ann.date}</span>
                       </div>
                     </div>
                   )}
                   
                   {/* Content */}
                   <div className="flex-1">
                     <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                       {renderTextWithLinks(ann.text)}
                     </p>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
              <Bell className="w-12 h-12 mb-4 opacity-20" />
              <p>No new announcements at this time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
