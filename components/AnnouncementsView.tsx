import React, { useState, useEffect } from 'react';
import { Announcement } from '../types'; // Adjust path if needed
import { Megaphone, Calendar, Bell, MessageSquare, Trash2, Edit2, Save, X, Reply, ChevronDown, ChevronUp, LogIn, Eye, EyeOff } from 'lucide-react';

import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AnnouncementsViewProps {
  announcements: Announcement[];
  isAdmin?: boolean;
}

interface Comment {
  id: string;
  author: string;
  authorUid: string;
  text: string;
  date: string;
  timestamp: number;
  parentId: string | null;
  hidden?: boolean;
  replies?: Comment[];
}

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
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Only grant comment admin privileges if actually signed in to Firebase as admin
  const isActuallyAdmin = user?.email === 'Lamariow@gmail.com' || user?.email === 'lamariow@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const q = query(collection(db, 'comments'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flatComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      
      // Build tree
      const commentMap = new Map<string, Comment>();
      flatComments.forEach(c => commentMap.set(c.id, { ...c, replies: [] }));
      
      const rootComments: Comment[] = [];
      flatComments.forEach(c => {
        if (c.parentId) {
          const parent = commentMap.get(c.parentId);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(commentMap.get(c.id)!);
          }
        } else {
          rootComments.push(commentMap.get(c.id)!);
        }
      });
      
      setComments(rootComments);
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, 'comments');
    });

    return () => unsubscribe();
  }, [authReady]);

  const handleLogin = async () => {
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error signing in", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/web-storage-unsupported') {
        setLoginError("Sign-in popup was blocked or closed. Please try opening the app in a new tab (using the button in the top right) to sign in.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError(`This domain (${window.location.hostname}) is not authorized for OAuth operations. Please add exactly this domain to your Firebase Console > Authentication > Settings > Authorized domains.`);
      } else {
        setLoginError(error.message || "An error occurred during sign in.");
      }
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    if (!user && !newAuthor.trim()) return;

    const newComment = {
      author: user ? (user.displayName || 'Anonymous') : newAuthor.trim(),
      authorUid: user ? user.uid : 'anonymous',
      text: newText.trim(),
      date: new Date().toLocaleDateString(),
      timestamp: Date.now(),
      parentId: null,
      hidden: false
    };

    try {
      await addDoc(collection(db, 'comments'), newComment);
      setNewText('');
      setNewAuthor('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `comments/${commentId}`);
    }
  };

  const handleEdit = async (commentId: string, newText: string) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), { text: newText });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    }
  };

  const handleToggleHide = async (commentId: string, currentHidden: boolean) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), { hidden: !currentHidden });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    }
  };

  const handleReply = async (parentId: string, text: string, authorName?: string) => {
    const reply = {
      author: user ? (user.displayName || 'Anonymous') : (authorName || 'Anonymous'),
      authorUid: user ? user.uid : 'anonymous',
      text: text.trim(),
      date: new Date().toLocaleDateString(),
      timestamp: Date.now(),
      parentId,
      hidden: false
    };

    try {
      await addDoc(collection(db, 'comments'), reply);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

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

  const getAnnouncementStyle = (color?: string) => {
    const key = color?.toLowerCase().trim() || 'white';
    switch(key) {
      case 'green': return 'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-100';
      case 'yellow': return 'bg-yellow-400/5 hover:bg-yellow-400/10 text-yellow-50';
      case 'orange': return 'bg-orange-500/5 hover:bg-orange-500/10 text-orange-50';
      case 'red':
      case 'maroon': return 'bg-rose-900/10 hover:bg-rose-900/20 text-rose-50';
      case 'white':
      default: return 'bg-slate-800/20 hover:bg-slate-800/40 text-slate-200';
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
                  className={`transition-all duration-300 ${getAnnouncementStyle(ann.color)} ${hasDetails ? 'cursor-pointer' : ''}`}
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
             {user ? (
               <div className="flex items-center gap-3 mb-2">
                 <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                   {user.displayName?.substring(0, 2).toUpperCase() || 'U'}
                 </div>
                 <span className="text-sm font-bold text-slate-200">{user.displayName}</span>
                 <button type="button" onClick={() => auth.signOut()} className="text-xs text-slate-500 hover:text-slate-300 ml-auto">Sign Out</button>
               </div>
             ) : (
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                 <div className="flex-1">
                   <input 
                     type="text" 
                     value={newAuthor}
                     onChange={(e) => setNewAuthor(e.target.value)}
                     placeholder="Your Name (or sign in)"
                     className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-violet-500 outline-none text-sm font-bold"
                   />
                 </div>
                 <div className="flex flex-col items-end gap-2">
                   <button 
                     type="button"
                     onClick={handleLogin}
                     className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-xl font-bold text-sm transition-colors whitespace-nowrap"
                   >
                     <LogIn className="w-4 h-4" />
                     Sign in
                   </button>
                 </div>
               </div>
             )}
             {loginError && (
               <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg mb-2">
                 {loginError}
               </div>
             )}
             <div>
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
                 disabled={!newText.trim() || (!user && !newAuthor.trim())}
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
              
              {/* Default Welcome Comment */}
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase bg-violet-600 text-white">
                    W
                  </div>
                </div>
                <div className="flex-1">
                  <div className="bg-slate-900/50 rounded-2xl p-4 border border-violet-500/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-violet-400">
                          Welcome
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                      Welcome to the Comments! Choose a fun nickname or sign in to be able to edit or delete your comments.
                    </p>
                  </div>
                </div>
              </div>

              {comments.filter(c => isActuallyAdmin || !c.hidden).map(comment => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  currentUser={user}
                  isAdmin={isActuallyAdmin} 
                  onDelete={handleDelete} 
                  onEdit={handleEdit}
                  onReply={handleReply}
                  onToggleHide={handleToggleHide}
                  onLogin={handleLogin}
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
  currentUser: User | null;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onReply: (parentId: string, text: string, authorName?: string) => void;
  onToggleHide: (id: string, currentHidden: boolean) => void;
  onLogin: () => void;
  depth: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, currentUser, isAdmin, onDelete, onEdit, onReply, onToggleHide, onLogin, depth }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAuthor, setReplyAuthor] = useState('');

  const isOwner = currentUser?.uid === comment.authorUid;
  const canModify = (isOwner && comment.authorUid !== 'anonymous') || isAdmin;

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(comment.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser && !replyAuthor.trim()) return;
    if (replyText.trim()) {
      onReply(comment.id, replyText.trim(), replyAuthor.trim());
      setIsReplying(false);
      setReplyText('');
      setReplyAuthor('');
    }
  };

  return (
    <div className={`flex gap-3 ${depth > 0 ? 'ml-8 md:ml-12 mt-3' : ''} ${comment.hidden && !isAdmin ? 'hidden' : ''}`}>
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${comment.author === 'Studio Admin' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
          {comment.author.substring(0, 2)}
        </div>
      </div>
      
      <div className="flex-1">
        <div className={`bg-slate-900/50 rounded-2xl p-4 border ${comment.hidden ? 'border-dashed border-slate-600 opacity-60' : 'border-slate-800/50 hover:border-slate-800'} transition-colors group`}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-bold ${comment.author === 'Studio Admin' ? 'text-rose-400' : 'text-slate-200'}`}>
                {comment.author}
              </span>
              <span className="text-[10px] text-slate-600">{comment.date}</span>
              {comment.hidden && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Hidden</span>}
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isAdmin && (
                <button onClick={() => onToggleHide(comment.id, !!comment.hidden)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-amber-400 transition-colors" title={comment.hidden ? "Unhide" : "Hide"}>
                  {comment.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              )}
              {canModify && (
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
              {!currentUser && (
                <input 
                  type="text" 
                  value={replyAuthor}
                  onChange={(e) => setReplyAuthor(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500"
                />
              )}
              <textarea 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsReplying(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                <button type="submit" disabled={!replyText.trim() || (!currentUser && !replyAuthor.trim())} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-500 disabled:opacity-50">Reply</button>
              </div>
            </div>
          </form>
        )}

        {/* Nested Replies */}
        {comment.replies && comment.replies.filter(r => isAdmin || !r.hidden).map(reply => (
          <CommentItem 
            key={reply.id} 
            comment={reply} 
            currentUser={currentUser}
            isAdmin={isAdmin} 
            onDelete={onDelete} 
            onEdit={onEdit}
            onReply={onReply}
            onToggleHide={onToggleHide}
            onLogin={onLogin}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
};