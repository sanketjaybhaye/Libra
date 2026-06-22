import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import BookCard from '../components/BookCard';

function cleanHighlightText(text) {
  if (!text) return '';
  let str = text.trim();
  
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1).trim();
  } else if (str.startsWith("'") && str.endsWith("'")) {
    str = str.slice(1, -1).trim();
  } else {
    if (str.startsWith('"') && !str.slice(1).includes('"')) {
      str = str.slice(1).trim();
    } else if (str.endsWith('"') && !str.slice(0, -1).includes('"')) {
      str = str.slice(0, -1).trim();
    }
    if (str.startsWith("'") && !str.slice(1).includes("'")) {
      str = str.slice(1).trim();
    } else if (str.endsWith("'") && !str.slice(0, -1).includes("'")) {
      str = str.slice(0, -1).trim();
    }
  }

  if (str.startsWith('[') && !str.includes(']')) {
    str = str.slice(1).trim();
  }
  if (str.endsWith(']') && !str.includes('[')) {
    str = str.slice(0, -1).trim();
  }
  
  return str;
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [continueItems, setContinueItems] = useState([]);
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recentHighlights, setRecentHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    reading: 0,
    completed: 0,
    authors: 0
  });

  useEffect(() => {
    Promise.all([
      api.continueReading().catch(() => ({ items: [] })),
      api.listItems({ sort: 'added' }).catch(() => ({ items: [] })),
      api.getAnalytics().catch(() => ({ totalFinished: 0, currentlyReading: 0, averageReadingProgress: 0 })),
      api.getRecentHighlights(6).catch(() => ({ highlights: [] }))
    ]).then(([cont, all, analytics, hlData]) => {
      setContinueItems(cont.items);
      setRecent(all.items.slice(0, 18));
      setRecentHighlights(hlData.highlights || []);
      
      // Calculate library stats
      const total = all.items.length;
      const reading = analytics.currentlyReading || all.items.filter(item => item.my_status === 'reading').length;
      const completed = analytics.totalFinished || all.items.filter(item => item.my_status === 'finished').length;
      const authors = new Set(all.items.map(item => item.author).filter(Boolean)).size;
      const avgProgress = analytics.averageReadingProgress || 0;
      
      setStats({ total, reading, completed, authors, avgProgress });

      // Extract favorites
      const favs = all.items.filter(item => item.is_favorite);
      setFavorites(favs.slice(0, 18));

      setLoading(false);
    });
  }, []);

  if (loading) return <div className="page-loading">Opening the shelves…</div>;

  const isEmpty = recent.length === 0;

  if (isEmpty) {
    return (
      <div className="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 19.5V5.5A2 2 0 0 1 6 3.5h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
        <h2>The shelf is empty</h2>
        <p>Add your first book or comic to start building your library.</p>
        <Link to="/upload" className="btn-primary">Add to library</Link>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* Stats Dashboard */}
      <div className="stats-grid">
        <Link to="/library" className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 19.5V5.5A2 2 0 0 1 6 3.5h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Shelved</span>
          </div>
        </Link>

        <Link to="/library?status=reading" className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.reading}</span>
            <span className="stat-label">In Progress</span>
          </div>
        </Link>

        <Link to="/library?status=finished" className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M22 4 12 14.01l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {stats.completed} <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>({stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%)</span>
            </span>
            <span className="stat-label">Completed</span>
          </div>
        </Link>

        <Link to="/library?sort=author" className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.authors}</span>
            <span className="stat-label">Unique Authors</span>
          </div>
        </Link>
      </div>

      {continueItems.length > 0 && (
        <section className="shelf-section">
          <h2 className="shelf-title">Continue reading</h2>
          <div className="book-grid">
            {continueItems.map((item) => <BookCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {/* Recent Notes & Highlights Section */}
      {recentHighlights.length > 0 && (
        <section className="shelf-section">
          <h2 className="shelf-title">Recent notes & highlights</h2>
          <div className="highlights-grid">
            {recentHighlights.map((hl) => (
              <div 
                key={hl.id} 
                className="highlight-card-hover"
                onClick={() => navigate(`/item/${hl.item_id}`, { state: { from: location.pathname + location.search } })}
              >
                <div>
                  <p className="highlight-card-text">
                    “{cleanHighlightText(hl.text)}”
                  </p>
                  {hl.note && hl.note !== 'Bookmark' && (
                    <p className="highlight-card-note">
                      <span className="highlight-card-note-badge">Note</span>
                      <span>{hl.note}</span>
                    </p>
                  )}
                </div>
                <div className="highlight-card-meta">
                  <span className="highlight-card-title" title={hl.item_title}>
                    {hl.item_title}
                  </span>
                  <span>{new Date(hl.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="shelf-section">
          <div className="shelf-header">
            <h2 className="shelf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent)' }}>★</span> Favorites
            </h2>
          </div>
          <div className="book-grid">
            {favorites.map((item) => <BookCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      <section className="shelf-section">
        <div className="shelf-header">
          <h2 className="shelf-title">Recently added</h2>
          <Link to="/library" className="shelf-link">View all →</Link>
        </div>
        <div className="book-grid">
          {recent.map((item) => <BookCard key={item.id} item={item} />)}
        </div>
      </section>
    </div>
  );
}
