/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Eye, Heart, MessageSquare, User as UserIcon, LogOut, Loader2, MapPin } from 'lucide-react';

// Components (will be created)
import Onboarding from './components/profile/Onboarding';
import Discovery from './components/discovery/Discovery';
import Matches from './components/chat/Matches';
import ProfileView from './components/profile/ProfileView';

type View = 'discovery' | 'matches' | 'profile' | 'onboarding';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('discovery');

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Load profile
        const profileRef = doc(db, 'users', u.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        } else {
          setCurrentView('onboarding');
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-sans">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 border-t-2 border-[#F27D26] rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-widest opacity-50">Initializing Veil</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white px-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-6xl font-serif tracking-tight leading-none italic">Veil</h1>
            <p className="text-[#F27D26] text-xs font-sans uppercase tracking-[0.3em] font-medium">Powered by CFN</p>
          </div>
          
          <div className="py-12 space-y-4">
            <h2 className="text-2xl font-light leading-snug">Discreet Dating for established Nigerian Professionals.</h2>
            <p className="text-sm text-gray-400 leading-relaxed px-8">
              Absolute discretion. Government ID verification. <br/>
              Matches based on choices, not exposure.
            </p>
          </div>

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white text-black py-4 rounded-full font-medium shadow-2xl hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
            {isLoggingIn ? 'Authenticating...' : 'Enter Discreetly'}
          </button>
          
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">30+ Professionals Only • NDPA 2023 Compliant</p>
        </motion.div>
      </div>
    );
  }

  if (!profile && currentView !== 'onboarding') {
    setCurrentView('onboarding');
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#F27D26] selection:text-white pb-20">
      <main className="max-w-md mx-auto h-screen relative overflow-hidden flex flex-col">
        {/* View Switcher */}
        <AnimatePresence mode="wait">
          {currentView === 'onboarding' && (
            <Onboarding 
              user={user} 
              onComplete={(newProfile) => {
                setProfile(newProfile);
                setCurrentView('discovery');
              }} 
            />
          )}

          {currentView === 'discovery' && (
            <Discovery profile={profile!} />
          )}

          {currentView === 'matches' && (
            <Matches profile={profile!} />
          )}

          {currentView === 'profile' && (
            <ProfileView profile={profile!} onLogout={handleLogout} />
          )}
        </AnimatePresence>

        {/* Global Navigation - Recipe 4 style bottom pill nav */}
        {profile && (
          <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/10 backdrop-blur-xl border border-white/10 rounded-full h-16 flex items-center justify-around px-2 z-50">
            <NavBtn active={currentView === 'discovery'} onClick={() => setCurrentView('discovery')} icon={<Eye size={20}/>} label="Discovery" />
            <NavBtn active={currentView === 'matches'} onClick={() => setCurrentView('matches')} icon={<MessageSquare size={20}/>} label="Matches" />
            <NavBtn active={currentView === 'profile'} onClick={() => setCurrentView('profile')} icon={<UserIcon size={20}/>} label="Account" />
          </nav>
        )}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-[#F27D26]' : 'text-gray-400 opacity-60 hover:opacity-100'}`}
    >
      <div className={`p-2 rounded-full ${active ? 'bg-[#F27D26]/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[8px] uppercase tracking-[0.2em] font-bold">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 rounded-full bg-[#F27D26] absolute -top-1" />}
    </button>
  );
}
