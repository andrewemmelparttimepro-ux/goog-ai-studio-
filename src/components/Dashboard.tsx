import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './FirebaseProvider';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, Timestamp, getDocs, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

interface Source {
  id: string;
  name: string;
  type: string;
  content: string;
  url?: string;
  createdAt?: any;
}

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
  const [sources, setSources] = useState<any[]>([]);
  const [newSourceText, setNewSourceText] = useState('');
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Section Management
  const [sectionIndex, setSectionIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const lastScrollTime = useRef(0);
  const touchStartY = useRef(0);
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
    if (now - lastScrollTime.current < 1200) return;

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const delta = touchStartY.current - touchEndY;
    const now = Date.now();
    
    if (now - lastScrollTime.current < 1200) return;

    if (Math.abs(delta) > 50) { // 50px swipe threshold
      if (delta > 0 && sectionIndex < totalSections - 1) {
        lastScrollTime.current = now;
        goToSection(sectionIndex + 1);
      } else if (delta < 0 && sectionIndex > 0) {
        lastScrollTime.current = now;
        goToSection(sectionIndex - 1);
      }
    }
  };

  const scrollToRoadmap = () => {
    goToSection(1);
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

    const unsubSources = onSnapshot(collection(db, 'sources'), (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Source)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sources');
    });

    return () => {
      unsubscribe();
      unsubSources();
    };
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

  const addSource = async () => {
    if (!newSourceText.trim()) return;
    try {
      await addDoc(collection(db, 'sources'), {
        name: newSourceText.length > 20 ? newSourceText.substring(0, 20) + '...' : newSourceText,
        type: 'TEXT',
        content: newSourceText,
        createdAt: serverTimestamp(),
        authorId: user?.uid
      });
      setNewSourceText('');
      setShowSourceInput(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sources');
    }
  };

  const removeSource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sources', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sources/${id}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    const storageRef = ref(storage, `knowledge-base/${user.uid}/${Date.now()}_${file.name}`);
    
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      await addDoc(collection(db, 'sources'), {
        name: file.name,
        type: 'FILE',
        fileType: file.type,
        url: url,
        createdAt: serverTimestamp(),
        authorId: user.uid,
        content: `File upload: ${file.name} (${file.type})`
      });
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
    }
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
                    <TrendingUp className="w-5 h-5" />
                    <span>The Game Plan</span>
                  </button>
                  <button 
                    onClick={() => goToSection(2)}
                    className={`sidebar-item w-full ${sectionIndex === 2 ? 'sidebar-item-active' : ''}`}
                  >
                    <Brain className="w-5 h-5" />
                    <span>The Brain</span>
                  </button>
                  <button 
                    onClick={() => goToSection(3)}
                    className={`sidebar-item w-full ${sectionIndex === 3 ? 'sidebar-item-active' : ''}`}
                  >
                    <Zap className="w-5 h-5" />
                    <span>Knowledge Base</span>
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-hidden relative perspective-2000"
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={sectionIndex}
            custom={direction}
            variants={{
              enter: (direction: number) => ({
                rotateY: direction > 0 ? 180 : -180,
                opacity: 0,
                scale: 0.95
              }),
              center: {
                rotateY: 0,
                opacity: 1,
                scale: 1,
                transition: {
                  duration: 0.7,
                  ease: [0.23, 1, 0.32, 1]
                }
              },
              exit: (direction: number) => ({
                rotateY: direction > 0 ? -180 : 180,
                opacity: 0,
                scale: 0.95,
                transition: {
                  duration: 0.7,
                  ease: [0.23, 1, 0.32, 1]
                }
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            className="h-full w-full absolute inset-0 bg-[var(--accents-1)] overflow-hidden"
            style={{ 
              backfaceVisibility: 'hidden', 
              transformStyle: 'preserve-3d',
              zIndex: isTransitioning ? 10 : 1
            }}
          >
            {sectionIndex === 0 && (
              <section className="h-full flex flex-col px-6 md:px-16 lg:px-24 py-6 md:py-12 overflow-hidden">
          <header className="flex-1 flex flex-col justify-center min-h-0 py-4 md:py-0">
              <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-8 md:gap-12 min-h-0">
                {/* Left: Strategic Briefing */}
                <div className="flex-1 flex flex-col justify-center min-h-0">
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[var(--brand-10)] font-black text-[10px] md:text-xs uppercase tracking-[0.5em] mb-4 md:mb-8 shrink-0"
                  >
                    The Morning Report • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </motion.p>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 min-h-0 max-h-[45vh] md:max-h-none">
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
                          className="space-y-8 md:space-y-12"
                        >
                          <div className="relative">
                            <h1 className="pitch-header text-4xl md:text-6xl lg:text-8xl">
                              {dailyBriefing.headline}
                            </h1>
                            <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start mt-6 md:mt-8">
                              <p className="text-lg md:text-2xl text-[var(--accents-9)] font-light leading-[1.2] max-w-2xl tracking-tight">
                                {dailyBriefing.summary}
                              </p>
                              
                              <div className="flex flex-col gap-6 md:gap-8 border-l border-white/10 pl-8 md:pl-12">
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-10)]">Priority Focus</span>
                                  <p className="text-sm md:text-base text-white font-medium leading-snug max-w-xs">
                                    {dailyBriefing.priorityFocus}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accents-6)]">Strategic Insight</span>
                                  <p className="text-sm md:text-base text-[var(--accents-6)] font-medium leading-snug max-w-xs">
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
                          className="pitch-header text-4xl md:text-6xl lg:text-8xl"
                        >
                          Strategic <br />
                          <span className="text-[var(--accents-6)]">Intelligence</span>
                        </motion.h1>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right: Vertical Action Pillars */}
                <div className="flex flex-col gap-4 md:gap-6 w-full lg:w-[450px] shrink-0">
                  
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowForm(true)}
                    className="flex-1 min-h-[140px] md:min-h-[200px] group relative flex flex-col items-center justify-center gap-3 md:gap-8 bg-gradient-to-br from-[var(--brand-10)]/20 via-[var(--brand-10)]/5 to-transparent border border-[var(--brand-10)]/30 rounded-[2rem] md:rounded-[4rem] overflow-hidden transition-all duration-500 shadow-[0_40px_100px_rgba(247,148,29,0.15)]"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(247,148,29,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative">
                      <div className="absolute inset-0 bg-[var(--brand-10)] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="icon-container !bg-[var(--brand-10)] !w-12 !h-12 md:!w-28 md:!h-28 !shadow-[0_0_80px_rgba(247,148,29,0.5)] group-hover:scale-110 transition-transform duration-700 relative z-10">
                        <Plus className="w-6 h-6 md:w-14 md:h-14 stroke-[3] text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="text-center px-6 md:px-10 relative z-10">
                      <span className="text-xl md:text-4xl font-black text-white uppercase tracking-tighter block mb-1 md:mb-2 group-hover:tracking-tight transition-all">New Objective</span>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-10)] animate-pulse" />
                        <p className="text-[8px] md:text-[11px] font-black text-[var(--brand-10)] uppercase tracking-[0.4em] opacity-80">Let's get started</p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={scrollToRoadmap}
                    className="flex-1 min-h-[140px] md:min-h-[200px] group relative flex flex-col items-center justify-center gap-3 md:gap-8 bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent border border-indigo-500/30 rounded-[2rem] md:rounded-[4rem] overflow-hidden transition-all duration-500 shadow-[0_40px_100px_rgba(99,102,241,0.15)]"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative">
                      <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="icon-container !bg-indigo-500 !w-12 !h-12 md:!w-28 md:!h-28 !shadow-[0_0_80px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-700 relative z-10">
                        <div className="w-6 h-6 md:w-14 md:h-14 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-full h-full text-white drop-shadow-lg">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="text-center px-6 md:px-10 relative z-10">
                      <span className="text-xl md:text-4xl font-black text-white uppercase tracking-tighter block mb-1 md:mb-2 group-hover:tracking-tight transition-all">Current Roadmap</span>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <p className="text-[8px] md:text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] opacity-80">Where we're headed</p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>
          </header>
        </section>
            )}

            {sectionIndex === 1 && (
              <section className="h-full flex flex-col bg-[var(--accents-1)] overflow-hidden">
                <Roadmap />
              </section>
            )}

            {sectionIndex === 2 && (
              <section className="h-full flex flex-col px-6 md:px-16 lg:px-24 bg-[var(--accents-1)] py-6 md:py-16 overflow-y-auto custom-scrollbar">
          {/* Top Widgets Grid */}
          <div className="grid grid-cols-1 gap-4 md:gap-8 flex-1">
          {/* Sources & AI Insights Widget */}
          <section className="modern-card p-6 md:p-10 flex flex-col min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-12">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-[var(--brand-10)]/10 rounded-xl md:rounded-[1.5rem] flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5 md:w-8 md:h-8 text-[var(--brand-10)]" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tighter">The Knowledge Base</h3>
                  <p className="text-[10px] md:text-xs text-[var(--accents-6)] font-bold uppercase tracking-widest mt-1">Making sense of the chaos</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <button 
                  onClick={() => setShowSourceInput(!showSourceInput)}
                  className="secondary-button flex items-center gap-2 md:gap-3 !px-3 md:!px-6 !py-2 md:!py-3 !text-[10px] md:!text-xs"
                >
                  <Plus className="w-3 h-3 md:w-4 md:h-4" />
                  <span>Add Note</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="secondary-button flex items-center gap-2 md:gap-3 !px-3 md:!px-6 !py-2 md:!py-3 !text-[10px] md:!text-xs disabled:opacity-50"
                >
                  {isUploading ? <RefreshCw className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Plus className="w-3 h-3 md:w-4 md:h-4" />}
                  <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <button 
                  onClick={runPortfolioSummary}
                  disabled={isSummarizing || (objectives.length === 0 && sources.length === 0)}
                  className="accent-button flex items-center gap-2 md:gap-3 disabled:opacity-50 !px-3 md:!px-6 !py-2 md:!py-3 !text-[10px] md:!text-xs"
                >
                  {isSummarizing ? <RefreshCw className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Zap className="w-3 h-3 md:w-4 md:h-4" />}
                  <span>{portfolioSummary ? 'Re-Analyze' : 'Generate Insights'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-12 flex-1">
              {/* Sources List */}
              <div className="lg:col-span-2 flex flex-col">
                <div className="text-[10px] font-black text-[var(--accents-6)] uppercase tracking-[0.3em] mb-4 md:mb-6">What we know ({sources.length})</div>
                
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
        </div>
      </section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Transition overlay removed as per request */}
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

