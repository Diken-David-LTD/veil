import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Zap, 
  MessageCircle, 
  Heart, 
  Eye, 
  Settings, 
  Crown, 
  TrendingUp, 
  AlertCircle,
  Clock,
  ArrowRight,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, Match } from '../../types';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface DashboardProps {
  profile: UserProfile;
  onNavigate: (view: any) => void;
}

export default function Dashboard({ profile, onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    matches: 0,
    likes: 0,
    profileViews: 14, // Mock for now, would be tracked in a real app
    newMessages: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const matchesQ = query(
          collection(db, 'matches'),
          where('users', 'array-contains', profile.uid),
          where('isMutual', '==', true)
        );
        const matchesSnap = await getDocs(matchesQ);
        
        const likesQ = query(
          collection(db, 'matches'),
          where('users', 'array-contains', profile.uid),
          where('isMutual', '==', false)
        );
        const likesSnap = await getDocs(likesQ);
        
        setStats(prev => ({
          ...prev,
          matches: matchesSnap.size,
          likes: likesSnap.size
        }));
      } catch (err) {
        console.error("Dashboard stats failed", err);
      }
    };
    fetchStats();
  }, [profile.uid]);

  const profileCompletion = [
    profile.photoURL,
    profile.bio,
    profile.interests?.length > 0,
    profile.neighborhood,
    profile.occupation
  ].filter(Boolean).length * 20;

  const nextSteps = [
    { 
      condition: !profile.photoURL, 
      label: 'Update Presence', 
      sub: 'Add a photo to activate Discovery.',
      icon: <Camera size={14} className="text-[#F27D26]" /> 
    },
    { 
      condition: !profile.isVerified, 
      label: 'Verify Identity', 
      sub: 'Gain the Elite Trust badge.',
      icon: <CheckCircle2 size={14} className="text-[#F27D26]" /> 
    },
    { 
      condition: !profile.bio || profile.bio.length < 10, 
      label: 'Refine Bio', 
      sub: 'Introduce yourself to the circle.',
      icon: <Zap size={14} className="text-[#F27D26]" /> 
    }
  ].filter(step => step.condition);

  return (
    <div className="h-full overflow-y-auto px-6 pt-6 pb-32 space-y-8 scrollbar-hide">
      {/* Profile Summary Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#F27D26]/20">
            {profile.photoURL ? (
              <img src={profile.photoURL} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center">
                <ShieldCheck size={24} className="text-gray-700" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 p-1 bg-[#F27D26] rounded-tl-lg shadow-lg">
              <ShieldCheck size={10} className="text-black" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-serif text-white">{profile.displayName}</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">{profile.subscriptionTier} Member</p>
          </div>
        </div>
        <button onClick={() => onNavigate('profile')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
          <Settings size={18} className="text-gray-400" />
        </button>
      </header>

      {/* Profile Strength */}
      <section className="bg-white/5 rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <TrendingUp size={80} />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold mb-1">Refinement Status</p>
              <h2 className="text-2xl font-serif">{profileCompletion}% Complete</h2>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Strong Presence</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${profileCompletion}%` }}
              className="h-full bg-gradient-to-r from-[#F27D26] to-[#ff9d5c]"
            />
          </div>
          {profileCompletion < 100 && (
            <p className="text-[10px] text-gray-500 leading-relaxed italic">
              "A fully detailed profile receives 3x more refined interests."
            </p>
          )}
        </div>
      </section>

      {/* Next Steps for New Members */}
      {nextSteps.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold ml-1">Arrival Tasks</h3>
          <div className="space-y-3">
            {nextSteps.map((step, i) => (
              <motion.button
                key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => onNavigate('profile')}
                className="w-full bg-gradient-to-r from-[#F27D26]/10 to-transparent p-4 rounded-2xl border border-[#F27D26]/20 flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center">
                  {step.icon}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">{step.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{step.sub}</p>
                </div>
                <ArrowRight size={14} className="ml-auto text-[#F27D26] opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          icon={<Heart size={16} />} 
          label="Interests" 
          value={stats.likes} 
          sub="Incoming"
          onClick={() => onNavigate('activity')}
        />
        <StatCard 
          icon={<MessageCircle size={16} />} 
          label="Matches" 
          value={stats.matches} 
          sub="Active Circle"
          onClick={() => onNavigate('messages')}
        />
        <StatCard 
          icon={<Eye size={16} />} 
          label="Refinement" 
          value={stats.profileViews} 
          sub="Profile Views"
          isPremium={profile.subscriptionTier === 'free'}
        />
        <StatCard 
          icon={<Zap size={16} />} 
          label="Boost" 
          value="Off" 
          sub="Presence Level"
          isPremium={profile.subscriptionTier === 'free'}
        />
      </div>

      {/* Quick Actions / Safety Center */}
      <section className="space-y-4 pt-4">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold ml-1">Integrity Center</h3>
        <div className="grid grid-cols-1 gap-3">
          <ActionRow 
            icon={<ShieldCheck className="text-[#F27D26]" size={18} />} 
            label="Verification Status" 
            sub={profile.isVerified ? "ID Fully Verified" : "Verification in Progress"} 
          />
          <ActionRow 
            icon={<AlertCircle className="text-red-500/60" size={18} />} 
            label="Report & Safety" 
            sub="24/7 Integrity Support" 
          />
        </div>
      </section>

      {/* Membership CTA */}
      {profile.subscriptionTier === 'free' && (
        <section className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-3xl p-6 border border-[#F27D26]/20 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#F27D26]/10 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-[#F27D26]" />
                <h4 className="text-sm font-serif">Executive Upgrade</h4>
              </div>
              <p className="text-[10px] text-gray-500">Reveal views & increase presence.</p>
            </div>
            <ArrowRight size={20} className="text-[#F27D26]" />
          </div>
        </section>
      )}

      {/* Footer Branding */}
      <footer className="text-center py-8 opacity-20">
        <p className="text-[8px] uppercase tracking-[0.4em] font-bold">VEIL • Refined Connections</p>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, sub, onClick, isPremium }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | number, 
  sub: string,
  onClick?: () => void,
  isPremium?: boolean 
}) {
  return (
    <button 
      onClick={onClick}
      disabled={!onClick && !isPremium}
      className="bg-white/5 rounded-3xl p-5 border border-white/5 flex flex-col items-start gap-4 text-left group transition-all hover:bg-white/10 relative overflow-hidden"
    >
      <div className={`p-2 rounded-xl transition-colors ${onClick ? 'bg-[#F27D26]/10 text-[#F27D26]' : 'bg-white/10 text-gray-400'}`}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-serif">{isPremium ? '??' : value}</span>
          {isPremium && <Crown size={12} className="text-[#F27D26]" />}
        </div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">{label}</p>
        <p className="text-[8px] text-gray-600 font-medium mt-0.5">{sub}</p>
      </div>
    </button>
  );
}

function ActionRow({ icon, label, sub }: { icon: React.ReactNode, label: string, sub: string }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center gap-4 group hover:bg-white/10 transition-all cursor-pointer">
      <div className="p-2.5 rounded-xl bg-black/40">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-white uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
      </div>
      <ArrowRight size={14} className="ml-auto text-gray-700 group-hover:text-[#F27D26] transition-colors" />
    </div>
  );
}
