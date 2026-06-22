import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../api';

function decodeHtml(html) {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

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


export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleBack = () => {
    const from = location.state?.from;
    if (from && !from.includes('/read/')) {
      navigate(from);
    } else {
      navigate('/library');
    }
  };

  const [item, setItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverCacheBuster, setCoverCacheBuster] = useState(0);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [shelves, setShelves] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [highlightSearch, setHighlightSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [showShelvesDropdown, setShowShelvesDropdown] = useState(false);
  const shelvesDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (shelvesDropdownRef.current && !shelvesDropdownRef.current.contains(e.target)) {
        setShowShelvesDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  async function handleCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadCover(id, file);
      setCoverCacheBuster((cb) => cb + 1);
      const d = await api.getItem(id);
      setItem(d.item);
      setForm((prev) => ({
        ...prev,
        ...d.item,
        coverUrl: null, // Clear any fetched coverUrl preview since they just uploaded a custom file
      }));
    } catch (err) {
      alert(err.message || 'Failed to upload cover image');
    } finally {
      setBusy(false);
    }
  }

  async function handleFetchMetadata() {
    if (!form.title.trim()) return;
    setFetchingMetadata(true);
    try {
      const data = await api.searchMetadata(form.title);
      if (data && data.meta) {
        const { title, author, description, coverUrl } = data.meta;
        setForm((prev) => ({
          ...prev,
          title: title || prev.title,
          author: author || prev.author,
          description: decodeHtml(description) || prev.description,
          coverUrl: coverUrl || prev.coverUrl,
        }));
        setErrors((prev) => ({ ...prev, title: '' }));
      } else {
        alert('No metadata found for this title');
      }
    } catch (err) {
      alert(err.message || 'Failed to fetch metadata');
    } finally {
      setFetchingMetadata(false);
    }
  }

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getItem(id),
      api.getShelves().catch(() => ({ shelves: [] })),
      api.getHighlights(id).catch(() => ({ highlights: [] })),
      api.getComments(id).catch(() => ({ comments: [] }))
    ]).then(([d, shelvesData, hlData, commentsData]) => {
      const decodedDesc = decodeHtml(d.item.description || '');
      const itemWithDecodedDesc = { ...d.item, description: decodedDesc };
      setItem(itemWithDecodedDesc);
      setForm({ ...itemWithDecodedDesc, tags: d.item.tags || [] });
      setTagInput((d.item.tags || []).join(', '));
      setShelves(shelvesData.shelves || []);
      setHighlights(hlData.highlights || []);
      setComments(commentsData.comments || []);
    });
  }, [id]);

  async function toggleShelf(shelfId) {
    const shelf = shelves.find(s => s.id === shelfId);
    const inShelf = shelf.items.some(i => i.id === id);
    try {
      if (inShelf) await api.removeFromShelf(shelfId, id);
      else await api.addToShelf(shelfId, id);
      const res = await api.getShelves();
      setShelves(res.shelves || []);
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDeleteHighlight(hlId) {
    if (!confirm('Delete highlight?')) return;
    try {
      await api.deleteHighlight(hlId);
      setHighlights(prev => prev.filter(h => h.id !== hlId));
    } catch (e) { alert(e.message); }
  }

  async function handleNotionSync() {
    setSyncing(true);
    try {
      const res = await api.syncToNotion(id);
      alert('Synced successfully to Notion! Page: ' + res.url);
    } catch (e) {
      alert('Failed to sync to Notion: ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  function handleExportMarkdown() {
    const header = `# Reading Notes: ${item.title}\n**Author**: ${item.author || 'Unknown'}\n**Format**: ${item.format.toUpperCase()}\n\n---\n\n`;
    const body = highlights.map(h => `> ${h.text}\n${h.note ? `\n*Note: ${h.note}*\n` : ''}`).join('\n\n');
    const content = header + body;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }



  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.addComment(id, newComment.trim());
      setComments(prev => [...prev, res.comment]);
      setNewComment('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingComment(false);
    }
  }

  if (!item || !form) return <div className="page-loading">Loading…</div>;

  function validateForm() {
    const newErrors = {};
    if (!form.title || !form.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (form.series_index && isNaN(Number(form.series_index))) {
      newErrors.series_index = 'Series index must be a number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setBusy(true);
    try {
      const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
      const { item: updated } = await api.updateItem(id, {
        title: form.title, 
        author: form.author, 
        series: form.series,
        series_index: form.series_index ? parseFloat(form.series_index) : null,
        description: form.description, 
        tags,
        coverUrl: form.coverUrl || null,
      });
      const decodedDesc = decodeHtml(updated.description || '');
      setItem({ ...updated, description: decodedDesc, tags });
      if (form.coverUrl) {
        setCoverCacheBuster((cb) => cb + 1);
      }
      setEditing(false);
      setErrors({});
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    await api.deleteItem(id);
    navigate('/library');
  }

  async function toggleFavorite() {
    if (item.is_favorite) await api.unfavorite(id);
    else await api.favorite(id);
    setItem({ ...item, is_favorite: !item.is_favorite });
  }

  const readerPath = item.kind === 'comic' ? `/read/comic/${id}` : item.format === 'pdf' ? `/read/pdf/${id}` : `/read/epub/${id}`;
  const canRead = ['epub', 'pdf', 'cbz', 'cbr'].includes(item.format);

  const getNormalizedColor = (color) => {
    if (!color) return '#ffd166';
    const c = color.toLowerCase();
    if (c === '#06d6a0' || c === '#118ab2' || c === '#ef476f') {
      return c;
    }
    return '#ffd166'; // Normalize default '#c98a3e' or other colors to Yellow
  };

  const filteredHighlights = highlights.filter(hl => {
    if (colorFilter !== 'all' && getNormalizedColor(hl.color) !== colorFilter) {
      return false;
    }
    if (highlightSearch.trim()) {
      const query = highlightSearch.toLowerCase();
      return (hl.text || '').toLowerCase().includes(query) || (hl.note || '').toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="detail-page">
      <button className="back-link" onClick={handleBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span>Back</span>
      </button>

      <div className="detail-hero">
        <div className="detail-cover-wrap">
          <div className="book-3d-card">
            {form.coverUrl ? (
              <img src={form.coverUrl} alt="Cover Preview" className="detail-cover" />
            ) : item.cover_path ? (
              <img src={`${api.coverUrl(id)}?cb=${coverCacheBuster}`} alt="" className="detail-cover" />
            ) : (
              <div className={`detail-cover book-cover-fallback ${getFallbackTheme(form.title || item.title)}`}>
                <div className="fallback-spine"></div>
                <div className="fallback-inner">
                  <span className="fallback-title-text">{form.title || item.title}</span>
                  <span className="fallback-author-text">{form.author || item.author || 'Libra Shelf'}</span>
                </div>
              </div>
            )}
            <div className="book-3d-spine"></div>
            <div className="book-3d-shine"></div>
            
            {editing && (
              <label className="cover-upload-overlay" title="Upload custom cover">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                <span>Change Cover</span>
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleCoverUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        <div className="detail-info">
          <span className={`kind-badge kind-${item.kind} detail-kind-badge`}>{item.kind === 'comic' ? 'Comic' : item.format.toUpperCase()}</span>

          {editing ? (
            <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px', width: '100%', maxWidth: '680px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="field-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.5px' }}>Title</label>
                <div className="edit-title-row">
                  <input 
                    className={`edit-title-input ${errors.title ? 'has-error' : ''}`} 
                    value={form.title} 
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                    }} 
                    placeholder="Title" 
                  />
                  <button 
                    type="button" 
                    className="btn-ghost btn-small fetch-metadata-btn" 
                    onClick={handleFetchMetadata} 
                    disabled={fetchingMetadata || !form.title?.trim()}
                  >
                    {fetchingMetadata ? 'Fetching...' : 'Fetch from Web'}
                  </button>
                </div>
                {errors.title && <span className="error-message" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.title}</span>}
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="field-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.5px' }}>Author</label>
                <input 
                  className="edit-input" 
                  placeholder="Author" 
                  value={form.author || ''} 
                  onChange={(e) => setForm({ ...form, author: e.target.value })} 
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="field-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.5px' }}>Series</label>
                  <input 
                    className="edit-input" 
                    placeholder="Series name (optional)" 
                    value={form.series || ''} 
                    onChange={(e) => setForm({ ...form, series: e.target.value })} 
                    style={{ maxWidth: '100%' }}
                  />
                </div>
                <div style={{ flex: '1 1 80px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="field-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.5px' }}>Index #</label>
                  <input 
                    className={`edit-input ${errors.series_index ? 'has-error' : ''}`} 
                    placeholder="Index" 
                    type="text" 
                    value={form.series_index || ''} 
                    onChange={(e) => {
                      setForm({ ...form, series_index: e.target.value });
                      if (errors.series_index) setErrors((prev) => ({ ...prev, series_index: '' }));
                    }} 
                    style={{ maxWidth: '100%' }}
                  />
                  {errors.series_index && <span className="error-message" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.series_index}</span>}
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="detail-title">{item.title}</h1>
              {item.author && <p className="detail-author">{item.author}</p>}
              {item.series && (
                <p className="detail-series">
                  Book {item.series_index} of <em>{item.series}</em>
                </p>
              )}
            </>
          )}

          <div className="detail-stats">
            {item.page_count && (
              <span className="stat-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5V5.5A2 2 0 0 1 6 3.5h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5a2 2 0 0 0-2 2Z"/></svg>
                <span>{item.page_count} {item.kind === 'comic' ? 'pages' : 'chapters'}</span>
              </span>
            )}
            <span className="stat-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <span>{formatBytes(item.file_size)}</span>
            </span>
            {item.my_status === 'reading' && (
              <span className="stat-badge stat-progress">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span>{Math.round(item.my_percent)}% read</span>
              </span>
            )}
            {item.my_status === 'finished' && (
              <span className="stat-badge stat-finished">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                <span>Finished</span>
              </span>
            )}
          </div>

          {!editing && (
            <div className="detail-actions" style={{ position: 'relative' }}>
              {canRead && (
                <button className="btn-primary" onClick={() => navigate(readerPath)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  <span>{item.my_status === 'reading' ? 'Continue reading' : 'Start reading'}</span>
                </button>
              )}
              <button className={`btn-ghost btn-favorite ${item.is_favorite ? 'is-favorited' : ''}`} onClick={toggleFavorite}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={item.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>{item.is_favorite ? 'Favorited' : 'Favorite'}</span>
              </button>
              <div className="dropdown-container btn-shelves" ref={shelvesDropdownRef}>
                <button className="btn-ghost" onClick={() => setShowShelvesDropdown(!showShelvesDropdown)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V5A2.5 2.5 0 0 1 6.5 2.5H20M12 6v6m-3-3h6"/></svg>
                  <span>Shelves</span>
                </button>
                {showShelvesDropdown && (
                  <div className="shelves-dropdown">
                    {shelves.length === 0 ? <div className="shelves-dropdown-empty">No custom shelves</div> : null}
                    {shelves.map(shelf => {
                      const inShelf = shelf.items.some(i => i.id === id);
                      return (
                        <label key={shelf.id} className="shelf-checkbox-row">
                          <input type="checkbox" checked={inShelf} onChange={() => toggleShelf(shelf.id)} />
                          <span>{shelf.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <a className="btn-ghost btn-download" href={api.fileUrl(id)} download>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                <span>Download</span>
              </a>
              {highlights.length > 0 && (
                <button className="btn-ghost btn-notion-sync" onClick={handleNotionSync} disabled={syncing}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  <span>{syncing ? 'Syncing...' : 'Sync to Notion'}</span>
                </button>
              )}
              {highlights.length > 0 && (
                <button className="btn-ghost btn-export-notes" onClick={handleExportMarkdown}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  <span>Export Notes</span>
                </button>
              )}
              <button className="btn-ghost btn-edit" onClick={() => setEditing(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Edit</span>
              </button>
            </div>
          )}

          {editing && (
            <div className="tag-edit" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '680px' }}>
              <label className="field-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.5px' }}>Tags (comma separated)</label>
              <input className="edit-input" style={{ maxWidth: '100%' }} value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="fantasy, favorites, to-reread" />
            </div>
          )}

          {editing && (
            <div className="edit-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn-primary" onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
              <button className="btn-ghost" onClick={() => { setEditing(false); setForm({ ...item }); setTagInput((item.tags || []).join(', ')); setErrors({}); }}>Cancel</button>
            </div>
          )}

          {!editing && item.tags?.length > 0 && (
            <div className="detail-tags">
              {item.tags.map((t) => <Link key={t} to={`/library?tag=${encodeURIComponent(t)}`} className="tag-pill">{t}</Link>)}
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div className="detail-description edit-description-section">
          <h3>About this {item.kind}</h3>
          <textarea
            className="edit-textarea"
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="No description set yet. Fetch details or write one here..."
            rows={6}
          />
        </div>
      ) : (
        item.description && (
        <div className="detail-description">
            <h3>About this {item.kind}</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{item.description}</p>
          </div>
        )
      )}

      {highlights.length > 0 && !editing && (
        <div className="detail-highlights">
          <h3>Your Highlights & Notes ({filteredHighlights.length})</h3>

          <div className="highlights-toolbar">
            <div className="highlights-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder="Search highlights & notes..." 
                value={highlightSearch} 
                onChange={(e) => setHighlightSearch(e.target.value)} 
                className="highlights-search-input"
              />
              {highlightSearch && (
                <button className="clear-search-btn" onClick={() => setHighlightSearch('')}>×</button>
              )}
            </div>
            <div className="highlights-color-selector">
              <button 
                className={`color-chip-all ${colorFilter === 'all' ? 'active' : ''}`} 
                onClick={() => setColorFilter('all')}
              >
                All
              </button>
              {[
                { hex: '#ffd166', label: 'Yellow' },
                { hex: '#06d6a0', label: 'Green' },
                { hex: '#118ab2', label: 'Blue' },
                { hex: '#ef476f', label: 'Pink' }
              ].map(c => (
                <button 
                  key={c.hex} 
                  className={`color-dot-filter ${colorFilter === c.hex ? 'active' : ''}`} 
                  style={{ backgroundColor: c.hex }} 
                  onClick={() => setColorFilter(c.hex)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="highlights-list">
            {filteredHighlights.length === 0 ? (
              <div className="highlights-empty-state">No matching highlights found</div>
            ) : (
              filteredHighlights.map(hl => (
                <div key={hl.id} className="highlight-item" style={{ borderLeftColor: getNormalizedColor(hl.color) }}>
                  <p className="highlight-text">“{cleanHighlightText(hl.text)}”</p>
                  {hl.note && <p className="highlight-note"><span className="note-badge">Note</span> {hl.note}</p>}
                  <div className="highlight-meta">
                    <span>{new Date(hl.created_at).toLocaleDateString()}</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn-link danger" onClick={() => handleDeleteHighlight(hl.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="detail-danger-zone">
        <div className="danger-zone-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span>Danger Zone</span>
        </div>
        <p className="danger-zone-desc">Once you delete this item, it will be removed permanently from your library shelves along with its stored file.</p>

        {confirmDelete ? (
          <div className="confirm-delete">
            <span className="confirm-delete-msg">Are you absolutely sure you want to delete this title?</span>
            <div className="confirm-delete-actions">
              <button className="btn-danger" onClick={handleDelete}>Yes, delete permanently</button>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>Delete title...</button>
        )}
      </div>

      {/* Discussion / Comments Section */}
      {!editing && (
        <div className="detail-comments card" style={{ marginTop: '32px', padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>Discussion & Shared Notes</h3>
          
          <form className="comment-form" onSubmit={handleAddComment} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Add to the discussion or log a public note..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{ flex: '1 1 200px' }}
            />
            <button type="submit" className="btn-primary" disabled={submittingComment}>
              {submittingComment ? 'Posting...' : 'Post'}
            </button>
          </form>

          <div className="comments-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {comments.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>No shared notes yet. Start the conversation!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="comment-item" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px' }}>
                  <span className="user-avatar" style={{ background: c.user_color || 'var(--accent)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                    {c.username[0].toUpperCase()}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{c.username}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{c.comment}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
