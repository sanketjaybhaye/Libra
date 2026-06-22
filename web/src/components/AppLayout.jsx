import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/library', label: 'Library', icon: ShelfIcon },
  { to: '/library?kind=book', label: 'Books', icon: BookIcon },
  { to: '/library?kind=comic', label: 'Comics', icon: ComicIcon },
  { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
];

function NavItem({ to, label, icon: Icon }) {
  const location = useLocation();
  const [path, query] = to.split('?');
  const targetParams = new URLSearchParams(query || '');
  const currentParams = new URLSearchParams(location.search);
  const isActive = to === '/'
    ? location.pathname === '/'
    : location.pathname === path && 
      (targetParams.get('kind') || '') === (currentParams.get('kind') || '') &&
      !currentParams.get('shelf') &&
      !currentParams.get('tag');

  return (
    <NavLink to={to} className={() => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppLayout({ children, search, onSearch }) {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [theme, setTheme] = useState(() => user?.theme_preference || localStorage.getItem('libra-theme') || 'dusk');
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user?.theme_preference) {
      setTheme(user.theme_preference);
    }
  }, [user?.theme_preference]);

  // Apply theme class on mount and theme change
  useEffect(() => {
    const themes = ['theme-sandstone', 'theme-nord', 'theme-emerald', 'theme-midnight'];
    document.body.classList.remove(...themes);
    if (theme !== 'dusk') {
      document.body.classList.add(`theme-${theme}`);
    }
    localStorage.setItem('libra-theme', theme);
  }, [theme]);

  // Fetch categories and shelves on navigation
  useEffect(() => {
    async function loadData() {
      try {
        const params = new URLSearchParams(location.search);
        const kind = params.get('kind') || '';
        const shelf = params.get('shelf') || '';
        const [facetsRes, shelvesRes] = await Promise.all([
          api.facets({ kind, shelf }),
          api.getShelves()
        ]);
        setCategories(facetsRes.tags || []);
        setShelves(shelvesRes.shelves || []);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
    loadData();
  }, [location.pathname, location.search]);

  // Fetch search results
  useEffect(() => {
    if (!search || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.listItems({ search: search.trim() });
        setSearchResults(res.items.slice(0, 5));
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [search]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const lastUrlSearchRef = useRef('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    
    if (urlSearch !== lastUrlSearchRef.current) {
      lastUrlSearchRef.current = urlSearch;
      onSearch?.(urlSearch);
    } else if (search && location.pathname !== '/library' && location.pathname !== '/') {
      onSearch?.('');
      lastUrlSearchRef.current = '';
    }
  }, [location.search, location.pathname, search, onSearch]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function handleThemeChange(t) {
    setTheme(t);
    try {
      const res = await api.updateProfile({ theme_preference: t });
      setUser(res.user);
    } catch (e) {
      console.error('Failed to save theme to server', e);
    }
  }

  async function handleToggleShared(shelfId, e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.toggleSharedShelf(shelfId);
      setShelves(prev => prev.map(s => s.id === shelfId ? { ...s, is_shared: res.is_shared } : s));
    } catch (err) {
      console.error('Failed to toggle shared status:', err);
    }
  }

  const myShelves = shelves.filter(s => s.is_owner);
  const sharedShelves = shelves.filter(s => !s.is_owner);

  return (
    <div className="app-shell">
      <div 
        className={`mobile-sidebar-backdrop ${mobileSidebarOpen ? 'active' : ''}`} 
        onClick={() => setMobileSidebarOpen(false)}
      />

      <aside className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="brand-mark">Libra</span>
          <button 
            className="mobile-menu-close" 
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="sidebar-scrollable-content">
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ to, label, icon }) => (
              <NavItem key={label} to={to} label={label} icon={icon} />
            ))}
          </nav>

          {myShelves.length > 0 && (
            <>
              <div className="sidebar-divider"></div>
              <div className="sidebar-section">
                <span className="sidebar-section-title">My Shelves</span>
                <div className="sidebar-categories">
                  {myShelves.map((shelf) => {
                    const currentParams = new URLSearchParams(location.search);
                    const isActive = currentParams.get('shelf') === shelf.id && !currentParams.get('tag');
                    return (
                      <Link
                        key={shelf.id}
                        to={`/library?shelf=${shelf.id}`}
                        className={`nav-item category-item ${isActive ? 'active' : ''}`}
                      >
                        <span className="category-icon">≡</span>
                        <span className="category-name">{shelf.name}</span>
                        <button
                          className={`shelf-share-btn ${shelf.is_shared ? 'shared' : ''}`}
                          onClick={(e) => handleToggleShared(shelf.id, e)}
                          title={shelf.is_shared ? 'Stop sharing this shelf' : 'Share this shelf'}
                          aria-label={shelf.is_shared ? 'Shared shelf' : 'Private shelf'}
                        >
                          <ShareIcon />
                        </button>
                        <span className="category-count">{shelf.items?.length || 0}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {sharedShelves.length > 0 && (
            <>
              <div className="sidebar-divider"></div>
              <div className="sidebar-section">
                <span className="sidebar-section-title">Shared Shelves</span>
                <div className="sidebar-categories">
                  {sharedShelves.map((shelf) => {
                    const currentParams = new URLSearchParams(location.search);
                    const isActive = currentParams.get('shelf') === shelf.id && !currentParams.get('tag');
                    return (
                      <Link
                        key={shelf.id}
                        to={`/library?shelf=${shelf.id}`}
                        className={`nav-item category-item ${isActive ? 'active' : ''}`}
                      >
                        <span className="category-icon">👥</span>
                        <span className="category-name">
                          {shelf.name} <span className="shelf-owner-badge">by {shelf.owner_name || 'user'}</span>
                        </span>
                        <span className="category-count">{shelf.items?.length || 0}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <span className="sidebar-section-title">Categories</span>
            <div className="sidebar-categories">
              {categories.length > 0 ? (
                categories.slice(0, 15).map((cat) => {
                  const currentParams = new URLSearchParams(location.search);
                  const isActive = currentParams.get('tag') === cat.name;
                  
                  const targetParams = new URLSearchParams();
                  const shelfVal = currentParams.get('shelf');
                  const kindVal = currentParams.get('kind');
                  const sortVal = currentParams.get('sort');
                  
                  if (shelfVal) targetParams.set('shelf', shelfVal);
                  if (kindVal) targetParams.set('kind', kindVal);
                  if (sortVal) targetParams.set('sort', sortVal);
                  
                  if (!isActive) {
                    targetParams.set('tag', cat.name);
                  }
                  
                  const qs = targetParams.toString();
                  const toUrl = `/library${qs ? `?${qs}` : ''}`;

                  return (
                    <Link
                      key={cat.name}
                      to={toUrl}
                      className={`nav-item category-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="category-icon">#</span>
                      <span className="category-name">{cat.name}</span>
                      <span className="category-count">{cat.count}</span>
                    </Link>
                  );
                })
              ) : (
                <span className="sidebar-empty">No categories yet</span>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="upload-btn" onClick={() => navigate('/upload')}>
            <PlusIcon />
            <span>Add to library</span>
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button 
            className="mobile-menu-toggle"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <MenuIcon />
          </button>
          <div className="topbar-search-container" ref={dropdownRef}>
            <div className="topbar-search">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search titles, authors, series…"
                value={search}
                onChange={(e) => {
                  onSearch?.(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowDropdown(false);
                    navigate(`/library?search=${encodeURIComponent(search)}`);
                  }
                }}
                aria-label="Search your library"
              />
            </div>

            {showDropdown && search && search.trim().length >= 2 && (
              <div className="search-dropdown">
                {searchResults.length > 0 ? (
                  <>
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        className="search-dropdown-item"
                        onClick={() => {
                          onSearch?.('');
                          setShowDropdown(false);
                          navigate(`/item/${item.id}`, { state: { from: location.pathname + location.search } });
                        }}
                      >
                        {item.cover_path ? (
                          <img src={api.coverUrl(item.id)} alt="" className="search-dropdown-thumb" />
                        ) : (
                          <div className="search-dropdown-fallback">
                            <span>{item.title.substring(0, 10)}</span>
                          </div>
                        )}
                        <div className="search-dropdown-info">
                          <span className="search-dropdown-title">{item.title}</span>
                          {item.author && <span className="search-dropdown-meta">{item.author}</span>}
                        </div>
                        <span className="search-dropdown-badge">{item.kind}</span>
                      </button>
                    ))}
                    <div className="menu-divider"></div>
                    <button
                      className="search-dropdown-item"
                      style={{ justifyContent: 'center', color: 'var(--accent)', fontWeight: 500 }}
                      onClick={() => {
                        setShowDropdown(false);
                        navigate(`/library?search=${encodeURIComponent(search)}`);
                      }}
                    >
                      See all results →
                    </button>
                  </>
                ) : (
                  <div className="search-dropdown-status">No titles found</div>
                )}
              </div>
            )}
          </div>

          <div className="topbar-user">
            <button className="user-chip" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="true" aria-expanded={menuOpen}>
              {user?.avatar_path ? (
                <img src={api.avatarUrl(user.avatar_path)} alt="Avatar" className="user-avatar-img" />
              ) : (
                <span className="user-avatar" style={{ background: user?.color }}>
                  {user?.username?.[0]?.toUpperCase()}
                </span>
              )}
              <span className="user-name">{user?.username}</span>
            </button>
            {menuOpen && (
              <div className="user-menu" onMouseLeave={() => setMenuOpen(false)}>
                {user?.is_admin && <div className="user-menu-tag">Admin ({user.username})</div>}
                
                <div className="theme-selector-header">Appearance</div>
                <div className="theme-options">
                  <button className={`theme-dot ${theme === 'dusk' ? 'active' : ''}`} style={{background: '#11151c', border: '1px solid #c98a3e'}} onClick={() => handleThemeChange('dusk')} title="Dusk"></button>
                  <button className={`theme-dot ${theme === 'sandstone' ? 'active' : ''}`} style={{background: '#1c1917', border: '1px solid #d97706'}} onClick={() => handleThemeChange('sandstone')} title="Sandstone"></button>
                  <button className={`theme-dot ${theme === 'nord' ? 'active' : ''}`} style={{background: '#2e3440', border: '1px solid #88c0d0'}} onClick={() => handleThemeChange('nord')} title="Nord"></button>
                  <button className={`theme-dot ${theme === 'emerald' ? 'active' : ''}`} style={{background: '#061f17', border: '1px solid #10b981'}} onClick={() => handleThemeChange('emerald')} title="Emerald"></button>
                  <button className={`theme-dot ${theme === 'midnight' ? 'active' : ''}`} style={{background: '#000000', border: '1px solid #c084fc'}} onClick={() => handleThemeChange('midnight')} title="Midnight"></button>
                </div>

                <div className="menu-divider"></div>
                <button className="user-menu-item" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>Settings</button>
                <button className="user-menu-item" onClick={handleLogout}>Sign out</button>
              </div>
            )}
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

function HomeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1H10v-5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5h3.5a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ShelfIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4v16M9 4v16M14 4v16M19 4v16M4 4h15M4 20h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
function BookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 19.5V5.5A2 2 0 0 1 6 3.5h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function ComicIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4" width="13" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="M16.5 7 20 6v15l-3.5 1" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function SearchIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
function AnalyticsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ShareIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
