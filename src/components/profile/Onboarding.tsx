import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, User as UserIcon, ShieldCheck, Sparkles, Loader2, Camera, X } from 'lucide-react';
import { ai, MODELS } from '../../lib/gemini';

interface OnboardingProps {
  user: User;
  onComplete: (profile: UserProfile) => void;
}

const NEIGHBORHOODS = ['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Maitama', 'Asokoro', 'Wuse 2'];

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState('refined');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    bio: '',
    birthDate: '',
    gender: 'male',
    interestedIn: 'female',
    neighborhood: 'Victoria Island',
  });

  const handleIdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setVerificationError("ID file is too large. Please select a file under 10MB.");
        return;
      }
      setIdFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setIdPreview(reader.result as string);
      reader.readAsDataURL(file);
      setVerificationError(null);
    }
  };

  const handleProfilePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setVerificationError("Profile photo is too large. Please select a file under 5MB.");
        return;
      }
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
      setVerificationError(null);
    }
  };

  const verifyIdWithAI = async (idUrl: string, profileUrl: string) => {
    setIsVerifying(true);
    try {
      const response = await ai.models.generateContent({
        model: MODELS.text,
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Analyze these two images for a user named ${formData.displayName} who identifies as ${formData.gender}.
              Image 1: Government-issued Nigerian ID.
              Image 2: User's Profile Photo.
              
              Verify the following:
              1. Is the first image a valid Nigerian ID (NIN, DL, or Passport)?
              2. Does the face in the profile photo match the face on the ID?
              3. Does the person in both images visually match the selected gender (${formData.gender})?
              4. Can you read the name on the ID to check if it matches ${formData.displayName}?

              Return a JSON object only: 
              {
                "isLegit": boolean,
                "confidence": number (0-1),
                "reason": string,
                "detectedGender": "male" | "female" | "none",
                "facesMatch": boolean
              }` },
              { inlineData: { data: idUrl.split(',')[1], mimeType: 'image/jpeg' } },
              { inlineData: { data: profileUrl.split(',')[1], mimeType: 'image/jpeg' } }
            ]
          }
        ]
      });

      const text = response.text || '{}';
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());
      
      if (!result.isLegit) {
        setVerificationError(result.reason || "ID document could not be verified. Please ensure it is clear and legible.");
        return false;
      }

      if (!result.facesMatch && result.confidence > 0.8) {
        setVerificationError("Identity mismatch: The profile photo does not seem to match the provided ID.");
        return false;
      }

      if (result.detectedGender !== formData.gender && result.detectedGender !== 'none' && result.confidence > 0.8) {
        setVerificationError(`Integrity check failed: Selected gender (${formData.gender}) does not match ID analysis.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("AI Verification failed", error);
      return true; // Proceed to pending review if AI transiently fails
    } finally {
      setIsVerifying(false);
    }
  };

  const generateBio = async () => {
    if (!formData.displayName || !formData.neighborhood) return;
    setIsGenerating(true);
    setSuggestions([]);

    try {
      const response = await ai.models.generateContent({
        model: MODELS.text,
        contents: `Generate 3 short, professional dating bios for someone named ${formData.displayName} living in ${formData.neighborhood}, Nigeria. 
        Tone requirements: ${selectedTone}. 
        Audience: Premium professionals who value discretion and success.
        Length: Under 150 characters per bio. 
        Format: Return as a JSON array of strings only.`,
      });

      const text = response.text || '[]';
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setSuggestions(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error("Bio generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = async () => {
    if (!profilePhotoPreview) {
      setVerificationError("A profile photo is required to establish your aesthetic presence.");
      setStep(4);
      return;
    }

    if (!idPreview) {
      setVerificationError("Identity verification is mandatory for the Veil network.");
      setStep(5);
      return;
    }

    const age = new Date().getFullYear() - new Date(formData.birthDate).getFullYear();
    if (age < 30) {
      alert("VEIL is exclusively for those aged 30 and above.");
      return;
    }

    setIsVerifying(true);
    const aiVerified = await verifyIdWithAI(idPreview, profilePhotoPreview!);
    if (!aiVerified) {
      setIsVerifying(false);
      return;
    }

    setIsUploading(true);
    const path = `users/${user.uid}`;
    try {
      let photoURL = user.photoURL || '';
      let idURL = '';

      // Upload Profile Photo
      if (profilePhotoFile) {
        const photoRef = ref(storage, `profiles/${user.uid}/avatar`);
        await uploadBytes(photoRef, profilePhotoFile);
        photoURL = await getDownloadURL(photoRef);
      }

      // Upload ID Document
      if (idFile) {
        const idRef = ref(storage, `ids/${user.uid}/id_doc`);
        await uploadBytes(idRef, idFile);
        idURL = await getDownloadURL(idRef);
      }

      const profile: any = {
        uid: user.uid,
        ...formData,
        isVerified: false,
        verificationStatus: 'pending',
        subscriptionTier: 'free',
        swipeCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photoURL: photoURL || undefined,
        idURL: idURL || undefined,
      };

      await setDoc(doc(db, 'users', user.uid), profile);
      onComplete({
        ...profile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsUploading(false);
      setIsVerifying(false);
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
        <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Step {step} of 5</p>
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
               {[
                 { id: 'male', label: 'Gentleman', icon: <UserIcon size={18} /> },
                 { id: 'female', label: 'Lady', icon: <UserIcon size={18} /> }
               ].map(g => (
                <button 
                  key={g.id} 
                  onClick={() => setFormData({...formData, gender: g.id})}
                  className={`flex-1 p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-500 ${formData.gender === g.id ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-[#111] border-white/5 opacity-40 hover:opacity-100 hover:border-white/20'}`}
                >
                  <div className={`${formData.gender === g.id ? 'text-[#F27D26]' : 'text-gray-500'}`}>
                    {g.icon}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-bold">{g.label}</span>
                </button>
               ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Interested in</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'female', label: 'Ladies' },
                { id: 'male', label: 'Gentlemen' },
                { id: 'all', label: 'Both' }
              ].map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setFormData({...formData, interestedIn: opt.id})}
                  className={`p-4 rounded-xl border text-[10px] uppercase tracking-widest font-bold transition-all ${formData.interestedIn === opt.id ? 'bg-[#F27D26] text-black border-[#F27D26]' : 'bg-[#111] border-white/5 opacity-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-bold">Select Bio Character</label>
              <div className="flex flex-wrap gap-2">
                {['refined', 'ambitious', 'reserved', 'witty'].map(tone => (
                  <button
                    key={tone}
                    onClick={() => setSelectedTone(tone)}
                    className={`px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-all ${selectedTone === tone ? 'bg-[#F27D26] text-black border-[#F27D26]' : 'border-white/10 text-gray-500 hover:border-white/30'}`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-xs uppercase tracking-widest opacity-50">Professional Bio</label>
                <button 
                  onClick={generateBio}
                  disabled={isGenerating || !formData.displayName}
                  className="flex items-center gap-2 text-[10px] text-[#F27D26] uppercase tracking-widest font-bold hover:opacity-80 disabled:opacity-30 transition-all bg-[#F27D26]/10 px-3 py-1.5 rounded-lg"
                >
                  {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {isGenerating ? 'Curating...' : 'Refine with AI'}
                </button>
              </div>
              <textarea 
                rows={4}
                placeholder="Keep it brief and sophisticated..."
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none"
              />
            </div>
          </div>

          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#F27D26] font-bold">Refined Suggestions</p>
                {suggestions.map((s, i) => (
                  <button 
                    key={i}
                    onClick={() => setFormData({...formData, bio: s})}
                    className="w-full text-left p-4 bg-[#111] border border-white/5 rounded-xl text-xs text-gray-400 hover:border-[#F27D26]/50 hover:text-white transition-all leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-[#111] p-6 rounded-2xl border border-[#F27D26]/20 space-y-4">
            <div className="flex items-center gap-3 text-[#F27D26]">
               <ShieldCheck size={24} />
               <h3 className="font-medium text-xs uppercase tracking-widest">Mandatory Verification</h3>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed uppercase tracking-widest">
              Identity verification and a professional profile photo are required for all Veil members. You must provide these in the subsequent steps.
            </p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif italic text-white">Profile Aesthetic</h3>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Public Face of your Identity</p>
          </div>

          <div className="flex justify-center">
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('profile-photo-input')?.click()}>
              <div className={`w-48 h-48 rounded-full border-2 p-1 transition-all ${profilePhotoPreview ? 'border-[#F27D26]' : 'border-dashed border-white/10'}`}>
                <div className="w-full h-full rounded-full overflow-hidden bg-[#111] border border-white/5 relative flex items-center justify-center">
                  {profilePhotoPreview ? (
                    <img src={profilePhotoPreview} alt="Profile Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={48} className="text-gray-700 group-hover:text-[#F27D26] transition-colors" />
                  )}
                  
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="text-white" size={24} />
                  </div>
                </div>
              </div>
              <input 
                id="profile-photo-input"
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleProfilePhotoSelect} 
              />
            </div>
          </div>

          <div className="space-y-4 text-center">
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto italic">
              "Your choice of imagery speaks volumes in silence. Choose a professional, clear portrait."
            </p>
            {verificationError && step === 4 && (
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{verificationError}</p>
            )}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif italic text-white">Identity Integrity</h3>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Secure Document Port</p>
          </div>

          <div className="bg-[#111] border-2 border-dashed border-white/10 rounded-[2rem] p-8 text-center space-y-4 relative overflow-hidden group">
            {idPreview ? (
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <img src={idPreview} alt="ID Preview" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => { setIdPreview(null); setIdFile(null); }}
                     className="bg-red-500 p-3 rounded-full shadow-lg transform hover:scale-110 transition-all"
                   >
                     <X size={20} />
                   </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block space-y-4 py-8">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto group-hover:bg-[#F27D26]/10 transition-all duration-500 border border-white/5">
                  <Camera size={32} className="text-gray-500 group-hover:text-[#F27D26]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-300">Upload Government ID</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">NIN • Passport • Driver's License</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleIdSelect} />
              </label>
            )}
          </div>

          {verificationError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 items-start"
            >
               <ShieldCheck className="text-red-500 shrink-0" size={18} />
               <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider leading-relaxed">{verificationError}</p>
            </motion.div>
          )}

          <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3 text-gray-400">
               <ShieldCheck size={24} />
               <p className="text-[10px] uppercase tracking-widest font-bold">Discretion Policy</p>
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed uppercase tracking-[0.15em]">
              Your ID data is encrypted at rest and never shared. We utilize AI-driven validation followed by a final manual review by our high-level concierge team.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            disabled={isVerifying || isUploading}
            className="flex-1 bg-white/5 border border-white/10 py-4 rounded-full font-medium shadow-sm transition-all disabled:opacity-20"
          >
            Back
          </button>
        )}
        <button 
          onClick={async () => {
            if (step < 5) setStep(step + 1);
            else await handleComplete();
          }}
          disabled={isVerifying || isUploading}
          className="flex-[2] bg-white text-black py-4 rounded-full font-medium shadow-xl hover:bg-gray-100 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {(isVerifying || isUploading) && <Loader2 size={16} className="animate-spin" />}
          {step === 5 ? (isVerifying || isUploading ? 'Authenticating...' : 'Establish Integrity') : 'Continue'}
        </button>
      </div>
    </motion.div>
  );
}
