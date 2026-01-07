import React, { useState } from 'react';
import { explainPattern } from '../services/geminiService';
import { Sparkles, X, Loader2 } from 'lucide-react';

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
        className="ml-2 inline-flex items-center text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
        title="Ask AI Instructor"
      >
        <Sparkles className="w-3 h-3 mr-1" />
        <span className="sr-only">Explain {pattern}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-900/30 text-violet-300 rounded-full">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">AI Assistant</h3>
            </div>
            
            <p className="font-semibold text-slate-300 mb-2">
              Explaining: <span className="text-violet-400">{pattern}</span>
            </p>

            <div className="bg-slate-800 p-4 rounded-xl text-slate-300 text-sm leading-relaxed min-h-[100px] border border-slate-700/50">
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                  <span className="ml-2 text-slate-400">Consulting the knowledge base...</span>
                </div>
              ) : (
                explanation
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};