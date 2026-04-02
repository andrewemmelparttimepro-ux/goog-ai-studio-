import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Calendar, Flag, CheckCircle2, Clock, MessageSquare, Send, Zap, FileText, Paperclip, Plus, Search, Brain, X, RefreshCw, ChevronRight } from 'lucide-react';
import { ObjectiveForm } from './ObjectiveForm';
import { generateEmbedding } from '../services/embeddingService';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from './FirebaseProvider';

interface TaskNote {
  id: string;
  text: string;
  timestamp: string;
  embedding?: number[];
}

interface TaskFile {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

interface RoadmapTask {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  description?: string;
  percentComplete?: number;
  notes?: TaskNote[];
  files?: TaskFile[];
}

interface PersonRoadmap {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  isActive: boolean;
  tasks: RoadmapTask[];
  notes?: TaskNote[];
  files?: TaskFile[];
}

const calculatePosition = (date: string) => {
  const d = new Date(date);
  const start = new Date('2026-03-01');
  const end = new Date('2026-06-30');
  const total = end.getTime() - start.getTime();
  const current = d.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (current / total) * 100));
};

type CardState = 
  | { type: 'TASK', task: RoadmapTask, owner: string, ownerId: string }
  | { type: 'PERSON', person: PersonRoadmap };

const TaskStack: React.FC<{
  tasks: RoadmapTask[];
  person: PersonRoadmap;
  calculatePosition: (date: string) => number;
  setActiveCard: (card: CardState | null) => void;
  getTaskPriority: (t: RoadmapTask) => number;
  isFirstRow: boolean;
}> = ({ tasks, person, calculatePosition, setActiveCard, getTaskPriority, isFirstRow }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedTasks = [...tasks].sort((a, b) => getTaskPriority(b) - getTaskPriority(a));

  const handleWheel = (e: React.WheelEvent) => {
    if (!isHovered || sortedTasks.length <= 1) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      setActiveIndex(prev => (prev + 1) % sortedTasks.length);
    } else {
      setActiveIndex(prev => (prev - 1 + sortedTasks.length) % sortedTasks.length);
    }
  };

  const getStatusColor = (t: RoadmapTask, isTop: boolean) => {
    if (t.status === 'COMPLETED') return isTop ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    const todayDate = new Date('2026-03-20');
    const dueDate = new Date(t.endDate);
    const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return isTop ? 'bg-rose-600 border-rose-400 text-white' : 'bg-rose-500/20 border-rose-500/40 text-rose-400';
    if (diffDays <= 3) return isTop ? 'bg-amber-500 border-amber-400 text-black' : 'bg-amber-500/20 border-amber-500/40 text-amber-400';
    return isTop ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
  };

  // The stack position is based on the earliest start and latest end of the group
  const earliestStart = sortedTasks.reduce((min, t) => new Date(t.startDate) < new Date(min) ? t.startDate : min, sortedTasks[0].startDate);
  const latestEnd = sortedTasks.reduce((max, t) => new Date(t.endDate) > new Date(max) ? t.endDate : max, sortedTasks[0].endDate);
  
  const left = calculatePosition(earliestStart);
  const width = calculatePosition(latestEnd) - left;

  return (
    <div 
      ref={containerRef}
      onWheel={handleWheel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setActiveIndex(0); }}
      className="absolute h-12 flex items-center transition-all duration-500"
      style={{ 
        left: `${left}%`, 
        width: `${Math.max(width, 15)}%`,
        zIndex: isHovered ? 50 : 10
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {sortedTasks.map((task, i) => {
          const isTop = i === activeIndex;
          const offset = isHovered ? 0 : (i - activeIndex) * 4;
          const scale = isHovered ? (isTop ? 1.1 : 0.95) : (1 - Math.abs(i - activeIndex) * 0.05);
          const opacity = isHovered ? (isTop ? 1 : 0.4) : (1 - Math.abs(i - activeIndex) * 0.3);
          
          // Re-calculate individual task position within the stack if needed, 
          // but for macOS style "stack", they usually share a base position when stacked.
          // We'll use the stack's left/width but allow individual tasks to show their range if expanded?
          // Actually, macOS stacks on the dock are at one point. 
          // On the timeline, we'll keep them at the stack's bounds for a clean look.

          return (
            <motion.div
              key={task.id}
              initial={false}
              animate={{ 
                y: offset,
                x: isHovered ? (i - activeIndex) * 10 : 0,
                scale,
                opacity: opacity > 0 ? opacity : 0,
                zIndex: isTop ? 100 : 50 - i
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCard({ type: 'TASK', task, owner: person.name, ownerId: person.id });
              }}
              className={`
                absolute inset-0 h-10 rounded-xl border flex items-center px-4 gap-3 cursor-pointer transition-all shadow-2xl
                ${getStatusColor(task, isTop)}
                ${isTop ? 'brightness-110 ring-2 ring-white/20' : 'brightness-75'}
              `}
            >
              <div className="w-5 h-5 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                {task.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black uppercase tracking-tight truncate">{task.title}</span>
                <span className="text-[7px] opacity-40 font-mono uppercase truncate">{task.startDate} - {task.endDate}</span>
              </div>

              {/* Hover Summary Pop-up (Only for top item) */}
              {isTop && isHovered && (
                <motion.div 
                  initial={{ opacity: 0, y: isFirstRow ? -10 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`absolute ${isFirstRow ? 'top-full mt-4' : 'bottom-full mb-4'} left-1/2 -translate-x-1/2 w-64 p-4 bg-black/95 border border-white/10 rounded-2xl pointer-events-none z-[200] shadow-2xl backdrop-blur-xl`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-black uppercase text-white tracking-widest">{task.title}</div>
                    <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${
                      task.priority === 'CRITICAL' ? 'bg-rose-500 text-white' : 
                      task.priority === 'HIGH' ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60'
                    }`}>
                      {task.priority}
                    </div>
                  </div>
                  <div className="text-[9px] text-white/50 leading-relaxed mb-3 line-clamp-2">
                    {task.description || 'Strategic objective in progress. Tap for full brief and collaboration.'}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[7px] text-white/30 uppercase font-bold">Progress</span>
                      <span className="text-[9px] text-white font-mono">{task.percentComplete || 0}%</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[7px] text-white/30 uppercase font-bold">Due Date</span>
                      <span className="text-[9px] text-white font-mono">{task.endDate}</span>
                    </div>
                  </div>
                  {sortedTasks.length > 1 && (
                    <div className="mt-3 pt-2 border-t border-white/5 text-center">
                      <span className="text-[7px] text-[var(--brand-10)] font-black uppercase tracking-widest animate-pulse">
                        Scroll to cycle stack ({activeIndex + 1}/{sortedTasks.length})
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const Roadmap: React.FC = () => {
  const [roadmapData, setRoadmapData] = useState<PersonRoadmap[]>([]);
  const months = ['Mar', 'Apr', 'May', 'Jun'];
  const [isTimelineMaximized, setIsTimelineMaximized] = useState(true);
  const [activeCard, setActiveCard] = useState<CardState | null>(null);
  const [assigningToId, setAssigningToId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'NOTES' | 'CHAT'>('NOTES');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuth();
  const [chatMessages, setChatMessages] = useState<{[key: string]: {id: string, text: string, sender: string, timestamp: string}[]}>({});
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date('2026-03-20');
  const todayPosition = calculatePosition('2026-03-20');

  const getTaskPriority = (t: RoadmapTask) => {
    if (t.status === 'COMPLETED') return 0;
    const todayDate = new Date('2026-03-20');
    const dueDate = new Date(t.endDate);
    const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 3; // Red
    if (diffDays <= 3) return 2; // Yellow
    return 1; // Green
  };

  const groupTasksIntoStacks = (tasks: RoadmapTask[]) => {
    if (tasks.length === 0) return [];
    const sorted = [...tasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const stacks: RoadmapTask[][] = [];
    
    sorted.forEach(task => {
      let placed = false;
      for (const stack of stacks) {
        const stackEnd = Math.max(...stack.map(t => new Date(t.endDate).getTime()));
        const taskStart = new Date(task.startDate).getTime();
        if (taskStart < stackEnd) {
          stack.push(task);
          placed = true;
          break;
        }
      }
      if (!placed) stacks.push([task]);
    });
    return stacks;
  };

  const [objectives, setObjectives] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let usersData: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Restore "Executive Panel" look if few users exist
      if (usersData.length < 5) {
        const placeholders = [
          { id: 'p1', displayName: 'SARAH CHEN', role: 'CHIEF OPERATING OFFICER', photoURL: 'https://i.pravatar.cc/150?u=sarah' },
          { id: 'p2', displayName: 'MARCUS REED', role: 'VP OF MANUFACTURING', photoURL: 'https://i.pravatar.cc/150?u=marcus' },
          { id: 'p3', displayName: 'ELENA RODRIGUEZ', role: 'HEAD OF LOGISTICS', photoURL: 'https://i.pravatar.cc/150?u=elena' },
          { id: 'p4', displayName: 'KEVIN MALONE', role: 'CHIEF FINANCIAL OFFICER', photoURL: 'https://i.pravatar.cc/150?u=kevin' }
        ];
        const existingIds = new Set(usersData.map(u => u.id));
        const existingNames = new Set(usersData.map(u => u.displayName?.toUpperCase()));
        placeholders.forEach(p => {
          if (!existingIds.has(p.id) && !existingNames.has(p.displayName)) usersData.push(p);
        });
      }
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = collection(db, 'objectives');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setObjectives(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'objectives');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (users.length === 0) return;

    const mappedData = users.map((u: any, index) => {
      const userObjectives = objectives.filter((o: any) => o.assignedToId === u.id);
      const colors = ['bg-indigo-600', 'bg-indigo-500', 'bg-indigo-400', 'bg-emerald-500', 'bg-indigo-300', 'bg-indigo-400', 'bg-emerald-400'];
      
      return {
        id: u.id,
        name: u.displayName?.toUpperCase() || 'UNKNOWN',
        role: u.role || 'Team Member',
        avatar: u.photoURL || `https://picsum.photos/seed/${u.id}/100/100`,
        color: colors[index % colors.length],
        isActive: true,
        tasks: userObjectives.map((o: any) => {
          const start = o.startDate ? (o.startDate instanceof Timestamp ? o.startDate.toDate().toISOString().split('T')[0] : o.startDate) : 
                       (o.createdAt instanceof Timestamp ? o.createdAt.toDate().toISOString().split('T')[0] : '2026-03-01');
          
          return {
            id: o.id,
            title: o.title,
            startDate: start,
            endDate: o.dueDate instanceof Timestamp ? o.dueDate.toDate().toISOString().split('T')[0] : new Date(o.dueDate).toISOString().split('T')[0],
            status: o.status === 'COMPLETED' ? 'COMPLETED' : (o.status === 'NOT_STARTED' ? 'PENDING' : 'IN_PROGRESS'),
            priority: o.priority,
            description: o.description,
            percentComplete: o.percentComplete || 0,
            notes: [],
            files: []
          };
        })
      };
    });
    setRoadmapData(mappedData);
  }, [users, objectives]);

  const highPriorityTasks = roadmapData.flatMap(p => 
    p.tasks.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL').map(t => ({ ...t, owner: p.name }))
  );

  useEffect(() => {
    if (!activeCard || activeTab !== 'CHAT' || !user) return;

    const targetId = activeCard.type === 'TASK' ? activeCard.task.id : activeCard.person.id;
    const messagesRef = collection(db, 'chats', targetId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          sender: data.senderId === user.uid ? 'YOU' : data.senderName || 'THEM',
          timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString()
        };
      });
      setChatMessages(prev => ({ ...prev, [targetId]: msgs }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${targetId}/messages`);
    });

    return () => unsubscribe();
  }, [activeCard, activeTab, user]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !activeCard) return;
    setIsProcessing(true);
    
    const embedding = await generateEmbedding(newNote);
    const note: TaskNote = {
      id: Math.random().toString(36).substr(2, 9),
      text: newNote,
      timestamp: new Date().toISOString(),
      embedding: embedding || undefined
    };

    if (activeCard.type === 'TASK') {
      const updatedTask = {
        ...activeCard.task,
        notes: [...(activeCard.task.notes || []), note]
      };
      setActiveCard({ ...activeCard, task: updatedTask });
    } else {
      const updatedPerson = {
        ...activeCard.person,
        notes: [...(activeCard.person.notes || []), note]
      };
      setActiveCard({ ...activeCard, person: updatedPerson });
    }
    setNewNote('');
    setIsProcessing(false);
  };

  const handleAddChatMessage = async () => {
    if (!newChatMessage.trim() || !activeCard || !user) return;
    
    setIsProcessing(true);
    const targetId = activeCard.type === 'TASK' ? activeCard.task.id : activeCard.person.id;
    const messagesRef = collection(db, 'chats', targetId, 'messages');
    
    try {
      await addDoc(messagesRef, {
        text: newChatMessage,
        senderId: user.uid,
        senderName: user.displayName || 'Unknown',
        timestamp: serverTimestamp()
      });
      setNewChatMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${targetId}/messages`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCard) return;

    setIsUploading(true);
    const targetId = activeCard.type === 'TASK' ? activeCard.task.id : activeCard.person.id;
    const storageRef = ref(storage, `uploads/${targetId}/${file.name}`);

    try {
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      const newFile: TaskFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        url: url
      };

      if (activeCard.type === 'TASK') {
        const updatedTask = {
          ...activeCard.task,
          files: [...(activeCard.task.files || []), newFile]
        };
        setActiveCard({ ...activeCard, task: updatedTask });
      } else {
        const updatedPerson = {
          ...activeCard.person,
          files: [...(activeCard.person.files || []), newFile]
        };
        setActiveCard({ ...activeCard, person: updatedPerson });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className={`w-full h-full flex flex-col gap-4 relative overflow-hidden transition-all duration-500 ${isTimelineMaximized ? 'px-4 md:px-8 lg:px-12 py-4 md:py-8' : 'px-6 md:px-16 lg:px-24 py-6 md:py-16'}`}>
      {/* Background Glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Dotted Background Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <header className={`flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10 border-b border-white/5 pb-4 transition-all duration-500 opacity-100`}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2 py-0.5 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest rounded-sm shadow-[0_0_15px_rgba(99,102,241,0.5)]">Optimized</div>
            <div className="text-[10px] font-mono text-[var(--accents-4)] uppercase tracking-[0.3em]">Today: {today.toLocaleDateString()}</div>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">The Master Plan</h2>
          <p className="text-[var(--accents-6)] font-bold uppercase tracking-[0.4em] text-[9px] mt-2">Shipping big things, one step at a time</p>
        </div>
        <div className="flex gap-6 md:gap-12">
          <div className="text-left md:text-right">
            <div className="text-[10px] font-black text-[var(--accents-4)] uppercase tracking-widest mb-1">Momentum</div>
            <div className="text-xl font-black text-white tracking-tighter">84%</div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-[10px] font-black text-[var(--accents-4)] uppercase tracking-widest mb-1">On the ground</div>
            <div className="text-xl font-black text-indigo-400 tracking-tighter">12/15</div>
          </div>
        </div>
      </header>

      {/* Top Section: High Priority Task Tracker (Kanban Style) */}
      <section className={`relative z-10 transition-all duration-500 ${isTimelineMaximized ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-1.5 h-6 bg-[var(--brand-10)] rounded-full shadow-[0_0_15px_rgba(247,148,29,0.4)]" />
          <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">The Must-Haves</h3>
        </div>
        
        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible pb-2 custom-scrollbar snap-x snap-mandatory">
          {['TO DO', 'IN PROGRESS', 'DONE'].map((column) => (
            <div key={column} className="min-w-[85vw] md:min-w-0 snap-center bg-white/[0.02] border border-white/5 rounded-3xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1 px-2">
                <span className="text-[9px] font-black text-[var(--accents-5)] uppercase tracking-[0.2em]">{column}</span>
                <div className="text-[10px] font-black text-white opacity-40">
                  {highPriorityTasks.filter(t => 
                    (column === 'TO DO' && t.status === 'PENDING') ||
                    (column === 'IN PROGRESS' && t.status === 'IN_PROGRESS') ||
                    (column === 'DONE' && t.status === 'COMPLETED')
                  ).length}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto custom-scrollbar pr-2">
                {highPriorityTasks.filter(t => 
                  (column === 'TO DO' && t.status === 'PENDING') ||
                  (column === 'IN PROGRESS' && t.status === 'IN_PROGRESS') ||
                  (column === 'DONE' && t.status === 'COMPLETED')
                ).map(task => (
                  <motion.div 
                    key={task.id}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    onClick={() => {
                      const person = roadmapData.find(p => p.name === task.owner);
                      if (person) setActiveCard({ type: 'TASK', task, owner: person.name, ownerId: person.id });
                    }}
                    className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[var(--brand-10)]" />
                        <span className="text-[8px] font-black text-[var(--accents-5)] uppercase tracking-widest">{task.owner}</span>
                      </div>
                      <Zap className="w-3 h-3 text-[var(--brand-10)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs font-bold text-white tracking-tight leading-snug">{task.title}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Roadmap Grid */}
      <motion.section 
        layout
        className={`relative z-10 flex flex-col gap-1 mt-1 transition-all duration-500 flex-1 ${isTimelineMaximized ? 'h-full' : ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-6 bg-white/20 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">The Journey</h3>
          </div>
          <button 
            onClick={() => setIsTimelineMaximized(!isTimelineMaximized)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all flex items-center gap-2 group"
          >
            <Zap className={`w-3 h-3 transition-transform duration-500 ${isTimelineMaximized ? 'rotate-180 text-[var(--brand-10)]' : 'text-white/40'}`} />
            {isTimelineMaximized ? 'Minimize View' : 'Maximize View'}
          </button>
        </div>

        <motion.div 
          layout
          className={`flex gap-4 overflow-hidden transition-all duration-500 ${isTimelineMaximized ? 'h-[calc(100vh-180px)]' : 'min-h-[450px] flex-1'}`}
        >
          {/* Left Panel: Exec Panel & Names */}
          <div className="w-20 md:w-56 flex flex-col gap-2 overflow-y-auto pr-1 md:pr-2 custom-scrollbar shrink-0">
            <div className="bg-indigo-600 text-white px-2 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-center shadow-[0_10px_30px_rgba(79,70,229,0.3)] border-b-4 border-indigo-800 sticky top-0 z-20 truncate">
              <span className="hidden md:inline">Executive Panel</span>
              <span className="md:hidden">Exec</span>
            </div>
            {roadmapData.map(person => (
              <div key={person.id} className="relative group">
                <div 
                  onClick={() => {
                    if (person.isActive) {
                      setActiveCard({ type: 'PERSON', person });
                      setActiveTab('CHAT');
                    }
                  }}
                  className={`
                  ${person.color} text-white px-2 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-center transition-all duration-500 flex items-center justify-center gap-2 md:gap-3
                  ${person.isActive ? 'cursor-pointer shadow-[0_0_30px_rgba(255,255,255,0.15)] ring-1 ring-white/20 scale-[1.02]' : 'opacity-40 grayscale'}
                `}>
                  {person.isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />}
                  <span className="truncate">{person.name}</span>
                </div>
                
                {/* Interaction Tooltip */}
                {person.isActive && (
                  <div className="absolute left-full ml-2 md:ml-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0">
                    <div className="bg-[var(--accents-2)] text-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl text-[10px] font-bold uppercase tracking-widest w-48 md:w-56 leading-relaxed border border-white/10 relative backdrop-blur-2xl">
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white/10" />
                      <div className="flex items-center gap-3 mb-3 md:mb-4">
                        <div className="w-2 h-2 rounded-full bg-[var(--success-9)] animate-pulse" />
                        <span className="text-[var(--accents-6)]">On the ground</span>
                      </div>
                      <p className="text-[var(--accents-8)] leading-relaxed hidden md:block">
                        You're now in sync with {person.name.split(' ')[0]}.
                      </p>
                      <div className="flex flex-col gap-2 mt-4 md:mt-6">
                        <button 
                          onClick={() => { setActiveCard({ type: 'PERSON', person }); setActiveTab('CHAT'); }}
                          className="secondary-button !px-4 !py-3 !text-[8px] w-full flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-3 h-3" />
                          SEND MESSAGE
                        </button>
                        <button 
                          onClick={() => { setActiveCard({ type: 'PERSON', person }); setAssigningToId(person.id); }}
                          className="accent-button !px-4 !py-3 !text-[8px] w-full flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          PUSH TASK
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right Panel: Timeline */}
          <div className="flex-1 relative bg-white/[0.01] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-8 flex flex-col">
            <div className="flex-1 relative overflow-y-auto overflow-x-auto custom-scrollbar pr-2 md:pr-4 pt-20">
              <div className="min-w-[600px] h-full relative">
                {/* Timeline Grid Lines */}
              <div className="absolute inset-0 flex justify-between pointer-events-none">
                {months.map((m, i) => (
                  <div key={m} className="flex flex-col items-center h-full relative" style={{ width: `${100 / months.length}%` }}>
                    <div className="w-px h-full bg-white/[0.03]" />
                    <span className="absolute bottom-4 text-[8px] font-black text-[var(--accents-5)] uppercase tracking-[0.3em] pb-2">{m}</span>
                  </div>
                ))}
              </div>

              {/* Today Indicator */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-[var(--brand-10)] z-20 shadow-[0_0_10px_rgba(247,148,29,0.5)]"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--brand-10)] text-black text-[7px] font-black uppercase rounded-b-sm">Today</div>
              </div>

              {/* Task Tracks */}
              <div className="relative flex flex-col gap-6 pt-8">
                {roadmapData.map((person, personIdx) => {
                  const stacks = groupTasksIntoStacks(person.tasks);
                  return (
                    <div key={person.id} className="min-h-[64px] flex items-center relative border-b border-white/[0.02] py-4">
                      {stacks.map((stack, stackIdx) => (
                        <TaskStack 
                          key={stackIdx}
                          tasks={stack}
                          person={person}
                          calculatePosition={calculatePosition}
                          setActiveCard={setActiveCard}
                          getTaskPriority={getTaskPriority}
                          isFirstRow={personIdx === 0}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>

      {/* Unified Card Modal */}
      <AnimatePresence>
        {activeCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6 bg-black/90 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 40 }}
              className="w-full max-w-5xl h-[90vh] md:h-[85vh] bg-[var(--accents-2)] border border-white/10 rounded-[2rem] md:rounded-[4rem] flex flex-col md:flex-row overflow-hidden shadow-2xl"
            >
              {/* Left Panel: Info & Files */}
              <div className="w-full h-auto max-h-[50%] md:max-h-none md:h-auto md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 p-6 md:p-12 flex flex-col gap-6 md:gap-8 bg-white/[0.01] overflow-y-auto custom-scrollbar shrink-0 md:shrink">
                {activeCard.type === 'TASK' ? (
                  <>
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest ${
                          activeCard.task.status === 'COMPLETED' ? 'bg-blue-400 text-black' : 'bg-[var(--brand-10)] text-black'
                        }`}>
                          {activeCard.task.status.replace('_', ' ')}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--accents-4)] uppercase tracking-widest">ID: {activeCard.task.id}</div>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-tight mb-4">{activeCard.task.title}</h3>
                      
                      <button 
                        onClick={() => {
                          const person = roadmapData.find(p => p.id === activeCard.ownerId);
                          if (person) setActiveCard({ type: 'PERSON', person });
                        }}
                        className="flex items-center gap-3 text-[var(--accents-5)] mb-6 md:mb-8 hover:text-white transition-colors group text-left"
                      >
                        <User className="w-4 h-4 group-hover:text-[var(--brand-10)] transition-colors" />
                        <span className="text-xs font-bold uppercase tracking-widest">{activeCard.owner}</span>
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => {
                            const person = roadmapData.find(p => p.id === activeCard.ownerId);
                            if (person) { setActiveCard({ type: 'PERSON', person }); setActiveTab('CHAT'); }
                          }}
                          className="secondary-button !px-4 !py-4 !text-[9px] flex items-center justify-center gap-2 border-white/10"
                        >
                          <MessageSquare className="w-4 h-4" />
                          MESSAGE
                        </button>
                        <button 
                          onClick={() => setAssigningToId(activeCard.ownerId)}
                          className="accent-button !px-4 !py-4 !text-[9px] flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          PUSH TASK
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest ${activeCard.person.color} text-white`}>
                          {activeCard.person.role}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--accents-4)] uppercase tracking-widest">ID: {activeCard.person.id}</div>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-tight mb-4">{activeCard.person.name}</h3>
                      
                      <div className="grid grid-cols-2 gap-3 mt-6 md:mt-8">
                        <button 
                          onClick={() => setActiveTab('CHAT')}
                          className={`secondary-button !px-4 !py-4 !text-[9px] flex items-center justify-center gap-2 border-white/10 ${activeTab === 'CHAT' ? 'bg-white/10 text-white' : ''}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          MESSAGE
                        </button>
                        <button 
                          onClick={() => setAssigningToId(activeCard.person.id)}
                          className="accent-button !px-4 !py-4 !text-[9px] flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          PUSH TASK
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Active Tasks</h4>
                      <div className="space-y-2">
                        {activeCard.person.tasks.map(t => (
                          <div 
                            key={t.id} 
                            onClick={() => setActiveCard({ type: 'TASK', task: t, owner: activeCard.person.name, ownerId: activeCard.person.id })} 
                            className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl cursor-pointer hover:bg-white/[0.08] transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className={`text-[8px] font-black uppercase tracking-widest ${t.status === 'COMPLETED' ? 'text-blue-400' : 'text-[var(--brand-10)]'}`}>
                                {t.status.replace('_', ' ')}
                              </div>
                              <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/60 transition-colors" />
                            </div>
                            <div className="text-xs font-bold text-white truncate">{t.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-4 md:space-y-6 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Attached Assets</h4>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isUploading ? <RefreshCw className="w-4 h-4 text-[var(--brand-10)] animate-spin" /> : <Plus className="w-4 h-4 text-[var(--brand-10)]" />}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </div>
                  <div className="space-y-3">
                    {(activeCard.type === 'TASK' ? activeCard.task.files : activeCard.person.files)?.map(file => (
                      <div key={file.id} className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/5 rounded-2xl group cursor-pointer hover:bg-white/[0.05] transition-all">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[var(--brand-10)]/20 transition-colors">
                          <Paperclip className="w-5 h-5 group-hover:text-[var(--brand-10)] transition-colors" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate">{file.name}</span>
                          <span className="text-[9px] text-[var(--accents-4)] uppercase font-mono">{file.size} • {file.type}</span>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-[10px] text-[var(--accents-4)] font-bold uppercase tracking-widest">No assets linked</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 md:pt-8">
                  <button 
                    onClick={() => setActiveCard(null)}
                    className="w-full py-4 md:py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all border border-white/5 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3"
                  >
                    <X className="w-4 h-4" />
                    Close Card
                  </button>
                </div>
              </div>

              {/* Right Panel: Strategic Notes & Intelligence / Communication */}
              <div className="flex-1 p-6 md:p-12 flex flex-col gap-4 md:gap-8 bg-black/20 min-h-0 md:min-h-[400px]">
                <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isExpanded ? 'hidden' : 'flex'}`}>
                  <div className="flex items-center gap-3 md:gap-6">
                    <button 
                      onClick={() => setActiveTab('NOTES')}
                      className={`flex items-center gap-2 md:gap-3 transition-all ${activeTab === 'NOTES' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <Brain className={`w-4 h-4 md:w-6 md:h-6 ${activeTab === 'NOTES' ? 'text-[var(--brand-10)]' : 'text-white/20'}`} />
                      <h4 className="text-sm md:text-xl font-black uppercase tracking-tighter">The Deep Dive</h4>
                    </button>
                    <div className="w-px h-4 md:h-6 bg-white/10" />
                    <button 
                      onClick={() => setActiveTab('CHAT')}
                      className={`flex items-center gap-2 md:gap-3 transition-all ${activeTab === 'CHAT' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <MessageSquare className={`w-4 h-4 md:w-6 md:h-6 ${activeTab === 'CHAT' ? 'text-indigo-400' : 'text-white/20'}`} />
                      <h4 className="text-sm md:text-xl font-black uppercase tracking-tighter">The Wire</h4>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 self-start md:self-auto">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                      {activeTab === 'NOTES' ? 'AI is paying attention' : 'End-to-end encrypted'}
                    </span>
                  </div>
                </div>

                <div className={`flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar ${isExpanded ? 'fixed inset-0 z-50 bg-black/90 p-12' : ''}`}>
                  {isExpanded && (
                    <button onClick={() => setIsExpanded(false)} className="absolute top-6 right-6 text-white/50 hover:text-white">
                      <X className="w-8 h-8" />
                    </button>
                  )}
                  {activeTab === 'NOTES' ? (
                    <>
                      {(activeCard.type === 'TASK' ? activeCard.task.notes : activeCard.person.notes)?.map(note => (
                        <div key={note.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] relative group">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-mono text-[var(--accents-4)] uppercase tracking-widest">
                              {new Date(note.timestamp).toLocaleString()}
                            </span>
                            {note.embedding && (
                              <div className="flex gap-1">
                                {[...Array(4)].map((_, i) => (
                                  <div key={i} className="w-1 h-3 bg-[var(--brand-10)]/40 rounded-full" />
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-white/80 leading-relaxed font-medium">{note.text}</p>
                        </div>
                      )) || (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                          <FileText className="w-16 h-16 mb-4" />
                          <p className="text-sm font-bold uppercase tracking-[0.3em]">Nothing to report... yet</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {(chatMessages[activeCard.type === 'TASK' ? activeCard.task.id : activeCard.person.id] || []).map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'YOU' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[80%] p-5 rounded-[2rem] ${msg.sender === 'YOU' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white/5 text-white/80 rounded-tl-sm border border-white/5'}`}>
                            <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                          </div>
                          <span className="text-[8px] font-mono text-white/20 uppercase mt-2 px-2">{msg.sender} • {new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                      {(!chatMessages[activeCard.type === 'TASK' ? activeCard.task.id : activeCard.person.id] || chatMessages[activeCard.type === 'TASK' ? activeCard.task.id : activeCard.person.id].length === 0) && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-20">
                          <MessageSquare className="w-16 h-16 mb-4" />
                          <p className="text-sm font-bold uppercase tracking-[0.3em]">No messages on the wire</p>
                        </div>
                      )}
                    </div>
                  )}
                  {!isExpanded && (
                    <button onClick={() => setIsExpanded(true)} className="absolute bottom-6 right-6 bg-white/10 p-2 rounded-full hover:bg-white/20">
                      <Zap className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea 
                    value={activeTab === 'NOTES' ? newNote : newChatMessage}
                    onChange={(e) => activeTab === 'NOTES' ? setNewNote(e.target.value) : setNewChatMessage(e.target.value)}
                    placeholder={activeTab === 'NOTES' ? "What's the word?" : "Send a message..."}
                    className="w-full h-32 bg-white/[0.03] border border-white/10 rounded-3xl p-6 text-sm text-white focus:outline-none focus:border-[var(--brand-10)]/40 transition-all resize-none pr-32"
                  />
                  <button 
                    onClick={activeTab === 'NOTES' ? handleAddNote : handleAddChatMessage}
                    disabled={isProcessing || (activeTab === 'NOTES' ? !newNote.trim() : !newChatMessage.trim())}
                    className="absolute bottom-6 right-6 px-6 py-3 bg-[var(--brand-10)] text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {isProcessing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                    {activeTab === 'NOTES' ? 'Log Note' : 'Send Message'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Task Modal */}
      {assigningToId && (
        <ObjectiveForm 
          onClose={() => setAssigningToId(null)} 
          initialOwnerId={assigningToId}
        />
      )}
    </div>
  );
};
