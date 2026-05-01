import { useState } from 'react';
import { UserProfile } from '../../types';
import { motion } from 'motion/react';
import { ShieldCheck, LogOut, CreditCard, ChevronRight, BadgeCheck, EyeOff, Lock, Camera } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ProfileViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function ProfileView({ profile, onLogout }: ProfileViewProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  const startVerification = async () => {
    setIsVerifying(true);
    // Simulate verification process
    setTimeout(async () => {
      await updateDoc(doc(db, 'users', profile.uid), {
        verificationStatus: 'verified',
        isVerified: true,
        updatedAt: new Date().toISOString()
      });
      setIsVerifying(false);
    }, 3000);
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-8 overflow-y-auto pb-32">
       <header className="flex flex-col items-center pt-8 space-y-4">
         <div className="relative">
           <div className="w-32 h-32 rounded-full border-2 border-[#F27D26] p-1">
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-800">
                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
              </div>
           </div>
           {profile.isVerified && (
             <div className="absolute bottom-1 right-1 bg-white text-[#F27D26] rounded-full p-1 border-4 border-[#050505]">
                <BadgeCheck size={20} fill="currentColor" className="text-white" />
             </div>
           )}
         </div>
         <div className="text-center">
            <h3 className="text-2xl font-serif">{profile.displayName}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-widest">{profile.neighborhood}</p>
         </div>
       </header>

       <div className="space-y-4">
         <section className="bg-[#111] rounded-2xl p-4 border border-white/5 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Privacy & Security</h4>
            
            <div className="flex items-center justify-between group cursor-pointer" onClick={() => !profile.isVerified && startVerification()}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#F27D26]/10 text-[#F27D26]">
                   <ShieldCheck size={18} />
                </div>
                <div>
                   <p className="text-sm font-medium">Identity Verification</p>
                   <p className="text-[10px] text-gray-500">{profile.isVerified ? 'Verified Account' : 'Action Required'}</p>
                </div>
              </div>
              {!profile.isVerified && (
                <button 
                  disabled={isVerifying}
                  className="text-[10px] uppercase tracking-widest font-bold bg-white text-black px-4 py-2 rounded-full"
                >
                  {isVerifying ? 'Verifying...' : 'Verify'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                   <EyeOff size={18} />
                </div>
                <p className="text-sm font-medium">Ghost Mode</p>
              </div>
              <Lock size={14} />
            </div>
         </section>

         <section className="bg-[#111] rounded-2xl p-4 border border-white/5 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Preferences</h4>
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
          className="w-full flex items-center justify-center gap-2 p-4 text-red-500 text-xs uppercase tracking-widest font-bold hover:bg-red-500/10 rounded-xl transition-all"
         >
           <LogOut size={16} />
           Terminate Session
         </button>
       </div>
    </div>
  );
}
