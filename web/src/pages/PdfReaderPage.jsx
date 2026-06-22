import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../api';
import TtsPlayer from '../components/TtsPlayer';
import CustomSelect from '../components/CustomSelect';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const [item, setItem] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [current, setCurrent] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1.3);
  const [fitMode, setFitMode] = useState('width'); // width | custom
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('toc'); // toc | bookmarks
  const [toc, setToc] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [filter, setFilter] = useState('original'); // original | dark | sepia
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [activePageText, setActivePageText] = useState('');
  const [showTtsPlayer, setShowTtsPlayer] = useState(false);
  
  const saveTimer = useRef(null);
  const renderTaskRef = useRef(null);
  const renderingPageRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(0);

  // Drawing state
  const drawingCanvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState('pencil'); // pencil | eraser
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef(null);

  // Focus Timer state
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false); // default to false
  const [timerMinimized, setTimerMinimized] = useState(false);
  const [timerMode, setTimerMode] = useState('countdown'); // countdown | countup
  const [sessionMinutesLogged, setSessionMinutesLogged] = useState(0);
  const activeSecondsAccumulator = useRef(0);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeout = useRef(null);

  const showToastMessage = (msg) => {
    clearTimeout(toastTimeout.current);
    setToastMessage(msg);
    toastTimeout.current = setTimeout(() => setToastMessage(''), 3000);
  };

  // Draggable Focus Timer logic
  const [timerPosition, setTimerPosition] = useState(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = (e) => {
    if (e.target.closest('select') || e.target.closest('input') || e.target.closest('button')) {
      return;
    }
    e.preventDefault();
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const isMobile = window.innerWidth < 600;
    const defaultY = chrome ? (isMobile ? 140 : 80) : (isMobile ? 10 : 20);
    const defaultX = isMobile ? 10 : 20;
    const currentX = timerPosition ? timerPosition.x : defaultX;
    const currentY = timerPosition ? timerPosition.y : defaultY;
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { x: currentX, y: currentY };
    isDraggingRef.current = true;
    const handleDragMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      const curX = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const dx = curX - dragStartRef.current.x;
      const dy = curY - dragStartRef.current.y;
      const newX = Math.max(10, Math.min(window.innerWidth - (timerMinimized ? 120 : 230), positionStartRef.current.x + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - (timerMinimized ? 60 : 180), positionStartRef.current.y - dy));
      setTimerPosition({ x: newX, y: newY });
    };
    const handleDragEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  };

  useEffect(() => {
    api.getItem(id).then((d) => setItem(d.item)).catch((e) => setError(e.message));
  }, [id]);

  async function resolveDest(dest, pdf) {
    if (!dest) return null;
    let explicitDest = dest;
    if (typeof dest === 'string') {
      try {
        explicitDest = await pdf.getDestination(dest);
      } catch (e) {
        return null;
      }
    }
    if (Array.isArray(explicitDest)) {
      const pageRef = explicitDest[0];
      if (typeof pageRef === 'object' && pageRef !== null) {
        try {
          const pageIdx = await pdf.getPageIndex(pageRef);
          return pageIdx + 1;
        } catch (e) {
          console.error('Failed to get page index from ref:', e);
        }
      } else if (typeof pageRef === 'number') {
        return pageRef + 1;
      }
    }
    return null;
  }

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    pdfjsLib.getDocument({ url: api.fileUrl(id) }).promise.then(async (pdf) => {
      if (cancelled) return;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      const startPage = item.my_location ? parseInt(item.my_location, 10) : 1;
      setCurrent(Math.min(Math.max(1, startPage), pdf.numPages));
      setLoading(false);

      // Parse outline/TOC
      try {
        const outline = await pdf.getOutline();
        if (outline) {
          const resolvedToc = [];
          const traverse = async (items, depth = 0) => {
            for (const item of items) {
              let pageNum = null;
              if (item.dest) {
                pageNum = await resolveDest(item.dest, pdf);
              }
              const indent = '  '.repeat(depth);
              resolvedToc.push({
                title: `${indent}${item.title || ''}`,
                page: pageNum
              });
              if (item.items && item.items.length > 0) {
                await traverse(item.items, depth + 1);
              }
            }
          };
          await traverse(outline);
          setToc(resolvedToc);
        }
      } catch (err) {
        console.error('Failed to parse outline:', err);
      }
    }).catch((e) => { setError(e.message); setLoading(false); });
    return () => { cancelled = true; };
  }, [item, id]);

  useEffect(() => {
    api.getHighlights(id).then(res => {
      if (res.highlights) {
        const bms = res.highlights.filter(h => h.note === 'Bookmark' || h.text.startsWith('Page '));
        setBookmarks(bms);
      }
    }).catch(console.error);
  }, [id]);

  const renderPage = useCallback(async (pageNum) => {
    try {
      const pdf = pdfDocRef.current;
      if (!pdf || !canvasRef.current) return;

      // Track the current page render request
      renderingPageRef.current = pageNum;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          console.warn('Failed to cancel previous render task:', e);
        }
        renderTaskRef.current = null;
      }

      const page = await pdf.getPage(pageNum);

      // If a newer render request has arrived while we were loading this page, stop.
      if (renderingPageRef.current !== pageNum) return;

      let currentScale = scale;
      if (fitMode === 'width') {
        const unscaledViewport = page.getViewport({ scale: 1, rotation });
        const isMobile = window.innerWidth <= 600;
        const sidebarOffset = (showSidebar && !isMobile) ? 320 : 0;
        const padding = isMobile ? 32 : 64;
        const containerWidth = Math.max(100, window.innerWidth - sidebarOffset - padding);
        currentScale = containerWidth / unscaledViewport.width;
      }

      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: currentScale, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);

      setCanvasSize({ width: viewport.width, height: viewport.height });

      // Check again after sizing the canvas
      if (renderingPageRef.current !== pageNum) return;

      const renderContext = {
        canvasContext: ctx,
        transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
        viewport: viewport
      };
      const task = page.render(renderContext);
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch (e) {
        if (e.name !== 'RenderingCancelledException') {
          throw e;
        }
      } finally {
        if (renderTaskRef.current === task) {
          renderTaskRef.current = null;
        }
      }

      // Extract text content of active page for TTS
      if (renderingPageRef.current === pageNum) {
        try {
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          setActivePageText(pageText || '');
        } catch (err) {
          console.error('Failed to extract text content:', err);
        }
      }
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }, [scale, fitMode, rotation, showSidebar]);

  useEffect(() => {
    if (pdfDocRef.current) renderPage(current);
  }, [current, renderPage]);

  useEffect(() => {
    if (fitMode !== 'width') return;
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (pdfDocRef.current) renderPage(current);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [fitMode, current, renderPage]);

  const saveProgress = useCallback((page) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pct = numPages > 0 ? Math.round((page / numPages) * 100) : 0;
      api.setProgress(id, { location: String(page), percent: pct }).catch(() => {});
    }, 600);
  }, [id, numPages]);

  const goTo = useCallback((page) => {
    if (isNaN(page) || page < 1 || page > numPages) return;
    setCurrent(page);
    saveProgress(page);
  }, [numPages, saveProgress]);

  // Focus Timer effect
  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        activeSecondsAccumulator.current += 1;
        if (activeSecondsAccumulator.current >= 60) {
          activeSecondsAccumulator.current = 0;
          api.logReadingTime(id, 1).catch(console.error);
          setSessionMinutesLogged(m => m + 1);
          showToastMessage("Logged 1 minute of active reading!");
        }

        if (timerMode === 'countdown') {
          setTimerSeconds((prev) => {
            if (prev <= 1) {
              setTimerActive(false);
              showToastMessage("Focus session completed! Take a break.");
              return 0;
            }
            return prev - 1;
          });
        } else {
          setTimerSeconds((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerMode, id]);

  // Loading annotations
  useEffect(() => {
    setStrokes([]); // Clear immediately when page changes
    api.getAnnotations(id, current)
      .then(res => {
        setStrokes(res.strokes || []);
      })
      .catch(console.error);
  }, [id, current]);

  // Canvas drawing logic
  const redrawCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.type === 'eraser' ? 'rgba(0,0,0,1)' : (stroke.color || 'var(--accent)');
      ctx.lineWidth = stroke.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = stroke.type === 'eraser' ? 'destination-out' : 'source-over';

      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      }
      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'source-over';
  }, [strokes]);

  useEffect(() => {
    redrawCanvas();
  }, [strokes, canvasSize, redrawCanvas]);

  const getCoordinates = (e) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x, y };
  };

  const startDrawing = (e) => {
    if (!drawMode) return;
    e.stopPropagation();
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    currentStroke.current = {
      type: drawTool,
      color: drawTool === 'pencil' ? 'var(--accent)' : 'rgba(0,0,0,1)',
      width: drawTool === 'pencil' ? 3 : 15,
      points: [coords]
    };
  };

  const draw = (e) => {
    if (!isDrawing || !drawMode) return;
    e.stopPropagation();
    const coords = getCoordinates(e);
    if (!coords) return;

    currentStroke.current.points.push(coords);

    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.strokeStyle = currentStroke.current.type === 'eraser' ? 'rgba(0,0,0,1)' : currentStroke.current.color;
    ctx.lineWidth = currentStroke.current.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = currentStroke.current.type === 'eraser' ? 'destination-out' : 'source-over';

    const pts = currentStroke.current.points;
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];
    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const endDrawing = (e) => {
    if (!isDrawing || !drawMode) return;
    e.stopPropagation();
    setIsDrawing(false);

    if (currentStroke.current && currentStroke.current.points.length > 1) {
      const newStrokes = [...strokes, currentStroke.current];
      setStrokes(newStrokes);
      api.saveAnnotations(id, current, newStrokes).catch(console.error);
    }
    currentStroke.current = null;
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    api.saveAnnotations(id, current, newStrokes).catch(console.error);
  };

  const handleClear = () => {
    if (!confirm('Are you sure you want to clear all drawings on this page?')) return;
    setStrokes([]);
    api.saveAnnotations(id, current, []).catch(console.error);
  };

  const handleTouchStart = (e) => {
    if (drawMode) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e) => {
    if (drawMode || touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;
    const elapsed = Date.now() - touchStartTime.current;

    if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10 && elapsed < 250) {
      setChrome(c => !c);
    } else if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        goTo(current + 1);
      } else {
        goTo(current - 1);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  useEffect(() => {
    function handler(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') goTo(current + 1);
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === '=' || e.key === '+') { setFitMode('custom'); setScale(s => Math.min(2.6, s + 0.2)); }
      if (e.key === '-' || e.key === '_') { setFitMode('custom'); setScale(s => Math.max(0.6, s - 0.2)); }
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate(`/item/${id}`);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, goTo, id, navigate]);

  async function markFinished() {
    await api.setProgress(id, { percent: 100, status: 'finished' });
    navigate(`/item/${id}`);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch (e) { console.error(e); }
  }

  const isBookmarked = bookmarks.some(b => parseInt(b.location_cfi, 10) === current);

  const openBookmarkModal = () => {
    const existing = bookmarks.find(b => parseInt(b.location_cfi, 10) === current);
    setBookmarkNote(existing && existing.note !== 'Bookmark' ? existing.note : '');
    setShowBookmarkModal(true);
  };

  async function saveBookmarkWithNote() {
    const existing = bookmarks.find(b => parseInt(b.location_cfi, 10) === current);
    try {
      if (existing) {
        const res = await api.updateHighlight(existing.id, { note: bookmarkNote || 'Bookmark' });
        setBookmarks(prev => prev.map(b => b.id === existing.id ? res.highlight : b));
      } else {
        const res = await api.createHighlight({
          item_id: id,
          location_cfi: String(current),
          text: `Page ${current}`,
          note: bookmarkNote || 'Bookmark'
        });
        if (res && res.highlight) {
          setBookmarks(prev => [...prev, res.highlight].sort((a, b) => parseInt(a.location_cfi, 10) - parseInt(b.location_cfi, 10)));
        }
      }
      setShowBookmarkModal(false);
    } catch (e) {
      console.error('Failed to save bookmark note:', e);
    }
  }

  async function deleteBookmark(bmId) {
    try {
      await api.deleteHighlight(bmId);
      setBookmarks(prev => prev.filter(b => b.id !== bmId));
    } catch (e) {
      console.error(e);
    }
  }

  const handleEditBookmarkNote = (bm) => {
    goTo(parseInt(bm.location_cfi, 10));
    setBookmarkNote(bm.note && bm.note !== 'Bookmark' ? bm.note : '');
    setShowSidebar(false);
    setShowBookmarkModal(true);
  };

  if (error) {
    return (
      <div className="reader-error">
        <p>Couldn't open this PDF: {error}</p>
        <button className="btn-ghost" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  if (loading) return <div className="reader-loading reader-loading-full">Opening PDF…</div>;

  const isLast = current === numPages;
  const percent = numPages ? Math.round((current / numPages) * 100) : 0;

  const filterStyle = filter === 'dark' 
    ? 'invert(0.9) hue-rotate(180deg)' 
    : filter === 'sepia' 
      ? 'sepia(0.6) contrast(0.95)' 
      : 'none';

  return (
    <div className={`comic-reader ${chrome ? 'chrome-active' : ''}`}>
      {chrome && (
        <header className="reader-topbar" style={{ display: 'flex', alignItems: 'center', height: '64px', padding: '0 24px' }}>
          <button 
            className="reader-icon-btn" 
            onClick={() => navigate(`/item/${id}`, { state: { from: location.state?.from } })} 
            aria-label="Close reader"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease, background 0.2s ease',
              marginRight: '12px'
            }}
          >
            <CloseIcon />
          </button>
          <span className="reader-title" style={{ fontSize: '15px', fontWeight: '600' }}>{item?.title}</span>
          
          <div className="reader-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Draw mode controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '12px', marginRight: '8px' }}>
              <button 
                className={`reader-icon-btn ${drawMode ? 'active' : ''}`} 
                onClick={() => {
                  setDrawMode(!drawMode);
                  setChrome(true);
                }} 
                title="Toggle Drawing Canvas"
                style={{
                  padding: '6px 10px',
                  background: drawMode ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-md)',
                  color: drawMode ? '#fff' : 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>Draw</span>
              </button>

              {drawMode && (
                <>
                  <button 
                    className="reader-icon-btn" 
                    onClick={() => setDrawTool(drawTool === 'pencil' ? 'eraser' : 'pencil')} 
                    title={drawTool === 'pencil' ? 'Switch to Eraser' : 'Switch to Pencil'}
                    style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', color: drawTool === 'eraser' ? 'var(--accent)' : 'inherit', display: 'flex', alignItems: 'center' }}
                  >
                    {drawTool === 'pencil' ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 20H4M20 20v-4M20 16l-8-8-4 4 8 8z" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    )}
                  </button>
                  <button 
                    className="reader-icon-btn" 
                    onClick={handleUndo} 
                    title="Undo"
                    disabled={strokes.length === 0}
                    style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', opacity: strokes.length === 0 ? 0.4 : 1 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                  </button>
                  <button 
                    className="reader-icon-btn" 
                    onClick={handleClear} 
                    title="Clear All"
                    style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Filter controls */}
            <div className="theme-swatches" style={{ display: 'inline-flex', marginRight: '12px', gap: '8px', alignItems: 'center' }}>
              <button 
                className={`theme-swatch theme-swatch-paper ${filter === 'original' ? 'active' : ''}`} 
                onClick={() => setFilter('original')} 
                title="Original View"
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%',
                  border: filter === 'original' ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  padding: 0,
                  background: '#f6f1e7',
                  boxShadow: filter === 'original' ? '0 0 8px var(--accent)' : 'none',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              />
              <button 
                className={`theme-swatch theme-swatch-sepia ${filter === 'sepia' ? 'active' : ''}`} 
                onClick={() => setFilter('sepia')} 
                title="Warm Sepia View"
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%',
                  border: filter === 'sepia' ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  padding: 0,
                  background: '#ecdfc3',
                  boxShadow: filter === 'sepia' ? '0 0 8px var(--accent)' : 'none',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              />
              <button 
                className={`theme-swatch theme-swatch-night ${filter === 'dark' ? 'active' : ''}`} 
                onClick={() => setFilter('dark')} 
                title="Dark Mode (Inverted)"
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%',
                  border: filter === 'dark' ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  padding: 0,
                  background: '#11151c',
                  boxShadow: filter === 'dark' ? '0 0 8px var(--accent)' : 'none',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              />
            </div>

            {/* Text to Speech Button */}
            <button 
              className={`reader-icon-btn ${showTtsPlayer ? 'active' : ''}`} 
              onClick={() => setShowTtsPlayer(!showTtsPlayer)} 
              title="Text to Speech"
              style={{ marginRight: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', color: showTtsPlayer ? 'var(--accent)' : 'inherit' }}
            >
              {showTtsPlayer ? <SpeakerActiveIcon /> : <SpeakerMuteIcon />}
            </button>

            {/* Rotation control */}
            <button 
              className="reader-icon-btn reader-rotate-btn" 
              onClick={() => setRotation(r => (r + 90) % 360)} 
              title="Rotate Page"
              style={{ marginRight: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)' }}
            >
              <RotateIcon />
            </button>

            {/* Bookmark button */}
            <button 
              className="reader-icon-btn"
              onClick={openBookmarkModal}
              title={isBookmarked ? "Edit Bookmark Note" : "Add Bookmark"}
              style={{ marginRight: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', color: isBookmarked ? 'var(--accent)' : 'inherit' }}
            >
              {isBookmarked ? <BookmarkFilledIcon /> : <BookmarkOutlineIcon />}
            </button>

            {/* Sidebar toggle */}
            <button 
              className="reader-icon-btn" 
              onClick={() => setShowSidebar(s => !s)} 
              title="Outline & Bookmarks"
              style={{ marginRight: '12px', padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', color: showSidebar ? 'var(--accent)' : 'inherit' }}
            >
              <TocIcon />
            </button>

            {/* Fit mode selector */}
            <button 
              className={`reader-icon-btn reader-fit-btn ${fitMode === 'width' ? 'active-fit' : ''}`} 
              onClick={() => setFitMode(m => m === 'width' ? 'custom' : 'width')}
              style={{ 
                marginRight: '8px', 
                fontSize: '11px', 
                fontWeight: '600',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                background: fitMode === 'width' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: fitMode === 'width' ? 'var(--accent-contrast)' : 'var(--text-primary)',
                transition: 'all 0.2s ease',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FitWidthIcon />
              <span>Fit Width</span>
            </button>

            {/* Zoom control segment */}
            <div className="reader-zoom-controls" style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              marginRight: '4px',
              height: '32px'
            }}>
              <button 
                className="reader-icon-btn" 
                onClick={() => { setFitMode('custom'); setScale((s) => Math.max(0.6, s - 0.2)); }} 
                aria-label="Zoom out"
                style={{ padding: '4px 6px', borderRadius: 'calc(var(--radius-md) - 2px)' }}
              >
                <MinusIcon />
              </button>
              <span className="zoom-value" style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9, minWidth: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                {Math.round(scale * 100)}%
              </span>
              <button 
                className="reader-icon-btn" 
                onClick={() => { setFitMode('custom'); setScale((s) => Math.min(2.6, s + 0.2)); }} 
                aria-label="Zoom in"
                style={{ padding: '4px 6px', borderRadius: 'calc(var(--radius-md) - 2px)' }}
              >
                <PlusIcon />
              </button>
            </div>

            {/* Fullscreen button */}
            <button 
              className="reader-icon-btn reader-fullscreen-btn" 
              onClick={toggleFullscreen} 
              aria-label="Toggle Fullscreen"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s ease, background 0.2s ease'
              }}
            >
              {fullscreen ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
          </div>
        </header>
      )}

      {showSidebar && (
        <nav className="reader-toc" style={{ background: 'rgba(17, 21, 28, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-lg)' }}>
          <div className="sidebar-tabs" style={{ 
            display: 'flex', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: 'var(--radius-md)', 
            padding: '2px',
            marginBottom: '16px' 
          }}>
            <button 
              className={`sidebar-tab ${sidebarTab === 'toc' ? 'active' : ''}`}
              onClick={() => setSidebarTab('toc')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: sidebarTab === 'toc' ? 'var(--bg-card)' : 'transparent',
                border: 'none',
                color: sidebarTab === 'toc' ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: '600',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: sidebarTab === 'toc' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Outline
            </button>
            <button 
              className={`sidebar-tab ${sidebarTab === 'bookmarks' ? 'active' : ''}`}
              onClick={() => setSidebarTab('bookmarks')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: sidebarTab === 'bookmarks' ? 'var(--bg-card)' : 'transparent',
                border: 'none',
                color: sidebarTab === 'bookmarks' ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: '600',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: sidebarTab === 'bookmarks' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Bookmarks ({bookmarks.length})
            </button>
          </div>
          
          {sidebarTab === 'toc' ? (
            <div className="reader-sidebar-toc" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
              {toc.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px' }}>No outline found in this document.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {toc.map((chapter, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>
                      {chapter.page ? (
                        <button 
                          onClick={() => {
                            goTo(chapter.page);
                            setShowSidebar(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            color: current === chapter.page ? 'var(--accent)' : 'var(--text-primary)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            whiteSpace: 'pre-wrap',
                            fontSize: '13px',
                            fontWeight: current === chapter.page ? '600' : '400',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {chapter.title}
                        </button>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            color: 'var(--text-secondary)',
                            padding: '8px 10px',
                            whiteSpace: 'pre-wrap',
                            fontSize: '13px',
                            fontWeight: '600',
                            opacity: 0.8
                          }}
                        >
                          {chapter.title}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="reader-sidebar-highlights" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
              {bookmarks.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px' }}>No bookmarks made yet. Click the star icon in the top bar!</p>
              ) : (
                bookmarks.map((bm) => (
                  <div 
                    key={bm.id} 
                    className="reader-hl-item" 
                    style={{ 
                      padding: '10px 12px', 
                      borderBottom: '1px solid var(--border)', 
                      borderLeft: '3px solid var(--accent)',
                      marginBottom: '8px',
                      background: 'rgba(255,255,255,0.02)'
                    }}
                  >
                    <p 
                      style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                      onClick={() => {
                        goTo(parseInt(bm.location_cfi, 10));
                        setShowSidebar(false);
                      }}
                      title="Click to jump to page"
                    >
                      {bm.text}
                    </p>
                    {bm.note && bm.note !== 'Bookmark' && (
                      <p style={{ margin: '4px 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                        {bm.note}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      <span>{new Date(bm.created_at).toLocaleDateString()}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleEditBookmarkNote(bm)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '2px 4px'
                          }}
                        >
                          Edit Note
                        </button>
                        <button 
                          onClick={() => deleteBookmark(bm.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '2px 4px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </nav>
      )}

      <div 
        className={`comic-viewer-area pdf-viewer-area ${chrome ? 'with-chrome' : ''}`} 
        onClick={() => {
          if (!drawMode) setChrome((c) => !c);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ position: 'relative' }}
      >
        <button className="comic-nav-zone comic-nav-left" onClick={(e) => { e.stopPropagation(); goTo(current - 1); }} aria-label="Previous page" disabled={current === 1} />
        
        <div className="pdf-canvas-container" style={{ position: 'relative', display: 'inline-block', margin: 'auto' }}>
          <canvas 
            ref={canvasRef} 
            className="pdf-canvas" 
            style={{ 
              filter: filterStyle,
              transition: 'filter 0.25s ease',
              display: 'block',
              cursor: drawMode ? 'crosshair' : 'pointer'
            }} 
            onClick={(e) => {
              if (drawMode) {
                e.stopPropagation();
              } else {
                setChrome((c) => !c);
              }
            }} 
          />
          <canvas
            ref={drawingCanvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={endDrawing}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              touchAction: 'none',
              cursor: drawMode ? 'crosshair' : 'default',
              pointerEvents: drawMode ? 'auto' : 'none',
              zIndex: 5
            }}
          />
        </div>
        
        <button className="comic-nav-zone comic-nav-right" onClick={(e) => { e.stopPropagation(); goTo(current + 1); }} aria-label="Next page" disabled={isLast} />
      </div>

      {chrome && (
        <footer className="reader-bottombar" style={{ height: '64px', padding: '14px 24px' }}>
          <div className="reader-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="comic-page-counter" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Page</span>
              <input 
                type="number" 
                className="page-jump-input" 
                value={current} 
                onChange={(e) => goTo(parseInt(e.target.value, 10))}
                min={1} max={Math.max(1, numPages)}
                style={{ 
                  width: '48px', 
                  background: 'rgba(255,255,255,0.06)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-sm)', 
                  color: '#fff', 
                  padding: '4px 6px', 
                  textAlign: 'center',
                  fontWeight: '600',
                  fontFamily: 'var(--font-mono)'
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span style={{ color: 'var(--text-tertiary)' }}>of {numPages}</span>
            </div>
            {isLast ? (
              <button className="btn-ghost btn-small" onClick={markFinished} style={{ padding: '4px 10px', fontSize: '11px' }}>Mark as finished</button>
            ) : null}
          </div>
          <div className="reader-progress-container" style={{ display: 'flex', alignItems: 'center', flex: 1, width: '100%', gap: '12px' }}>
            <input
              type="range"
              className="comic-scrubber"
              min={1}
              max={Math.max(1, numPages)}
              value={current}
              onChange={(e) => goTo(parseInt(e.target.value, 10))}
              onClick={(e) => e.stopPropagation()}
              aria-label="Jump to page"
              style={{ margin: 0, flex: 1 }}
            />
            <span className="reader-progress-label" style={{ marginTop: '0', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: '600', fontFamily: 'var(--font-mono)', minWidth: '40px', justifyContent: 'flex-end' }}>
              {percent}%
            </span>
          </div>
        </footer>
      )}

      {showBookmarkModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }} onClick={() => setShowBookmarkModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '90%',
            maxWidth: '360px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            color: 'var(--text-primary)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-display)', fontSize: '18px' }}>
              {isBookmarked ? 'Edit Bookmark' : 'Add Bookmark'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Add a note for Page {current}:
            </p>
            <textarea
              value={bookmarkNote}
              onChange={(e) => setBookmarkNote(e.target.value)}
              placeholder="e.g. Gregor's transformation..."
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: '13px',
                resize: 'none',
                outline: 'none',
                marginBottom: '20px'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {isBookmarked && (
                <button
                  className="btn-danger"
                  onClick={() => {
                    const existing = bookmarks.find(b => parseInt(b.location_cfi, 10) === current);
                    if (existing) deleteBookmark(existing.id);
                    setShowBookmarkModal(false);
                  }}
                  style={{ marginRight: 'auto', padding: '6px 12px', fontSize: '12px' }}
                >
                  Delete
                </button>
              )}
              <button
                className="btn-ghost"
                onClick={() => setShowBookmarkModal(false)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveBookmarkWithNote}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showTtsPlayer && (
        <TtsPlayer
          text={activePageText}
          onNextPage={() => goTo(current + 1)}
          onPrevPage={() => goTo(current - 1)}
          onClose={() => setShowTtsPlayer(false)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--accent)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          {toastMessage}
        </div>
      )}
      {/* Floating Focus Timer Widget */}
      <div className="focus-timer-widget" style={{
        position: 'fixed',
        bottom: timerPosition ? `${timerPosition.y}px` : undefined,
        left: timerPosition ? `${timerPosition.x}px` : undefined,
        background: 'rgba(17, 21, 28, 0.95)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-md)',
        padding: timerMinimized ? '8px 12px' : '12px 16px',
        zIndex: 99,
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(12px)',
        color: 'var(--text-primary)',
        width: timerMinimized ? 'fit-content' : '220px',
        transition: 'all 0.15s ease-out, bottom 0.2s ease, left 0.2s ease',
        display: 'flex',
        flexDirection: timerMinimized ? 'row' : 'column',
        alignItems: timerMinimized ? 'center' : 'stretch',
        gap: timerMinimized ? '10px' : '8px',
        cursor: 'grab',
        userSelect: 'none'
      }} 
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      onClick={(e) => e.stopPropagation()}>
        {timerMinimized ? (
          <>
            <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:{(timerSeconds % 60).toString().padStart(2, '0')}
            </span>
            <button 
              onClick={() => setTimerActive(!timerActive)}
              style={{
                background: 'transparent',
                border: 'none',
                color: timerActive ? 'var(--text-secondary)' : 'var(--accent)',
                padding: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title={timerActive ? 'Pause' : 'Start'}
            >
              {timerActive ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <button 
              onClick={() => setTimerMinimized(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                padding: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Expand timer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          </>
        ) : (
          <>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>Focus Timer</span>
              </div>
              <button 
                onClick={() => setTimerMinimized(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                title="Minimize timer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>
              </button>
            </div>

            {/* Mode selector — full width */}
            <CustomSelect
              value={timerMode === 'countup' ? 'stopwatch' : (showCustomInput ? 'custom' : String(customMinutes))}
              onChange={(val) => {
                if (val === 'custom') {
                  setTimerMode('countdown');
                  setShowCustomInput(true);
                  setTimerActive(false);
                } else if (val === 'stopwatch') {
                  setTimerMode('countup');
                  setTimerSeconds(0);
                  setTimerActive(false);
                  setShowCustomInput(false);
                } else {
                  setTimerMode('countdown');
                  const mins = parseInt(val, 10);
                  setCustomMinutes(mins);
                  setTimerSeconds(mins * 60);
                  setTimerActive(false);
                  setShowCustomInput(false);
                }
                activeSecondsAccumulator.current = 0;
              }}
              options={[
                { value: '15', label: '15m Focus' },
                { value: '25', label: '25m Pomodoro' },
                { value: '45', label: '45m Deep Study' },
                ...(!['15', '25', '45'].includes(String(customMinutes)) ? [{ value: String(customMinutes), label: `${customMinutes}m Custom` }] : []),
                { value: 'custom', label: 'Custom...' },
                { value: 'stopwatch', label: 'Stopwatch' }
              ]}
              className="timer-select"
            />
            
            {showCustomInput && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Minutes:</span>
                <input 
                  type="number" 
                  min="1" 
                  max="180" 
                  value={customMinutes} 
                  onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1)))}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    padding: '3px 6px',
                    fontSize: '12px',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setTimerSeconds(customMinutes * 60);
                    setTimerActive(false);
                    setShowCustomInput(false);
                  }}
                  style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '4px' }}
                >
                  Set
                </button>
              </div>
            )}
            
            {/* Timer display */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '4px 0 2px' }}>
              <span style={{ fontSize: '30px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:{(timerSeconds % 60).toString().padStart(2, '0')}
              </span>
              {sessionMinutesLogged > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {sessionMinutesLogged}m logged
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => setTimerActive(!timerActive)}
                style={{ 
                  flex: 1, 
                  padding: '7px 12px', 
                  fontSize: '12px', 
                  fontWeight: 700,
                  background: timerActive ? 'rgba(255,255,255,0.08)' : 'var(--accent)', 
                  color: timerActive ? 'var(--text-primary)' : '#fff',
                  border: timerActive ? '1px solid rgba(255,255,255,0.12)' : 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  boxShadow: timerActive ? 'none' : '0 2px 10px rgba(201, 138, 62, 0.25)'
                }}
              >
                {timerActive ? (
                  <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg> Pause</>
                ) : (
                  <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start</>
                )}
              </button>
              <button 
                onClick={() => {
                  setTimerActive(false);
                  setTimerSeconds(timerMode === 'countdown' ? (customMinutes * 60) : 0);
                  activeSecondsAccumulator.current = 0;
                }}
                style={{ 
                  padding: '7px 12px', 
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;
}
function TocIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>;
}
function ExpandIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>;
}
function ShrinkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>;
}
function MinusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function RotateIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>;
}
function BookmarkOutlineIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
}
function BookmarkFilledIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
}
function SpeakerMuteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M23 9l-6 6M17 9l6 6"/></svg>;
}
function SpeakerActiveIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
}
function FitWidthIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/></svg>;
}
