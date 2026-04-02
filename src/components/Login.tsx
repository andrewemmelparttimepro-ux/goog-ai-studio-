import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, Timestamp } from 'firebase/firestore';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureProfile(result.user);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    const email = 'kevin@sandpro.com';
    const pass = 'password123';
    
    try {
      let user;
      try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        user = result.user;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          const result = await createUserWithEmailAndPassword(auth, email, pass);
          user = result.user;
        } else {
          throw err;
        }
      }
      
      if (user) {
        await ensureProfile(user, 'KEVIN MALONE', 'EXECUTIVE');
      }
    } catch (err: any) {
      console.error("Demo login error:", err);
      setError("Demo login failed. Please use Google sign-in.");
    } finally {
      setLoading(false);
    }
  };

  const ensureProfile = async (user: any, displayName?: string, role?: string) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const isAdmin = user.email === 'andrewemmelparttimepro@gmail.com';
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || 'New User',
        role: role || (isAdmin ? 'ADMIN' : 'CONTRIBUTOR'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Seed initial tasks for Kevin
      if (displayName === 'KEVIN MALONE') {
        const objectivesRef = collection(db, 'objectives');
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(today.getMonth() + 1);
        
        await addDoc(objectivesRef, {
          title: 'Q1 Financial Audit',
          description: 'Complete the quarterly financial audit for all departments.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          assignedToId: user.uid,
          percentComplete: 45,
          startDate: serverTimestamp(),
          dueDate: Timestamp.fromDate(nextMonth),
          createdAt: serverTimestamp()
        });

        const inTwoMonths = new Date();
        inTwoMonths.setMonth(today.getMonth() + 2);
        await addDoc(objectivesRef, {
          title: 'Budget Allocation Review',
          description: 'Review and approve budget allocations for the manufacturing expansion.',
          status: 'NOT_STARTED',
          priority: 'MEDIUM',
          assignedToId: user.uid,
          percentComplete: 0,
          startDate: serverTimestamp(),
          dueDate: Timestamp.fromDate(inTwoMonths),
          createdAt: serverTimestamp()
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--accents-1)] p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--brand-10)]/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--brand-10)]/5 blur-[120px] rounded-full" />

      <div className="max-w-md w-full modern-card p-10 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-10)]/10 border border-[var(--brand-10)]/20 text-[var(--brand-10)] text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-10)] animate-pulse" />
            SandPro HQ
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">SP OMP</h1>
          <p className="text-[var(--accents-7)] text-sm font-light">Where big things happen.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="accent-button w-full py-4 text-white font-black flex items-center justify-center gap-3 active:scale-[0.98] mb-4"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <button
          onClick={handleDemoLogin}
          disabled={loading}
          className="secondary-button w-full py-4 text-white font-black flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-[var(--brand-10)]/20 flex items-center justify-center text-[var(--brand-10)]">
                K
              </div>
              Login as Kevin (Demo)
            </>
          )}
        </button>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-[var(--accents-6)] uppercase tracking-widest font-bold">
            Authorized Personnel & Dreamers Only
          </p>
        </div>
      </div>
    </div>
  );
};
