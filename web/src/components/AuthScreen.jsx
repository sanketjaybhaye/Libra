import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [hasUsers, setHasUsers] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.usersExist().then((d) => {
      setHasUsers(d.exists);
      if (!d.exists) setMode('register');
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-backdrop" aria-hidden="true">
        <svg className="spine-art" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
          {[...Array(9)].map((_, i) => {
            const colors = ['#c98a3e', '#7c9885', '#7e91c9', '#b5483d', '#9e8ac9', '#d9a05e', '#5a7a68', '#8a6a4a', '#6a7e9e'];
            const x = 20 + i * 42;
            const h = 380 + (i % 3) * 60;
            return (
              <rect key={i} x={x} y={560 - h} width="30" height={h} rx="2"
                fill={colors[i % colors.length]} opacity={0.85} />
            );
          })}
        </svg>
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-mark">Libra</span>
          <span className="auth-tag">your shelf, on your network</span>
        </div>

        {!hasUsers && (
          <p className="auth-welcome">
            No one's set up Libra yet. Create the first account to get started — it becomes the admin.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              minLength={3}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {hasUsers && (
          <button
            type="button"
            className="auth-switch"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? "New here? Create an account" : 'Already have an account? Sign in'}
          </button>
        )}
      </div>
    </div>
  );
}
