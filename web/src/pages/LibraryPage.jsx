import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import BookCard from '../components/BookCard';
import CustomSelect from '../components/CustomSelect';

export default function LibraryPage({ search: searchProp }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || searchProp || '';
  const [items, setItems] = useState([]);
  const [facets, setFacets] = useState({ authors: [], series: [], tags: [] });
  const [loading, setLoading] = useState(true);

  function getFallbackTheme(title) {
    const themes = ['fb-navy', 'fb-crimson', 'fb-emerald', 'fb-plum', 'fb-sepia'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;
    return themes[index];
  }

  const kind = params.get('kind') || '';
  const author = params.get('author') || '';
  const seriesFilter = params.get('series') || '';
  const tag = params.get('tag') || '';
  const shelf = params.get('shelf') || '';
  const status = params.get('status') || '';
  const sort = params.get('sort') || 'added';

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'series'

  useEffect(() => {
    api.facets({ kind, shelf }).then(setFacets).catch(() => {});
  }, [kind, shelf]);

  useEffect(() => {
    setLoading(true);
    api.listItems({ kind, author, series: seriesFilter, tag, shelf, status, search, sort })
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));
  }, [kind, author, seriesFilter, tag, shelf, status, search, sort]);

  const groupedItems = useMemo(() => {
    if (viewMode !== 'series' || seriesFilter || search || author || tag || status) return null;
    const groups = {};
    const standalone = [];
    items.forEach((item) => {
      if (item.series) {
        if (!groups[item.series]) groups[item.series] = [];
        groups[item.series].push(item);
      } else {
        standalone.push(item);
      }
    });
    return { groups, standalone };
  }, [items, viewMode, seriesFilter, search, author, tag, status]);

  function setFilters(updates) {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setParams(next);
  }

  function setFilter(key, value) {
    setFilters({ [key]: value });
  }

  const activeFilterLabel = author || seriesFilter || tag || (search ? `Search "${search}"` : '') || (status === 'reading' ? 'In Progress' : status === 'finished' ? 'Completed' : '');

  return (
    <div className="library-page">
      <div className="library-toolbar">
        <div className="kind-tabs">
          <button className={!kind ? 'active' : ''} onClick={() => setFilter('kind', '')}>All</button>
          <button className={kind === 'book' ? 'active' : ''} onClick={() => setFilter('kind', 'book')}>Books</button>
          <button className={kind === 'comic' ? 'active' : ''} onClick={() => setFilter('kind', 'comic')}>Comics</button>
        </div>

        <div className="toolbar-right">
          {!seriesFilter && !search && !author && !tag && (
            <div className="view-mode-toggle">
              <button className={`btn-ghost btn-small ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>Grid</button>
              <button className={`btn-ghost btn-small ${viewMode === 'series' ? 'active' : ''}`} onClick={() => setViewMode('series')}>Series</button>
            </div>
          )}
          <CustomSelect
            value={sort}
            onChange={(val) => setFilter('sort', val)}
            options={[
              { value: 'added', label: 'Recently added' },
              { value: 'title', label: 'Title' },
              { value: 'author', label: 'Author' },
              { value: 'progress', label: 'Progress' }
            ]}
            align="right"
          />
        </div>
      </div>

      {(facets.authors.length > 0 || facets.series.length > 0 || facets.tags.length > 0) && (
        <div className="facet-row">
          {facets.series.length > 0 && (
            <FacetGroup
              label="Series"
              options={facets.series.map((s) => ({ value: s.series, count: s.count }))}
              active={seriesFilter}
              onSelect={(v) => setFilter('series', v)}
            />
          )}
          {facets.tags.length > 0 && (
            <FacetGroup
              label="Tags"
              options={facets.tags.map((t) => ({ value: t.name, count: t.count }))}
              active={tag}
              onSelect={(v) => setFilter('tag', v)}
            />
          )}
        </div>
      )}

      {activeFilterLabel && (
        <div className="active-filter-chip">
          Filtering by <strong>{activeFilterLabel}</strong>
          <button onClick={() => setFilters({ author: '', series: '', tag: '', status: '', search: '' })}>Clear</button>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state-inline">
          <p>Nothing matches here yet.</p>
        </div>
      ) : groupedItems ? (
        <>
          <div className="library-series-view">
            {Object.entries(groupedItems.groups).sort().map(([seriesName, sItems]) => (
              <div key={seriesName} className="series-group-card" onClick={() => setFilter('series', seriesName)}>
                <div className="series-group-covers">
                  {sItems.slice(0, 3).map((item, idx) => {
                    if (item.cover_path) {
                      return (
                        <img 
                          key={item.id} 
                          src={api.coverUrl(item.id)} 
                          alt="" 
                          className={`series-cover-stack s-cover-${idx}`} 
                          onError={(e) => { e.target.style.display = 'none'; }} 
                        />
                      );
                    }
                    return (
                      <div 
                        key={item.id} 
                        className={`series-cover-stack s-cover-${idx} book-cover-fallback ${getFallbackTheme(item.title)}`} 
                        style={{ padding: '8px', boxSizing: 'border-box' }}
                      >
                        <div className="fallback-spine" style={{ left: 0 }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', paddingLeft: '8px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.95)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2', textAlign: 'left' }}>{item.title}</span>
                          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{item.author || 'Libra'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="series-group-info">
                  <h3>{seriesName}</h3>
                  <span>{sItems.length} items</span>
                </div>
              </div>
            ))}
          </div>
          {groupedItems.standalone.length > 0 && (
            <>
              <h2 className="standalone-header" style={{ width: '100%', marginTop: '3rem', marginBottom: '1.5rem' }}>Standalone Titles</h2>
              <div className="book-grid">
                {groupedItems.standalone.map((item) => <BookCard key={item.id} item={item} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="book-grid">
          {items.map((item) => <BookCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function FacetGroup({ label, options, active, onSelect }) {
  return (
    <div className="facet-group">
      <span className="facet-label">{label}</span>
      <div className="facet-chips">
        {options.slice(0, 12).map((opt) => (
          <button
            key={opt.value}
            className={`facet-chip ${active === opt.value ? 'active' : ''}`}
            onClick={() => onSelect(active === opt.value ? '' : opt.value)}
          >
            {opt.value} <span className="facet-count">{opt.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
