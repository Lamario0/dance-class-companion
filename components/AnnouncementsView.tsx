import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Announcement } from '../types';
import { MessageCircle, Trash2, Edit2, Save, X, Reply, ChevronDown, Send, CalendarDays } from 'lucide-react';
import { Segmented } from './ui/Segmented';
import { EmptyState } from './ui/Doodles';
import { useToast } from './ui/Toast';
import { DancingDots } from './ui/Doodles';
import {
  ChatThread, subscribeToChat, postChatMessage, buildThreads, moderateChat, MAX_AUTHOR, MAX_TEXT,
} from '../services/chatService';

// UI-only: remember the chat name locally after the first post.
const NAME_KEY = 'dcc_chat_name';
const readSavedName = () => {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
};
const saveName = (name: string) => {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
};

// UI-only: static colour lookups for the event-type dots (Tailwind needs literal class names).
const DOT: Record<string, string> = {
  green: 'bg-emerald-400', yellow: 'bg-yellow-400', orange: 'bg-orange-400', red: 'bg-rose-500', maroon: 'bg-rose-500', white: 'bg-slate-300',
};
const BADGE: Record<string, string> = {
  green: 'text-emerald-300', yellow: 'text-yellow-300', orange: 'text-orange-300', red: 'text-rose-300', maroon: 'text-rose-300', white: 'text-text-mid',
};
const colorKey = (c?: string) => {
  const k = c?.toLowerCase().trim() || 'white';
  return k in DOT ? k : 'white';
};
const useIsDesktop = () => {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "10/22/2026" → { mon: "Oct", day: "22" }; anything else is shown as-is. */
const splitDate = (d: string) => {
  const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { mon: MONTHS[+m[1] - 1], day: String(+m[2]) };
  return null;
};


interface AnnouncementsViewProps {
  announcements: Announcement[];
  isAdmin?: boolean;
  /** signed instructor session token from /api/admin-login, for edit/delete */
  adminToken?: string | null;
}

type Comment = ChatThread;

const formatDate = (d: Date | null) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now');

/** Season the chat resets on, for the "fresh start" note: "Oct–Dec". */
const quarterRange = () => {
  const q = Math.floor(new Date().getMonth() / 3) * 3;
  return `${MONTHS[q]}–${MONTHS[q + 2]}`;
};

// Legend colors mapping
const LEGEND = [
  { label: 'Local Events', colorClass: 'bg-emerald-500', textClass: 'text-emerald-400', key: 'green' },
  { label: 'Non WCS Events', colorClass: 'bg-yellow-500', textClass: 'text-yellow-400', key: 'yellow' },
  { label: 'Weekend Events', colorClass: 'bg-orange-500', textClass: 'text-orange-400', key: 'orange' },
  { label: 'Out of Area (Small)', colorClass: 'bg-rose-800', textClass: 'text-rose-400', key: 'red' },
  { label: 'Misc/Other', colorClass: 'bg-slate-400', textClass: 'text-slate-400', key: 'white' }
];

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ announcements, isAdmin = false, adminToken = null }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [chatStatus, setChatStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [chatRetry, setChatRetry] = useState(0);
  const [posting, setPosting] = useState(false);
  const [newAuthor, setNewAuthor] = useState(readSavedName);
  const [newText, setNewText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // UI-only state
  const [view, setView] = useState<'updates' | 'chat'>('updates');
  const [savedName, setSavedName] = useState(readSavedName);
  const [editingName, setEditingName] = useState(false);
  const toast = useToast();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const isDesktop = useIsDesktop();

  // Mobile: publish the floating chat bar's height so the page and music player clear it.
  useEffect(() => {
    const root = document.documentElement;
    const el = composerFormRef.current;
    if (view !== 'chat' || isDesktop || !el) {
      root.style.setProperty('--chat-h', '0px');
      return;
    }
    const ro = new ResizeObserver(() => root.style.setProperty('--chat-h', `${el.offsetHeight + 8}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--chat-h', '0px');
    };
  }, [view, isDesktop]);

  // Live chat from Firestore (this quarter only — see services/chatService.ts).
  useEffect(() => {
    const unsub = subscribeToChat(
      msgs => {
        setComments(buildThreads(msgs));
        setChatStatus('ready');
      },
      err => {
        console.error('Chat failed to load', err);
        setChatStatus('error');
      },
    );
    return unsub;
  }, [chatRetry]);

  const handleDelete = async (commentId: string) => {
    if (!adminToken) return;
    if (!window.confirm('Delete this message and its replies?')) return;
    const t = toast.show('Deleting…', 'loading');
    try {
      await moderateChat(adminToken, { type: 'delete', id: commentId });
      t.update('Deleted', 'success');
    } catch (err) {
      t.update((err as Error).message || "Couldn't delete that.", 'error');
    }
  };

  const handleEdit = async (commentId: string, text: string) => {
    if (!adminToken) return false;
    const t = toast.show('Saving…', 'loading');
    try {
      await moderateChat(adminToken, { type: 'edit', id: commentId, text });
      t.update('Saved', 'success');
      return true;
    } catch (err) {
      t.update((err as Error).message || "Couldn't save that.", 'error');
      return false;
    }
  };

  const handleReply = async (parentId: string, author: string, text: string) => {
    const t = toast.show('Posting…', 'loading');
    try {
      await postChatMessage(author, text, parentId);
      t.update('Posted!', 'success');
      return true;
    } catch (err) {
      console.error(err);
      t.update("Couldn't post — check your connection.", 'error');
      return false;
    }
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
          <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-soft underline underline-offset-2 break-all relative z-20" onClick={(e) => e.stopPropagation()}>
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const onComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const author = newAuthor.trim();
    const text = newText.trim();
    if (!author || !text || posting) return;
    setPosting(true);
    const t = toast.show('Posting…', 'loading');
    saveName(author);
    setSavedName(author);
    setEditingName(false);
    try {
      await postChatMessage(author, text);
      setNewText('');
      t.update('Posted!', 'success');
    } catch (err) {
      console.error(err);
      t.update("Couldn't post — check your connection.", 'error');
    } finally {
      setPosting(false);
    }
  };

  const askName = !savedName || editingName;
  const placeComposer = (node: React.ReactElement) => (isDesktop ? node : createPortal(node, document.body));

  return (
    <div className="mx-auto max-w-3xl">
      <Segmented
        idPrefix="news"
        label="News sections"
        value={view}
        onChange={setView}
        options={[
          { value: 'updates', label: 'Updates', count: announcements.length },
          { value: 'chat', label: 'Chat' },
        ]}
        className="mb-6 md:max-w-xs"
      />

      <div id="news-panel" role="tabpanel" aria-labelledby={`news-tab-${view}`} key={view} className="animate-fade">
        {view === 'updates' ? (
          <section aria-label="Studio updates">
            {/* Event key: one row of small legend chips */}
            <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4" aria-label="Event key">
              {LEGEND.map((item) => (
                <span key={item.key} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] text-text-mid">
                  <span className={`h-2 w-2 rounded-full ${DOT[item.key]}`} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>

            {announcements.length > 0 ? (
              <ul className="card stagger divide-y divide-line overflow-hidden">
                {announcements.map((ann, i) => {
                  const isExpanded = expandedId === ann.id;
                  const hasDetails = !!ann.details;
                  const key = colorKey(ann.color);
                  const d = ann.date ? splitDate(ann.date) : null;
                  const legend = LEGEND.find(l => l.key === key);

                  return (
                    <li key={ann.id} style={{ ['--i' as any]: i }}>
                      <div
                        role={hasDetails ? 'button' : undefined}
                        tabIndex={hasDetails ? 0 : undefined}
                        aria-expanded={hasDetails ? isExpanded : undefined}
                        onClick={() => hasDetails && toggleExpand(ann.id)}
                        onKeyDown={(e) => {
                          if (hasDetails && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleExpand(ann.id);
                          }
                        }}
                        className={`flex gap-4 px-4 py-4 md:px-5 transition-colors ${hasDetails ? 'cursor-pointer hover:bg-surface-2/60 active:bg-surface-2' : ''}`}
                      >
                        {/* compact date badge */}
                        <div className="relative flex w-12 shrink-0 flex-col items-center justify-center rounded-sm bg-surface-2 py-1.5 text-center">
                          {d ? (
                            <>
                              <span className={`text-[12px] font-bold uppercase leading-none ${BADGE[key]}`}>{d.mon}</span>
                              <span className="mt-0.5 text-[20px] font-extrabold leading-none text-text-hi tabular-nums">{d.day}</span>
                            </>
                          ) : ann.date ? (
                            <span className="px-1 text-[12px] font-semibold leading-tight text-text-mid">{ann.date}</span>
                          ) : (
                            <CalendarDays className="h-5 w-5 text-text-lo" aria-hidden="true" />
                          )}
                          <span
                            className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-surface-1 ${DOT[key]}`}
                            title={legend?.label}
                            aria-label={legend?.label}
                          />
                        </div>

                        <div className="min-w-0 flex-1 self-center">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold leading-snug text-text-hi">{renderTextWithLinks(ann.text)}</h3>
                            {hasDetails && (
                              <ChevronDown
                                className={`mt-0.5 h-5 w-5 shrink-0 text-text-lo transition-transform duration-300 ease-[var(--ease-spring)] ${isExpanded ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          {/* smooth height accordion */}
                          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-calm)] ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden" inert={!isExpanded}>
                              <p className="pt-2 text-[15px] leading-relaxed text-text-mid whitespace-pre-wrap">
                                {renderTextWithLinks(ann.details || '')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="card">
                <EmptyState doodle="sparkle" title="Nothing new right now." body="Studio news and events will show up here." />
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Community chat" className="md:overflow-hidden md:rounded-[var(--radius-lg)] md:border md:border-line md:bg-surface-1 md:shadow-[var(--shadow-card)]">
            {/* Desktop: the comments scroll inside the card; mobile: the page scrolls */}
            <div className="md:max-h-[min(60vh,560px)] md:overflow-y-auto md:overscroll-contain md:p-5 [scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent]">
              <p className="mb-5 flex items-start gap-2 text-[14px] leading-snug text-text-lo">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" aria-hidden="true" />
                <span>
                  Chat with your classmates. The board starts fresh every quarter — this one runs {quarterRange()}.
                </span>
              </p>
              {chatStatus === 'loading' ? (
                <div className="flex items-center gap-3 py-6 text-text-mid">
                  <DancingDots label="Loading chat" />
                  <span>Loading the chat…</span>
                </div>
              ) : chatStatus === 'error' ? (
                <EmptyState
                  doodle="swirl"
                  title="Couldn't load the chat."
                  body="Check your connection and try again."
                  action={
                    <button type="button" onClick={() => { setChatStatus('loading'); setChatRetry(n => n + 1); }} className="btn-secondary press">
                      Try again
                    </button>
                  }
                />
              ) : comments.length > 0 ? (
                <ul className="stagger space-y-5 pb-4 md:pb-0">
                  {comments.map((comment, i) => (
                    <li key={comment.id} style={{ ['--i' as any]: Math.min(i, 8) }}>
                      <CommentItem
                        comment={comment}
                        isAdmin={isAdmin}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onReply={handleReply}
                        depth={0}
                        defaultName={savedName}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState doodle="swirl" title="It's quiet in here." body="Say hi or ask about this week's class." />
              )}
            </div>

            {/* Mobile: floating bar that rises out of the top of the bottom nav.
                Desktop: sits under the scrollable comments, inside the card. */}
            {/* Mobile: portalled to <body> so the tab-switch transform can't trap position:fixed */}
            {placeComposer(<form
              ref={composerFormRef}
              onSubmit={onComposerSubmit}
              className={
                isDesktop
                  ? 'border-t border-line bg-surface-1 p-3'
                  : 'rise-from-nav fixed inset-x-0 z-[38] mx-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-lg)] border border-white/10 bg-surface-1/90 p-3 shadow-[var(--shadow-float)] backdrop-blur-xl backdrop-saturate-150'
              }
              style={isDesktop ? undefined : { bottom: 'calc(var(--nav-h) + 8px)' }}
            >
              {askName ? (
                <div className="mb-2">
                  <label htmlFor="chat-name" className="sr-only">Your name</label>
                  <input
                    id="chat-name"
                    type="text"
                    maxLength={MAX_AUTHOR}
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="input !min-h-11 !py-2"
                  />
                </div>
              ) : (
                <p className="mb-1.5 px-1 text-[13px] text-text-lo">
                  Posting as <span className="font-semibold text-text-mid">{savedName}</span>
                  {' · '}
                  <button type="button" onClick={() => setEditingName(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center -my-3 font-semibold text-brand-soft underline-offset-2 hover:underline">
                    change
                  </button>
                </p>
              )}
              <div className="flex items-end gap-2">
                <label htmlFor="chat-message" className="sr-only">Message</label>
                <textarea
                  id="chat-message"
                  ref={composerRef}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Share your thoughts…"
                  maxLength={MAX_TEXT}
                  rows={1}
                  className="input !min-h-11 max-h-32 resize-none !py-2.5 [field-sizing:content]"
                />
                <button
                  type="submit"
                  disabled={!newAuthor.trim() || !newText.trim() || posting}
                  aria-label="Post message"
                  data-tip="Post"
                  className="tip press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-strong text-white hover:bg-brand disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-[18px] w-[18px]" />
                </button>
              </div>
            </form>)}
          </section>
        )}
      </div>
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => Promise<boolean>;
  onReply: (parentId: string, author: string, text: string) => Promise<boolean>;
  depth: number;
  /** UI-only: prefill reply name with the remembered chat name */
  defaultName?: string;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, isAdmin, onDelete, onEdit, onReply, depth, defaultName = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isReplying, setIsReplying] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState(defaultName);
  const [replyText, setReplyText] = useState('');

  const [busy, setBusy] = useState(false);

  const handleSaveEdit = async () => {
    if (!editText.trim() || busy) return;
    setBusy(true);
    if (await onEdit(comment.id, editText.trim())) setIsEditing(false);
    setBusy(false);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyAuthor.trim() || !replyText.trim() || busy) return;
    setBusy(true);
    if (await onReply(comment.id, replyAuthor.trim(), replyText.trim())) {
      setIsReplying(false);
      setReplyText('');
    }
    setBusy(false);
  };

  // "Studio Admin" is reserved by firestore.rules, so only older built-in posts carry it.
  const isStaff = comment.author === 'Studio Admin';

  return (
    <div className={`flex gap-3 ${depth > 0 ? 'mt-4' : ''}`}>
      {/* Avatar — on desktop hover pops a small tilted name tag */}
      <div className="group/avatar relative shrink-0">
        <div
          className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold uppercase ${
            isStaff ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white' : 'bg-surface-2 text-text-mid'
          }`}
          aria-hidden="true"
        >
          {comment.author.substring(0, 2)}
        </div>
        <span
          className="pointer-events-none absolute bottom-full left-0 mb-2 hidden -rotate-6 scale-75 whitespace-nowrap rounded-sm bg-accent px-2 py-1 text-[12px] font-bold text-surface-0 opacity-0 shadow-lg transition-all duration-300 ease-[var(--ease-spring)] md:block md:group-hover/avatar:scale-100 md:group-hover/avatar:opacity-100 md:group-hover/avatar:-rotate-3"
          aria-hidden="true"
        >
          {comment.author}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="group">
          <div className="flex items-start justify-between gap-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className={`font-semibold ${isStaff ? 'text-accent' : 'text-text-hi'}`}>{comment.author}</span>
              <span className="text-[13px] text-text-lo">{formatDate(comment.createdAt)}</span>
            </p>
            {isAdmin && (
              <div className="-mr-2 -mt-2 flex items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                <button onClick={() => setIsEditing(!isEditing)} aria-label="Edit comment" data-tip="Edit" className="tip press grid h-11 w-11 place-items-center rounded-full text-text-lo hover:bg-surface-2 hover:text-sky-300">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(comment.id)} aria-label="Delete comment" data-tip="Delete" className="tip press grid h-11 w-11 place-items-center rounded-full text-text-lo hover:bg-surface-2 hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                aria-label="Edit comment"
                className="input resize-none"
                rows={2}
              />
              <div className="flex justify-end gap-1">
                <button onClick={() => setIsEditing(false)} aria-label="Cancel edit" className="press grid h-11 w-11 place-items-center rounded-full text-text-lo hover:text-text-hi"><X className="h-4 w-4"/></button>
                <button onClick={handleSaveEdit} aria-label="Save edit" className="press grid h-11 w-11 place-items-center rounded-full text-emerald-400 hover:text-emerald-300"><Save className="h-4 w-4"/></button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-text-mid">{comment.text}</p>
          )}

          <button
            onClick={() => setIsReplying(!isReplying)}
            aria-expanded={isReplying}
            className="press -ml-2 mt-0.5 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold text-text-lo hover:text-brand-soft"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
        </div>

        {/* Reply Form */}
        {isReplying && (
          <form onSubmit={handleSubmitReply} className="mt-1 space-y-2 border-l-2 border-brand/50 pl-3 animate-fade">
            <input
               type="text"
               value={replyAuthor}
               onChange={(e) => setReplyAuthor(e.target.value)}
               placeholder="Your name"
               aria-label="Your name"
               maxLength={MAX_AUTHOR}
               className="input !min-h-11 !py-2"
             />
             <textarea
               maxLength={MAX_TEXT}
               value={replyText}
               onChange={(e) => setReplyText(e.target.value)}
               placeholder="Write a reply…"
               aria-label="Reply"
               rows={2}
               className="input resize-none"
             />
             <div className="flex justify-end gap-2">
               <button type="button" onClick={() => setIsReplying(false)} className="btn-secondary press !min-h-11 text-[15px]">Cancel</button>
               <button type="submit" disabled={!replyAuthor.trim() || !replyText.trim() || busy} className="btn-primary press !min-h-11 text-[15px]">Reply</button>
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
            defaultName={defaultName}
          />
        ))}
      </div>
    </div>
  );
};
