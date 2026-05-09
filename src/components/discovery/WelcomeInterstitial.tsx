import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Sparkles, Loader2 } from 'lucide-react';

interface WelcomeInterstitialProps {
  onComplete: () => void;
  displayName: string;
}

export default function WelcomeInterstitial({ onComplete, displayName }: WelcomeInterstitialProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="relative mb-12"
      >
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#F27D26] to-[#ff9d5c] flex items-center justify-center shadow-[0_0_50px_rgba(242,125,38,0.3)]">
          <ShieldCheck size={48} className="text-black" />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-2 border-[#F27D26]/20 border-t-[#F27D26] rounded-[2.5rem] -m-2"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="space-y-4"
      >
        <h1 className="text-3xl font-serif text-white">Welcome, {displayName.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 font-medium tracking-wide max-w-xs mx-auto">
          Our refinement algorithms are currently curating your initial professional circle.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-16 flex flex-col items-center gap-4"
      >
        <div className="flex items-center gap-3 text-[#F27D26]">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Synchronizing Presence</span>
        </div>
        
        <div className="flex gap-1.5 h-1 w-32 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="w-full h-full bg-[#F27D26]"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-12 flex items-center gap-2 text-white/20"
      >
        <Sparkles size={14} />
        <span className="text-[8px] uppercase tracking-[0.5em] font-bold">VEIL • ABSOLUTE DISCRETION</span>
      </motion.div>
    </div>
  );
}
