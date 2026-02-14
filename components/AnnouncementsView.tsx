
import React, { useState, useEffect } from 'react';
import { Announcement } from '../types';
import { Megaphone, Calendar, Bell, MessageSquare, User, Trash2, Edit2, CornerDownRight, Save, X, Reply } from 'lucide-react';

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

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ announcements, isAdmin = false }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newAuthor, setNewAuthor] = useState('');
  const [newText, setNewText] = useState('');

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
    // We keep the author name for convenience
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

  // Helper to detect URLs and wrap them in anchor tags
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        const href = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline break-all">
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-12">
      {/* Official Announcements */}
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
