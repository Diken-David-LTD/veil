import { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { motion } from 'motion/react';
import { MapPin, Calendar, User as UserIcon, ShieldCheck } from 'lucide-react';

interface OnboardingProps {
  user: User;
  onComplete: (profile: UserProfile) => void;
}

const NEIGHBORHOODS = ['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Maitama', 'Asokoro', 'Wuse 2'];

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    bio: '',
    birthDate: '',
    gender: 'male',
    interestedIn: 'female',
    neighborhood: 'Victoria Island',
  });

  const handleComplete = async () => {
    const age = new Date().getFullYear() - new Date(formData.birthDate).getFullYear();
    if (age < 30) {
      alert("VEIL is exclusively for those aged 30 and above.");
      return;
    }

    const path = `users/${user.uid}`;
    try {
      const profile: any = {
        uid: user.uid,
        ...formData,
        isVerified: false,
        verificationStatus: 'none',
        subscriptionTier: 'free',
        swipeCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photoURL: user.photoURL || undefined,
      };

      await setDoc(doc(db, 'users', user.uid), profile);
      // For immediate frontend update, we'll use local dates since serverTimestamp isn't a string immediately
      onComplete({
        ...profile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#050505] p-6 space-y-8 overflow-y-auto pb-32"
    >
      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Step {step} of 3</p>
        <h1 className="text-3xl font-serif">Curating your Presence</h1>
      </header>

      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Professional Name</label>
            <input 
              type="text" 
              value={formData.displayName}
              onChange={e => setFormData({...formData, displayName: e.target.value})}
              className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Date of Birth (30+ requirement)</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30" />
              <input 
                type="date" 
                value={formData.birthDate}
                onChange={e => setFormData({...formData, birthDate: e.target.value})}
                className="w-full bg-[#111] border border-white/10 p-4 pl-12 rounded-xl focus:border-[#F27D26] outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Neighborhood (Lagos/Abuja)</label>
            <div className="grid grid-cols-2 gap-2">
              {NEIGHBORHOODS.map(n => (
                <button 
                  key={n}
                  onClick={() => setFormData({...formData, neighborhood: n})}
                  className={`p-3 text-xs rounded-lg border transition-all ${formData.neighborhood === n ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 opacity-60'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Identity & Interest</label>
            <div className="flex gap-4">
               {['male', 'female'].map(g => (
                <button 
                  key={g} 
                  onClick={() => setFormData({...formData, gender: g})}
                  className={`flex-1 p-4 rounded-xl border capitalize ${formData.gender === g ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 opacity-50'}`}
                >
                  {g}
                </button>
               ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Interested in</label>
            <select 
              value={formData.interestedIn}
              onChange={e => setFormData({...formData, interestedIn: e.target.value})}
              className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none"
            >
              <option value="female">Women</option>
              <option value="male">Men</option>
              <option value="all">Everyone</option>
            </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Professional Bio</label>
            <textarea 
              rows={4}
              placeholder="Keep it brief and sophisticated..."
              value={formData.bio}
              onChange={e => setFormData({...formData, bio: e.target.value})}
              className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none"
            />
          </div>

          <div className="bg-[#111] p-6 rounded-2xl border border-[#F27D26]/20 space-y-4">
            <div className="flex items-center gap-3 text-[#F27D26]">
               <ShieldCheck size={24} />
               <h3 className="font-medium">Mandatory Accountability</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              By joining Veil, you agree to our verification process. You will be able to browse initially, but messaging requires a Government ID check.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="flex-1 bg-white/5 border border-white/10 py-4 rounded-full font-medium"
          >
            Back
          </button>
        )}
        <button 
          onClick={() => step < 3 ? setStep(step + 1) : handleComplete()}
          className="flex-[2] bg-white text-black py-4 rounded-full font-medium shadow-xl"
        >
          {step === 3 ? 'Establish Presence' : 'Continue'}
        </button>
      </div>
    </motion.div>
  );
}
