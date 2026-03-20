import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './FirebaseProvider';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, Timestamp, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ObjectiveForm } from './ObjectiveForm';
import { ObjectiveDetails } from './ObjectiveDetails';
import { Roadmap } from './Roadmap';
import { NotificationCenter } from './NotificationCenter';
import { fetchExternalMetric } from '../services/externalDataService';
import { Brain, TrendingUp, History, ChevronRight, LayoutDashboard, Zap, Menu, X, RefreshCw, Plus, Search } from 'lucide-react';

interface Metric {
  label: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  integrationId?: string;
  externalSource?: 'KPH_EHS' | 'SAP' | 'MANUAL';
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface Objective {
  id: string;
  title: string;
  description: string;
  assignedToId: string;
  status: string;
  priority: string;
  dueDate: any;
  percentComplete: number;
  metrics?: Metric[];
  subtasks?: Subtask[];
}

import { generatePortfolioSummary, generateDailyBriefing, DailyBriefing } from '../services/aiService';
import { motion, AnimatePresence } from 'framer-motion';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portfolioSummary, setPortfolioSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefing | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sources, setSources] = useState<{ id: string; name: string; type: string; content: string }[]>([]);
  const [newSourceText, setNewSourceText] = useState('');
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Section Management
  const [sectionIndex, setSectionIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const lastScrollTime = useRef(0);
  const totalSections = 3;

  useEffect(() => {
    if (isTransitioning) {
      setGlitchActive(true);
      const timer = setTimeout(() => setGlitchActive(false), 500);
      return () => clearTimeout(timer);
    }
  }, [sectionIndex, isTransitioning]);

  const goToSection = (index: number) => {
    if (index < 0 || index >= totalSections || index === sectionIndex || isTransitioning) return;
    
    setDirection(index > sectionIndex ? 1 : -1);
    setIsTransitioning(true);
    setSectionIndex(index);
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 1200);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isTransitioning) return;
    
    const now = Date.now();
    // Longer cooldown to prevent "slop" and accidental double-flips
    if (now - lastScrollTime.current < 1000) return;

    if (Math.abs(e.deltaY) > 40) {
      if (e.deltaY > 0) {
        if (sectionIndex < totalSections - 1) {
          lastScrollTime.current = now;
          goToSection(sectionIndex + 1);
        }
      } else {
        if (sectionIndex > 0) {
          lastScrollTime.current = now;
          goToSection(sectionIndex - 1);
        }
      }
    }
  };

  const scrollToRoadmap = () => {
    goToSection(2);
  };

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'objectives'), orderBy('dueDate', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective));
      setObjectives(data);
      setLoading(false);
      
      // Fetch daily briefing once objectives are loaded
      if (data.length > 0 && !dailyBriefing && !isBriefingLoading) {
        fetchBriefing(data);
      }
    }, (error) => {
      console.error("Objectives fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const fetchBriefing = async (currentObjectives: Objective[]) => {
    setIsBriefingLoading(true);
    try {
      const briefing = await generateDailyBriefing(currentObjectives, profile);
      setDailyBriefing(briefing);
    } catch (error) {
      console.error("Briefing fetch error:", error);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const runPortfolioSummary = async () => {
    if (objectives.length === 0 && sources.length === 0) return;
    setIsSummarizing(true);
    try {
      const summary = await generatePortfolioSummary(objectives, sources);
      setPortfolioSummary(summary);
    } catch (error) {
      console.error("Portfolio summary failed:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const addSource = () => {
    if (!newSourceText.trim()) return;
    const newSource = {
      id: Math.random().toString(36).substr(2, 9),
      name: newSourceText.length > 20 ? newSourceText.substring(0, 20) + '...' : newSourceText,
      type: 'TEXT',
      content: newSourceText
    };
    setSources([...sources, newSource]);
    setNewSourceText('');
    setShowSourceInput(false);
  };

  const removeSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  const kpis = {
    open: objectives.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length,
    overdue: objectives.filter(o => {
      const due = o.dueDate instanceof Timestamp ? o.dueDate.toDate() : new Date(o.dueDate);
      return due < new Date() && o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
    }).length,
    dueSoon: objectives.filter(o => {
      const due = o.dueDate instanceof Timestamp ? o.dueDate.toDate() : new Date(o.dueDate);
      const diff = due.getTime() - new Date().getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 7 && o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
    }).length,
    completed: objectives.filter(o => o.status === 'COMPLETED').length,
  };

  const canCreate = profile?.role === 'ADMIN' || profile?.role === 'MANAGER';

  return (
    <div className="flex min-h-screen bg-[var(--accents-1)] text-[var(--accents-8)] font-sans selection:bg-[var(--brand-10)]/30 overflow-hidden relative">
      {/* Sidebar Toggle Tab (Vertical) */}
      {!isSidebarOpen && (
        <motion.button 
          initial={{ x: -20 }}
          animate={{ x: 0 }}
          whileHover={{ x: 5 }}
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] bg-[var(--brand-10)] text-white py-8 px-2 rounded-r-2xl shadow-2xl flex flex-col items-center gap-4 group transition-all"
          aria-label="Open Sidebar"
        >
          <Menu className="w-5 h-5" />
          <span className="[writing-mode:vertical-lr] text-[10px] font-black uppercase tracking-[0.2em] rotate-180">Navigation</span>
        </motion.button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45]"
            />
            <motion.aside 
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-80 bg-[var(--accents-2)] border-r border-white/5 flex flex-col fixed top-0 left-0 h-screen z-50 shadow-2xl"
            >
              <div className="p-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--brand-10)] rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--brand-10)]/20">
                      <LayoutDashboard className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-2xl font-black tracking-tighter">
                      <span className="text-white">Sand</span>
                      <span className="text-[var(--accents-6)]">Pro</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-xl text-[var(--accents-6)] hover:text-white transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="relative mb-10">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accents-6)]" />
                  <input 
                    type="text" 
                    placeholder="Quick search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-[var(--brand-10)]/30 transition-all"
                  />
                </div>

                <nav className="space-y-2 flex-1">
                  <div className="text-[10px] font-black text-[var(--accents-6)] uppercase tracking-[0.3em] mb-6 px-6">Workspace</div>
                  <button 
                    onClick={() => goToSection(0)}
                    className={`sidebar-item w-full ${sectionIndex === 0 ? 'sidebar-item-active' : ''}`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span>The Bridge</span>
                  </button>
                  <button 
                    onClick={() => goToSection(1)}
                    className={`sidebar-item w-full ${sectionIndex === 1 ? 'sidebar-item-active' : ''}`}
                  >
                    <Brain className="w-5 h-5" />
                    <span>The Brain</span>
                  </button>
                  <button 
                    onClick={() => goToSection(2)}
                    className={`sidebar-item w-full ${sectionIndex === 2 ? 'sidebar-item-active' : ''}`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>The Game Plan</span>
                  </button>
                  <button className="sidebar-item w-full opacity-40 cursor-not-allowed">
                    <Zap className="w-5 h-5" />
                    <span>Automations</span>
                  </button>
                </nav>

                <div className="mt-auto pt-8 border-t border-white/5">
                  <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-3xl border border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-10)]/20 flex items-center justify-center border border-[var(--brand-10)]/30 overflow-hidden">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[var(--brand-10)] font-black text-lg">{user?.displayName?.[0] || 'U'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-white truncate">{profile?.displayName || user?.displayName}</div>
                      <div className="text-[10px] text-[var(--accents-6)] font-mono uppercase tracking-widest truncate">{profile?.role || 'CONTRIBUTOR'}</div>
                    </div>
                    <button
                      onClick={() => signOut(auth)}
                      className="p-2 hover:bg-[var(--error-5)]/10 rounded-xl transition-colors text-[var(--accents-6)] hover:text-[var(--error-9)]"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main 
        onWheel={handleWheel}
        className="flex-1 overflow-hidden relative perspective-2000"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={sectionIndex}
            custom={direction}
            variants={{
              enter: (direction: number) => ({
                rotateX: direction > 0 ? 90 : -90,
                opacity: 0,
                z: -800,
                scale: 0.8,
                filter: 'blur(10px)'
              }),
              center: {
                rotateX: 0,
                opacity: 1,
                z: 0,
                scale: 1,
                filter: 'blur(0px)',
                transition: {
                  duration: 1.2,
                  ease: [0.19, 1, 0.22, 1]
                }
              },
              exit: (direction: number) => ({
                rotateX: direction > 0 ? -90 : 90,
                opacity: 0,
                z: -800,
                scale: 0.8,
                filter: 'blur(10px)',
                transition: {
                  duration: 1.0,
                  ease: [0.19, 1, 0.22, 1]
                }
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            className="h-full w-full absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
          >
            {sectionIndex === 0 && (
              <section className="h-full flex flex-col px-16 md:px-24 py-12 overflow-hidden">
          <header className="flex-1 flex flex-col justify-center">
              <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-12">
                {/* Left: Strategic Briefing */}
                <div className="flex-1 flex flex-col justify-center">
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[var(--brand-10)] font-black text-xs uppercase tracking-[0.5em] mb-8"
                  >
                    The Morning Report • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </motion.p>
                  
                  <AnimatePresence mode="wait">
                    {isBriefingLoading ? (
                      <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-4 text-[var(--accents-6)]"
                      >
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="text-sm font-black uppercase tracking-[0.3em]">Synthesizing Daily Strategic Briefing...</span>
                      </motion.div>
                    ) : dailyBriefing ? (
                      <motion.div 
                        key="briefing"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", damping: 20 }}
                        className="space-y-12"
                      >
                        <div className="relative">
                          <h1 className="pitch-header">
                            {dailyBriefing.headline}
                          </h1>
                          <div className="flex flex-col md:flex-row gap-12 items-start mt-8">
                            <p className="text-xl md:text-2xl text-[var(--accents-9)] font-light leading-[1.2] max-w-2xl tracking-tight">
                              {dailyBriefing.summary}
                            </p>
                            
                            <div className="flex flex-col gap-8 border-l border-white/10 pl-12">
                              <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-10)]">Priority Focus</span>
                                <p className="text-base text-white font-medium leading-snug max-w-xs">
                                  {dailyBriefing.priorityFocus}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accents-6)]">Strategic Insight</span>
                                <p className="text-base text-[var(--accents-6)] font-medium leading-snug max-w-xs">
                                  {dailyBriefing.newsInsight}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.h1 
                        key="default"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="pitch-header"
                      >
                        Strategic <br />
                        <span className="text-[var(--accents-6)]">Intelligence</span>
                      </motion.h1>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right: Vertical Action Pillars */}
                <div className="flex flex-col gap-6 w-full lg:w-[450px]">
                  
                  {canCreate && (
                    <motion.button
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: 1.02, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowForm(true)}
                      className="flex-1 group relative flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[var(--brand-10)]/20 via-[var(--brand-10)]/5 to-transparent border border-[var(--brand-10)]/30 rounded-[4rem] overflow-hidden transition-all duration-500 shadow-[0_40px_100px_rgba(247,148,29,0.15)]"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(247,148,29,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="relative">
                        <div className="absolute inset-0 bg-[var(--brand-10)] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="icon-container !bg-[var(--brand-10)] !w-28 !h-28 !shadow-[0_0_80px_rgba(247,148,29,0.5)] group-hover:scale-110 transition-transform duration-700 relative z-10">
                          <Plus className="w-14 h-14 stroke-[3] text-white drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="text-center px-10 relative z-10">
                        <span className="text-4xl font-black text-white uppercase tracking-tighter block mb-2 group-hover:tracking-tight transition-all">New Objective</span>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-10)] animate-pulse" />
                          <p className="text-[11px] font-black text-[var(--brand-10)] uppercase tracking-[0.4em] opacity-80">Let's get started</p>
                        </div>
                      </div>
                    </motion.button>
                  )}

                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={scrollToRoadmap}
                    className="flex-1 group relative flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent border border-indigo-500/30 rounded-[4rem] overflow-hidden transition-all duration-500 shadow-[0_40px_100px_rgba(99,102,241,0.15)]"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative">
                      <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="icon-container !bg-indigo-500 !w-28 !h-28 !shadow-[0_0_80px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-700 relative z-10">
                        <TrendingUp className="w-14 h-14 stroke-[3] text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="text-center px-10 relative z-10">
                      <span className="text-4xl font-black text-white uppercase tracking-tighter block mb-2 group-hover:tracking-tight transition-all">Current Roadmap</span>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] opacity-80">Where we're headed</p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>
          </header>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-10 left-0 right-0 px-16 md:px-24 pointer-events-none"
          >
            <div className="flex flex-col lg:flex-row items-stretch gap-12">
              <div className="flex-1">
                <div className="flex flex-col md:flex-row gap-12 items-start">
                  {/* Spacer to align with the briefing summary line above */}
                  <div className="max-w-2xl w-full hidden md:block" />
                  <div className="flex flex-col items-center gap-3 -translate-x-1/2">
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-center whitespace-nowrap">Keep going • Scroll to proceed</span>
                    <div className="w-px h-16 bg-gradient-to-b from-[var(--brand-10)] via-[var(--brand-10)]/50 to-transparent shadow-[0_0_10px_rgba(247,148,29,0.2)]" />
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-[450px] hidden lg:block" />
            </div>
          </motion.div>
        </section>
            )}

            {sectionIndex === 1 && (
              <section className="h-full flex flex-col px-16 md:px-24 bg-[var(--accents-1)] py-16 overflow-hidden">
          {/* Top Widgets Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 flex-1">
          {/* Sources & AI Insights Widget */}
          <section className="modern-card p-10 xl:col-span-3 flex flex-col min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-[var(--brand-10)]/10 rounded-[1.5rem] flex items-center justify-center">
                  <Brain className="w-8 h-8 text-[var(--brand-10)]" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tighter">The Knowledge Base</h3>
                  <p className="text-xs text-[var(--accents-6)] font-bold uppercase tracking-widest mt-1">Making sense of the chaos</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowSourceInput(!showSourceInput)}
                  className="secondary-button flex items-center gap-3"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Source</span>
                </button>
                <button 
                  onClick={runPortfolioSummary}
                  disabled={isSummarizing || (objectives.length === 0 && sources.length === 0)}
                  className="accent-button flex items-center gap-3 disabled:opacity-50"
                >
                  {isSummarizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>{portfolioSummary ? 'Re-Analyze' : 'Generate Insights'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 flex-1">
              {/* Sources List */}
              <div className="lg:col-span-2 flex flex-col">
                <div className="text-[10px] font-black text-[var(--accents-6)] uppercase tracking-[0.3em] mb-6">What we know ({sources.length})</div>
                
                <AnimatePresence>
                  {showSourceInput && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mb-6 overflow-hidden"
                    >
                      <textarea 
                        value={newSourceText}
                        onChange={(e) => setNewSourceText(e.target.value)}
                        placeholder="Paste strategic notes, market data, or project updates..."
                        className="modern-input w-full h-32 text-sm mb-4 resize-none"
                      />
                      <div className="flex justify-end gap-4">
                        <button onClick={() => setShowSourceInput(false)} className="text-[10px] font-black text-[var(--accents-6)] uppercase hover:text-white transition-all">Discard</button>
                        <button onClick={addSource} className="text-[10px] font-black text-[var(--brand-10)] uppercase hover:brightness-125 transition-all">Commit to Database</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto space-y-3 pr-4 custom-scrollbar">
                  {sources.length > 0 ? (
                    sources.map(source => (
                      <motion.div 
                        layout
                        key={source.id} 
                        className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl group/source hover:bg-white/[0.04] hover:border-[var(--brand-10)]/30 transition-all"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[var(--accents-6)]">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-[var(--accents-9)] truncate">{source.name}</span>
                        </div>
                        <button 
                          onClick={() => removeSource(source.id)}
                          className="opacity-0 group-hover/source:opacity-100 p-2 hover:bg-[var(--error-5)]/10 rounded-xl transition-all text-[var(--accents-6)] hover:text-[var(--error-9)]"
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </button>
                      </motion.div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] opacity-30 p-10 text-center">
                      <Plus className="w-10 h-10 text-[var(--accents-6)] mb-4" />
                      <p className="text-[10px] text-[var(--accents-6)] font-black uppercase tracking-[0.2em]">No sources connected</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Output */}
              <div className="lg:col-span-3 flex flex-col">
                <div className="text-[10px] font-black text-[var(--accents-6)] uppercase tracking-[0.3em] mb-6">The AI's take</div>
                {portfolioSummary ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 bg-white/[0.01] border border-white/5 rounded-[2rem] p-8 overflow-y-auto custom-scrollbar"
                  >
                    <div className="text-base text-[var(--accents-9)] leading-relaxed whitespace-pre-wrap font-medium">
                      {portfolioSummary}
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] opacity-30 p-10 text-center">
                    <p className="text-[10px] text-[var(--accents-6)] font-black uppercase tracking-[0.2em] max-w-xs leading-loose">
                      {isSummarizing ? 'Synthesizing global knowledge base...' : 'Connect sources and initiate analysis to generate strategic insights'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* KPI Summary Widget */}
          <section className="modern-card p-10 flex flex-col">
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">How we're doing</h3>
              <div className="w-2 h-2 rounded-full bg-[var(--success-9)] animate-pulse" />
            </div>
            
            <div className="grid grid-cols-1 gap-6 flex-1">
              {[
                { label: "Active", value: kpis.open, color: "text-[var(--brand-10)]", bg: "bg-[var(--brand-10)]/5" },
                { label: "Overdue", value: kpis.overdue, color: "text-[var(--error-9)]", bg: "bg-[var(--error-9)]/5" },
                { label: "Due Soon", value: kpis.dueSoon, color: "text-[var(--warning-9)]", bg: "bg-[var(--warning-9)]/5" },
                { label: "Completed", value: kpis.completed, color: "text-[var(--success-9)]", bg: "bg-[var(--success-9)]/5" }
              ].map((kpi, i) => (
                <div key={i} className={`${kpi.bg} border border-white/5 rounded-3xl p-6 flex items-center justify-between group hover:border-white/10 transition-all`}>
                  <div>
                    <div className="text-[10px] font-black tracking-[0.2em] text-[var(--accents-6)] uppercase mb-1">{kpi.label}</div>
                    <div className={`text-4xl font-black ${kpi.color} tracking-tighter`}>{kpi.value}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--accents-4)] group-hover:text-white transition-all" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
            )}

            {sectionIndex === 2 && (
              <section className="h-full flex flex-col px-16 md:px-24 bg-[var(--accents-1)] py-16 overflow-hidden">
                <Roadmap />
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Scanline overlay for "switch" feel */}
        {(isTransitioning || glitchActive) && (
          <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 1, 0] }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 bg-[var(--brand-10)]/5 backdrop-blur-[2px]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%]" />
            <div className="w-full h-1 bg-[var(--brand-10)] shadow-[0_0_30px_var(--brand-10)] animate-scanline absolute top-0" />
            <div className="w-full h-px bg-[var(--brand-10)]/20 absolute top-1/4" />
            <div className="w-full h-px bg-[var(--brand-10)]/20 absolute top-3/4" />
            
            {/* Technical readout flicker */}
            <div className="absolute top-10 right-10 font-mono text-[8px] text-[var(--brand-10)] opacity-60 flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--brand-10)] animate-pulse" />
                SESSION_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
              </div>
              <div>SYNC_STATUS: ACTIVE</div>
              <div>RE-CALIBRATING: {Math.floor(Math.random() * 100)}%</div>
            </div>
          </div>
        )}
      </main>


      {showForm && <ObjectiveForm onClose={() => setShowForm(false)} />}
      {selectedObjectiveId && (
        <ObjectiveDetails 
          objectiveId={selectedObjectiveId} 
          onClose={() => setSelectedObjectiveId(null)} 
        />
      )}
    </div>
  );
};

