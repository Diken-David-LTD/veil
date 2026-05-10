import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserProfile, Match } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, MapPin, ShieldCheck, Sparkles, Eye, User as UserIcon, Lock, Crown, SlidersHorizontal, Check, AlertCircle } from 'lucide-react';
import { ai, MODELS } from '../../lib/gemini';
import { calculateAge } from '../../lib/utils';
import { REFINED_INTERESTS } from '../profile/InterestsPicker';

interface DiscoveryProps {
  profile: UserProfile;
}

export default function Discovery({ profile }: DiscoveryProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchResult, setMatchResult] = useState<UserProfile | null>(null);
  const [aiIntro, setAiIntro] = useState<string | null>(null);

  const isPremium = profile.subscriptionTier === 'premium' || profile.subscriptionTier === 'executive';
  const currentUserDisplay = users[currentIndex];

  useEffect(() => {
    const generateAiIntro = async () => {
      if (!isPremium || !currentUserDisplay) return;
      
      try {
        const response = await ai.models.generateContent({
          model: MODELS.text,
          contents: `Our premium user ${profile.displayName} is viewing ${currentUserDisplay.displayName}. ${profile.displayName} is interested in ${profile.interests.join(', ')}. ${currentUserDisplay.displayName} is interested in ${currentUserDisplay.interests.join(', ')}. Generate a one-sentence elite icebreaker about their shared interests. Be extremely classy and brief.`,
        });
        setAiIntro(response.text);
      } catch (err) {
        console.error("AI Intro failed", err);
      }
    };
    generateAiIntro();
  }, [currentUserDisplay?.uid, isPremium, profile.displayName, profile.interests]);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [ageRange, setAgeRange] = useState({ min: 30, max: 55 });
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const path = 'users';
      try {
        const q = query(
          collection(db, 'users'),
          where('gender', '==', profile.interestedIn === 'all' ? 'female' : profile.interestedIn),
        );
        
        const snap = await getDocs(q);
        const fetched = snap.docs
          .map(d => d.data() as UserProfile)
          .filter(u => {
            const age = calculateAge(u.birthDate);
            const matchesAge = u.uid !== profile.uid && age >= ageRange.min && age <= ageRange.max;
            
            // Apply Advanced Filters ( respecting subscription tier if needed, 
            // but usually we let them toggle and then show results or a prompt)
            
            // Only apply advanced filters for paying members
            const isPremium = profile.subscriptionTier === 'premium' || profile.subscriptionTier === 'executive';
            
            let matchesFilters = true;
            if (isPremium) {
              if (verifiedOnly && !u.isVerified) matchesFilters = false;
              if (selectedInterests.length > 0) {
                const sharedInterests = u.interests?.filter(i => selectedInterests.includes(i)) || [];
                if (sharedInterests.length === 0) matchesFilters = false;
              }
            }

            return matchesAge && matchesFilters;
          });
        
        // AI Matchmaking Logic for Premium/Executive Users
        if ((profile.subscriptionTier === 'premium' || profile.subscriptionTier === 'executive') && fetched.length > 5) {
          try {
            const candidates = fetched.slice(0, 15).map(u => ({
              uid: u.uid,
              bio: u.bio || '',
              interests: u.interests || [],
              persona: u.desiredPersona || 'professional'
            }));

            const response = await ai.models.generateContent({
              model: MODELS.text,
              contents: [{
                role: 'user',
                parts: [{
                  text: `Compare this user:
                  - Bio: ${profile.bio}
                  - Interests: ${profile.interests?.join(', ')}
                  - Persona: ${profile.desiredPersona}
                  
                  To these candidates:
                  ${JSON.stringify(candidates)}
                  
                  Rank the candidates (return ONLY an array of UIDs) from most compatible to least compatible based on professional synergy, shared prestige interests (like Yachting, Philanthropy, Angel Investing), and persona alignment.`
                }]
              }]
            });

            const text = response.text || '[]';
            try {
              const rankedUids = JSON.parse(text.replace(/```json|```/g, '').trim() || '[]');
              if (Array.isArray(rankedUids)) {
                fetched.sort((a, b) => {
                  const indexA = rankedUids.indexOf(a.uid);
                  const indexB = rankedUids.indexOf(b.uid);
                  if (indexA === -1 && indexB === -1) return 0;
                  if (indexA === -1) return 1;
                  if (indexB === -1) return -1;
                  return indexA - indexB;
                });
              }
            } catch (err) {
              console.error("Failed to parse AI ranking", err);
            }
          } catch (aiErr) {
            console.error("AI Ranking failed, falling back to default order", aiErr);
          }
        }

        setUsers(fetched);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    };
    fetchUsers();
  }, [profile, ageRange, verifiedOnly, selectedInterests]);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    // Check limits for free users
    if (direction === 'right' && profile.subscriptionTier === 'free' && profile.swipeCount >= 10) {
      setShowLimitReached(true);
      return;
    }

    const matchId = [profile.uid, currentUserDisplay.uid].sort().join('_');
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
          if (matchData.likes[currentUserDisplay.uid]) {
            await updateDoc(matchRef, {
              [`likes.${profile.uid}`]: serverTimestamp(),
              isMutual: true,
              updatedAt: serverTimestamp()
            });
            setMatchResult(currentUserDisplay);
          }
        } else {
          await setDoc(matchRef, {
            users: [profile.uid, currentUserDisplay.uid],
            likes: { [profile.uid]: serverTimestamp() },
            isMutual: false,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, matchPath);
    }
    
    setAiIntro(null);
    setCurrentIndex(prev => prev + 1);
  };

  if (loading) return null;

  return (
    <div className="h-full flex flex-col relative px-4 pt-4">
      <header className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-serif">Discovery</h2>
          <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Exclusive Circle</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-[#F27D26] text-black' : 'bg-white/5 text-gray-400'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
          <div className={`p-2 rounded-lg ${profile.subscriptionTier === 'executive' ? 'bg-purple-500/10 text-purple-400' : 'bg-[#F27D26]/10 text-[#F27D26]'}`}>
            {profile.subscriptionTier === 'executive' ? <Crown size={18} /> : <Sparkles size={18} />}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 bg-[#111] rounded-2xl border border-white/5 p-5 overflow-hidden shadow-2xl"
          >
            <div className="space-y-6">
              {/* Age Filter */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Age Range Preference</span>
                  <span className="text-xs font-bold text-[#F27D26]">{ageRange.min} - {ageRange.max}</span>
                </div>
                <div className="space-y-4 px-2">
                  <input 
                    type="range" 
                    min="30" 
                    max="100" 
                    value={ageRange.max}
                    onChange={(e) => setAgeRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
                    className="w-full accent-[#F27D26]"
                  />
                  <div className="flex justify-between text-[8px] text-gray-600 uppercase tracking-tighter">
                    <span>30 Years</span>
                    <span>Distinguished (100+)</span>
                  </div>
                </div>
              </div>

              {/* Advanced Filters Section */}
              <div className="pt-4 border-t border-white/5 space-y-6">
                 {/* Verification Toggle */}
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Verified Only</span>
                       {!isPremium && <Crown size={12} className="text-[#F27D26]" />}
                    </div>
                    <button 
                      onClick={() => isPremium ? setVerifiedOnly(!verifiedOnly) : null}
                      className={`w-10 h-5 rounded-full transition-all relative ${!isPremium ? 'opacity-50 cursor-not-allowed' : ''} ${verifiedOnly ? 'bg-[#F27D26]' : 'bg-white/10'}`}
                    >
                      <motion.div 
                        initial={false}
                        animate={{ x: verifiedOnly ? 20 : 2 }}
                        className="absolute top-1 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
                      />
                    </button>
                 </div>

                 {/* Interests Filter */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Interest Filtering</span>
                          {!isPremium && <Crown size={12} className="text-[#F27D26]" />}
                       </div>
                       {selectedInterests.length > 0 && isPremium && (
                         <button 
                           onClick={() => setSelectedInterests([])}
                           className="text-[8px] uppercase tracking-widest text-[#F27D26] font-bold"
                         >
                           Reset
                         </button>
                       )}
                    </div>
                    <div className={`flex flex-wrap gap-2 ${!isPremium ? 'opacity-30 pointer-events-none' : ''}`}>
                       {REFINED_INTERESTS.slice(0, 8).map(interest => {
                         const isSelected = selectedInterests.includes(interest);
                         return (
                           <button
                             key={interest}
                             onClick={() => toggleInterest(interest)}
                             className={`px-3 py-1.5 rounded-full text-[9px] transition-all border ${
                               isSelected 
                                 ? 'bg-[#F27D26] text-black border-[#F27D26]' 
                                 : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                             }`}
                           >
                              <div className="flex items-center gap-1.5">
                                {interest}
                                {isSelected && <Check size={10} />}
                              </div>
                           </button>
                         )
                       })}
                       {REFINED_INTERESTS.length > 8 && <span className="text-[10px] text-gray-600 flex items-center px-2">...</span>}
                    </div>
                    
                    {!isPremium && (
                      <div className="p-3 bg-[#F27D26]/5 rounded-xl border border-[#F27D26]/10 flex items-center gap-3">
                         <Crown size={14} className="text-[#F27D26] shrink-0" />
                         <p className="text-[9px] text-gray-400 leading-tight">
                           Interest-based targeting and Verified filters are exclusive to <span className="text-[#F27D26] font-bold">Premium</span> members.
                         </p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {showLimitReached ? (
            <motion.div 
              key="limit"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-[#0a0a0a] rounded-[2rem] border border-[#F27D26]/20 flex flex-col items-center justify-center p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26]">
                <Lock size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif text-white">Daily Threshold Attained</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  As an esteemed Standard member, you've completed your daily curation. Sustain your presence without limits by exploring our higher tiers.
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
                
                {currentUserDisplay.isVerified && (
                  <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 border border-white/20">
                    <ShieldCheck size={12} className="text-[#F27D26]" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Verified</span>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/60 to-transparent">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-semibold flex items-center gap-2">
                        {currentUserDisplay.displayName}{currentUserDisplay.privacySettings?.showAge !== false ? `, ${new Date().getFullYear() - new Date(currentUserDisplay.birthDate).getFullYear()}` : ''}
                      </h3>
                      <div className="flex items-center gap-1 text-gray-400 text-xs text uppercase tracking-widest font-medium">
                         <MapPin size={10} />
                         {currentUserDisplay.privacySettings?.showNeighborhood !== false ? currentUserDisplay.neighborhood : 'Disclosed on Match'}
                      </div>
                    </div>
                    
                    {/* Compatibility Score */}
                    {profile.interests && currentUserDisplay.interests && (
                      <div className="bg-[#F27D26]/20 backdrop-blur-md px-3 py-2 rounded-2xl border border-[#F27D26]/30 flex flex-col items-center min-w-[50px]">
                        <span className="text-[10px] text-[#F27D26] font-bold leading-none mb-1">Match</span>
                        <span className="text-lg font-serif text-white leading-none">
                          {Math.round((currentUserDisplay.interests.filter(i => profile.interests.includes(i)).length / REFINED_INTERESTS.length) * 100 + 40)}%
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <p className="mt-3 text-sm text-gray-300 line-clamp-2 leading-relaxed italic opacity-80">
                    "{currentUserDisplay.privacySettings?.showBio !== false ? (currentUserDisplay.bio || 'Saying hello from Lagos.') : 'Keeping things private for now.'}"
                  </p>

                  {/* AI Icebreaker */}
                  {aiIntro && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={10} className="text-[#F27D26]" />
                        <span className="text-[8px] uppercase tracking-widest text-[#F27D26] font-bold">Elite Icebreaker</span>
                      </div>
                      <p className="text-[10px] text-white/80 leading-relaxed italic">"{aiIntro}"</p>
                    </motion.div>
                  )}
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentUserDisplay.interests?.slice(0, 3).map(i => (
                      <span key={i} className="text-[8px] uppercase tracking-widest bg-white/5 px-2 py-1 rounded-full border border-white/10 text-gray-400">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-around items-center bg-black/40">
                <button 
                  onClick={() => handleSwipe('left')}
                  className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-gray-500 hover:bg-white/5 transition-all"
                  title="Dismiss"
                >
                  <X size={20} />
                </button>
                <button 
                  onClick={() => handleSwipe('right')}
                  className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                  title="Interested"
                >
                  <Heart size={24} fill="currentColor" />
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Should we bring this profile to the attention of our integrity council? We take these matters with the utmost gravity.")) {
                      window.alert("Concern Received: Our internal circle will review this presence with the utmost gravity. Your discretion is our promise.");
                      handleSwipe('left');
                    }
                  }}
                  className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-gray-700 hover:bg-red-500/10 hover:text-red-500/60 transition-all"
                  title="Report"
                >
                  <AlertCircle size={20} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-8">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-600">
                <Eye size={32} />
              </div>
              <h3 className="text-xl font-serif">Momentary Stillness</h3>
              <p className="text-sm text-gray-500 leading-relaxed">We've navigated through your immediate professional orbit. Allow the circle to expand as new refined profiles join our registry.</p>
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

