
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Minus, Save, Users, DollarSign, Calculator, UserPlus, RefreshCcw, CheckCircle2, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { commitAttendance, commitCompedEntry, fetchCurrentSessionState, syncCurrentSessionState, GOOGLE_SCRIPT_URL } from '../services/spreadsheetService';

export const CalculatorView: React.FC = () => {
  // Check if spreadsheet is configured
  const isSpreadsheetConfigured = useMemo(() => 
    GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('REPLACE_WITH_YOUR_ID')
  , []);

  // Date tracking
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Counters
  const [lessonCount, setLessonCount] = useState(0);
  const [danceOnlyCount, setDanceOnlyCount] = useState(0);
  const [totalManualAdjust, setTotalManualAdjust] = useState(0);
  const [totalCompedCount, setTotalCompedCount] = useState(0);
  
  // Prices & Revenue
  const [priceLesson, setPriceLesson] = useState(25);
  const [priceDance, setPriceDance] = useState(15);
  const [customAmount, setCustomAmount] = useState(0);

  // Comped Inputs
  const [compedName, setCompedName] = useState('');
  const [compedNotes, setCompedNotes] = useState('');
  
  // Split
  const [splitPersons, setSplitPersons] = useState(1);
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Persistence: Fetch on Mount
  useEffect(() => {
    if (!isSpreadsheetConfigured) return;
    const loadState = async () => {
      const saved = await fetchCurrentSessionState();
      if (saved) {
        setLessonCount(saved.lessonCount ?? 0);
        setDanceOnlyCount(saved.danceOnlyCount ?? 0);
        setTotalManualAdjust(saved.totalManualAdjust ?? 0);
        setTotalCompedCount(saved.totalCompedCount ?? 0);
        setSplitPersons(saved.splitPersons ?? 1);
        setCustomAmount(saved.customAmount ?? 0);
        if (saved.priceLesson) setPriceLesson(saved.priceLesson);
        if (saved.priceDance) setPriceDance(saved.priceDance);
      }
    };
    loadState();
  }, [isSpreadsheetConfigured]);

  // Sync function wrapped in useCallback
  const performSync = useCallback((state: any) => {
    if (isSpreadsheetConfigured) {
      syncCurrentSessionState(state);
    }
  }, [isSpreadsheetConfigured]);

  // Persistence: Sync to cloud periodically
  useEffect(() => {
    const timer = setTimeout(() => {
      performSync({
        lessonCount,
        danceOnlyCount,
        totalManualAdjust,
        totalCompedCount,
        splitPersons,
        customAmount,
        selectedDate,
        priceLesson,
        priceDance
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [lessonCount, danceOnlyCount, totalManualAdjust, totalCompedCount, splitPersons, customAmount, selectedDate, priceLesson, priceDance, performSync]);

  const totalInAttendance = useMemo(() => 
    lessonCount + danceOnlyCount + totalCompedCount + totalManualAdjust
  , [lessonCount, danceOnlyCount, totalCompedCount, totalManualAdjust]);

  const totalRevenue = useMemo(() => 
    (lessonCount * priceLesson) + (danceOnlyCount * priceDance) + (Number(customAmount) || 0)
  , [lessonCount, priceLesson, danceOnlyCount, priceDance, customAmount]);

  // Specific rounding requirements: Venue DOWN (floor), Instructors UP (ceil)
  const venueShare = Math.floor(totalRevenue * 0.5);
  const instructorPool = Math.ceil(totalRevenue * 0.5);
  const perPersonSplit = Math.ceil(instructorPool / splitPersons);

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all data and counters for this session? This cannot be undone.")) {
      const today = new Date().toISOString().split('T')[0];
      
      setLessonCount(0);
      setDanceOnlyCount(0);
      setTotalManualAdjust(0);
      setTotalCompedCount(0);
      setCustomAmount(0);
      setCompedName('');
      setCompedNotes('');
      setSplitPersons(1);
      setSelectedDate(today);
      setPriceLesson(25);
      setPriceDance(15);
      
      if (isSpreadsheetConfigured) {
        syncCurrentSessionState({
          lessonCount: 0,
          danceOnlyCount: 0,
          totalManualAdjust: 0,
          totalCompedCount: 0,
          splitPersons: 1,
          customAmount: 0,
          selectedDate: today,
          priceLesson: 25,
          priceDance: 15
        });
      }
    }
  };

  const handleAddComped = async () => {
    if (!compedName.trim()) return;
    
    const record = {
      date: selectedDate,
      name: compedName,
      notes: compedNotes
    };

    const success = await commitCompedEntry(record);
    if (success || !isSpreadsheetConfigured) {
      // Allow local updates even if spreadsheet fails/not configured for testing
      setTotalCompedCount(prev => prev + 1);
      setCompedName('');
      setCompedNotes('');
      if (isSpreadsheetConfigured) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }
    }
  };

  const handleCalculateSave = async () => {
    if (!isSpreadsheetConfigured) {
      alert("Spreadsheet connection not configured. Please add your Web App URL to services/spreadsheetService.ts");
      return;
    }
    
    setIsSaving(true);
    const record = {
      date: selectedDate,
      totalInAttendance,
      lessonAndDance: lessonCount,
      danceOnly: danceOnlyCount,
      totalComped: totalCompedCount
    };

    const success = await commitAttendance(record);
    setIsSaving(false);
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Configuration Warning Banner */}
      {!isSpreadsheetConfigured && (
        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-rose-400 font-bold text-sm">Spreadsheet Connection Missing</p>
            <p className="text-rose-400/70 text-xs mt-1">
              Data will not be saved to Google Sheets. Paste your Web App URL into 
              <code className="mx-1 px-1 py-0.5 bg-rose-500/20 rounded text-rose-300 font-mono">services/spreadsheetService.ts</code>
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-row items-center justify-between mb-8 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="p-1.5 bg-violet-600 rounded-lg shrink-0">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h2 className="text-xs sm:text-xl font-black text-white whitespace-nowrap">Admin Tools</h2>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 pl-3 pr-2 shadow-sm shrink-0">
            <CalendarIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-[10px] sm:text-sm font-bold text-slate-200 outline-none cursor-pointer [color-scheme:dark] w-[80px] sm:w-auto"
            />
          </div>
        </div>
        
        <button 
          onClick={handleClearAll}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl border border-rose-500/20 transition-all text-[10px] sm:text-sm font-black shadow-lg flex-shrink-0"
        >
          <RefreshCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="space-y-6">
          <section className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 border border-slate-800 shadow-xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              Attendance
            </h3>
            
            <div className="space-y-8">
              <Counter 
                label="Lesson + Dance" 
                count={lessonCount} 
                onChange={setLessonCount} 
                price={priceLesson} 
                onPriceChange={setPriceLesson}
                color="violet"
              />
              <Counter 
                label="Dance Only" 
                count={danceOnlyCount} 
                onChange={setDanceOnlyCount} 
                price={priceDance} 
                onPriceChange={setPriceDance}
                color="sky"
              />
            </div>

            <div className="mt-10 pt-8 border-t border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Total Heads</p>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums">{totalInAttendance}</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button onClick={() => setTotalManualAdjust(v => v - 1)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-400"><Minus className="w-4 h-4"/></button>
                <span className="text-[9px] text-slate-500 font-black uppercase px-1">Adjust</span>
                <button onClick={() => setTotalManualAdjust(v => v + 1)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-400"><Plus className="w-4 h-4"/></button>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 border border-slate-800 shadow-xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Comped Guests
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <input 
                  type="text" 
                  placeholder="Guest Name"
                  value={compedName}
                  onChange={(e) => setCompedName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500 outline-none placeholder:text-slate-600 font-medium"
                />
                <textarea 
                  placeholder="Notes"
                  value={compedNotes}
                  onChange={(e) => setCompedNotes(e.target.value)}
                  rows={2}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500 outline-none resize-none placeholder:text-slate-600 font-medium"
                />
              </div>
              <button 
                onClick={handleAddComped}
                disabled={!compedName.trim()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10"
              >
                <Plus className="w-5 h-5" />
                Add Guest
              </button>
              <div className="text-center pt-1">
                <span className="px-3 py-1 bg-slate-800 rounded-full text-[9px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest">Comped Total: {totalCompedCount}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden h-full">
             <div className="absolute -top-10 -right-10 opacity-[0.03] pointer-events-none">
               <DollarSign className="w-64 h-64" />
             </div>
             
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Revenue & Payout
            </h3>

            <div className="space-y-8">
              <div className="bg-slate-950 p-6 sm:p-8 rounded-[2rem] border border-slate-800 relative z-10">
                <div className="flex justify-between items-start mb-8 sm:mb-10">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 sm:mb-2">Total Income</p>
                    <p className="text-2xl sm:text-5xl font-black text-emerald-400 drop-shadow-sm tabular-nums">${totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 sm:mb-2">Misc ($)</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={customAmount || ''}
                      onChange={(e) => setCustomAmount(Number(e.target.value))}
                      className="w-16 sm:w-24 bg-slate-900 border border-slate-800 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 text-white text-right font-bold text-xs sm:text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 sm:p-5 rounded-2xl border border-slate-800/50">
                    <p className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase mb-1 whitespace-nowrap">Venue (50% ↓)</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-200 tabular-nums">${venueShare.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 sm:p-5 rounded-2xl border border-slate-800/50">
                    <p className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase mb-1 whitespace-nowrap">Instructors (50% ↑)</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-200 tabular-nums">${instructorPool.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Instructor Split (↑)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => setSplitPersons(num)}
                      className={`py-3 sm:py-4 rounded-xl font-black transition-all border text-xs sm:text-sm ${
                        splitPersons === num 
                          ? 'bg-violet-600 border-violet-500 text-white shadow-xl shadow-violet-900/20 scale-105 z-10' 
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {num}P
                    </button>
                  ))}
                </div>
                
                <div className="mt-6 sm:mt-8 p-6 sm:p-8 bg-violet-600/5 rounded-[2rem] border border-violet-500/10 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/5 transition-colors duration-500"></div>
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-2">Individual Share</p>
                  <p className="text-3xl sm:text-5xl font-black text-white tabular-nums">${perPersonSplit.toFixed(2)}</p>
                </div>
              </div>

              <button 
                onClick={handleCalculateSave}
                disabled={isSaving}
                className="w-full py-5 sm:py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl sm:rounded-[1.5rem] font-black text-lg sm:text-xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-900/20 active:scale-95 disabled:bg-slate-800 mt-4"
              >
                {isSaving ? <RefreshCcw className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" /> : <Save className="w-6 h-6 sm:w-7 sm:h-7" />}
                Save Report
              </button>
            </div>
          </section>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-3xl shadow-2xl flex items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-12 duration-500 z-50 whitespace-nowrap">
          <div className="p-1 bg-white/20 rounded-full">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="font-black text-sm sm:text-lg">Changes Saved!</span>
        </div>
      )}
    </div>
  );
};

interface CounterProps {
  label: string;
  count: number;
  onChange: (val: number) => void;
  price: number;
  onPriceChange: (val: number) => void;
  color: 'violet' | 'sky';
}

const Counter: React.FC<CounterProps> = ({ label, count, onChange, price, onPriceChange, color }) => {
  const colorMap = {
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500 hover:text-white',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500 hover:text-white',
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-sm font-black text-slate-300 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl border border-slate-800">
           <span className="text-[8px] sm:text-[10px] font-black text-slate-600 uppercase tracking-tighter">$</span>
           <input 
            type="number" 
            value={price}
            onChange={(e) => onPriceChange(Number(e.target.value))}
            className="w-8 sm:w-10 bg-transparent text-slate-200 text-xs sm:text-sm text-center outline-none font-black"
           />
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={() => onChange(Math.max(0, count - 1))}
          className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-center text-slate-500 bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-slate-200 active:scale-90"
        >
          <Minus className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
        <div className="flex-1 text-center py-2 sm:py-4 bg-slate-950/50 rounded-xl sm:rounded-2xl border border-slate-800/50">
          <span className="text-3xl sm:text-5xl font-black text-white tabular-nums">{count}</span>
        </div>
        <button 
          onClick={() => onChange(count + 1)}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-center active:scale-90 shadow-lg ${colorMap[color]}`}
        >
          <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      </div>
    </div>
  );
};
