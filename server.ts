import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase for the backend
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ==========================================
  // POWER BI REPORTING API (The "Jake" Routes)
  // ==========================================
  
  app.get('/api/reporting/objectives', async (req, res) => {
    try {
      const q = query(collection(db, 'objectives'), orderBy('dueDate', 'asc'));
      const snapshot = await getDocs(q);
      
      const data = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const item = docSnap.data();
        
        // Fetch status history for this objective
        const historyQ = query(collection(db, `objectives/${docSnap.id}/statusHistory`), orderBy('timestamp', 'desc'));
        const historySnap = await getDocs(historyQ);
        const history = historySnap.docs.map(h => ({
          id: h.id,
          ...h.data(),
          timestamp: h.data().timestamp?.toDate?.()?.toISOString() || h.data().timestamp
        }));

        // Flatten and format for Power BI
        return {
          id: docSnap.id,
          ...item,
          dueDate: item.dueDate?.toDate?.()?.toISOString() || item.dueDate,
          startDate: item.startDate?.toDate?.()?.toISOString() || item.startDate,
          createdAt: item.createdAt?.toDate?.()?.toISOString() || item.createdAt,
          updatedAt: item.updatedAt?.toDate?.()?.toISOString() || item.updatedAt,
          completionDate: item.completionDate?.toDate?.()?.toISOString() || item.completionDate,
          statusHistory: history
        };
      }));

      res.json({
        info: "SandPro OMP Reporting API",
        endpoint: "objectives",
        count: data.length,
        timestamp: new Date().toISOString(),
        data: data
      });
    } catch (error) {
      console.error("Reporting API Error:", error);
      res.status(500).json({ error: "Failed to fetch reporting data" });
    }
  });

  // ==========================================
  // AUTOMATED NOTIFICATION TRIGGER
  // ==========================================

  app.post('/api/system/check-overdue', async (req, res) => {
    try {
      const now = new Date();
      // Firestore doesn't allow multiple inequality filters on different fields.
      // We'll fetch all non-completed objectives and filter by dueDate in memory.
      const q = query(
        collection(db, 'objectives'),
        where('status', '!=', 'COMPLETED')
      );
      
      const snapshot = await getDocs(q);
      const notificationsCreated = [];

      for (const docSnap of snapshot.docs) {
        const obj = docSnap.data();
        const dueDate = obj.dueDate?.toDate?.() || new Date(obj.dueDate);
        
        if (dueDate < now) {
          const notificationData = {
            userId: obj.assignedToId,
            title: "Objective Overdue",
            message: `The objective "${obj.title}" is past its due date. Action required.`,
            type: "OVERDUE",
            read: false,
            createdAt: serverTimestamp(),
            link: `/objective/${docSnap.id}`
          };
          
          // Check if notification already exists to avoid spam
          const existingQ = query(
            collection(db, 'notifications'),
            where('userId', '==', obj.assignedToId),
            where('link', '==', `/objective/${docSnap.id}`),
            where('read', '==', false)
          );
          const existingSnap = await getDocs(existingQ);
          
          if (existingSnap.empty) {
            await addDoc(collection(db, 'notifications'), notificationData);
            notificationsCreated.push({ id: docSnap.id, title: obj.title });
          }
        }
      }

      res.json({ 
        success: true, 
        processed: snapshot.size, 
        created: notificationsCreated.length,
        items: notificationsCreated
      });
    } catch (error) {
      console.error("Notification check failed:", error);
      res.status(500).json({ error: "Failed to process overdue items" });
    }
  });

  app.get('/api/reporting/health', (req, res) => {
    res.json({ status: 'ok', service: 'SP OMP API' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 SP OMP Server Running
-------------------------
App URL: http://localhost:${PORT}
Reporting API: http://localhost:${PORT}/api/reporting/objectives
    `);
  });
}

startServer();
