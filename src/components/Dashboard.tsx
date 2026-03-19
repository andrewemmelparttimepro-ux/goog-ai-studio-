import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './FirebaseProvider';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, Timestamp, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ObjectiveForm } from './ObjectiveForm';
import { ObjectiveDetails } from './ObjectiveDetails';
import { NotificationCenter } from './NotificationCenter';
import { fetchExternalMetric } from '../services/externalDataService';
import { RefreshCw, Search, Filter, Plus } from 'lucide-react';

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
  assignedToId: string;
  status: string;
  priority: string;
  dueDate: any;
  percentComplete: number;
  metrics?: Metric[];
  subtasks?: Subtask[];
}

import { generatePortfolioSummary } from '../services/aiService';
import { Sparkles, Brain, TrendingUp, History, ChevronRight, LayoutDashboard, Zap } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredObjectives = useMemo(() => {
    return objectives.filter(obj => {
      const matchesSearch = obj.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           obj.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || obj.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [objectives, searchTerm, filterStatus]);

  const syncAllMetrics = async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing external data...");
    let syncCount = 0;

    try {
      for (const obj of objectives) {
        if (!obj.metrics || obj.metrics.length === 0) continue;
        
        let updatedMetrics = [...obj.metrics];
        let hasChanges = false;

        for (let i = 0; i < updatedMetrics.length; i++) {
          const metric = updatedMetrics[i];
          if (metric.externalSource && metric.externalSource !== 'MANUAL' && metric.integrationId) {
            try {
              const externalData = await fetchExternalMetric(metric.externalSource, metric.integrationId);
              if (externalData.value !== metric.current) {
                updatedMetrics[i] = { ...metric, current: externalData.value };
                hasChanges = true;
                syncCount++;
              }
            } catch (e) {
              console.warn(`Failed to sync metric ${metric.label} for objective ${obj.id}`, e);
            }
          }
        }

        if (hasChanges) {
          await updateDoc(doc(db, 'objectives', obj.id), {
            metrics: updatedMetrics,
            updatedAt: Timestamp.now()
          });
        }
      }
      setSyncStatus(`Successfully synced ${syncCount} metrics.`);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      console.error("Error syncing all metrics:", error);
      setSyncStatus("Sync failed. Check console.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'objectives'), orderBy('dueDate', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective));
      setObjectives(data);
      setLoading(false);
    }, (error) => {
      console.error("Objectives fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const runPortfolioSummary = async () => {
    if (objectives.length === 0) return;
    setIsSummarizing(true);
    try {
      const summary = await generatePortfolioSummary(objectives);
      setPortfolioSummary(summary);
    } catch (error) {
      console.error("Portfolio summary failed:", error);
    } finally {
      setIsSummarizing(false);
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
    <div className="min-h-screen bg-[#0B0C10] text-[#E8E8F0] flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-[#151619]/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="text-xl font-black tracking-tighter">
            <span className="text-[#F7941D]">Sand</span>
            <span className="text-[#555568]">Pro</span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="text-[10px] font-bold tracking-[0.2em] text-[#F7941D] uppercase">
            SP OMP
          </div>
        </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white">{profile?.displayName || user?.displayName}</div>
              <div className="text-[10px] text-[#555568] font-mono uppercase tracking-widest">{profile?.role || 'CONTRIBUTOR'}</div>
            </div>
            <NotificationCenter />
            <button
              onClick={() => signOut(auth)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#555568] hover:text-white"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Platform Dashboard</h2>
            <p className="text-[#8C8CA0] text-sm">Real-time execution tracking for SandPro objectives.</p>
          </div>
          <div className="flex items-center gap-3">
            {syncStatus && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#F7941D]/10 border border-[#F7941D]/20 rounded-xl animate-pulse">
                <RefreshCw className={`w-3 h-3 text-[#F7941D] ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold text-[#F7941D] uppercase tracking-widest">{syncStatus}</span>
              </div>
            )}
            <button 
              onClick={syncAllMetrics}
              disabled={isSyncing}
              className="px-6 py-3 bg-[#151619] border border-white/10 hover:bg-white/5 text-[#8C8CA0] hover:text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync All
            </button>
            <a 
              href="/api/reporting/objectives" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#151619] border border-white/10 hover:bg-white/5 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
            >
              <svg className="w-5 h-5 text-[#F7941D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reporting API
            </a>
            {canCreate && (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-[#F7941D] hover:bg-[#E8850A] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#F7941D]/20 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Objective
              </button>
            )}
          </div>
        </div>

        {/* AI Portfolio Insight */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-16 h-12 text-[#F7941D]" />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#F7941D]/10 rounded-xl">
                <Brain className="w-6 h-6 text-[#F7941D]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Portfolio Strategic Insights</h3>
                <p className="text-[10px] text-[#555568] font-bold uppercase tracking-tighter">AI-Generated Executive Summary</p>
              </div>
            </div>
            <button 
              onClick={runPortfolioSummary}
              disabled={isSummarizing || objectives.length === 0}
              className="paper-button px-6 py-3 bg-[#F7941D]/10 hover:bg-[#F7941D]/20 text-[#F7941D] text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              {isSummarizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {portfolioSummary ? 'Refresh Insights' : 'Generate Strategic Summary'}
            </button>
          </div>

          {portfolioSummary && (
            <div className="mt-6 p-6 bg-white/[0.01] border border-white/5 rounded-xl animate-in fade-in slide-in-from-top-4 duration-700">
              <p className="text-sm text-[#8C8CA0] leading-relaxed italic border-l-4 border-[#F7941D]/30 pl-6">
                "{portfolioSummary}"
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-[#555568] font-bold uppercase tracking-widest">
                <Zap className="w-3 h-3 text-[#F7941D]" />
                Actionable Intelligence for Leadership
              </div>
            </div>
          )}
        </section>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: "Open Objectives", value: kpis.open, color: "text-[#F7941D]" },
            { label: "Overdue", value: kpis.overdue, color: "text-red-500" },
            { label: "Due in 7 Days", value: kpis.dueSoon, color: "text-amber-500" },
            { label: "Completed", value: kpis.completed, color: "text-emerald-500" }
          ].map((kpi, i) => (
            <div key={i} className="paper-card p-6 text-center">
              <div className={`text-3xl font-black font-mono mb-1 ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[10px] font-bold tracking-widest text-[#555568] uppercase">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Objectives List */}
        <div className="paper-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Execution Grid</h3>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555568]" />
                <input 
                  type="text" 
                  placeholder="Search objectives..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#F7941D]/50 w-full md:w-64 transition-all"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#555568]" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#F7941D]/50 transition-all appearance-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_ON_INPUT">Waiting</option>
                  <option value="AT_RISK">At Risk</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="p-20 text-center">
              <div className="w-8 h-8 border-2 border-[#F7941D]/30 border-t-[#F7941D] rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredObjectives.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-bold text-[#555568] uppercase tracking-widest">Objective</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#555568] uppercase tracking-widest">Priority</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#555568] uppercase tracking-widest">Due Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#555568] uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#555568] uppercase tracking-widest text-right">Metrics</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#555568] uppercase tracking-widest text-right">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredObjectives.map((obj) => {
                    const dueDate = obj.dueDate instanceof Timestamp ? obj.dueDate.toDate() : new Date(obj.dueDate);
                    const isOverdue = dueDate < new Date() && obj.status !== 'COMPLETED';
                    
                    // Calculate metric progress if available
                    const metricProgress = obj.metrics?.[0] ? 
                      Math.round(((obj.metrics[0].current - obj.metrics[0].baseline) / (obj.metrics[0].target - obj.metrics[0].baseline)) * 100) : 
                      null;

                    return (
                      <tr 
                        key={obj.id} 
                        onClick={() => setSelectedObjectiveId(obj.id)}
                        className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-white group-hover:text-[#F7941D] transition-colors">{obj.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              obj.priority === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                              obj.priority === 'HIGH' ? 'bg-amber-500' :
                              obj.priority === 'MEDIUM' ? 'bg-blue-500' : 'bg-slate-500'
                            }`} />
                            <span className="text-xs text-[#8C8CA0]">{obj.priority}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-xs font-mono ${isOverdue ? 'text-red-500 font-bold' : 'text-[#8C8CA0]'}`}>
                            {dueDate.toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            obj.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                            obj.status === 'AT_RISK' ? 'bg-amber-500/10 text-amber-500' :
                            obj.status === 'BLOCKED' ? 'bg-red-500/10 text-red-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {obj.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {obj.metrics?.[0] ? (
                            <div className="text-[10px] font-mono text-[#F7941D]">
                              {obj.metrics[0].current} / {obj.metrics[0].target} {obj.metrics[0].unit}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#555568]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                              <div 
                                className="h-full bg-[#F7941D] transition-all duration-500" 
                                style={{ width: `${obj.percentComplete || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-white">{obj.percentComplete || 0}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-[#555568]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Objectives Found</h3>
              <p className="text-[#8C8CA0] text-sm max-w-xs mx-auto">
                {canCreate ? "Start by creating your first objective." : "You don't have any objectives assigned yet."}
              </p>
            </div>
          )}
        </div>
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

