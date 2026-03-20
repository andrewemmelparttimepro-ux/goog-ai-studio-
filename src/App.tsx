import { FirebaseProvider, useAuth } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--accents-1)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--brand-10)]/30 border-t-[var(--brand-10)] rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <Dashboard /> : <Login />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
