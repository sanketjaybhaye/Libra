import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthScreen from './components/AuthScreen';
import AppLayout from './components/AppLayout';

// Lazy load page components to shrink initial bundle footprint
const HomePage = lazy(() => import('./pages/HomePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const EpubReaderPage = lazy(() => import('./pages/EpubReaderPage'));
const ComicReaderPage = lazy(() => import('./pages/ComicReaderPage'));
const PdfReaderPage = lazy(() => import('./pages/PdfReaderPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

function Shell() {
  const [search, setSearch] = useState('');
  return (
    <AppLayout search={search} onSearch={setSearch}>
      <Suspense fallback={<div className="page-loading">Loading…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<LibraryPage search={search} />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="boot-loading">Libra</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <Suspense fallback={<div className="page-loading">Loading…</div>}>
      <Routes>
        <Route path="/read/epub/:id" element={<EpubReaderPage />} />
        <Route path="/read/comic/:id" element={<ComicReaderPage />} />
        <Route path="/read/pdf/:id" element={<PdfReaderPage />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
