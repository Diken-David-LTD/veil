import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

const REFINED_INTERESTS = [
  'Fine Dining', 'Art Collecting', 'Angel Investing', 'Sailing', 
  'Polo', 'Golf', 'Philanthropy', 'Wine Tasting', 'VC',
  'Classical Music', 'Boutique Hotels', 'Horse Racing',
  'Contemporary Art', 'Tennis', 'Yachting'
];

interface InterestsPickerProps {
  selected: string[];
  onChange: (interests: string[]) => void;
}

export default function InterestsPicker({ selected, onChange }: InterestsPickerProps) {
  const toggleInterest = (interest: string) => {
    if (selected.includes(interest)) {
      onChange(selected.filter(i => i !== interest));
    } else {
      if (selected.length < 5) {
        onChange([...selected, interest]);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Select Interests (Max 5)</label>
        <span className="text-[10px] text-[#F27D26] font-bold">{selected.length}/5</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {REFINED_INTERESTS.map(interest => {
          const isSelected = selected.includes(interest);
          return (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-full text-xs transition-all border ${
                isSelected 
                  ? 'bg-[#F27D26] text-black border-[#F27D26]' 
                  : 'bg-[#111] text-gray-400 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {interest}
                {isSelected && <Check size={12} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
