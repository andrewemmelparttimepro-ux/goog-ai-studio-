import { FirebaseProvider, useAuth } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F7941D]/30 border-t-[#F7941D] rounded-full animate-spin" />
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
