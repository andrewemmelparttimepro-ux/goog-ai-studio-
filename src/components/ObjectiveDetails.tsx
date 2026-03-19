import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuth } from './FirebaseProvider';
import { X, MessageSquare, Clock, CheckCircle2, AlertCircle, Ban, RefreshCw } from 'lucide-react';
import { fetchExternalMetric } from '../services/externalDataService';

import { analyzeObjectiveRisk, RiskAnalysis } from '../services/aiService';
import { Sparkles, Brain, TrendingUp, History, ChevronRight } from 'lucide-react';

interface ObjectiveUpdate {
  id: string;
  text: string;
  authorName: string;
  createdAt: any;
  statusAtTime: string;
}

interface StatusHistoryEntry {
  id: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedByName: string;
  timestamp: any;
  comment?: string;
}

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
      <div className="paper-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                objective.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                objective.status === 'AT_RISK' ? 'bg-amber-500/10 text-amber-500' :
                objective.status === 'BLOCKED' ? 'bg-red-500/10 text-red-500' :
                'bg-blue-500/10 text-blue-500'
              }`}>
                {objective.status.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-[#555568] font-mono uppercase tracking-widest">
                Priority: {objective.priority}
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">{objective.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#555568] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* AI Risk Analysis Section */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-12 h-12 text-[#F7941D]" />
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F7941D]/10 rounded-lg">
                  <Brain className="w-5 h-5 text-[#F7941D]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">AI Strategic Risk Analysis</h3>
                  <p className="text-[10px] text-[#555568] font-bold uppercase tracking-tighter">Powered by Gemini 3.0 Flash</p>
                </div>
              </div>
              <button 
                onClick={runRiskAnalysis}
                disabled={isAnalyzing}
                className="paper-button px-4 py-2 bg-[#F7941D]/10 hover:bg-[#F7941D]/20 text-[#F7941D] text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {riskAnalysis ? 'Refresh Analysis' : 'Run Analysis'}
              </button>
            </div>

            {riskAnalysis ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    riskAnalysis.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/20' :
                    riskAnalysis.riskLevel === 'HIGH' ? 'bg-[#F7941D]/20 text-[#F7941D] border-[#F7941D]/20' :
                    riskAnalysis.riskLevel === 'MEDIUM' ? 'bg-blue-500/20 text-blue-500 border-blue-500/20' :
                    'bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
                  }`}>
                    Risk Level: {riskAnalysis.riskLevel}
                  </div>
                  <div className="text-[10px] text-[#555568] font-mono">Confidence: {Math.round(riskAnalysis.confidence * 100)}%</div>
                </div>
                
                <p className="text-sm text-[#8C8CA0] leading-relaxed italic border-l-2 border-[#F7941D]/30 pl-4">
                  "{riskAnalysis.summary}"
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {riskAnalysis.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                      <TrendingUp className="w-3 h-3 text-[#F7941D] mt-0.5 flex-shrink-0" />
                      <span className="text-[11px] text-[#8C8CA0] leading-tight">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[11px] text-[#555568] font-bold uppercase tracking-widest">No analysis performed for this objective cycle yet.</p>
              </div>
            )}
          </section>

          {/* Metrics Section */}
          {objective.metrics && objective.metrics.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-3">Metric Tracking</h3>
              <div className="space-y-4">
                {objective.metrics.map((metric: any, idx: number) => {
                  const progress = Math.min(100, Math.max(0, ((metric.current - metric.baseline) / (metric.target - metric.baseline)) * 100));
                  return (
                    <div key={idx} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <div className="text-[10px] font-bold text-[#555568] uppercase mb-1">{metric.label}</div>
                          <div className="text-lg font-black text-white font-mono">
                            {metric.current} <span className="text-xs font-normal text-[#555568]">{metric.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[#555568] uppercase mb-1">Target</div>
                          <div className="text-sm font-bold text-[#F7941D] font-mono">{metric.target} {metric.unit}</div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#F7941D] transition-all duration-500" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-4 flex gap-2">
                        <input 
                          type="number"
                          value={metric.current}
                          onChange={(e) => updateMetric(idx, Number(e.target.value))}
                          className="paper-input w-24 px-3 py-1 text-xs text-white rounded-lg"
                        />
                        <span className="text-[10px] text-[#555568] self-center uppercase font-bold">Update Current</span>
                        
                        {metric.externalSource && metric.externalSource !== 'MANUAL' && (
                          <button
                            onClick={() => syncMetric(idx)}
                            className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[#F7941D] uppercase hover:underline"
                          >
                            <RefreshCw className="w-3 h-3" />
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
              <h3 className="text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-3">Execution Steps</h3>
              <div className="space-y-2">
                {objective.subtasks.map((st: any) => (
                  <button
                    key={st.id}
                    onClick={() => toggleSubtask(st.id)}
                    className="w-full flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-[#555568] group-hover:border-[#F7941D]'
                    }`}>
                      {st.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-sm ${st.completed ? 'text-[#555568] line-through' : 'text-[#8C8CA0]'}`}>
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          <section>
            <h3 className="text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-3">Context</h3>
            <p className="text-[#8C8CA0] text-sm leading-relaxed bg-white/[0.02] p-4 rounded-xl border border-white/5">
              {objective.description || "No description provided."}
            </p>
          </section>

          {/* Status Controls */}
          <section>
            <h3 className="text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-3">Execution Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ON_TRACK', label: 'On Track', icon: Clock, color: 'hover:bg-blue-500/10 hover:text-blue-500' },
                { id: 'AT_RISK', label: 'At Risk', icon: AlertCircle, color: 'hover:bg-amber-500/10 hover:text-amber-500' },
                { id: 'BLOCKED', label: 'Blocked', icon: Ban, color: 'hover:bg-red-500/10 hover:text-red-500' },
                { id: 'COMPLETED', label: 'Complete', icon: CheckCircle2, color: 'hover:bg-emerald-500/10 hover:text-emerald-500' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => updateStatus(btn.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-white/5 transition-all text-[10px] font-bold uppercase tracking-widest ${
                    objective.status === btn.id ? 'bg-white/10 text-white border-white/20' : 'text-[#555568] ' + btn.color
                  }`}
                >
                  <btn.icon className="w-4 h-4" />
                  {btn.label}
                </button>
              ))}
            </div>
          </section>

          {/* Updates Feed */}
          <section>
            <h3 className="text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-4">Execution Log</h3>
            
            <form onSubmit={handleAddUpdate} className="mb-6">
              <div className="relative">
                <textarea
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Add a progress update..."
                  className="paper-input w-full rounded-xl p-4 text-sm text-white placeholder:text-[#555568] resize-none h-24"
                />
                <button
                  type="submit"
                  disabled={!newUpdate.trim()}
                  className="absolute bottom-3 right-3 p-2 bg-[#F7941D] text-white rounded-lg hover:bg-[#E8850A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {updates.map((update) => (
                <div key={update.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">{update.authorName}</span>
                    <span className="text-[10px] text-[#555568] font-mono">
                      {update.createdAt?.toDate().toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-[#8C8CA0]">{update.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Status History Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-[#555568]" />
              <h3 className="text-[10px] font-bold text-[#555568] uppercase tracking-widest">Audit Trail</h3>
            </div>
            
            <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/5">
              {history.map((entry) => (
                <div key={entry.id} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 w-6 h-6 bg-[#0B0C10] border border-white/10 rounded-full flex items-center justify-center z-10">
                    <div className="w-2 h-2 bg-[#F7941D] rounded-full" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <span className="text-[#8C8CA0]">{entry.oldStatus}</span>
                      <ChevronRight className="w-3 h-3 text-[#555568]" />
                      <span className="text-white">{entry.newStatus}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-[#555568] font-bold uppercase">
                      <span>{entry.changedByName}</span>
                      <span className="w-1 h-1 bg-[#555568] rounded-full" />
                      <span className="font-mono">{entry.timestamp?.toDate().toLocaleString()}</span>
                    </div>
                    {entry.comment && (
                      <p className="text-[11px] text-[#555568] italic mt-1">{entry.comment}</p>
                    )}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-[11px] text-[#555568] italic pl-8">No status changes recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
