import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './FirebaseProvider';
import { Bell, Check, ExternalLink, AlertTriangle, Info } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'OVERDUE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'SYSTEM';
  read: boolean;
  createdAt: any;
  link?: string;
}

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });

    return () => unsub();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'OVERDUE': return <AlertTriangle className="w-4 h-4 text-[var(--error-8)]" />;
      case 'STATUS_CHANGE': return <Info className="w-4 h-4 text-blue-500" />;
      case 'ASSIGNMENT': return <Bell className="w-4 h-4 text-[var(--brand-10)]" />;
      default: return <Bell className="w-4 h-4 text-[var(--accents-6)]" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="secondary-button p-2 relative"
      >
        <Bell className="w-5 h-5 text-[var(--accents-7)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--brand-10)] text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[var(--accents-1)]">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 modern-card z-[90] overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Notifications</h4>
              <span className="text-[10px] text-[var(--accents-6)] font-bold">{unreadCount} Unread</span>
            </div>
            
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-[var(--accents-6)] mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-[var(--accents-6)] font-bold uppercase tracking-tighter">All quiet on the front</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`p-4 border-b border-white/5 transition-colors ${n.read ? 'opacity-60' : 'bg-white/[0.02]'}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">{getTypeIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h5 className="text-xs font-black text-white truncate pr-2">{n.title}</h5>
                          {!n.read && (
                            <button 
                              onClick={() => markAsRead(n.id)}
                              className="text-[var(--brand-10)] hover:text-white transition-colors"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--accents-7)] leading-relaxed mb-2">{n.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[var(--accents-6)] font-mono">
                            {n.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {n.link && (
                            <a 
                              href={n.link} 
                              className="text-[9px] font-bold text-[var(--brand-10)] uppercase hover:underline flex items-center gap-1"
                            >
                              View <ExternalLink className="w-2 h-2" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 bg-white/[0.02] border-t border-white/5 text-center">
              <button 
                onClick={() => {
                  // Trigger manual check for demo
                  fetch('/api/system/check-overdue?key=sp-omp-internal-key', { method: 'POST' });
                  setIsOpen(false);
                }}
                className="text-[9px] font-black text-[var(--accents-6)] hover:text-white uppercase tracking-widest transition-colors"
              >
                Poke the system
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
