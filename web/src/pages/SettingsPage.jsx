import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [shelves, setShelves] = useState([]);
  const [showToken, setShowToken] = useState(false);
  
  const COLORS = ['#c98a3e', '#7c9885', '#7e91c9', '#c97e9e', '#9e8ac9'];
  async function handleColorChange(c) {
    try {
      const res = await api.updateProfile({ color: c });
      setUser(res.user);
    } catch (e) {
      alert('Failed to update color: ' + e.message);
    }
  }
  const [newShelfName, setNewShelfName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [notionToken, setNotionToken] = useState(user?.notion_token || '');
  const [notionDatabaseId, setNotionDatabaseId] = useState(user?.notion_database_id || '');
  const [savingNotion, setSavingNotion] = useState(false);

  const [dailyPageGoal, setDailyPageGoal] = useState(user?.daily_page_goal || 20);
  const [dailyMinuteGoal, setDailyMinuteGoal] = useState(user?.daily_minute_goal || 30);
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    if (user) {
      setNotionToken(user.notion_token || '');
      setNotionDatabaseId(user.notion_database_id || '');
      setDailyPageGoal(user.daily_page_goal ?? 20);
      setDailyMinuteGoal(user.daily_minute_goal ?? 30);
    }
  }, [user]);

  async function handleSaveNotion(e) {
    e.preventDefault();
    setSavingNotion(true);
    try {
      const res = await api.updateProfile({
        notion_token: notionToken,
        notion_database_id: notionDatabaseId
      });
      setUser(res.user);
      alert('Notion settings saved successfully!');
    } catch (e) {
      alert('Failed to save Notion settings: ' + e.message);
    } finally {
      setSavingNotion(false);
    }
  }

  async function handleSaveGoals(e) {
    e.preventDefault();
    setSavingGoals(true);
    try {
      const res = await api.updateProfile({
        daily_page_goal: dailyPageGoal,
        daily_minute_goal: dailyMinuteGoal
      });
      setUser(res.user);
      alert('Reading goals saved successfully!');
    } catch (e) {
      alert('Failed to save reading goals: ' + e.message);
    } finally {
      setSavingGoals(false);
    }
  }

  useEffect(() => {
    loadShelves();
  }, []);

  async function loadShelves() {
    try {
      const res = await api.getShelves();
      setShelves(res.shelves || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateShelf(e) {
    e.preventDefault();
    if (!newShelfName.trim()) return;
    try {
      await api.createShelf(newShelfName);
      setNewShelfName('');
      loadShelves();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDeleteShelf(id) {
    if (!confirm('Are you sure you want to delete this shelf?')) return;
    try {
      await api.deleteShelf(id);
      loadShelves();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const res = await api.uploadAvatar(file);
      setUser(res.user); 
    } catch (e) {
      alert('Failed to upload avatar: ' + e.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="page-header" style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '700', margin: 0 }}>Settings</h1>
      </header>

      <div className="settings-grid">
        <section className="settings-section card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ProfileIcon />
            Profile
          </h2>
          <div className="profile-row" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div className="avatar-container" style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden' }}>
              {user?.avatar_path ? (
                <img src={api.avatarUrl(user.avatar_path)} alt="Avatar" className="large-avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div className="large-avatar placeholder" style={{ background: user?.color, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 600, color: '#fff' }}>
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <label className="avatar-hover-overlay" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>{avatarUploading ? 'Uploading...' : 'Edit'}</span>
                <input type="file" accept="image/*" className="visually-hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
              </label>
            </div>
            <div className="profile-info" style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600' }}>{user?.username}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{user?.is_admin ? 'Administrator' : 'Reader'}</p>
              
              <div className="color-picker-row" style={{ marginTop: '1.2rem' }}>
                <span className="field-label" style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Color Accent</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      style={{
                        background: c,
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        border: user?.color === c ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                        boxShadow: user?.color === c ? `0 0 12px ${c}` : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                      }}
                      onClick={() => handleColorChange(c)}
                      aria-label={`Select avatar color ${c}`}
                      className="color-bubble"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GoalsIcon />
            Daily Goals
          </h2>
          <p className="settings-description" style={{ margin: 0 }}>
            Set daily targets for pages and active reading duration to track your reading habits.
          </p>
          <form className="goals-form" onSubmit={handleSaveGoals} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>Daily Pages</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={dailyPageGoal}
                  onChange={(e) => setDailyPageGoal(parseInt(e.target.value, 10) || 20)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>Daily Minutes</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={dailyMinuteGoal}
                  onChange={(e) => setDailyMinuteGoal(parseInt(e.target.value, 10) || 30)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={savingGoals} style={{ alignSelf: 'flex-start', marginTop: '8px', padding: '10px 18px', fontSize: '13px' }}>
              <SaveIcon />
              {savingGoals ? 'Saving...' : 'Save Goals'}
            </button>
          </form>
        </section>

        <section className="settings-section card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShelvesIcon />
            My Shelves
          </h2>
          <form className="add-shelf-form" onSubmit={handleCreateShelf}>
            <input
              type="text"
              placeholder="New shelf name..."
              value={newShelfName}
              onChange={(e) => setNewShelfName(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '10px 16px', fontSize: '13px' }}>Create</button>
          </form>

          <div className="shelves-list">
            {shelves.length === 0 ? (
              <p className="empty-text" style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No shelves created yet.</p>
            ) : (
              shelves.map((shelf) => (
                <div key={shelf.id} className="shelf-item-row">
                  <span style={{ fontSize: '13.5px', fontWeight: '500' }}>
                    {shelf.name} <small style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginLeft: '6px' }}>({shelf.items?.length || 0} items)</small>
                  </span>
                  <button 
                    className="btn-danger btn-ghost" 
                    onClick={() => handleDeleteShelf(shelf.id)}
                    title="Delete Shelf"
                    style={{
                      padding: '8px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      border: '1px solid rgba(220, 53, 69, 0.2)',
                      background: 'rgba(220, 53, 69, 0.05)',
                      color: 'var(--danger)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="settings-section card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotionIcon />
            Notion Integration
          </h2>
          <p className="settings-description" style={{ margin: 0 }}>
            Automatically sync highlights and reading notes to your personal Notion database.
          </p>
          <form className="notion-form" onSubmit={handleSaveNotion} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>Integration Token</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="secret_..."
                  value={notionToken}
                  onChange={(e) => setNotionToken(e.target.value)}
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title={showToken ? "Hide Token" : "Show Token"}
                >
                  {showToken ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11-8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>Database ID</label>
              <input
                type="text"
                placeholder="Enter 32-character database ID"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={savingNotion} style={{ alignSelf: 'flex-start', marginTop: '8px', padding: '10px 18px', fontSize: '13px' }}>
              <SaveIcon />
              {savingNotion ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

// Icon Components for beautiful visual headers
function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GoalsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ShelvesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

