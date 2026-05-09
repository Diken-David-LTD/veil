import React, { useState, useRef } from 'react';
import { UserProfile, SubscriptionTier } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, LogOut, CreditCard, ChevronRight, BadgeCheck, EyeOff, Lock, Camera, Loader2, Sparkles, Crown, Zap, Edit2, Check, X as CloseIcon } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ai, MODELS } from '../../lib/gemini';

interface ProfileViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

const TIER_DETAILS = {
  free: {
    label: 'Standard',
    icon: <ShieldCheck size={16} />,
    color: 'text-gray-400',
    benefits: ['10 Likes per day', 'Standard Verification', 'Basic Discovery']
  },
  premium: {
    label: 'Discreet Premium',
    icon: <Zap size={16} />,
    color: 'text-[#F27D26]',
    benefits: ['Unlimited Likes', 'Advanced Privacy', 'Verified-Only Filters', 'Priority Support']
  },
  executive: {
    label: 'Executive Stealth',
    icon: <Crown size={16} />,
    color: 'text-purple-400',
    benefits: ['All Premium Features', 'Ghost Mode Enabled', 'Dedicated Concierge', 'Stealth Discovery']
  }
};

export default function ProfileView({ profile, onLogout }: ProfileViewProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState(profile.bio || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Please select a file under 5MB.");
      return;
    }

    setIsUploading(true);
    const path = `profiles/${profile.uid}/avatar`;
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', profile.uid), {
        photoURL: downloadURL,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpgrade = async (tier: SubscriptionTier) => {
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        subscriptionTier: tier,
        updatedAt: serverTimestamp()
      });
      setShowUpgrade(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    }
  };

  const saveBio = async () => {
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        bio: tempBio,
        updatedAt: serverTimestamp()
      });
      setIsEditingBio(false);
      setSuggestions([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    }
  };

  const generateBio = async () => {
    setIsGenerating(true);
    try {
      const response = await ai.models.generateContent({
        model: MODELS.text,
        contents: `Refine this professional dating bio for ${profile.displayName} in ${profile.neighborhood}, Nigeria: "${tempBio}". 
        The tone should be sophisticated, mature, and intriguing. 
        Return 2 variations as a JSON array of strings only.`,
      });

      const text = response.text || '[]';
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setSuggestions(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error("AI Bio generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const startVerification = async () => {
    setIsVerifying(true);
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          verificationStatus: 'verified',
          isVerified: true,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
      }
      setIsVerifying(false);
    }, 3000);
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-8 overflow-y-auto pb-32">
       <header className="flex flex-col items-center pt-8 space-y-4">
         <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
           <div className={`w-32 h-32 rounded-full border-2 p-1 transition-all ${isUploading ? 'border-dashed animate-pulse' : 'border-[#F27D26]'}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-800 relative">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                     <Camera className="text-gray-600" size={32} />
                  </div>
                )}
                
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="text-white animate-spin" size={24} />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <Camera className="text-white" size={24} />
                </div>
              </div>
           </div>
           
           <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             accept="image/*" 
             onChange={handlePhotoUpload} 
           />

           {profile.isVerified && (
             <div className="absolute bottom-1 right-1 bg-white text-[#F27D26] rounded-full p-1 border-4 border-[#050505]">
                <BadgeCheck size={20} fill="currentColor" className="text-white" />
             </div>
           )}
         </div>
         <div className="text-center">
            <h3 className="text-2xl font-serif">{profile.displayName}</h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs text-gray-500 uppercase tracking-widest">{profile.neighborhood}</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span className={`text-[10px] uppercase tracking-widest font-bold ${TIER_DETAILS[profile.subscriptionTier].color}`}>
                {TIER_DETAILS[profile.subscriptionTier].label}
              </span>
            </div>
         </div>
       </header>

       <div className="space-y-6">
         {/* Bio Section */}
         <section className="bg-[#111] rounded-2xl p-5 border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">The Narrative</h4>
              {!isEditingBio ? (
                <button onClick={() => { setIsEditingBio(true); setTempBio(profile.bio || ''); }} className="text-[#F27D26] p-1">
                   <Edit2 size={14} />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                   <button onClick={saveBio} className="p-1 text-green-500"><Check size={16}/></button>
                   <button onClick={() => { setIsEditingBio(false); setSuggestions([]); }} className="p-1 text-red-500"><CloseIcon size={16}/></button>
                </div>
              )}
            </div>
            
            {isEditingBio ? (
              <div className="space-y-4">
                <textarea 
                  value={tempBio}
                  onChange={(e) => setTempBio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm focus:border-[#F27D26] outline-none min-h-[100px]"
                />
                <button 
                  onClick={generateBio}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#F27D26]/10 text-[#F27D26] text-[10px] uppercase tracking-widest font-bold rounded-xl hover:bg-[#F27D26]/20 transition-all border border-[#F27D26]/20"
                >
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Refine Narrative with AI
                </button>
                
                <AnimatePresence>
                  {suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pt-2"
                    >
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">AI Curation</p>
                      {suggestions.map((s, i) => (
                        <button 
                          key={i}
                          onClick={() => setTempBio(s)}
                          className="w-full text-left p-3 bg-white/5 border border-white/5 rounded-lg text-xs text-gray-400 hover:text-white transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <p className="text-sm text-gray-300 leading-relaxed italic">
                "{profile.bio || 'Your digital narrative is yet to be established.'}"
              </p>
            )}
         </section>

         {/* Subscription Card */}
         <section 
           onClick={() => setShowUpgrade(true)}
           className="bg-gradient-to-br from-[#1A1A1A] to-[#111] rounded-2xl p-5 border border-white/5 relative overflow-hidden cursor-pointer group"
         >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Elite Benefits</h4>
                <Sparkles size={14} className="text-[#F27D26]" />
              </div>
              <p className="text-sm font-medium">Upgrade to Executive Stealth</p>
              <p className="text-[10px] text-gray-400 leading-relaxed">Unlock Ghost Mode and unlimited interactions with Nigeria's highest echelon.</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
               <Crown size={120} />
            </div>
         </section>

         <section className="bg-[#111] rounded-2xl p-4 border border-white/5 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Privacy & Security</h4>
            
            <div className="flex items-center justify-between group cursor-pointer" onClick={() => !profile.isVerified && startVerification()}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#F27D26]/10 text-[#F27D26]">
                   <ShieldCheck size={18} />
                </div>
                <div>
                   <p className="text-sm font-medium">Identity Verification</p>
                   <p className="text-[10px] text-gray-500">
                     {profile.isVerified ? 'Verified Account' : 
                      profile.verificationStatus === 'pending' ? 'Verification Pending' : 'Action Required'}
                   </p>
                </div>
              </div>
              {!profile.isVerified && (
                <button 
                  disabled={isVerifying || profile.verificationStatus === 'pending'}
                  className="text-[10px] uppercase tracking-widest font-bold bg-white text-black px-4 py-2 rounded-full shadow-lg disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 
                   profile.verificationStatus === 'pending' ? 'Pending Review' : 'Verify'}
                </button>
              )}
            </div>

            <div className={`flex items-center justify-between transition-opacity ${profile.subscriptionTier !== 'executive' ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                   <EyeOff size={18} />
                </div>
                <p className="text-sm font-medium">Ghost Mode</p>
              </div>
              {profile.subscriptionTier !== 'executive' ? (
                <Lock size={14} />
              ) : (
                <div className="w-8 h-4 bg-[#F27D26]/20 rounded-full flex items-center px-1">
                   <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                </div>
              )}
            </div>
         </section>

         <section className="bg-[#111] rounded-2xl p-4 border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Preferences</h4>
              <button className="text-[10px] text-[#F27D26] uppercase tracking-widest font-bold">Update</button>
            </div>
            <div className="flex items-center justify-between py-1">
               <span className="text-sm text-gray-300">Interested in</span>
               <span className="text-xs text-[#F27D26] capitalize">{profile.interestedIn}</span>
            </div>
            <div className="flex items-center justify-between py-1">
               <span className="text-sm text-gray-300">Neighborhood</span>
               <span className="text-xs text-[#F27D26]">{profile.neighborhood}</span>
            </div>
         </section>

         <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-4 text-red-500 text-xs uppercase tracking-widest font-bold hover:bg-red-500/10 rounded-xl transition-all border border-red-500/10"
         >
           <LogOut size={16} />
           Terminate Session
         </button>
       </div>

       {/* Upgrade Modal */}
       <AnimatePresence>
         {showUpgrade && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-end"
           >
             <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               className="w-full bg-[#0a0a0a] rounded-t-[2.5rem] p-8 pb-12 space-y-8 max-h-[90vh] overflow-y-auto"
             >
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-serif italic">Elevate Status</h2>
                  <button onClick={() => setShowUpgrade(false)} className="p-2 bg-white/5 rounded-full text-gray-500">
                    <CloseIcon size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  {(['premium', 'executive'] as SubscriptionTier[]).map(tier => (
                    <button 
                      key={tier}
                      onClick={() => handleUpgrade(tier)}
                      className={`w-full p-6 bg-[#111] border rounded-3xl text-left transition-all ${profile.subscriptionTier === tier ? 'border-[#F27D26]' : 'border-white/5'}`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                         <div className={`p-2 rounded-xl bg-white/5 ${TIER_DETAILS[tier].color}`}>
                           {TIER_DETAILS[tier].icon}
                         </div>
                         <h4 className="font-semibold text-lg">{TIER_DETAILS[tier].label}</h4>
                      </div>
                      <ul className="space-y-2">
                        {TIER_DETAILS[tier].benefits.map((b, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-[#F27D26]" /> 
                            {b}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 flex justify-between items-end">
                         <p className="text-xs text-[#F27D26] uppercase tracking-widest font-bold">Nigeria's Standard</p>
                         <p className="text-xl font-serif italic">₦{tier === 'premium' ? '15,000' : '45,000'}<span className="text-xs font-sans not-italic text-gray-500">/mo</span></p>
                      </div>
                    </button>
                  ))}
                </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}


