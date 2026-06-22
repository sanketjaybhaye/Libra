import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const ACCEPTED = ['.epub', '.pdf', '.cbz', '.cbr'];

export default function UploadPage() {
  const [queue, setQueue] = useState([]); // { id, file, status, progress, error, result }
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const uploadOne = useCallback(async (entry) => {
    setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, status: 'uploading' } : e)));
    try {
      const { item } = await api.upload(entry.file, (pct) => {
        setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, progress: pct } : e)));
      });
      setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, status: 'done', result: item, progress: 100 } : e)));
    } catch (err) {
      setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, status: 'error', error: err.message } : e)));
    }
  }, []);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter((f) => ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext)));
    const rejected = fileList.length - files.length;
    const items = files.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file, status: 'queued', progress: 0, error: null, result: null,
    }));
    setQueue((q) => [...q, ...items]);
    items.forEach(uploadOne);
    if (rejected > 0) {
      // eslint-disable-next-line no-console
      console.warn(`${rejected} file(s) skipped — unsupported format`);
    }
  }, [uploadOne]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  const doneCount = queue.filter((e) => e.status === 'done').length;
  const hasActivity = queue.some((e) => e.status === 'uploading' || e.status === 'queued');

  return (
    <div className="upload-page">
      <h1 className="upload-heading">Add to your library</h1>
      <p className="upload-sub">Drop in EPUB, PDF, CBZ, or CBR files. Covers and details are picked up from the files automatically.</p>

      <div
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          onChange={(e) => addFiles(e.target.files)}
          className="visually-hidden"
        />
        <UploadIcon />
        <p className="dropzone-text"><strong>Drop files here</strong> or click to browse</p>
        <p className="dropzone-formats">EPUB · PDF · CBZ · CBR</p>
      </div>

      {queue.length > 0 && (
        <div className="upload-queue">
          <div className="upload-queue-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>{doneCount} of {queue.length} files imported</span>
            {!hasActivity && doneCount > 0 && (
              <button 
                className="btn-primary" 
                onClick={() => navigate('/library')} 
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Go to library
              </button>
            )}
          </div>
          {queue.map((entry) => (
            <div key={entry.id} className={`queue-row queue-${entry.status}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '8px' }}>
              <span className="queue-filename" style={{ fontSize: '13.5px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.file.name}</span>
              
              {entry.status === 'uploading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div className="queue-progress" style={{ width: '100px', height: '5px', background: 'var(--ink-700)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${entry.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s ease' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', minWidth: '36px', textAlign: 'right', fontWeight: '600' }}>
                    {entry.progress}%
                  </span>
                </div>
              )}
              
              {entry.status === 'done' && (
                <span className="queue-status queue-status-done" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--tag)', fontWeight: '600' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Added{entry.result?.title ? ` — ${entry.result.title}` : ''}
                </span>
              )}
              
              {entry.status === 'error' && (
                <span className="queue-status queue-status-error" style={{ fontSize: '12.5px', color: 'var(--danger)', fontWeight: '600' }}>
                  {entry.error}
                </span>
              )}
              
              {entry.status === 'queued' && (
                <span className="queue-status" style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
                  Waiting…
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4M12 4 7 9M12 4l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
