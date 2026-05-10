import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, Match } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Lock } from 'lucide-react';

interface LikesViewProps {
  profile: UserProfile;
  onViewProfile?: (uid: string) => void;
}

export default function LikesView({ profile, onViewProfile }: LikesViewProps) {
  const [likesMe, setLikesMe] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLikesMe = async () => {
      try {
        const q = query(
          collection(db, 'matches'),
          where('users', 'array-contains', profile.uid),
          where('isMutual', '==', false)
        );
        const snap = await getDocs(q);
        const likerIds = snap.docs
          .map(d => d.data() as Match)
          .filter(m => m.likes && !m.likes[profile.uid]) // They liked me, but I haven't liked back
          .map(m => m.users.find(id => id !== profile.uid)!);

        if (likerIds.length > 0) {
          const userPromises = likerIds.map(id => getDoc(doc(db, 'users', id)));
          const userSnaps = await Promise.all(userPromises);
          setLikesMe(userSnaps.map(s => s.data() as UserProfile));
        }
      } catch (error) {
        console.error("Error fetching likes:", error);
      } finally {
        setLoading(false);
      }
    };
    if (profile.uid) fetchLikesMe();
  }, [profile.uid]);

  return (
    <div className="h-full flex flex-col px-4 pt-4 overflow-hidden">
      <header className="mb-6">
        <h2 className="text-2xl font-serif">Activity</h2>
        <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Refined Interest</p>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 h-full p-1">
             {[1,2,3,4].map(i => (
               <div key={i} className="aspect-[3/4] rounded-3xl bg-[#111] animate-pulse" />
             ))}
          </div>
        ) : likesMe.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-4 p-1"
          >
            {likesMe.map(liker => (
              <div 
                key={liker.uid}
                className="aspect-[3/4] relative rounded-3xl overflow-hidden border border-white/5 bg-[#111] group"
              >
                <img 
                  src={liker.photoURL} 
                  className={`w-full h-full object-cover transition-all duration-700 ${profile.subscriptionTier === 'free' ? 'blur-xl scale-110 grayscale brightness-75' : 'group-hover:scale-105'}`}
                  alt="Secret User"
                  referrerPolicy="no-referrer"
                />
                
                {profile.subscriptionTier === 'free' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black/20">
                    <Lock size={20} className="text-[#F27D26] mb-2" />
                    <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-white mb-4">Interested Member</p>
                    <button className="text-[8px] uppercase tracking-widest font-bold text-[#F27D26] bg-[#F27D26]/10 px-3 py-1.5 rounded-full border border-[#F27D26]/20">
                      Reveal Presence
                    </button>
                  </div>
                ) : (
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black to-transparent">
                    <p className="text-xs font-bold truncate">{liker.displayName}</p>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest">{liker.neighborhood}</p>
                    <button 
                      onClick={() => onViewProfile?.(liker.uid)}
                      className="mt-2 w-full py-1.5 bg-white text-black rounded-lg text-[8px] font-bold uppercase tracking-widest"
                    >
                      View Profile
                    </button>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-40">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Heart size={24} />
            </div>
            <h3 className="text-lg font-serif">Stillness in the Orbit</h3>
            <p className="text-xs italic">Your refined presence will naturally draw the right connections as the circle expands.</p>
          </div>
        )}
      </div>
    </div>
  );
}
