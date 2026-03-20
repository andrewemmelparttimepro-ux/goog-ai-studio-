import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getDocs, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './FirebaseProvider';

interface Group {
  id: string;
  name: string;
}

interface User {
  uid: string;
  displayName: string;
}

export const ObjectiveForm: React.FC<{ onClose: () => void; initialOwnerId?: string }> = ({ onClose, initialOwnerId }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    groupId: '',
    assignedToId: initialOwnerId || '',
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
      <div className="modern-card w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] rounded-[2rem] md:rounded-[2.5rem]">
        <div className="px-6 md:px-8 py-4 md:py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">Launch Something New</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-[var(--accents-6)] hover:text-white transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-2">Title</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="modern-input w-full"
                  placeholder="e.g. Reduce equipment downtime 15%"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-2">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="modern-input w-full min-h-[120px] resize-none"
                  placeholder="Detailed statement of the expected outcome..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-2">Priority</label>
                  <select
                    required
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="modern-input w-full appearance-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-2">Due Date</label>
                  <input
                    required
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="modern-input w-full"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-2">Group</label>
                  <select
                    required
                    value={formData.groupId}
                    onChange={e => setFormData({ ...formData, groupId: e.target.value })}
                    className="modern-input w-full appearance-none"
                  >
                    <option value="" disabled>Select Group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em] mb-2">Assign To</label>
                  <select
                    required
                    value={formData.assignedToId}
                    onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
                    className="modern-input w-full appearance-none"
                  >
                    <option value="" disabled>Select Owner</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                  </select>
                </div>
              </div>

              {/* Metrics Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em]">How we'll know we won</label>
                  <button 
                    type="button" 
                    onClick={() => setMetrics([...metrics, { label: '', baseline: 0, target: 100, unit: '%', externalSource: 'MANUAL', integrationId: '' }])}
                    className="text-[10px] text-[var(--brand-10)] font-black uppercase hover:underline tracking-widest"
                  >
                    + Add Metric
                  </button>
                </div>
                <div className="space-y-3">
                  {metrics.map((m, i) => (
                    <div key={i} className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          placeholder="Metric Label (e.g. Safety Score)"
                          value={m.label}
                          onChange={(e) => {
                            const newM = [...metrics];
                            newM[i].label = e.target.value;
                            setMetrics(newM);
                          }}
                          className="modern-input flex-1 text-xs"
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
                          className="modern-input w-full sm:w-24 text-xs"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={m.externalSource}
                          onChange={(e) => {
                            const newM = [...metrics];
                            newM[i].externalSource = e.target.value as any;
                            setMetrics(newM);
                          }}
                          className="modern-input flex-1 text-[10px] appearance-none"
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
                            className="modern-input flex-1 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtasks Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-[var(--accents-6)] uppercase tracking-[0.2em]">The Plan</label>
                  <button 
                    type="button" 
                    onClick={() => setSubtasks([...subtasks, { title: '' }])}
                    className="text-[10px] text-[var(--brand-10)] font-black uppercase hover:underline tracking-widest"
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
                      className="modern-input w-full text-xs"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 flex gap-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button flex-1 text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="accent-button flex-1 text-xs uppercase tracking-widest"
            >
              {loading ? "Launching..." : "Let's get started"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
