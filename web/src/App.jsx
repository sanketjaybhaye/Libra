import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthScreen from './components/AuthScreen';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import ItemDetailPage from './pages/ItemDetailPage';
import UploadPage from './pages/UploadPage';
import EpubReaderPage from './pages/EpubReaderPage';
import ComicReaderPage from './pages/ComicReaderPage';
import PdfReaderPage from './pages/PdfReaderPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';

function Shell() {
  const [search, setSearch] = useState('');
  return (
    <AppLayout search={search} onSearch={setSearch}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage search={search} />} />
        <Route path="/item/:id" element={<ItemDetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
    <Routes>
      <Route path="/read/epub/:id" element={<EpubReaderPage />} />
      <Route path="/read/comic/:id" element={<ComicReaderPage />} />
      <Route path="/read/pdf/:id" element={<PdfReaderPage />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
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
