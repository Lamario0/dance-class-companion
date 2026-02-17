
import React, { useState, useEffect } from 'react';
import { Announcement } from '../types';
import { Megaphone, Calendar, Bell, MessageSquare, Trash2, Edit2, Save, X, Reply, ChevronDown, ChevronUp } from 'lucide-react';

interface AnnouncementsViewProps {
  announcements: Announcement[];
  isAdmin?: boolean;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
  replies: Comment[];
}

const STORAGE_KEY = 'dance_app_comments_v1';

// Legend colors mapping
const LEGEND = [
  { label: 'Local Events', colorClass: 'bg-emerald-500', textClass: 'text-emerald-400', key: 'green' },
  { label: 'Non WCS Events', colorClass: 'bg-yellow-500', textClass: 'text-yellow-400', key: 'yellow' },
  { label: 'Weekend Events', colorClass: 'bg-orange-500', textClass: 'text-orange-400', key: 'orange' },
  { label: 'Out of Area (Small)', colorClass: 'bg-rose-800', textClass: 'text-rose-400', key: 'red' },
  { label: 'Misc/Other', colorClass: 'bg-slate-400', textClass: 'text-slate-400', key: 'white' }
];

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ announcements, isAdmin = false }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newAuthor, setNewAuthor] = useState('');
  const [newText, setNewText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load comments from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setComments(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse comments", e);
      }
    } else {
      // Default welcome comment
      setComments([
        {
          id: '1',
          author: 'Studio Admin',
          text: 'Welcome to the community discussion! Feel free to ask questions or chat about this week’s class below.',
          date: new Date().toLocaleDateString(),
          replies: []
        }
      ]);
    }
  }, []);

  // Save comments to local storage whenever they change
  useEffect(() => {
    if (comments.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    }
  }, [comments]);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newText.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      author: newAuthor.trim(),
      text: newText.trim(),
      date: new Date().toLocaleDateString(),
      replies: []
    };

    setComments(prev => [newComment, ...prev]);
    setNewText('');
  };

  const updateCommentTree = (items: Comment[], targetId: string, action: (item: Comment) => Comment | null): Comment[] => {
    return items.map(item => {
      if (item.id === targetId) {
        return action(item);
      }
      if (item.replies.length > 0) {
        const updatedReplies = updateCommentTree(item.replies, targetId, action).filter(Boolean) as Comment[];
        return { ...item, replies: updatedReplies };
      }
      return item;
    }).filter(Boolean) as Comment[];
  };

  const handleDelete = (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    setComments(prev => updateCommentTree(prev, commentId, () => null));
  };

  const handleEdit = (commentId: string, newText: string) => {
    setComments(prev => updateCommentTree(prev, commentId, (item) => ({ ...item, text: newText })));
  };

  const handleReply = (parentId: string, author: string, text: string) => {
    const reply: Comment = {
      id: Date.now().toString(),
      author,
      text,
      date: new Date().toLocaleDateString(),
      replies: []
    };

    setComments(prev => updateCommentTree(prev, parentId, (item) => ({
      ...item,
      replies: [...item.replies, reply]
    })));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Helper to detect URLs and wrap them in anchor tags
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        const href = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline break-all relative z-20">
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Styles based on color column
  const getAnnouncementStyle = (color?: string) => {
    const key = color?.toLowerCase().trim() || 'white';
    switch(key) {
      case 'green':
        return 'border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-100';
      case 'yellow':
        return 'border-l-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10 text-yellow-50';
      case 'orange':
        return 'border-l-orange-500 bg-orange-500/5 hover:bg-orange-500/10 text-orange-50';
      case 'red':
      case 'maroon':
        return 'border-l-rose-800 bg-rose-900/10 hover:bg-rose-900/20 text-rose-50';
      case 'white':
      default:
        return 'border-l-slate-400 bg-slate-800/20 hover:bg-slate-800/40 text-slate-200';
    }
  };

  const getBadgeColor = (color?: string) => {
    const key = color?.toLowerCase().trim() || 'white';
    switch(key) {
      case 'green': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'yellow': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'orange': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'red':
      case 'maroon': return 'bg-rose-900/30 text-rose-400 border-rose-800/40';
      default: return 'bg-slate-700/50 text-slate-300 border-slate-600/30';
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-12">
      {/* Official Announcements */}
      <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-6 bg-gradient-to-b from-slate-900 to-slate-800/50">
           <div className="flex items-center gap-3">
             <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl ring-1 ring-rose-500/20">
               <Megaphone className="w-6 h-6" />
             </div>
             <div>
               <h2 className="text-2xl font-bold text-white">Announcements</h2>
               <p className="text-slate-400 text-sm">Upcoming events & updates</p>
             </div>
           </div>
           
           {/* Legend - Top Right Box */}
           <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
              <span className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider border-b border-slate-800/50 pb-2">Event Key</span>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {LEGEND.map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.colorClass}`}></div>
                    <span className={`text-[10px] sm:text-xs font-medium ${item.textClass} whitespace-nowrap`}>{item.label}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>

        <div className="divide-y divide-slate-800/50">
          {announcements.length > 0 ? (
            announcements.map((ann) => {
              const isExpanded = expandedId === ann.id;
              const hasDetails = !!ann.details;
              
              return (
                <div 
                  key={ann.id} 
                  className={`transition-all duration-300 border-l-4 ${getAnnouncementStyle(ann.color)} ${hasDetails ? 'cursor-pointer' : ''}`}
                  onClick={() => hasDetails && toggleExpand(ann.id)}
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                       {/* Date Badge */}
                       {ann.date && (
                         <div className="flex-shrink-0">
                           <div className={`inline-flex flex-col items-center justify-center min-w-[80px] px-3 py-2 rounded-lg border text-center ${getBadgeColor(ann.color)}`}>
                             <Calendar className="w-4 h-4 mb-1 opacity-80" />
                             <span className="text-sm font-bold">{ann.date}</span>
                           </div>
                         </div>
                       )}
                       
                       {/* Content */}
                       <div className="flex-1 w-full">
                         <div className="flex justify-between items-start gap-4">
                           <h3 className="text-lg font-bold leading-tight mb-1">
                             {renderTextWithLinks(ann.text)}
                           </h3>
                           {hasDetails && (
                             <div className="text-slate-500 mt-1">
                               {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                             </div>
                           )}
                         </div>
                         
                         {!hasDetails && !isExpanded && (
                            <p className="text-sm text-slate-400 mt-1 italic">No additional details</p>
                         )}

                         {/* Collapsible Details */}
                         <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                           <div className="overflow-hidden">
                             <div className="pt-3 border-t border-slate-700/30 text-sm leading-relaxed opacity-90 whitespace-pre-wrap flex gap-3">
                               <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1 flex-shrink-0 select-none">Details</span>
                               <div>
                                 {renderTextWithLinks(ann.details || '')}
                               </div>
                             </div>
                           </div>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
              <Bell className="w-12 h-12 mb-4 opacity-20" />
              <p>No new announcements at this time.</p>
            </div>
          )}
        </div>
      </div>

      {/* Community Discussion Section */}
      <div className="space-y-6">
         <div className="flex items-center gap-3 px-2">
            <MessageSquare className="w-6 h-6 text-violet-400" />
            <h3 className="text-xl font-bold text-slate-200">Community Chat</h3>
         </div>

         {/* New Comment Form */}
         <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
           <form onSubmit={handlePostComment} className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label>
               <input 
                 type="text" 
                 value={newAuthor}
                 onChange={(e) => setNewAuthor(e.target.value)}
                 placeholder="Your name"
                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-violet-500 outline-none text-sm font-bold"
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message</label>
               <textarea 
                 value={newText}
                 onChange={(e) => setNewText(e.target.value)}
                 placeholder="Share your thoughts..."
                 rows={3}
                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-violet-500 outline-none resize-none text-sm"
               />
             </div>
             <div className="flex justify-end">
               <button 
                 type="submit"
                 disabled={!newAuthor.trim() || !newText.trim()}
                 className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Post Comment
               </button>
             </div>
           </form>
         </div>

         {/* Comments List */}
         <div className={comments.length > 2 ? "bg-slate-950/30 rounded-3xl border border-slate-800 overflow-hidden" : ""}>
           <div className={comments.length > 2 
             ? "max-h-[600px] overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600" 
             : "space-y-4"}>
              {comments.map(comment => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  isAdmin={isAdmin} 
                  onDelete={handleDelete} 
                  onEdit={handleEdit}
                  onReply={handleReply}
                  depth={0}
                />
              ))}
           </div>
         </div>
      </div>
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onReply: (parentId: string, author: string, text: string) => void;
  depth: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, isAdmin, onDelete, onEdit, onReply, depth }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isReplying, setIsReplying] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState('');
  const [replyText, setReplyText] = useState('');

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(comment.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyAuthor.trim() && replyText.trim()) {
      onReply(comment.id, replyAuthor.trim(), replyText.trim());
      setIsReplying(false);
      setReplyAuthor('');
      setReplyText('');
    }
  };

  return (
    <div className={`flex gap-3 ${depth > 0 ? 'ml-8 md:ml-12 mt-3' : ''}`}>
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${comment.author === 'Studio Admin' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
          {comment.author.substring(0, 2)}
        </div>
      </div>
      
      <div className="flex-1">
        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-800 transition-colors group">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-bold ${comment.author === 'Studio Admin' ? 'text-rose-400' : 'text-slate-200'}`}>
                {comment.author}
              </span>
              <span className="text-[10px] text-slate-600">{comment.date}</span>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isAdmin && (
                <>
                  <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-sky-400 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(comment.id)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea 
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIsEditing(false)} className="p-1 text-slate-500 hover:text-slate-300"><X className="w-4 h-4"/></button>
                <button onClick={handleSaveEdit} className="p-1 text-emerald-500 hover:text-emerald-400"><Save className="w-4 h-4"/></button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
          )}

          <div className="mt-3 flex gap-4">
             <button 
               onClick={() => setIsReplying(!isReplying)}
               className="text-xs font-bold text-slate-600 hover:text-violet-400 transition-colors flex items-center gap-1.5"
             >
               <Reply className="w-3 h-3" />
               Reply
             </button>
          </div>
        </div>

        {/* Reply Form */}
        {isReplying && (
          <form onSubmit={handleSubmitReply} className="mt-3 bg-slate-900 p-4 rounded-xl border border-slate-800 border-l-4 border-l-violet-500/50">
            <div className="space-y-3">
              <input 
                 type="text" 
                 value={replyAuthor}
                 onChange={(e) => setReplyAuthor(e.target.value)}
                 placeholder="Your Name"
                 className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500"
               />
               <textarea 
                 value={replyText}
                 onChange={(e) => setReplyText(e.target.value)}
                 placeholder="Write a reply..."
                 rows={2}
                 className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500 resize-none"
               />
               <div className="flex justify-end gap-2">
                 <button type="button" onClick={() => setIsReplying(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                 <button type="submit" disabled={!replyAuthor || !replyText} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-500 disabled:opacity-50">Reply</button>
               </div>
            </div>
          </form>
        )}

        {/* Nested Replies */}
        {comment.replies.map(reply => (
          <CommentItem 
            key={reply.id} 
            comment={reply} 
            isAdmin={isAdmin} 
            onDelete={onDelete} 
            onEdit={onEdit}
            onReply={onReply}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
};
