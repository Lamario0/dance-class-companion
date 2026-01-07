
import React, { useState } from 'react';
import { explainPattern } from '../services/geminiService';
import { BrainCircuit, X, Loader2, Wand2 } from 'lucide-react';

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

  return (
    <>
      <button 
        onClick={handleAsk}
        className="ml-2 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500 hover:text-white transition-all duration-200 border border-violet-500/20 shadow-sm group/ai"
        title="Ask AI Instructor"
      >
        <BrainCircuit className="w-3.5 h-3.5 group-hover/ai:scale-110 transition-transform" />
        <span className="sr-only">Explain {pattern}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 relative animate-in fade-in zoom-in duration-200 ring-1 ring-white/10">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-violet-600/20 text-violet-400 rounded-2xl border border-violet-500/20">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">AI Dance Guide</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Instant Insight</p>
              </div>
            </div>
            
            <div className="mb-6">
               <p className="text-sm text-slate-400 mb-1">Concept:</p>
               <p className="text-lg font-bold text-violet-400 leading-tight">
                 {pattern}
               </p>
            </div>

            <div className="bg-slate-950/50 p-6 rounded-2xl text-slate-200 text-sm leading-relaxed min-h-[120px] border border-slate-800/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <Wand2 className="w-20 h-20 rotate-12" />
              </div>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-24 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <span className="text-slate-500 font-medium italic">Consulting the instructor manual...</span>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                  {explanation}
                </div>
              )}
            </div>
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-all border border-slate-700 active:scale-95 shadow-lg"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
