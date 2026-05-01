import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserProfile, Match } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ArrowLeft, Send, ShieldAlert, BadgeCheck } from 'lucide-react';
import ChatThread from './ChatThread';

interface MatchesProps {
  profile: UserProfile;
}

export default function Matches({ profile }: MatchesProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'matches'),
      where('users', 'array-contains', profile.uid),
      where('isMutual', '==', true)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      try {
        const matchDocs = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data() as Match;
          const otherUserId = data.users.find(id => id !== profile.uid);
          if (!otherUserId) return null;
          
          const otherSnap = await getDoc(doc(db, 'users', otherUserId));
          if (!otherSnap.exists()) return null;
          
          return {
            ...data,
            id: d.id,
            participants: [profile, otherSnap.data() as UserProfile]
          };
        }));

        setMatches(matchDocs.filter(m => m !== null) as Match[]);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'matches');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches');
    });

    return unsubscribe;
  }, [profile]);

  if (selectedMatch) {
    return <ChatThread match={selectedMatch} currentUserId={profile.uid} onBack={() => setSelectedMatch(null)} />;
  }

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <header className="mb-6">
        <h2 className="text-2xl font-serif">Encounters</h2>
        <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Verified Connections Only</p>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center opacity-30 animate-pulse">
           <MessageSquare size={40} />
        </div>
      ) : matches.length > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-4 pb-20">
          {matches.map(m => {
            const other = m.participants?.find(p => p.uid !== profile.uid);
            return (
              <motion.button 
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedMatch(m)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#111] border border-white/5 hover:border-[#F27D26]/30 transition-all text-left"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-800">
                    <img src={other?.photoURL} alt={other?.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  {other?.isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 text-[#F27D26]">
                      <BadgeCheck size={14} fill="white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{other?.displayName}</h4>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {m.lastMessage || 'Begin the conversation...'}
                  </p>
                </div>
                <div className="text-[10px] text-gray-600 uppercase tracking-tighter">
                  {new Date(m.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40 px-8">
           <MessageSquare size={40} />
           <p className="text-xs uppercase tracking-widest leading-loose">No active connections. <br/> Your mutuality awaits in Discovery.</p>
        </div>
      )}
    </div>
  );
}
