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
import Dashboard from './components/dashboard/Dashboard';
import Discovery from './components/discovery/Discovery';
import LikesView from './components/discovery/LikesView';
import Matches from './components/chat/Matches';
import ProfileView from './components/profile/ProfileView';
import LoginPortal from './components/auth/LoginPortal';
import Navigation, { ViewType } from './components/layout/Navigation';
import WelcomeInterstitial from './components/discovery/WelcomeInterstitial';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType | 'onboarding' | 'profile'>('dashboard');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Listen for unread messages across all matches
    const matchesQ = query(
      collection(db, 'matches'),
      where('users', 'array-contains', profile.uid),
      where('isMutual', '==', true)
    );

    const unsubMatches = onSnapshot(matchesQ, async (snap) => {
      let totalUnread = 0;
      for (const matchDoc of snap.docs) {
        const messagesQ = query(
          collection(db, `matches/${matchDoc.id}/messages`),
          where('senderId', '!=', profile.uid),
          where('isRead', '==', false)
        );
        const messagesSnap = await getDocs(messagesQ);
        totalUnread += messagesSnap.size;
      }
      setUnreadCount(totalUnread);
    });

    // Listen for new likes (Activity)
    const likesQ = query(
      collection(db, 'matches'),
      where('users', 'array-contains', profile.uid),
      where('isMutual', '==', false)
    );

    const unsubLikes = onSnapshot(likesQ, (snap) => {
      const pendingLikes = snap.docs.filter(d => {
        const data = d.data();
        return data.likes && !data.likes[profile.uid];
      });
      setHasNewActivity(pendingLikes.length > 0);
    });

    return () => {
      unsubMatches();
      unsubLikes();
    };
  }, [profile]);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        unsubProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile(data);
            if (currentView === 'onboarding') {
              setCurrentView('discovery');
            }
          } else {
            setProfile(null);
            setCurrentView('onboarding');
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [currentView]);

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
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-sans uppercase tracking-[0.4em] font-medium text-[#F27D26]">by ConnectFest Network</p>
              <div className="flex items-center justify-center gap-4 text-white/20">
                <span className="h-px w-8 bg-current" />
                <p className="text-[9px] uppercase tracking-[0.2em]">Authentic Connections</p>
                <span className="h-px w-8 bg-current" />
              </div>
            </div>
          </div>
          
          <LoginPortal 
            onLoginStart={() => setIsLoggingIn(true)} 
            onLoginEnd={() => setIsLoggingIn(false)}
          />
          
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Exclusive to Professionals • Respecting Your Privacy</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#F27D26] selection:text-white">
      <main className="max-w-md mx-auto h-[100dvh] relative overflow-hidden flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {currentView === 'onboarding' && (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Onboarding 
                  user={user!} 
                  onComplete={(newProfile) => {
                    setProfile(newProfile);
                    setShowWelcome(true);
                    setCurrentView('dashboard');
                  }} 
                />
              </motion.div>
            )}

            {currentView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <Dashboard profile={profile!} onNavigate={(view) => setCurrentView(view)} />
              </motion.div>
            )}

            {currentView === 'discovery' && (
              <motion.div 
                key="discovery"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="h-full"
              >
                <Discovery profile={profile!} />
              </motion.div>
            )}

            {currentView === 'activity' && (
              <motion.div 
                key="activity"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full"
              >
                <LikesView 
                  profile={profile!} 
                  onViewProfile={() => setCurrentView('discovery')}
                />
              </motion.div>
            )}

            {currentView === 'messages' && (
              <motion.div 
                key="messages"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="h-full"
              >
                <Matches profile={profile!} onChatStateChange={setIsChatting} />
              </motion.div>
            )}

            {currentView === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <ProfileView profile={profile!} onLogout={handleLogout} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {profile && !isChatting && currentView !== 'onboarding' && (
          <Navigation 
            currentView={currentView as ViewType} 
            onViewChange={(view) => setCurrentView(view)} 
            unreadCount={unreadCount}
            hasNewActivity={hasNewActivity}
          />
        )}

        <AnimatePresence>
          {showWelcome && profile && (
            <WelcomeInterstitial 
              displayName={profile.displayName} 
              onComplete={() => setShowWelcome(false)} 
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
