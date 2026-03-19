import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './FirebaseProvider';

interface Group {
  id: string;
  name: string;
}

interface User {
  uid: string;
  displayName: string;
}

export const ObjectiveForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    groupId: '',
    assignedToId: '',
    priority: 'MEDIUM',
    dueDate: '',
  });
  const [metrics, setMetrics] = useState([{ 
    label: '', 
    baseline: 0, 
    target: 100, 
    unit: '%',
    externalSource: 'MANUAL' as 'KPH_EHS' | 'SAP' | 'MANUAL',
    integrationId: ''
  }]);
  const [subtasks, setSubtasks] = useState([{ title: '' }]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupsSnap = await getDocs(collection(db, 'groups'));
        setGroups(groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));

        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      } catch (error) {
        console.error("Error fetching form data:", error);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const filteredMetrics = metrics.filter(m => m.label.trim()).map(m => ({ ...m, current: m.baseline }));
      const filteredSubtasks = subtasks
        .filter(s => s.title.trim())
        .map(s => ({ id: Math.random().toString(36).substr(2, 9), title: s.title, completed: false }));

      const path = 'objectives';
      const objectiveRef = doc(collection(db, path));
      const objectiveId = objectiveRef.id;

      await setDoc(objectiveRef, {
        ...formData,
        id: objectiveId,
        status: 'NOT_STARTED',
        initiatedById: user.uid,
        dueDate: new Date(formData.dueDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        percentComplete: 0,
        acknowledged: false,
        metrics: filteredMetrics,
        subtasks: filteredSubtasks,
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'objectives');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="paper-card w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Initiate Objective</h3>
          <button onClick={onClose} className="text-[#555568] hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-1.5">Title</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="paper-input w-full px-4 py-3 text-sm text-white rounded-xl"
                  placeholder="e.g. Reduce equipment downtime 15%"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="paper-input w-full px-4 py-3 text-sm text-white rounded-xl min-h-[100px]"
                  placeholder="Detailed statement of the expected outcome..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-1.5">Priority</label>
                  <select
                    required
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="paper-input w-full px-4 py-3 text-sm text-white rounded-xl appearance-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-1.5">Due Date</label>
                  <input
                    required
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="paper-input w-full px-4 py-3 text-sm text-white rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-1.5">Group</label>
                  <select
                    required
                    value={formData.groupId}
                    onChange={e => setFormData({ ...formData, groupId: e.target.value })}
                    className="paper-input w-full px-4 py-3 text-sm text-white rounded-xl appearance-none"
                  >
                    <option value="" disabled>Select Group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#555568] uppercase tracking-widest mb-1.5">Assign To</label>
                  <select
                    required
                    value={formData.assignedToId}
                    onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
                    className="paper-input w-full px-4 py-3 text-sm text-white rounded-xl appearance-none"
                  >
                    <option value="" disabled>Select Owner</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                  </select>
                </div>
              </div>

              {/* Metrics Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-[#555568] uppercase tracking-widest">Metrics & Data Connectors</label>
                  <button 
                    type="button" 
                    onClick={() => setMetrics([...metrics, { label: '', baseline: 0, target: 100, unit: '%', externalSource: 'MANUAL', integrationId: '' }])}
                    className="text-[10px] text-[#F7941D] font-bold uppercase hover:underline"
                  >
                    + Add Metric
                  </button>
                </div>
                <div className="space-y-3">
                  {metrics.map((m, i) => (
                    <div key={i} className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-2">
                      <div className="flex gap-2">
                        <input
                          placeholder="Metric Label (e.g. Safety Score)"
                          value={m.label}
                          onChange={(e) => {
                            const newM = [...metrics];
                            newM[i].label = e.target.value;
                            setMetrics(newM);
                          }}
                          className="paper-input flex-1 px-3 py-2 text-xs text-white rounded-lg"
                        />
                        <input
                          placeholder="Target"
                          type="number"
                          value={m.target}
                          onChange={(e) => {
                            const newM = [...metrics];
                            newM[i].target = Number(e.target.value);
                            setMetrics(newM);
                          }}
                          className="paper-input w-20 px-3 py-2 text-xs text-white rounded-lg"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={m.externalSource}
                          onChange={(e) => {
                            const newM = [...metrics];
                            newM[i].externalSource = e.target.value as any;
                            setMetrics(newM);
                          }}
                          className="paper-input flex-1 px-3 py-2 text-[10px] text-white rounded-lg appearance-none"
                        >
                          <option value="MANUAL">Manual Entry</option>
                          <option value="KPH_EHS">KPH EHS Connector</option>
                          <option value="SAP">SAP ERP Connector</option>
                        </select>
                        {m.externalSource !== 'MANUAL' && (
                          <input
                            placeholder="Integration ID"
                            value={m.integrationId}
                            onChange={(e) => {
                              const newM = [...metrics];
                              newM[i].integrationId = e.target.value;
                              setMetrics(newM);
                            }}
                            className="paper-input flex-1 px-3 py-2 text-xs text-white rounded-lg"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtasks Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-[#555568] uppercase tracking-widest">Execution Steps</label>
                  <button 
                    type="button" 
                    onClick={() => setSubtasks([...subtasks, { title: '' }])}
                    className="text-[10px] text-[#F7941D] font-bold uppercase hover:underline"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-2">
                  {subtasks.map((s, i) => (
                    <input
                      key={i}
                      placeholder="Step description..."
                      value={s.title}
                      onChange={(e) => {
                        const newS = [...subtasks];
                        newS[i].title = e.target.value;
                        setSubtasks(newS);
                      }}
                      className="paper-input w-full px-3 py-2 text-xs text-white rounded-lg"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex gap-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-[#555568] hover:text-white font-bold uppercase tracking-widest text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="paper-button flex-1 py-3 bg-[#F7941D] hover:bg-[#E8850A] disabled:bg-[#F7941D]/50 text-white font-bold rounded-xl uppercase tracking-widest text-xs"
            >
              {loading ? "Initiating..." : "Initiate Objective"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
