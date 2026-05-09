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
import LoginPortal from './components/auth/LoginPortal';

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
        // Real-time profile sync
        const profileRef = doc(db, 'users', u.uid);
        const unsubProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            setCurrentView('onboarding');
          }
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
          className="max-w-md w-full flex flex-col items-center gap-12"
        >
          <div className="space-y-4 text-center">
            <h1 className="text-8xl font-serif tracking-tighter leading-none italic select-none">Veil</h1>
            <div className="flex items-center justify-center gap-4 text-[#F27D26]/60">
              <span className="h-px w-8 bg-current" />
              <p className="text-[10px] font-sans uppercase tracking-[0.4em] font-medium text-[#F27D26]">Est. 2024</p>
              <span className="h-px w-8 bg-current" />
            </div>
          </div>
          
          <LoginPortal 
            onLoginStart={() => setIsLoggingIn(true)} 
            onLoginEnd={() => setIsLoggingIn(false)}
          />
          
          <p className="text-[10px] text-gray-700 uppercase tracking-widest font-medium">30+ Professionals Only • NDPA 2023 Compliant</p>
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
