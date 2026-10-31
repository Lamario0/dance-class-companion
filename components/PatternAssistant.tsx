
import React, { useState, useCallback } from 'react';
import { explainPattern } from '../services/geminiService';
import { Sparkles } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { DancingDots, SparkleDoodle } from './ui/Doodles';

interface PatternAssistantProps {
  pattern: string;
  className: string;
}

export const PatternAssistant: React.FC<PatternAssistantProps> = ({ pattern, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleAsk = async () => {
    setIsOpen(true);
    if (!explanation) {
      setLoading(true);
      const result = await explainPattern(pattern, className);
      setExplanation(result);
      setLoading(false);
    }
  };

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={handleAsk}
        aria-label={`Ask the AI instructor about ${pattern}`}
        data-tip="Ask the AI instructor"
        data-tip-align="end"
        className="tip press -my-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand-soft hover:bg-brand/15 hover:text-white"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/15 ring-1 ring-brand/30">
          <Sparkles className="h-4 w-4" />
        </span>
      </button>

      <BottomSheet
        open={isOpen}
        onClose={close}
        eyebrow={<span className="inline-flex items-center gap-1.5 text-brand-soft"><Sparkles className="h-3.5 w-3.5" /> AI instructor · {className}</span>}
        title={pattern}
        footer={
          <button type="button" onClick={close} className="btn-secondary press w-full">
            Got it
          </button>
        }
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="relative">
              <DancingDots label="Thinking" />
              <SparkleDoodle className="absolute -right-6 -top-3 h-4 w-4 text-accent" />
            </div>
            <p className="text-text-lo">Counting it out… 5, 6, 7, 8</p>
          </div>
        ) : (
          <p className="whitespace-pre-line text-text-mid leading-relaxed animate-fade">{explanation}</p>
        )}
      </BottomSheet>
    </>
  );
};
