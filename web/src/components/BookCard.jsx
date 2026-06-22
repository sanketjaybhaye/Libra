import { useState, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

const BookCard = memo(function BookCard({ item }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProgress = item.my_percent > 0 && item.my_percent < 99;
  const [imgError, setImgError] = useState(false);

  // Fallback themes generator
  function getFallbackTheme(title) {
    const themes = ['fb-navy', 'fb-crimson', 'fb-emerald', 'fb-plum', 'fb-sepia'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;
    return themes[index];
  }

  return (
    <button className="book-card" onClick={() => navigate(`/item/${item.id}`, { state: { from: location.pathname + location.search } })}>
      <div className="book-cover-wrap">
        {item.cover_path && !imgError ? (
          <img src={api.coverUrl(item.id)} alt="" className="book-cover" loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div className={`book-cover book-cover-fallback ${getFallbackTheme(item.title)}`}>
            <div className="fallback-spine"></div>
            <div className="fallback-inner">
              <span className="fallback-title-text">{item.title}</span>
              <span className="fallback-author-text">{item.author || 'Libra Shelf'}</span>
            </div>
          </div>
        )}
        <span className={`kind-badge kind-${item.kind}`}>{item.kind === 'comic' ? 'Comic' : item.format.toUpperCase()}</span>
        {item.is_favorite && <span className="fav-badge" aria-label="Favorited">★</span>}
        {hasProgress && (
          <div className="progress-rail" aria-label={`${Math.round(item.my_percent)}% read`}>
            <div className="progress-fill" style={{ width: `${item.my_percent}%` }} />
          </div>
        )}
        {item.my_status === 'finished' && <span className="finished-check" aria-label="Finished">✓</span>}
      </div>
      <div className="book-meta">
        <span className="book-title">{item.title}</span>
        {item.author && <span className="book-author">{item.author}</span>}
      </div>
    </button>
  );
});

export default BookCard;
