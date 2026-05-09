import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserProfile, Match } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, MapPin, ShieldCheck, Sparkles, Eye, User as UserIcon, Lock, Crown } from 'lucide-react';

interface DiscoveryProps {
  profile: UserProfile;
}

export default function Discovery({ profile }: DiscoveryProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchResult, setMatchResult] = useState<UserProfile | null>(null);
  const [showLimitReached, setShowLimitReached] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const path = 'users';
      try {
        const q = query(
          collection(db, 'users'),
          where('gender', '==', profile.interestedIn === 'all' ? 'female' : profile.interestedIn),
        );
        
        const snap = await getDocs(q);
        const fetched = snap.docs
          .map(d => d.data() as UserProfile)
          .filter(u => u.uid !== profile.uid);
        
        setUsers(fetched);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    };
    fetchUsers();
  }, [profile]);

  const handleSwipe = async (direction: 'left' | 'right') => {
    // Check limits for free users
    if (direction === 'right' && profile.subscriptionTier === 'free' && profile.swipeCount >= 10) {
      setShowLimitReached(true);
      return;
    }

    const targetUser = users[currentIndex];
    const matchId = [profile.uid, targetUser.uid].sort().join('_');
    const matchPath = `matches/${matchId}`;

    try {
      if (direction === 'right') {
        const matchRef = doc(db, 'matches', matchId);
        const matchSnap = await getDoc(matchRef);

        // Update current user's swipe count
        await updateDoc(doc(db, 'users', profile.uid), {
          swipeCount: increment(1),
          updatedAt: serverTimestamp()
        });

        if (matchSnap.exists()) {
          const matchData = matchSnap.data() as Match;
          if (matchData.likes[targetUser.uid]) {
            await updateDoc(matchRef, {
              [`likes.${profile.uid}`]: serverTimestamp(),
              isMutual: true,
              updatedAt: serverTimestamp()
            });
            setMatchResult(targetUser);
          }
        } else {
          await setDoc(matchRef, {
            users: [profile.uid, targetUser.uid],
            likes: { [profile.uid]: serverTimestamp() },
            isMutual: false,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, matchPath);
    }
    
    setCurrentIndex(currentIndex + 1);
  };

  if (loading) return null;

  const currentUserDisplay = users[currentIndex];

  return (
    <div className="h-full flex flex-col relative px-4 pt-4">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-serif">Discovery</h2>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Near {profile.neighborhood}</p>
        </div>
        <div className={`p-2 rounded-lg ${profile.subscriptionTier === 'executive' ? 'bg-purple-500/10 text-purple-400' : 'bg-[#F27D26]/10 text-[#F27D26]'}`}>
          {profile.subscriptionTier === 'executive' ? <Crown size={18} /> : <Sparkles size={18} />}
        </div>
      </header>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {showLimitReached ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-[#0a0a0a] rounded-[2rem] border border-[#F27D26]/20 flex flex-col items-center justify-center p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26]">
                <Lock size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif text-white">Daily Limit Reached</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  As a Standard professional, you have reached your daily interaction limit. Upgrade to maintain your presence without boundaries.
                </p>
              </div>
              <button 
                onClick={() => setShowLimitReached(false)}
                className="w-full bg-[#F27D26] text-black py-4 rounded-full font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#F27D26]/20"
              >
                Explore Tiers
              </button>
            </motion.div>
          ) : currentUserDisplay ? (
            <motion.div 
              key={currentUserDisplay.uid}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ x: 200, opacity: 0 }}
              className="absolute inset-0 bg-[#111] rounded-[2rem] overflow-hidden border border-white/5 flex flex-col"
            >
              <div className="relative flex-1 bg-gradient-to-b from-gray-800 to-black">
                {currentUserDisplay.photoURL ? (
                   <img 
                    src={currentUserDisplay.photoURL} 
                    className="w-full h-full object-cover opacity-80" 
                    alt={currentUserDisplay.displayName}
                    referrerPolicy="no-referrer"
                   />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#181818]">
                    <UserIcon size={80} className="opacity-10" />
                  </div>
                )}
                
                {/* Privacy Badge */}
                {currentUserDisplay.isVerified && (
                  <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 border border-white/20">
                    <ShieldCheck size={12} className="text-[#F27D26]" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Verified</span>
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black via-black/60 to-transparent">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-semibold flex items-center gap-2">
                      {currentUserDisplay.displayName}, {new Date().getFullYear() - new Date(currentUserDisplay.birthDate).getFullYear()}
                    </h3>
                    <div className="flex items-center gap-1 text-gray-400 text-xs text uppercase tracking-widest">
                       <MapPin size={12} />
                       {currentUserDisplay.neighborhood}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-300 line-clamp-2 leading-relaxed italic opacity-80">
                    "{currentUserDisplay.bio || 'Professional in Lagos.'}"
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 flex justify-around items-center bg-black/40">
                <button 
                  onClick={() => handleSwipe('left')}
                  className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-white/5 transition-all"
                >
                  <X size={24} />
                </button>
                <button 
                  onClick={() => handleSwipe('right')}
                  className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  <Heart size={24} fill="currentColor" />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-8">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-600">
                <Eye size={32} />
              </div>
              <h3 className="text-xl font-serif">Discovery Paused</h3>
              <p className="text-sm text-gray-500 leading-relaxed">We've shown you everyone in your immediate professional circle. Check back soon for new refined profiles.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Match Success Overlay */}
      <AnimatePresence>
        {matchResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
               initial={{ scale: 0.5 }}
               animate={{ scale: 1 }}
               className="space-y-4"
            >
              <h1 className="text-6xl font-serif italic text-[#F27D26]">A Match.</h1>
              <p className="text-sm uppercase tracking-[0.3em] font-medium text-white/60">Absolute Discretion Maintained</p>
            </motion.div>

            <div className="my-12 flex -space-x-4">
               <div className="w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-gray-900">
                 <img src={profile.photoURL} alt="Me" referrerPolicy="no-referrer" />
               </div>
               <div className="w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-gray-900">
                 <img src={matchResult.photoURL} alt="Matched" referrerPolicy="no-referrer" />
               </div>
            </div>

            <p className="max-w-xs text-sm text-gray-400 mb-10 leading-relaxed">
               You and {matchResult.displayName} have mutually expressed interest. Your identities are now visible to each other.
            </p>

            <button 
              onClick={() => setMatchResult(null)}
              className="w-full bg-white text-black py-4 rounded-full font-medium"
            >
              Express your Greetings
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

