import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const seedGroups = async () => {
    try {
      const groupsSnap = await getDocs(collection(db, 'groups'));
      if (groupsSnap.empty) {
        console.log("Seeding default groups...");
        const defaultGroups = [
          { name: 'Safety & Compliance', description: 'EHS and regulatory oversight' },
          { name: 'Operations', description: 'Core production and field activities' },
          { name: 'Maintenance', description: 'Equipment and facility upkeep' },
          { name: 'Logistics', description: 'Supply chain and transport' },
          { name: 'Administration', description: 'Corporate and support functions' }
        ];

        for (const group of defaultGroups) {
          await addDoc(collection(db, 'groups'), {
            ...group,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Error seeding groups:", error);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Auto-upgrade admin email if needed
          if (user.email === 'andrewemmelparttimepro@gmail.com' && data.role !== 'ADMIN') {
            await updateDoc(doc(db, 'users', user.uid), { role: 'ADMIN' });
          }
          
          setProfile(data);

          // Seed groups if admin
          if (data.role === 'ADMIN') {
            seedGroups();
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Profile fetch error:", error);
        setLoading(false);
      });

      return () => unsubscribeProfile();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
