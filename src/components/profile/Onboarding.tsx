import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, User as UserIcon, ShieldCheck, Sparkles, Loader2, Camera, X, Check } from 'lucide-react';
import { ai, MODELS } from '../../lib/gemini';
import { calculateAge } from '../../lib/utils';
import InterestsPicker from './InterestsPicker';

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
  const [isConciergeLoading, setIsConciergeLoading] = useState(false);
  const [conciergeStrategy, setConciergeStrategy] = useState<string | null>(null);
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
    professionalBackground: '',
    desiredPersona: 'enigmatic',
    interests: [] as string[],
  });

  const consultConcierge = async () => {
    if (!formData.professionalBackground) return;
    setIsConciergeLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: MODELS.text,
        contents: `As the 'Veil Concierge', a high-end matchmaker for Nigerian elites, provide a 2-sentence exclusive profile strategy for ${formData.displayName}. 
        Professional Context: ${formData.professionalBackground}. 
        Desired Persona: ${formData.desiredPersona}. 
        Location: ${formData.neighborhood}.
        Keep it sharp, sophisticated, and encouraging. Focus on standing out in a discreet professional network.`,
      });
      setConciergeStrategy(response.text);
    } catch (error) {
      console.error("Concierge consultation failed", error);
    } finally {
      setIsConciergeLoading(false);
    }
  };

  const handleIdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setVerificationError("Digital Weight: Your document carries a bit too much data. A more concise image (under 10MB), please.");
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
        setVerificationError("Luminous Limit: Your portrait exceeds our aesthetic data limit. A more refined, lighter file (under 5MB) is needed.");
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
    setVerificationError(null);
    try {
      const idMime = idUrl.split(':')[1]?.split(';')[0] || 'image/jpeg';
      const profileMime = profileUrl.split(':')[1]?.split(';')[0] || 'image/jpeg';

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
              { inlineData: { data: idUrl.split(',')[1], mimeType: idMime } },
              { inlineData: { data: profileUrl.split(',')[1], mimeType: profileMime } }
            ]
          }
        ]
      });
      const text = response.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        
        if (!result.isLegit) {
          setVerificationError(result.reason || "Clarity Breach: Our systems found your document elusive. A clearer, more illuminated capture will do.");
          return false;
        }

        if (!result.facesMatch && result.confidence > 0.8) {
          setVerificationError("Persona Mismatch: Our refinement scan detected a slight variance between your ID and portrait. Integrity is our foundation.");
          return false;
        }

        if (result.detectedGender !== formData.gender && result.detectedGender !== 'none' && result.confidence > 0.8) {
          setVerificationError(`Integrity Pause: Your self-identified gender and our document analysis are out of sync. Accuracy is elegance.`);
          return false;
        }

        return true;
      } catch (parseError) {
        console.error("AI Response Parsing failed", parseError);
        return true; // Fallback
      }
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
        Background: ${formData.professionalBackground || 'High-level professional'}.
        Desired Persona: ${formData.desiredPersona}.
        Current Bio/Notes: ${formData.bio || 'New user'}.
        Tone requirements: ${selectedTone}. 
        Audience: Premium professionals who value discretion and success.
        Length: Under 150 characters per bio. 
        Format: Return as a JSON array of strings only.`,
      });

      const text = response.text || '[]';
      try {
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        setSuggestions(Array.isArray(parsed) ? parsed : []);
      } catch (parseErr) {
        console.error("Bio parsing failed", parseErr);
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Bio generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = async () => {
    if (!profilePhotoPreview) {
      setVerificationError("Portrait Missing: The inner circle values a strong aesthetic presence. A photo is essential.");
      setStep(4);
      return;
    }

    if (!idPreview) {
      setVerificationError("Clearance Required: To maintain the highest integrity, we require a pulse on your identification.");
      setStep(5);
      return;
    }

    const age = calculateAge(formData.birthDate);
    if (age < 30) {
      setVerificationError("Seasoned Presence: VEIL is a curated circle reserved for those thirty and above, where every story has weight.");
      setStep(1);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    try {
      const aiVerified = await verifyIdWithAI(idPreview, profilePhotoPreview!);
      if (!aiVerified) {
        setIsVerifying(false);
        return;
      }

      setIsUploading(true);
      const path = `users/${user.uid}`;
      
      let photoURL = user.photoURL || '';
      let idURL = '';

      // Upload Profile Photo
      if (profilePhotoPreview) {
        try {
          const photoRef = ref(storage, `profiles/${user.uid}/avatar`);
          await uploadString(photoRef, profilePhotoPreview, 'data_url');
          photoURL = await getDownloadURL(photoRef);
        } catch (storageErr) {
          console.error("Profile photo upload failed", storageErr);
          setVerificationError("Aesthetic Transfer Interrupted: Our portrait vault is experiencing connectivity issues. Please ensure your connection is stable and try again.");
          setIsUploading(false);
          setIsVerifying(false);
          return;
        }
      }

      // Upload ID Document
      if (idPreview) {
        try {
          const idRef = ref(storage, `ids/${user.uid}/id_doc`);
          await uploadString(idRef, idPreview, 'data_url');
          idURL = await getDownloadURL(idRef);
        } catch (storageErr) {
          console.error("ID upload failed", storageErr);
          setVerificationError("Integrity Transfer Interrupted: Our secure document vault is momentarily unreachable. Please try again.");
          setIsUploading(false);
          setIsVerifying(false);
          return;
        }
      }

      const profile: any = {
        uid: user.uid,
        ...formData,
        birthDate: formData.birthDate.includes('T') ? formData.birthDate : `${formData.birthDate}T00:00:00Z`,
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
    } catch (error: any) {
      console.error("Signup failed", error);
      const errorMessage = error?.message || "Momentary Static: Something slightly off-script happened during your initiation.";
      setVerificationError(errorMessage);
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
        <h1 className="text-3xl font-serif">Hello there. Let's get started.</h1>
      </header>

      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Your full name</label>
            <input 
              type="text" 
              value={formData.displayName}
              onChange={e => setFormData({...formData, displayName: e.target.value})}
              placeholder="e.g. David Diken"
              className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none transition-all placeholder:text-gray-700"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-50">Birthday (must be 30+)</label>
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

          <div className="pt-4 border-t border-white/5">
            <InterestsPicker 
              selected={formData.interests} 
              onChange={(interests) => setFormData({...formData, interests})} 
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="bg-[#111] p-6 rounded-2xl border border-[#F27D26]/20 space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#F27D26]">
                  <Sparkles size={20} />
                  <h3 className="font-medium text-[10px] uppercase tracking-widest">Veil AI Concierge</h3>
                </div>
                <button 
                  onClick={consultConcierge}
                  disabled={isConciergeLoading || !formData.professionalBackground}
                  className="text-[10px] text-[#F27D26] uppercase tracking-widest font-bold hover:opacity-80 disabled:opacity-30"
                >
                  {isConciergeLoading ? <Loader2 size={12} className="animate-spin" /> : 'Get Strategy'}
                </button>
              </div>
              
              <AnimatePresence mode="wait">
                {conciergeStrategy ? (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] text-gray-400 italic leading-relaxed"
                  >
                    "{conciergeStrategy}"
                  </motion.p>
                ) : (
                  <p className="text-[10px] text-gray-500 leading-relaxed uppercase tracking-wider">
                    Provide your professional background below for an personalized profile strategy.
                  </p>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-50">Professional Background</label>
                <input 
                  type="text" 
                  placeholder="Tell us what you do, e.g. Designer, Founder, Lawyer..."
                  value={formData.professionalBackground}
                  onChange={e => setFormData({...formData, professionalBackground: e.target.value})}
                  className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none placeholder:opacity-20 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-50">Desired Persona</label>
                <select 
                  value={formData.desiredPersona}
                  onChange={e => setFormData({...formData, desiredPersona: e.target.value})}
                  className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none text-sm"
                >
                  <option value="enigmatic">Enigmatic & Powerful</option>
                  <option value="warm">Warm & Charismatic Leader</option>
                  <option value="intellectual">Authentic & Intellectual</option>
                  <option value="adventurous">Dynamic & Adventurous</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/5">
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
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-widest opacity-50">Professional Bio</label>
                {suggestions.length > 0 && (
                  <button 
                    onClick={generateBio}
                    disabled={isGenerating}
                    className="flex items-center gap-1 text-[10px] text-[#F27D26] uppercase tracking-widest font-bold hover:opacity-80 disabled:opacity-30"
                  >
                    {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    Regenerate
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea 
                  rows={4}
                  placeholder="Keep it brief and sophisticated..."
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  className="w-full bg-[#111] border border-white/10 p-4 rounded-xl focus:border-[#F27D26] outline-none pr-12"
                />
                <button 
                  onClick={generateBio}
                  disabled={isGenerating || !formData.displayName}
                  className="absolute top-4 right-4 text-[#F27D26] hover:scale-110 transition-transform disabled:opacity-30"
                  title="Generate with AI"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                </button>
              </div>
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
               <h3 className="font-medium text-xs uppercase tracking-widest">Keeping it safe</h3>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed uppercase tracking-widest">
              To keep our community high-quality, we ask for a quick identity check and a friendly profile photo in the next steps.
            </p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif italic text-white">Your Profile Photo</h3>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">How others will see you</p>
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
            <h3 className="text-xl font-serif italic text-white">Member Safety</h3>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Making sure it's really you</p>
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
                  <p className="text-sm font-medium text-gray-300">Snap a Photo of your ID</p>
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
               <p className="text-[10px] uppercase tracking-widest font-bold">Your Privacy Matters</p>
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed uppercase tracking-[0.15em]">
              We take your privacy seriously. Your ID is only used for a one-time verification by our trusted team to ensure everyone here is who they say they are.
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
          {step === 5 ? (isVerifying || isUploading ? 'Signing you up...' : 'Join the Community') : 'Continue'}
        </button>
      </div>
    </motion.div>
  );
}
