import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuth } from './FirebaseProvider';
import { X, MessageSquare, Clock, CheckCircle2, AlertCircle, Ban, RefreshCw } from 'lucide-react';
import { fetchExternalMetric } from '../services/externalDataService';

import { analyzeObjectiveRisk } from '../services/aiService';
import { Sparkles, Brain, TrendingUp, History, ChevronRight } from 'lucide-react';
import { Objective, ObjectiveUpdate, StatusHistoryEntry, RiskAnalysis } from '../types';

interface ObjectiveDetailsProps {
  objectiveId: string;
  onClose: () => void;
}

export const ObjectiveDetails: React.FC<ObjectiveDetailsProps> = ({ objectiveId, onClose }) => {
  const { profile } = useAuth();
  const [objective, setObjective] = useState<any>(null);
  const [updates, setUpdates] = useState<ObjectiveUpdate[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [loading, setLoading] = useState(true);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const unsubObj = onSnapshot(doc(db, 'objectives', objectiveId), (doc) => {
      if (doc.exists()) {
        setObjective({ id: doc.id, ...doc.data() });
      }
      setLoading(false);
    });

    const qUpdates = query(
      collection(db, `objectives/${objectiveId}/updates`),
      orderBy('createdAt', 'desc')
    );
    const unsubUpdates = onSnapshot(qUpdates, (snapshot) => {
      setUpdates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ObjectiveUpdate)));
    });

    const qHistory = query(
      collection(db, `objectives/${objectiveId}/statusHistory`),
      orderBy('timestamp', 'desc')
    );
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatusHistoryEntry)));
    });

    return () => {
      unsubObj();
      unsubUpdates();
      unsubHistory();
    };
  }, [objectiveId]);

  const runRiskAnalysis = async () => {
    if (!objective) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeObjectiveRisk(objective);
      setRiskAnalysis(analysis);
    } catch (error) {
      console.error("Risk analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpdate.trim()) return;

    try {
      await addDoc(collection(db, `objectives/${objectiveId}/updates`), {
        text: newUpdate,
        authorId: profile?.uid,
        authorName: profile?.displayName || 'Unknown User',
        createdAt: serverTimestamp(),
        statusAtTime: objective.status
      });
      setNewUpdate('');
    } catch (error) {
      console.error("Error adding update:", error);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (newStatus === objective.status) return;
    
    try {
      const oldStatus = objective.status;
      
      // Update objective
      await updateDoc(doc(db, 'objectives', objectiveId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'COMPLETED' ? { completionDate: serverTimestamp(), percentComplete: 100 } : {})
      });

      // Record history
      await addDoc(collection(db, `objectives/${objectiveId}/statusHistory`), {
        oldStatus,
        newStatus,
        changedBy: profile?.uid,
        changedByName: profile?.displayName || 'System',
        timestamp: serverTimestamp(),
        comment: `Status changed from ${oldStatus} to ${newStatus}`
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const updateMetric = async (index: number, newValue: number) => {
    const newMetrics = [...objective.metrics];
    newMetrics[index].current = newValue;
    try {
      await updateDoc(doc(db, 'objectives', objectiveId), {
        metrics: newMetrics,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `objectives/${objectiveId}`);
    }
  };

  const syncMetric = async (index: number) => {
    const metric = objective.metrics[index];
    if (!metric.externalSource || metric.externalSource === 'MANUAL' || !metric.integrationId) return;

    try {
      const data = await fetchExternalMetric(metric.externalSource, metric.integrationId);
      await updateMetric(index, data.value);
    } catch (error) {
      console.error("Sync failed:", error);
    }
  };

  const toggleSubtask = async (subtaskId: string) => {
    const newSubtasks = objective.subtasks.map((st: any) => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const completedCount = newSubtasks.filter((st: any) => st.completed).length;
    const percentComplete = Math.round((completedCount / newSubtasks.length) * 100);

    try {
      await updateDoc(doc(db, 'objectives', objectiveId), {
        subtasks: newSubtasks,
        percentComplete,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error toggling subtask:", error);
    }
  };

  if (loading) return null;
  if (!objective) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="modern-card w-full max-w-2xl rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-start md:items-center justify-between bg-white/[0.02] gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
              <span className={`text-[8px] md:text-[10px] font-black px-2 md:px-3 py-1 rounded-lg uppercase tracking-[0.2em] border ${
                objective.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                objective.status === 'AT_RISK' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                objective.status === 'BLOCKED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                {objective.status.replace(/_/g, ' ')}
              </span>
              <span className="text-[8px] md:text-[10px] text-[var(--accents-6)] font-bold uppercase tracking-[0.2em]">
                Priority: {objective.priority}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter truncate">{objective.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 hover:bg-white/5 rounded-xl transition-colors text-[var(--accents-6)] hover:text-white shrink-0">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 md:space-y-10 custom-scrollbar">
          {/* AI Risk Analysis Section */}
          <section className="glass-panel p-6 md:p-8 relative overflow-hidden group border-l-4 border-l-[var(--brand-10)]">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <Sparkles className="w-24 h-24 md:w-32 md:h-32 text-[var(--brand-10)]" />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10 relative z-10">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="p-3 md:p-4 bg-[var(--brand-10)]/10 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(247,148,29,0.1)] shrink-0">
                  <Brain className="w-5 h-5 md:w-7 md:h-7 text-[var(--brand-10)]" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-[0.2em]">Strategic Risk Assessment</h3>
                  <p className="text-[8px] md:text-[10px] text-[var(--accents-6)] font-bold uppercase tracking-widest mt-1">Intelligence Core: Gemini 3.0 Flash</p>
                </div>
              </div>
              <button 
                onClick={runRiskAnalysis}
                disabled={isAnalyzing}
                className="secondary-button !text-[8px] md:!text-[10px] !py-2 md:!py-2.5 !px-4 md:!px-5 flex items-center justify-center gap-2 md:gap-2.5 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 w-full md:w-auto"
              >
                {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {riskAnalysis ? 'Recalibrate Intelligence' : 'Initialize Analysis'}
              </button>
            </div>

            {riskAnalysis ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-8">
                  <div className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] border shadow-lg ${
                    riskAnalysis.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30 shadow-red-500/10' :
                    riskAnalysis.riskLevel === 'HIGH' ? 'bg-[var(--brand-10)]/20 text-[var(--brand-10)] border-[var(--brand-10)]/30 shadow-[var(--brand-10)]/10' :
                    riskAnalysis.riskLevel === 'MEDIUM' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30 shadow-blue-500/10' :
                    'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shadow-emerald-500/10'
                  }`}>
                    Risk Profile: {riskAnalysis.riskLevel}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div className="text-[10px] text-[var(--accents-6)] font-mono font-bold uppercase tracking-widest">Confidence Index: {Math.round(riskAnalysis.confidence * 100)}%</div>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute -left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-[var(--brand-10)] via-[var(--brand-10)]/50 to-transparent opacity-30" />
                  <p className="text-[13px] text-[var(--accents-7)] leading-relaxed italic font-medium">
                    "{riskAnalysis.summary}"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {riskAnalysis.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-4 p-5 bg-white/[0.01] border border-white/5 rounded-2xl hover:bg-white/[0.02] transition-colors group/rec">
                      <div className="p-1.5 bg-[var(--brand-10)]/5 rounded-lg group-hover/rec:bg-[var(--brand-10)]/10 transition-colors">
                        <TrendingUp className="w-4 h-4 text-[var(--brand-10)]" />
                      </div>
                      <span className="text-xs text-[var(--accents-7)] leading-relaxed font-medium">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                <div className="mb-4 flex justify-center">
                  <Sparkles className="w-8 h-8 text-[var(--accents-6)] opacity-20" />
                </div>
                <p className="text-[11px] text-[var(--accents-6)] font-bold uppercase tracking-[0.2em] max-w-[280px] mx-auto leading-loose">
                  Strategic intelligence core idle. Initialize analysis to identify potential execution risks.
                </p>
              </div>
            )}
          </section>

          {/* Metrics Section */}
          {objective.metrics && objective.metrics.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-6 px-2">Metric Tracking</h3>
              <div className="space-y-6">
                {objective.metrics.map((metric: any, idx: number) => {
                  const progress = Math.min(100, Math.max(0, ((metric.current - metric.baseline) / (metric.target - metric.baseline)) * 100));
                  return (
                    <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <div className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-widest mb-2">{metric.label}</div>
                          <div className="text-2xl font-black text-white font-mono">
                            {metric.current} <span className="text-xs font-normal text-[var(--accents-6)]">{metric.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-widest mb-2">Target</div>
                          <div className="text-lg font-black text-[var(--brand-10)] font-mono">{metric.target} {metric.unit}</div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-6">
                        <div 
                          className="h-full bg-[var(--brand-10)] transition-all duration-700 ease-out" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 flex gap-3">
                          <input 
                            type="number"
                            value={metric.current}
                            onChange={(e) => updateMetric(idx, Number(e.target.value))}
                            className="modern-input w-32 text-sm"
                          />
                          <span className="text-[10px] text-[var(--accents-6)] self-center uppercase font-bold tracking-widest">Update Current</span>
                        </div>
                        
                        {metric.externalSource && metric.externalSource !== 'MANUAL' && (
                          <button
                            onClick={() => syncMetric(idx)}
                            className="flex items-center gap-2 text-[10px] font-black text-[var(--brand-10)] uppercase hover:underline tracking-widest"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Sync {metric.externalSource.replace('_', ' ')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Subtasks Section */}
          {objective.subtasks && objective.subtasks.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-6 px-2">Execution Steps</h3>
              <div className="space-y-3">
                {objective.subtasks.map((st: any) => (
                  <button
                    key={st.id}
                    onClick={() => toggleSubtask(st.id)}
                    className="w-full flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all text-left group"
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--accents-6)] group-hover:border-[var(--brand-10)]'
                    }`}>
                      {st.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-sm font-bold transition-all ${st.completed ? 'text-[var(--accents-6)] line-through' : 'text-[var(--accents-7)] group-hover:text-white'}`}>
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          <section>
            <h3 className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-6 px-2">Context</h3>
            <p className="text-[var(--accents-7)] text-sm leading-relaxed bg-white/[0.02] p-6 rounded-2xl border border-white/5">
              {objective.description || "No description provided."}
            </p>
          </section>

          {/* Status Controls */}
          <section>
            <h3 className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-6 px-2">Execution Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'ON_TRACK', label: 'On Track', icon: Clock, color: 'hover:bg-blue-500/10 hover:text-blue-500' },
                { id: 'AT_RISK', label: 'At Risk', icon: AlertCircle, color: 'hover:bg-amber-500/10 hover:text-amber-500' },
                { id: 'BLOCKED', label: 'Blocked', icon: Ban, color: 'hover:bg-red-500/10 hover:text-red-500' },
                { id: 'COMPLETED', label: 'Complete', icon: CheckCircle2, color: 'hover:bg-emerald-500/10 hover:text-emerald-500' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => updateStatus(btn.id)}
                  className={`flex flex-col items-center gap-2 md:gap-3 p-3 md:p-5 rounded-xl md:rounded-2xl border border-white/5 transition-all text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-center ${
                    objective.status === btn.id ? 'bg-white/10 text-white border-white/20 shadow-lg' : 'text-[var(--accents-6)] ' + btn.color
                  }`}
                >
                  <btn.icon className="w-4 h-4 md:w-5 md:h-5" />
                  {btn.label}
                </button>
              ))}
            </div>
          </section>

          {/* Updates Feed */}
          <section>
            <h3 className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-6 px-2">Execution Log</h3>
            
            <form onSubmit={handleAddUpdate} className="mb-8">
              <div className="relative">
                <textarea
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Add a progress update..."
                  className="modern-input w-full rounded-2xl p-6 text-sm text-white placeholder:text-[var(--accents-6)] resize-none h-32"
                />
                <button
                  type="submit"
                  disabled={!newUpdate.trim()}
                  className="absolute bottom-4 right-4 p-3 bg-[var(--brand-10)] text-white rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-10)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {updates.map((update) => (
                <div key={update.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-white uppercase tracking-widest">{update.authorName}</span>
                    <span className="text-[10px] text-[var(--accents-6)] font-mono font-bold">
                      {update.createdAt?.toDate().toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--accents-7)] leading-relaxed">{update.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Status History Section */}
          <section className="pb-12">
            <div className="flex items-center justify-between mb-10 px-2">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/5 rounded-xl">
                  <History className="w-5 h-5 text-[var(--accents-6)]" />
                </div>
                <h3 className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em]">Strategic Audit Trail</h3>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent ml-6" />
            </div>
            
            <div className="space-y-10 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-white/10 before:via-white/5 before:to-transparent">
              {history.map((entry) => (
                <div key={entry.id} className="relative pl-12 group/audit">
                  <div className="absolute left-0 top-1 w-10 h-10 bg-[var(--accents-1)] border border-white/10 rounded-full flex items-center justify-center z-10 shadow-xl group-hover/audit:border-[var(--brand-10)]/30 transition-colors">
                    <div className="w-3 h-3 bg-[var(--brand-10)] rounded-full shadow-[0_0_15px_rgba(247,148,29,0.5)] animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
                        <span className="text-[var(--accents-6)] line-through opacity-50">{entry.oldStatus.replace(/_/g, ' ')}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--brand-10)]" />
                        <span className="text-white bg-white/5 px-3 py-1 rounded-lg border border-white/10">{entry.newStatus.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-[var(--accents-6)] font-bold uppercase tracking-widest">
                      <span className="text-white/80">{entry.changedByName}</span>
                      <span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                      <span className="font-mono opacity-60">{entry.timestamp?.toDate().toLocaleString()}</span>
                    </div>
                    {entry.comment && (
                      <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/5" />
                        <p className="text-[11px] text-[var(--accents-6)] italic pl-4 leading-relaxed">{entry.comment}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="pl-12 py-4">
                  <p className="text-[11px] text-[var(--accents-6)] italic uppercase tracking-widest opacity-40">No strategic shifts recorded in the current cycle.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
