import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Match, Message } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, ShieldAlert, CircleAlert, BadgeCheck } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const otherUser = match.participants?.find(p => p.uid !== currentUserId);
  const currentUserProfile = match.participants?.find(p => p.uid === currentUserId);

  useEffect(() => {
    const q = query(
      collection(db, `matches/${match.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `matches/${match.id}/messages`);
    });

    return unsubscribe;
  }, [match.id]);

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
          systemInstruction: "You are a safety filter for a premium dating app in Nigeria. Analyze the message for signs of: sharing bank details, phone numbers too early, external social handles (Instagram/Telegram), or predatory investment advice. Respond with 'SAFE' or 'WARNING' only."
        }
      });
      return response.text?.includes('WARNING') || false;
    } catch (e) {
      console.error("Gemini Safety Check failed", e);
      return false;
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
      <header className="p-4 border-b border-white/5 flex items-center gap-3 bg-black/40 backdrop-blur-md">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
             <img src={otherUser?.photoURL} alt={otherUser?.displayName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1">
              {otherUser?.displayName}
              {otherUser?.isVerified && <BadgeCheck size={14} className="text-[#F27D26]" />}
            </h4>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{otherUser?.neighborhood}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <motion.div 
            key={m.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              m.senderId === currentUserId 
                ? 'bg-white text-black rounded-tr-none' 
                : 'bg-[#111] text-white rounded-tl-none border border-white/5'
            }`}>
              {m.text}
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
