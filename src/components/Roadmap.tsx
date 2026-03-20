import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Calendar, Flag, CheckCircle2, Clock, MessageSquare, Send, Zap, FileText, Paperclip, Plus, Search, Brain, X, RefreshCw } from 'lucide-react';
import { ObjectiveForm } from './ObjectiveForm';
import { generateEmbedding } from '../services/embeddingService';

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
}

const MOCK_ROADMAP: PersonRoadmap[] = [
  {
    id: '1',
    name: 'JOSH',
    role: 'Lead Architect',
    avatar: 'https://picsum.photos/seed/josh/100/100',
    color: 'bg-indigo-600',
    isActive: true,
    tasks: [
      { 
        id: 't1', 
        title: 'Core Infrastructure Audit', 
        startDate: '2026-03-01', 
        endDate: '2026-03-15', 
        status: 'COMPLETED', 
        priority: 'HIGH',
        description: 'Comprehensive review of the primary cloud infrastructure and security protocols.',
        notes: [
          { id: 'n1', text: 'Initial scan shows 98% compliance with security standards.', timestamp: '2026-03-02T10:00:00Z', embedding: [0.1, 0.2, 0.3] },
          { id: 'n2', text: 'Identified minor latency issues in the US-East region.', timestamp: '2026-03-05T14:30:00Z', embedding: [0.4, 0.5, 0.6] }
        ],
        files: [
          { id: 'f1', name: 'Audit_Report_V1.pdf', type: 'PDF', size: '2.4 MB', url: '#' },
          { id: 'f2', name: 'Security_Scan_Results.xlsx', type: 'XLSX', size: '1.1 MB', url: '#' }
        ]
      },
      { id: 't2', title: 'Database Migration Strategy', startDate: '2026-03-16', endDate: '2026-04-05', status: 'IN_PROGRESS', priority: 'HIGH' },
    ]
  },
  {
    id: '2',
    name: 'KELBY',
    role: 'Product Strategy',
    avatar: 'https://picsum.photos/seed/kelby/100/100',
    color: 'bg-indigo-500',
    isActive: false,
    tasks: [
      { id: 't4', title: 'Market Analysis Q2', startDate: '2026-03-05', endDate: '2026-03-20', status: 'COMPLETED', priority: 'MEDIUM' },
      { id: 't5', title: 'Product Roadmap Alignment', startDate: '2026-03-22', endDate: '2026-04-15', status: 'IN_PROGRESS', priority: 'HIGH' },
    ]
  },
  {
    id: '3',
    name: 'DREW',
    role: 'UX Director',
    avatar: 'https://picsum.photos/seed/drew/100/100',
    color: 'bg-indigo-400',
    isActive: true,
    tasks: [
      { id: 't7', title: 'Design System V2', startDate: '2026-03-10', endDate: '2026-04-01', status: 'IN_PROGRESS', priority: 'HIGH' },
    ]
  },
  {
    id: '4',
    name: 'KAYLA',
    role: 'Frontend Lead',
    avatar: 'https://picsum.photos/seed/kayla/100/100',
    color: 'bg-emerald-500',
    isActive: false,
    tasks: [
      { id: 't8', title: 'Component Library Refactor', startDate: '2026-03-15', endDate: '2026-04-10', status: 'IN_PROGRESS', priority: 'MEDIUM' },
    ]
  },
  {
    id: '5',
    name: 'MALCOMB',
    role: 'Backend Engineer',
    avatar: 'https://picsum.photos/seed/malcomb/100/100',
    color: 'bg-indigo-300',
    isActive: false,
    tasks: [
      { id: 't9', title: 'API Documentation', startDate: '2026-03-20', endDate: '2026-04-05', status: 'PENDING', priority: 'LOW' },
    ]
  }
];

const HIGH_PRIORITY_TASKS = MOCK_ROADMAP.flatMap(p => 
  p.tasks.filter(t => t.priority === 'HIGH').map(t => ({ ...t, owner: p.name }))
);

const calculatePosition = (date: string) => {
  const d = new Date(date);
  const start = new Date('2026-03-01');
  const end = new Date('2026-06-30');
  const total = end.getTime() - start.getTime();
  const current = d.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (current / total) * 100));
};

export const Roadmap: React.FC = () => {
  const months = ['Mar', 'Apr', 'May', 'Jun'];
  const [isTimelineMaximized, setIsTimelineMaximized] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<{task: RoadmapTask, owner: string, ownerId: string} | null>(null);
  const [assigningToId, setAssigningToId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'NOTES' | 'CHAT'>('NOTES');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatMessages, setChatMessages] = useState<{[key: string]: {id: string, text: string, sender: string, timestamp: string}[]}>({});
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date('2026-03-20');
  const todayPosition = calculatePosition('2026-03-20');

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedTask) return;
    setIsProcessing(true);
    
    const embedding = await generateEmbedding(newNote);
    const note: TaskNote = {
      id: Math.random().toString(36).substr(2, 9),
      text: newNote,
      timestamp: new Date().toISOString(),
      embedding: embedding || undefined
    };

    // In a real app, we'd update Firestore here. 
    // For now, we update local state.
    const updatedTask = {
      ...selectedTask.task,
      notes: [...(selectedTask.task.notes || []), note]
    };
    setSelectedTask({ ...selectedTask, task: updatedTask });
    setNewNote('');
    setIsProcessing(false);
  };

  const handleAddChatMessage = () => {
    if (!newChatMessage.trim() || !selectedTask) return;
    
    const msg = {
      id: Math.random().toString(36).substr(2, 9),
      text: newChatMessage,
      sender: 'YOU',
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => ({
      ...prev,
      [selectedTask.task.id]: [...(prev[selectedTask.task.id] || []), msg]
    }));
    setNewChatMessage('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;

    setIsUploading(true);
    // Simulate upload
    setTimeout(() => {
      const newFile: TaskFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        url: '#'
      };

      const updatedTask = {
        ...selectedTask.task,
        files: [...(selectedTask.task.files || []), newFile]
      };
      setSelectedTask({ ...selectedTask, task: updatedTask });
      setIsUploading(false);
    }, 1500);
  };
  
  return (
    <div className="w-full h-full flex flex-col gap-6 py-10 px-10 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Dotted Background Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <header className={`flex items-end justify-between relative z-10 border-b border-white/5 pb-6 transition-all duration-500 ${isTimelineMaximized ? 'opacity-0 h-0 overflow-hidden pb-0 border-0' : 'opacity-100'}`}>
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="px-2 py-0.5 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest rounded-sm shadow-[0_0_15px_rgba(99,102,241,0.5)]">Optimized</div>
            <div className="text-[10px] font-mono text-[var(--accents-4)] uppercase tracking-[0.3em]">Today: {today.toLocaleDateString()}</div>
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">The Master Plan</h2>
          <p className="text-[var(--accents-6)] font-bold uppercase tracking-[0.4em] text-[10px] mt-4">Shipping big things, one step at a time</p>
        </div>
        <div className="flex gap-12">
          <div className="text-right">
            <div className="text-[10px] font-black text-[var(--accents-4)] uppercase tracking-widest mb-1">Momentum</div>
            <div className="text-2xl font-black text-white tracking-tighter">84%</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-[var(--accents-4)] uppercase tracking-widest mb-1">On the ground</div>
            <div className="text-2xl font-black text-indigo-400 tracking-tighter">12/15</div>
          </div>
        </div>
      </header>

      {/* Top Section: High Priority Task Tracker (Kanban Style) */}
      <section className={`relative z-10 transition-all duration-500 ${isTimelineMaximized ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1.5 h-6 bg-[var(--brand-10)] rounded-full shadow-[0_0_15px_rgba(247,148,29,0.4)]" />
          <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">The Must-Haves</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['TO DO', 'IN PROGRESS', 'DONE'].map((column) => (
            <div key={column} className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-[9px] font-black text-[var(--accents-5)] uppercase tracking-[0.2em]">{column}</span>
                <div className="text-[10px] font-black text-white opacity-40">
                  {HIGH_PRIORITY_TASKS.filter(t => 
                    (column === 'TO DO' && t.status === 'PENDING') ||
                    (column === 'IN PROGRESS' && t.status === 'IN_PROGRESS') ||
                    (column === 'DONE' && t.status === 'COMPLETED')
                  ).length}
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                {HIGH_PRIORITY_TASKS.filter(t => 
                  (column === 'TO DO' && t.status === 'PENDING') ||
                  (column === 'IN PROGRESS' && t.status === 'IN_PROGRESS') ||
                  (column === 'DONE' && t.status === 'COMPLETED')
                ).map(task => (
                  <motion.div 
                    key={task.id}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl transition-colors group cursor-pointer"
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
        className={`relative z-10 flex flex-col gap-1 mt-4 transition-all duration-500 flex-1 ${isTimelineMaximized ? 'h-full' : ''}`}
      >
        <div className="flex items-center justify-between mb-6">
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
          className={`flex gap-4 overflow-hidden transition-all duration-500 ${isTimelineMaximized ? 'h-[calc(100vh-180px)]' : 'h-[400px]'}`}
        >
          {/* Left Panel: Exec Panel & Names */}
          <div className="w-56 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-center shadow-[0_10px_30px_rgba(79,70,229,0.3)] border-b-4 border-indigo-800 sticky top-0 z-20">
              Executive Panel
            </div>
            {MOCK_ROADMAP.map(person => (
              <div key={person.id} className="relative group">
                <div className={`
                  ${person.color} text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-center transition-all duration-500 flex items-center justify-center gap-3
                  ${person.isActive ? 'shadow-[0_0_30px_rgba(255,255,255,0.15)] ring-1 ring-white/20 scale-[1.02]' : 'opacity-40 grayscale'}
                `}>
                  {person.isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  {person.name}
                </div>
                
                {/* Interaction Tooltip */}
                {person.isActive && (
                  <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0">
                    <div className="bg-[var(--accents-2)] text-white p-6 rounded-[2rem] shadow-2xl text-[10px] font-bold uppercase tracking-widest w-56 leading-relaxed border border-white/10 relative backdrop-blur-2xl">
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white/10" />
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-2 rounded-full bg-[var(--success-9)] animate-pulse" />
                        <span className="text-[var(--accents-6)]">On the ground</span>
                      </div>
                      <p className="text-[var(--accents-8)] leading-relaxed">
                        You're now in sync with {person.name.split(' ')[0]}.
                      </p>
                      <div className="flex flex-col gap-2 mt-6">
                        <button 
                          onClick={() => setActiveMessageId(person.id)}
                          className="secondary-button !px-4 !py-3 !text-[8px] w-full flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-3 h-3" />
                          SEND MESSAGE
                        </button>
                        <button 
                          onClick={() => setAssigningToId(person.id)}
                          className="accent-button !px-4 !py-3 !text-[8px] w-full flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          ASSIGN TASK
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right Panel: Timeline */}
          <div className="flex-1 relative bg-white/[0.01] border border-white/5 rounded-[3rem] p-8 overflow-hidden flex flex-col">
            <div className="flex-1 relative overflow-y-auto custom-scrollbar pr-4">
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
              <div className="relative flex flex-col gap-2 pt-8">
                {MOCK_ROADMAP.map(person => (
                  <div key={person.id} className="h-[52px] flex items-center relative border-b border-white/[0.02]">
                    {person.tasks.map((task, i) => {
                    const left = calculatePosition(task.startDate);
                    const width = calculatePosition(task.endDate) - left;
                    
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        onClick={() => setSelectedTask({ task, owner: person.name, ownerId: person.id })}
                        transition={{ delay: i * 0.1, duration: 0.8, ease: "circOut" }}
                        className={`
                          absolute h-9 rounded-xl border flex items-center px-4 gap-3 cursor-pointer hover:brightness-125 transition-all group/task
                          ${task.status === 'COMPLETED' ? 'bg-blue-400/10 border-blue-400/30 text-blue-400' : 
                            task.status === 'IN_PROGRESS' ? 'bg-[var(--brand-10)]/20 border-[var(--brand-10)]/40 text-white' : 
                            'bg-white/5 border-white/10 text-[var(--accents-5)]'}
                        `}
                        style={{ 
                          left: `${left}%`, 
                          width: `${Math.max(width, 10)}%`,
                          transformOrigin: 'left'
                        }}
                      >
                        <div className="w-5 h-5 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 group-hover/task:bg-white/20 transition-colors">
                          {task.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-black uppercase tracking-tight truncate">{task.title}</span>
                          <span className="text-[7px] opacity-40 font-mono uppercase truncate">{task.startDate} - {task.endDate}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 40 }}
              className="w-full max-w-5xl h-[85vh] bg-[var(--accents-2)] border border-white/10 rounded-[4rem] flex overflow-hidden shadow-2xl"
            >
              {/* Left Panel: Info & Files */}
              <div className="w-1/3 border-r border-white/5 p-12 flex flex-col gap-10 bg-white/[0.01]">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest ${
                      selectedTask.task.status === 'COMPLETED' ? 'bg-blue-400 text-black' : 'bg-[var(--brand-10)] text-black'
                    }`}>
                      {selectedTask.task.status}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--accents-4)] uppercase tracking-widest">ID: {selectedTask.task.id}</div>
                  </div>
                  <h3 className="text-4xl font-black text-white tracking-tighter uppercase leading-tight mb-4">{selectedTask.task.title}</h3>
                  <div className="flex items-center gap-3 text-[var(--accents-5)] mb-8">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{selectedTask.owner}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setActiveMessageId(selectedTask.ownerId)}
                      className="secondary-button !px-4 !py-4 !text-[9px] flex items-center justify-center gap-2 border-white/10"
                    >
                      <MessageSquare className="w-4 h-4" />
                      SEND MESSAGE
                    </button>
                    <button 
                      onClick={() => setAssigningToId(selectedTask.ownerId)}
                      className="accent-button !px-4 !py-4 !text-[9px] flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      PUSH TASK
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
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
                    {selectedTask.task.files?.map(file => (
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

                <div className="mt-auto">
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="w-full py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all border border-white/5 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3"
                  >
                    <X className="w-4 h-4" />
                    Back to the plan
                  </button>
                </div>
              </div>

              {/* Right Panel: Strategic Notes & Intelligence / Communication */}
              <div className="flex-1 p-12 flex flex-col gap-8 bg-black/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setActiveTab('NOTES')}
                      className={`flex items-center gap-3 transition-all ${activeTab === 'NOTES' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <Brain className={`w-6 h-6 ${activeTab === 'NOTES' ? 'text-[var(--brand-10)]' : 'text-white/20'}`} />
                      <h4 className="text-xl font-black uppercase tracking-tighter">The Deep Dive</h4>
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                    <button 
                      onClick={() => setActiveTab('CHAT')}
                      className={`flex items-center gap-3 transition-all ${activeTab === 'CHAT' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <MessageSquare className={`w-6 h-6 ${activeTab === 'CHAT' ? 'text-indigo-400' : 'text-white/20'}`} />
                      <h4 className="text-xl font-black uppercase tracking-tighter">The Wire</h4>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                      {activeTab === 'NOTES' ? 'AI is paying attention' : 'End-to-end encrypted'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                  {activeTab === 'NOTES' ? (
                    <>
                      {selectedTask.task.notes?.map(note => (
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
                      {(chatMessages[selectedTask.task.id] || []).map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'YOU' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[80%] p-5 rounded-[2rem] ${msg.sender === 'YOU' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white/5 text-white/80 rounded-tl-sm border border-white/5'}`}>
                            <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                          </div>
                          <span className="text-[8px] font-mono text-white/20 uppercase mt-2 px-2">{msg.sender} • {new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                      {(!chatMessages[selectedTask.task.id] || chatMessages[selectedTask.task.id].length === 0) && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-20">
                          <MessageSquare className="w-16 h-16 mb-4" />
                          <p className="text-sm font-bold uppercase tracking-[0.3em]">No messages on the wire</p>
                        </div>
                      )}
                    </div>
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

      {/* Communication Hub Modal */}
      <AnimatePresence>
        {activeMessageId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 40 }}
              className="w-full max-w-2xl bg-[var(--accents-2)] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-[600px]"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                    <MessageSquare className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">The Wire</h3>
                    <p className="text-[10px] text-[var(--accents-6)] font-bold uppercase tracking-widest mt-1">
                      Secure Channel: {MOCK_ROADMAP.find(p => p.id === activeMessageId)?.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveMessageId(null)}
                  className="p-3 hover:bg-white/5 rounded-xl transition-colors text-[var(--accents-6)] hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                <div className="flex flex-col items-center justify-center opacity-20 text-center py-10">
                  <Zap className="w-12 h-12 mb-4 text-indigo-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Establishing secure link...</p>
                </div>
                {/* Simulated messages could go here */}
              </div>

              <div className="p-8 bg-black/20">
                <div className="relative">
                  <textarea 
                    placeholder="Type a message..."
                    className="w-full h-24 bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all resize-none pr-24"
                  />
                  <button 
                    onClick={() => setActiveMessageId(null)}
                    className="absolute bottom-4 right-4 px-5 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-[9px] uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
                  >
                    <Send className="w-3 h-3" />
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
