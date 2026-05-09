import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, writeBatch, where, getDocs, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Match, Message } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, ShieldAlert, CircleAlert, BadgeCheck, MoreVertical, Flag, Ban } from 'lucide-react';
import { ai, MODELS } from '../../lib/gemini';

interface ChatThreadProps {
  match: Match;
  currentUserId: string;
  onBack: () => void;
}

export default function ChatThread({ match, currentUserId, onBack }: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isScamWarning, setIsScamWarning] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const otherUser = match.participants?.find(p => p.uid !== currentUserId);
  const currentUserProfile = match.participants?.find(p => p.uid === currentUserId);

  useEffect(() => {
    const q = query(
      collection(db, `matches/${match.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(newMessages);

      // Mark unread messages from other user as read
      if (!snap.metadata.hasPendingWrites) {
        const unread = snap.docs.filter(d => d.data().senderId !== currentUserId && !d.data().isRead);
        if (unread.length > 0) {
          const batch = writeBatch(db);
          unread.forEach(d => {
            batch.update(doc(db, `matches/${match.id}/messages`, d.id), { isRead: true });
          });
          batch.commit().catch(e => console.error("Failed to mark messages as read", e));
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `matches/${match.id}/messages`);
    });

    return unsubscribe;
  }, [match.id, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const detectScam = async (text: string) => {
    if (messages.length > 5) return false; // Only check initial messages

    try {
      const response = await ai.models.generateContent({
        model: MODELS.text,
        contents: text,
        config: {
          //@ts-ignore - systemInstruction might not be in all model versions yet but keeping original pattern
          systemInstruction: "You are a safety filter for a premium dating app in Nigeria. Analyze the message for signs of: sharing bank details, phone numbers too early, external social handles (Instagram/Telegram), or predatory investment advice. Respond with 'SAFE' or 'WARNING' only."
        }
      });
      return response.text?.includes('WARNING') || false;
    } catch (e) {
      console.error("Safety Check failed", e);
      return false;
    }
  };

  const handleBlock = async () => {
    if (!otherUser || !window.confirm('Block this user? You will no longer see each other.')) return;
    try {
      await updateDoc(doc(db, 'users', currentUserId), {
        blockedUsers: arrayUnion(otherUser.uid)
      });
      alert("User blocked. Absolute discretion has been applied.");
      onBack();
    } catch (error) {
      console.error("Block failed", error);
    }
  };

  const handleReport = async (reason: string) => {
    if (!otherUser) return;
    setIsReporting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUserId,
        reportedUserId: otherUser.uid,
        matchId: match.id,
        reason,
        createdAt: serverTimestamp()
      });
      alert("Report submitted. Our concierge team will review this discreetly.");
      setShowOptions(false);
      setReportReason(null);
      setCustomReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    } finally {
      setIsReporting(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (!currentUserProfile?.isVerified) {
      alert("Verification Required: You must verify your ID to send messages on Veil.");
      return;
    }

    const textToSend = inputText;
    setInputText('');

    const isSuspicious = await detectScam(textToSend);
    if (isSuspicious) setIsScamWarning(true);

    try {
      await addDoc(collection(db, `matches/${match.id}/messages`), {
        senderId: currentUserId,
        text: textToSend,
        createdAt: serverTimestamp(),
        isRead: false
      });

      await updateDoc(doc(db, 'matches', match.id), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${match.id}/messages`);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-[60] flex flex-col">
      <header className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
               <img src={otherUser?.photoURL} alt={otherUser?.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h4 className="text-sm font-medium flex items-center gap-1">
                {otherUser?.displayName}
                {otherUser?.isVerified && <BadgeCheck size={14} className="text-[#F27D26]" />}
              </h4>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{otherUser?.neighborhood}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 hover:bg-white/5 rounded-full text-gray-500"
          >
            <MoreVertical size={20} />
          </button>

          <AnimatePresence>
            {showOptions && (
              <>
                <div className="fixed inset-0" onClick={() => setShowOptions(false)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-10"
                >
                  <button 
                    onClick={() => setReportReason('discretion')}
                    className="w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-white/5 transition-all text-red-500"
                  >
                    <Flag size={14} /> Report Discretion Breach
                  </button>
                  <button 
                    onClick={() => setReportReason('conduct')}
                    className="w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-white/5 transition-all text-red-500"
                  >
                    <ShieldAlert size={14} /> Unprofessional Conduct
                  </button>
                  <button 
                    onClick={() => setReportReason('other')}
                    className="w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-white/5 transition-all text-gray-400"
                  >
                    <CircleAlert size={14} /> Other Concern
                  </button>
                  <button 
                    onClick={handleBlock}
                    className="w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-white/5 transition-all text-gray-400 border-t border-white/5"
                  >
                    <Ban size={14} /> Block Profile
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Report Modal */}
      <AnimatePresence>
        {reportReason && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-serif text-white mb-2">Internal Report</h3>
              <p className="text-xs text-gray-500 mb-6 font-medium tracking-wide">
                Please provide details regarding your concern with {otherUser?.displayName}.
              </p>

              <textarea 
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="What occurred? Be as specific as possible..."
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white h-32 outline-none focus:border-[#F27D26] transition-all mb-6 resize-none"
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setReportReason(null)}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleReport(`${reportReason}: ${customReason}`)}
                  disabled={isReporting || !customReason.trim()}
                  className="flex-1 py-3 bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
                >
                  {isReporting ? 'Submitting...' : 'File Report'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <motion.div 
            key={m.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div className="flex flex-col gap-1 items-end">
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                m.senderId === currentUserId 
                  ? 'bg-white text-black rounded-tr-none' 
                  : 'bg-[#111] text-white rounded-tl-none border border-white/5'
              }`}>
                {m.text}
              </div>
              {m.senderId === currentUserId && (
                <div className="flex items-center gap-1 mt-1 px-1">
                  <span className="text-[9px] text-gray-600">
                    {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  {m.isRead ? (
                    <BadgeCheck size={10} className="text-[#F27D26]" />
                  ) : (
                    <BadgeCheck size={10} className="text-gray-700" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isScamWarning && (
          <div className="bg-[#F27D26]/10 border border-[#F27D26]/20 p-3 rounded-xl flex gap-3 text-[#F27D26] text-xs">
            <ShieldAlert size={16} className="shrink-0" />
            <p>Safety Advisory: We've detected patterns common in premature data sharing. For your discretion, please maintain communication within Veil.</p>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-black/80 backdrop-blur-lg border-t border-white/5">
        {!currentUserProfile?.isVerified ? (
           <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <CircleAlert size={16} />
                <span>Verification required to chat</span>
              </div>
              <button disabled className="text-[10px] uppercase tracking-widest font-bold opacity-30">Verify Now</button>
           </div>
        ) : (
          <div className="relative">
            <input 
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Send a greeting..."
              className="w-full bg-[#111] border border-white/10 p-4 rounded-full outline-none focus:border-[#F27D26] transition-all text-sm pr-12"
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
