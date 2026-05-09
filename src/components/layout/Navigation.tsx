import React from 'react';
import { motion } from 'motion/react';
import { Eye, Heart, MessageSquare, User } from 'lucide-react';

export type ViewType = 'discovery' | 'activity' | 'messages' | 'profile';

interface NavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  hasNewActivity?: boolean;
  unreadCount?: number;
}

export default function Navigation({ currentView, onViewChange, hasNewActivity, unreadCount }: NavigationProps) {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/10 backdrop-blur-xl border border-white/10 rounded-full h-16 flex items-center justify-around px-2 z-50 shadow-2xl">
      <NavBtn 
        active={currentView === 'discovery'} 
        onClick={() => onViewChange('discovery')} 
        icon={<Eye size={20}/>} 
        label="Discover" 
      />
      <NavBtn 
        active={currentView === 'activity'} 
        onClick={() => onViewChange('activity')} 
        icon={<Heart size={20}/>} 
        label="Activity" 
        badge={hasNewActivity}
      />
      <NavBtn 
        active={currentView === 'messages'} 
        onClick={() => onViewChange('messages')} 
        icon={<MessageSquare size={20}/>} 
        label="Messages" 
        badge={unreadCount ? unreadCount > 0 : false}
        count={unreadCount}
      />
      <NavBtn 
        active={currentView === 'profile'} 
        onClick={() => onViewChange('profile')} 
        icon={<User size={20}/>} 
        label="Account" 
      />
    </nav>
  );
}

interface NavBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
  count?: number;
}

function NavBtn({ active, onClick, icon, label, badge, count }: NavBtnProps) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 transition-all flex-1 h-full ${active ? 'text-[#F27D26]' : 'text-gray-400 opacity-60 hover:opacity-100'}`}
    >
      <div className={`p-2 rounded-full transition-colors ${active ? 'bg-[#F27D26]/10' : ''}`}>
        {icon}
      </div>
      
      {badge && !active && (
        <span className="absolute top-3 right-5 w-2 h-2 bg-[#F27D26] rounded-full ring-2 ring-[#050505]" />
      )}
      
      {count !== undefined && count > 0 && (
        <span className="absolute top-2 right-4 bg-[#F27D26] text-black text-[7px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border border-black">
          {count > 9 ? '9+' : count}
        </span>
      )}

      <span className="text-[7px] uppercase tracking-[0.2em] font-bold">{label}</span>
      
      {active && (
        <motion.div 
          layoutId="nav-dot" 
          className="w-1 h-1 rounded-full bg-[#F27D26] absolute -top-1" 
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}
