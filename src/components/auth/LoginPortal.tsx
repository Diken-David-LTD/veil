import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Mail, Lock, Loader2, ArrowRight, ArrowLeft, Key, Check, UserPlus, Sparkles } from 'lucide-react';

interface LoginPortalProps {
  onLoginStart: () => void;
  onLoginEnd: () => void;
}

type AuthStep = 'email' | 'password' | 'register' | 'forgot';

export default function LoginPortal({ onLoginStart, onLoginEnd }: LoginPortalProps) {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSocialAuth = async (providerName: 'google') => {
    setLoading(true);
    setError(null);
    onLoginStart();
    
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(`Secure Entry Disabled: Google authentication isn't active for this gateway.`);
      } else {
        setError(`Gateway Pause: We encountered a slight delay in your elite entry. Please try once more.`);
      }
    } finally {
      setLoading(false);
      onLoginEnd();
    }
  };

  const handleAnonymousAuth = async () => {
    setLoading(true);
    setError(null);
    onLoginStart();
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Anonymous Entry Restricted: This gateway requires dedicated identification.');
      } else {
        setError('Shadow Error: Our guest entry system is momentarily obscured.');
      }
    } finally {
      setLoading(false);
      onLoginEnd();
    }
  };

  const handlePrototypeEntry = async () => {
    setLoading(true);
    setError(null);
    onLoginStart();
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      // Create a mock profile that is already verified to bypass onboarding
      const profileRef = doc(db, 'users', user.uid);
      await setDoc(profileRef, {
        uid: user.uid,
        displayName: 'Architect Alpha',
        title: 'Lead Product Designer',
        company: 'Vanguard Studios',
        neighborhood: 'Ikoyi, Lagos',
        gender: 'male',
        interestedIn: 'all',
        birthDate: '1990-01-01T00:00:00Z',
        bio: 'Exploring the intersections of high-end aesthetics and digital architecture. Here for refined connections and elite synergy.',
        interests: ['Angel Investing', 'Yachting', 'Modern Architecture', 'Philanthropy'],
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
        isVerified: true,
        verificationStatus: 'verified',
        subscriptionTier: 'executive',
        swipeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error(err);
      setError('Prototype Entry Failed: The circle is closed for maintenance.');
    } finally {
      setLoading(false);
      onLoginEnd();
    }
  };

  const handleEmailNext = () => {
    if (!email) return;
    setError(null);
    // In a real app we might check if user exists via auth.fetchSignInMethodsForEmail(email)
    // For simplicity, we just proceed to password or register depending on user intent
    setStep('password');
  };

  const handleAuth = async (isRegister: boolean) => {
    setLoading(true);
    setError(null);
    onLoginStart();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Credentials Gateway Closed: This method of entry is currently being refined.');
      } else {
        const isUserNotFound = err.message.includes('auth/user-not-found') || err.message.includes('auth/invalid-credential');
        setError(isUserNotFound ? "Identity Not Found: We couldn't locate your profile in the inner circle. Join us?" : "Access Denied: Your credentials don't match our refined registry.");
        if (isUserNotFound) setStep('register');
      }
    } finally {
      setLoading(false);
      onLoginEnd();
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Reset link sent to your inbox.');
      setTimeout(() => setStep('password'), 3000);
    } catch (err: any) {
      setError("Delivery Interrupted: We couldn't dispatch the recovery link. Is the email correct?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#F27D26]/30 to-transparent" />
      
      <header className="space-y-4 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-white/5 text-[#F27D26]">
          <Shield size={32} />
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-serif italic">Welcome Back</h2>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Connecting Nigeria's Finest</p>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="space-y-6"
        >
          {step === 'email' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Your Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input 
                    type="email" 
                    placeholder="name@firm.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-2xl focus:border-[#F27D26] outline-none transition-all placeholder:text-gray-700 font-serif"
                  />
                </div>
              </div>

              <button 
                onClick={handleEmailNext}
                disabled={!email}
                className="w-full bg-white text-black py-4 rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 disabled:opacity-30 transition-all shadow-lg"
              >
                Continue to Sign In <ArrowRight size={16} />
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-gray-700 font-bold bg-[#0a0a0a] px-4">Social Entry</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleSocialAuth('google')}
                  disabled={loading}
                  className="flex items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group disabled:opacity-50"
                  title="Google"
                >
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="ml-2 text-[10px] uppercase tracking-widest font-bold text-gray-400 group-hover:text-white transition-colors">Google</span>
                </button>
                <button 
                  onClick={handlePrototypeEntry}
                  disabled={loading}
                  className="flex items-center justify-center p-4 rounded-2xl bg-[#F27D26]/10 border border-[#F27D26]/20 hover:bg-[#F27D26]/20 transition-all group disabled:opacity-50"
                  title="Prototype Entry"
                >
                  <Sparkles size={20} className="text-[#F27D26]" />
                  <span className="ml-2 text-[10px] uppercase tracking-widest font-bold text-[#F27D26]">Prototype</span>
                </button>
              </div>

              <div className="pt-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">Secure Global Access</p>
              </div>
            </div>
          )}

          {(step === 'password' || step === 'register') && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <button onClick={() => setStep('email')} className="p-1 hover:text-[#F27D26] transition-opacity">
                  <ArrowLeft size={16} />
                </button>
                <p className="text-[10px] uppercase tracking-widest font-bold">{email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">
                  {step === 'register' ? 'Create a Password' : 'Your Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-2xl focus:border-[#F27D26] outline-none transition-all placeholder:text-gray-700"
                  />
                </div>
              </div>

              <button 
                onClick={() => handleAuth(step === 'register')}
                disabled={loading || password.length < 6}
                className="w-full bg-[#F27D26] text-black py-4 rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#d86d1f] disabled:opacity-30 transition-all shadow-lg shadow-[#F27D26]/10"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                {step === 'register' ? 'Create My Account' : 'Sign In'}
              </button>

              <div className="flex justify-between items-center px-2">
                <button 
                  onClick={() => setStep(step === 'register' ? 'password' : 'register')}
                  className="text-[10px] uppercase tracking-widest text-gray-500 font-bold hover:text-white"
                >
                  {step === 'register' ? 'Already have access?' : 'New professional?'}
                </button>
                {step === 'password' && (
                  <button 
                    onClick={() => setStep('forgot')}
                    className="text-[10px] uppercase tracking-widest text-gray-500 font-bold hover:text-white"
                  >
                    Forgot Access?
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'forgot' && (
            <div className="space-y-6">
               <div className="flex items-center gap-2 text-gray-500 mb-2">
                <button onClick={() => setStep('password')} className="p-1 hover:text-[#F27D26]">
                  <ArrowLeft size={16} />
                </button>
                <p className="text-[10px] uppercase tracking-widest font-bold">Recovery Mode</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-gray-400 leading-relaxed italic">Confirm your professional email. We will send an encrypted recovery link.</p>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    disabled
                    className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-2xl text-gray-500"
                  />
                </div>
              </div>

              <button 
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-white/10 text-white py-4 rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                Send Reset Link
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 pt-4">
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
            >
               <div className="text-red-500 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
               </div>
               <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider leading-relaxed">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3"
            >
               <div className="text-green-500 mt-0.5">
                  <Check size={16} />
               </div>
               <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider leading-relaxed">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="text-center">
         <p className="text-[8px] text-gray-600 uppercase tracking-widest leading-loose">
           By joining, you join a community built on <br/>
           mutual respect, trust, and professional integrity.
         </p>
      </footer>
    </div>
  );
}
