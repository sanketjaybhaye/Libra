import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ePub from 'epubjs';
import { api } from '../api';
import TtsPlayer from '../components/TtsPlayer';
import CustomSelect from '../components/CustomSelect';

const FONT_SIZES = [85, 100, 115, 130, 150];
const THEMES = {
  paper: { bg: '#f6f1e7', text: '#1c1812' },
  night: { bg: '#11151c', text: '#e8e3d6' },
  sepia: { bg: '#ecdfc3', text: '#2b2415' },
  emerald: { bg: '#061f17', text: '#ecfdf5' },
  midnight: { bg: '#000000', text: '#f5f5f5' },
};

const getColorClass = (color) => {
  if (!color) return 'hl-default';
  if (color === '#ffd166') return 'hl-yellow';
  if (color === '#06d6a0') return 'hl-green';
  if (color === '#118ab2') return 'hl-blue';
  if (color === '#ef476f') return 'hl-pink';
  return 'hl-default';
};

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

export default function EpubReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('toc'); // 'toc' | 'highlights'
  const [toc, setToc] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const [theme, setTheme] = useState('paper');
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [activePageText, setActivePageText] = useState('');
  const [showTtsPlayer, setShowTtsPlayer] = useState(false);
  const saveTimer = useRef(null);
  const touchStartX = useRef(null);

  const [selectionMenu, setSelectionMenu] = useState(null);

  const highlightsRef = useRef([]);
  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.resize();
      const timer = setTimeout(() => {
        renditionRef.current?.resize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [chrome, showSidebar]);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [noteText, setNoteText] = useState('');

  const handleDismissSelection = useCallback(() => {
    if (selectionMenu && selectionMenu.contents) {
      try {
        const win = selectionMenu.contents.window;
        const doc = selectionMenu.contents.document;
        win.getSelection()?.removeAllRanges();
        doc?.getSelection()?.removeAllRanges();
      } catch (err) {
        console.error(err);
      }
    }
    try {
      window.getSelection()?.removeAllRanges();
      document.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error(err);
    }
    setSelectionMenu(null);
  }, [selectionMenu]);

  const handleCopySelection = useCallback(() => {
    if (selectionMenu) {
      navigator.clipboard.writeText(selectionMenu.text).then(() => {
        showToastMessage("Copied to clipboard!");
      }).catch(console.error);
      handleDismissSelection();
    }
  }, [selectionMenu, handleDismissSelection]);

  const handleCreateHighlight = useCallback((colorValue) => {
    if (!selectionMenu) return;
    const { cfiRange, text } = selectionMenu;
    
    renditionRef.current?.annotations.highlight(cfiRange, {}, (e) => {
      const found = highlightsRef.current.find(h => h.location_cfi === cfiRange);
      if (found) {
        setEditingHighlight(found);
        setNoteText(found.note || '');
        setShowNoteModal(true);
      }
    }, getColorClass(colorValue), { fill: colorValue, 'fill-opacity': '0.55', 'mix-blend-mode': 'multiply' });

    api.createHighlight({ item_id: id, location_cfi: cfiRange, text, color: colorValue })
      .then(res => {
        if (res && res.highlight) {
          setHighlights(prev => [...prev, res.highlight]);
          showToastMessage("Text highlighted!");
        }
      })
      .catch(console.error);

    handleDismissSelection();
  }, [selectionMenu, id, handleDismissSelection]);

  const handleCreateHighlightWithNote = useCallback(() => {
    if (!selectionMenu) return;
    const { cfiRange, text } = selectionMenu;
    const defaultColor = '#ffd166'; // default color is yellow

    renditionRef.current?.annotations.highlight(cfiRange, {}, (e) => {
      const found = highlightsRef.current.find(h => h.location_cfi === cfiRange);
      if (found) {
        setEditingHighlight(found);
        setNoteText(found.note || '');
        setShowNoteModal(true);
      }
    }, getColorClass(defaultColor), { fill: defaultColor, 'fill-opacity': '0.55', 'mix-blend-mode': 'multiply' });

    api.createHighlight({ item_id: id, location_cfi: cfiRange, text, color: defaultColor })
      .then(res => {
        if (res && res.highlight) {
          setHighlights(prev => [...prev, res.highlight]);
          setEditingHighlight(res.highlight);
          setNoteText('');
          setShowNoteModal(true);
        }
      })
      .catch(console.error);

    handleDismissSelection();
  }, [selectionMenu, id, handleDismissSelection]);

  // Focus Timer state
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false); // default to false
  const [timerMode, setTimerMode] = useState('countdown'); // countdown | countup
  const [sessionMinutesLogged, setSessionMinutesLogged] = useState(0);
  const activeSecondsAccumulator = useRef(0);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [timerMinimized, setTimerMinimized] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeout = useRef(null);
  const [currentHref, setCurrentHref] = useState('');

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
    return () => window.speechSynthesis.cancel();
  }, []);

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

  useEffect(() => {
    api.getItem(id).then((d) => setItem(d.item)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!item || !viewerRef.current) return;
    let cancelled = false;

    const book = ePub(api.fileUrl(id), { openAs: 'epub' });
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'auto',
    });
    renditionRef.current = rendition;

    applyTheme(rendition, theme, fontSizeIdx);

    const startLocation = item.my_location || undefined;
    rendition.display(startLocation).catch(() => rendition.display());

    book.ready.then(() => book.locations.generate(1200)).then(() => {
      if (cancelled) return;
      setLoading(false);
    }).catch(() => setLoading(false));

    book.loaded.navigation.then((nav) => {
      if (!cancelled) setToc(nav.toc || []);
    });

    rendition.on('relocated', (location) => {
      const pct = book.locations.length() ? Math.round(book.locations.percentageFromCfi(location.start.cfi) * 100) : 0;
      setProgress(pct);
      
      if (location && location.start) {
        setCurrentHref(location.start.href);
        if (location.start.cfi) {
          book.getRange(location.start.cfi).then(range => {
            setActivePageText(range.toString() || '');
          }).catch(err => console.error('Failed to extract text from page:', err));
        }
      }

      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api.setProgress(id, { location: location.start.cfi, percent: pct }).catch(() => {});
      }, 1500);
    });

    rendition.on('rendered', () => {
      attachEventHandlers(rendition);
    });

    rendition.on('touchstart', (e) => {
      touchStartX.current = e.changedTouches[0].screenX;
    });

    rendition.on('touchend', (e) => {
      if (touchStartX.current === null) return;
      
      // Check if there is an active text selection to prevent swipe page turn during selection dragging
      let hasSelection = false;
      try {
        rendition.getContents().forEach(content => {
          const sel = content.window.getSelection();
          if (sel && sel.toString().trim().length > 0) {
            hasSelection = true;
          }
        });
      } catch (err) {
        console.error('Error checking selection:', err);
      }

      if (hasSelection) {
        touchStartX.current = null;
        return;
      }

      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX.current - touchEndX;
      if (diff > 50) rendition.next();
      else if (diff < -50) rendition.prev();
      touchStartX.current = null;
    });

    rendition.on('selected', (cfiRange, contents) => {
      const selection = contents.window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const iframe = viewerRef.current.querySelector('iframe');
      if (!iframe) return;
      const iframeRect = iframe.getBoundingClientRect();

      const top = rect.top + iframeRect.top - 50; 
      const left = rect.left + iframeRect.left + (rect.width / 2) - 110; 
      
      const viewportWidth = window.innerWidth;
      const menuWidth = 220; 
      const finalLeft = Math.max(10, Math.min(viewportWidth - menuWidth - 10, left));
      let finalTop = top;
      if (finalTop < 10) {
        finalTop = rect.bottom + iframeRect.top + 10;
      }

      setSelectionMenu({
        top: finalTop,
        left: finalLeft,
        cfiRange,
        text: cleanHighlightText(range.toString()),
        contents
      });
    });

    // Fetch previously saved highlights and render them
    api.getHighlights(id).then(res => {
      if (res.highlights) {
        setHighlights(res.highlights);
        res.highlights.forEach(hl => {
          const colorValue = hl.color || '#ffd166';
          rendition.annotations.highlight(hl.location_cfi, {}, (e) => {
            const found = highlightsRef.current.find(h => h.location_cfi === hl.location_cfi);
            if (found) {
              setEditingHighlight(found);
              setNoteText(found.note || '');
              setShowNoteModal(true);
            }
          }, getColorClass(colorValue), { fill: colorValue, 'fill-opacity': '0.55', 'mix-blend-mode': 'multiply' });
        });
      }
    }).catch(console.error);

    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
      book.destroy();
    };
  }, [item, id]);

  function attachEventHandlers(rendition) {
    const contents = rendition.getContents();
    contents.forEach((content) => {
      content.document?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') rendition.next();
        if (e.key === 'ArrowLeft') rendition.prev();
      });
      content.document?.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        const selection = content.window.getSelection();
        if (selection && selection.toString().trim().length > 0) return;
        setSelectionMenu(null);
        setShowSidebar(false);
        setChrome((c) => !c);
      });
    });
  }

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (selectionMenu && !e.target.closest('.selection-menu-container')) {
        handleDismissSelection();
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('touchstart', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };
  }, [selectionMenu, handleDismissSelection]);

  useEffect(() => {
    function handler(e) {
      if (e.key === 'ArrowRight') renditionRef.current?.next();
      if (e.key === 'ArrowLeft') renditionRef.current?.prev();
      if (e.key === 'Escape') navigate(`/item/${id}`);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, navigate]);

  useEffect(() => {
    if (renditionRef.current) applyTheme(renditionRef.current, theme, fontSizeIdx);
  }, [theme, fontSizeIdx]);

  function applyTheme(rendition, themeName, sizeIdx) {
    const t = THEMES[themeName];
    rendition.themes.default({
      body: { 
        background: `${t.bg} !important`, 
        color: `${t.text} !important`,
        'font-family': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important',
        'padding': '0 20px !important'
      },
      'p, span, div, h1, h2, h3, h4, h5, h6, a, li': {
        color: `${t.text} !important`
      },
      p: { 
        'margin-top': '0 !important',
        'margin-bottom': '0.35em !important',
        'line-height': '1.55 !important',
        'word-break': 'break-word !important',
        '-webkit-hyphens': 'auto !important',
        'hyphens': 'auto !important',
        'text-align': 'left !important'
      },
      'p.calibre1, p.calibre2, p.calibre3, p.calibre4, p.calibre5, p.calibre': {
        'margin-top': '0 !important',
        'margin-bottom': '0 !important'
      },
      '::selection': {
        background: 'rgba(201, 138, 62, 0.3) !important'
      },
      '.epubjs-hl.hl-yellow': {
        'fill': '#ffd166 !important',
        'background-color': '#ffd166 !important',
        'fill-opacity': '0.55 !important',
        'opacity': '0.8 !important',
        'mix-blend-mode': 'multiply !important'
      },
      '.epubjs-hl.hl-green': {
        'fill': '#06d6a0 !important',
        'background-color': '#06d6a0 !important',
        'fill-opacity': '0.55 !important',
        'opacity': '0.8 !important',
        'mix-blend-mode': 'multiply !important'
      },
      '.epubjs-hl.hl-blue': {
        'fill': '#118ab2 !important',
        'background-color': '#118ab2 !important',
        'fill-opacity': '0.55 !important',
        'opacity': '0.8 !important',
        'mix-blend-mode': 'multiply !important'
      },
      '.epubjs-hl.hl-pink': {
        'fill': '#ef476f !important',
        'background-color': '#ef476f !important',
        'fill-opacity': '0.55 !important',
        'opacity': '0.8 !important',
        'mix-blend-mode': 'multiply !important'
      },
      '.epubjs-hl.hl-default': {
        'fill': '#ffd166 !important',
        'background-color': '#ffd166 !important',
        'fill-opacity': '0.55 !important',
        'opacity': '0.8 !important',
        'mix-blend-mode': 'multiply !important'
      }
    });
    rendition.themes.fontSize(`${FONT_SIZES[sizeIdx]}%`);
  }

  function goToChapter(href) {
    renditionRef.current?.display(href);
    setShowSidebar(false);
  }

  async function markFinished() {
    await api.setProgress(id, { percent: 100, status: 'finished' });
    navigate(`/item/${id}`);
  }

  const matchHref = (tocHref, currentHref) => {
    if (!tocHref || !currentHref) return false;
    const cleanToc = tocHref.split('#')[0];
    const cleanCurrent = currentHref.split('#')[0];
    return cleanToc === cleanCurrent || 
           cleanToc.endsWith(cleanCurrent) || 
           cleanCurrent.endsWith(cleanToc);
  };

  const renderTocItems = (items, depth = 0) => {
    return items.map((chapter) => {
      const isActive = matchHref(chapter.href, currentHref);
      return (
        <li key={chapter.id || chapter.href} style={{ marginBottom: '4px' }}>
          <button 
            onClick={() => goToChapter(chapter.href)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-primary)',
              padding: '6px 10px',
              paddingLeft: `${10 + depth * 12}px`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: isActive ? '600' : 'normal',
              transition: 'all 0.15s ease'
            }}
          >
            {chapter.label.trim()}
          </button>
          {chapter.subitems && chapter.subitems.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {renderTocItems(chapter.subitems, depth + 1)}
            </ul>
          )}
        </li>
      );
    });
  };

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

  async function handleDeleteHighlight(hlId, cfiRange) {
    if (!confirm('Are you sure you want to delete this highlight?')) return;
    try {
      await api.deleteHighlight(hlId);
      setHighlights(prev => prev.filter(h => h.id !== hlId));
      renditionRef.current?.annotations.remove(cfiRange, 'highlight');
    } catch (e) {
      console.error(e);
    }
  }

  function handleEditHighlightNote(hl) {
    setEditingHighlight(hl);
    setNoteText(hl.note || '');
    setShowNoteModal(true);
  }

  async function saveHighlightNote() {
    if (!editingHighlight) return;
    try {
      const res = await api.updateHighlight(editingHighlight.id, { note: noteText });
      if (res && res.highlight) {
        setHighlights(prev => prev.map(h => h.id === editingHighlight.id ? res.highlight : h));
      }
      setShowNoteModal(false);
      setEditingHighlight(null);
      setNoteText('');
    } catch (e) {
      console.error('Failed to update highlight note:', e);
    }
  }

  if (error) {
    return (
      <div className="reader-error">
        <p>Couldn't open this book: {error}</p>
        <button className="btn-ghost" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  return (
    <div className={`epub-reader theme-${theme} ${chrome ? 'chrome-active' : ''}`}>
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
            {/* Text to Speech Button */}
            <button 
              className={`reader-icon-btn ${showTtsPlayer ? 'active' : ''}`} 
              onClick={() => setShowTtsPlayer(!showTtsPlayer)} 
              aria-label="Text to speech"
              style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', color: showTtsPlayer ? 'var(--accent)' : 'inherit' }}
            >
              {showTtsPlayer ? <SpeakerActiveIcon /> : <SpeakerMuteIcon />}
            </button>

            {/* Sidebar toggle */}
            <button 
              className="reader-icon-btn" 
              onClick={() => setShowSidebar((v) => !v)} 
              aria-label="Table of contents"
              style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', color: showSidebar ? 'var(--accent)' : 'inherit' }}
            >
              <TocIcon />
            </button>

            {/* Fullscreen button */}
            <button 
              className="reader-icon-btn" 
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
              Contents
            </button>
            <button 
              className={`sidebar-tab ${sidebarTab === 'highlights' ? 'active' : ''}`}
              onClick={() => setSidebarTab('highlights')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: sidebarTab === 'highlights' ? 'var(--bg-card)' : 'transparent',
                border: 'none',
                color: sidebarTab === 'highlights' ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: '600',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: sidebarTab === 'highlights' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Notes ({highlights.length})
            </button>
          </div>
          
          {sidebarTab === 'toc' ? (
            <div className="reader-sidebar-toc" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {renderTocItems(toc)}
              </ul>
            </div>
          ) : (
            <div className="reader-sidebar-highlights" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
              {highlights.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px 0' }}>No highlights made yet. Select text in the book to highlight!</p>
              ) : (
                highlights.map((hl) => (
                  <div 
                    key={hl.id} 
                    className="reader-hl-item" 
                    style={{ 
                      padding: '10px 12px', 
                      borderBottom: '1px solid var(--border)', 
                      borderLeft: `3px solid ${hl.color || 'var(--accent)'}`,
                      marginBottom: '8px',
                      background: 'rgba(255,255,255,0.02)'
                    }}
                  >
                    <p 
                      style={{ margin: '0 0 6px 0', fontSize: '13px', fontStyle: 'italic', cursor: 'pointer', lineHeight: '1.4' }}
                      onClick={() => {
                        renditionRef.current?.display(hl.location_cfi);
                        setShowSidebar(false);
                      }}
                      title="Click to jump to this page"
                    >
                      “{cleanHighlightText(hl.text)}”
                    </p>
                    {hl.note && (
                      <p style={{ margin: '4px 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                        {hl.note}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      <span>{new Date(hl.created_at).toLocaleDateString()}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleEditHighlightNote(hl)}
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
                          onClick={() => handleDeleteHighlight(hl.id, hl.location_cfi)}
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

      {loading && <div className="reader-loading">Opening book…</div>}

      <div className="epub-viewer-area" onClick={() => setChrome((c) => (showSidebar ? c : !c))}>
        <button className="epub-nav-zone epub-nav-left" onClick={(e) => { e.stopPropagation(); renditionRef.current?.prev(); }} aria-label="Previous page" />
        <div ref={viewerRef} className="epub-viewer" onClick={(e) => e.stopPropagation()} />
        <button className="epub-nav-zone epub-nav-right" onClick={(e) => { e.stopPropagation(); renditionRef.current?.next(); }} aria-label="Next page" />
      </div>

      {chrome && (
        <footer className="reader-bottombar" style={{ height: '64px', padding: '14px 24px' }}>
          <div className="reader-controls">
            <div className="theme-swatches">
              {Object.keys(THEMES).map((t) => (
                <button
                  key={t}
                  className={`theme-swatch theme-swatch-${t} ${theme === t ? 'active' : ''}`}
                  onClick={() => setTheme(t)}
                  aria-label={`${t} theme`}
                />
              ))}
            </div>
            <div className="font-size-controls">
              <button onClick={() => setFontSizeIdx((i) => Math.max(0, i - 1))} aria-label="Decrease text size">A−</button>
              <button onClick={() => setFontSizeIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))} aria-label="Increase text size">A+</button>
            </div>
            {progress < 100 ? (
              <button className="btn-ghost btn-small" onClick={markFinished} style={{ padding: '4px 10px', fontSize: '11px' }}>Mark as finished</button>
            ) : (
              <span className="reader-finished-tag">✓ Finished</span>
            )}
          </div>
          <div className="reader-progress-container" style={{ display: 'flex', alignItems: 'center', flex: 1, width: '100%', gap: '12px' }}>
            <div className="reader-progress-bar" style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', margin: 0, flex: 1 }}>
              <div className="reader-progress-fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '999px' }} />
            </div>
            <span className="reader-progress-label" style={{ marginTop: '0', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: '600', fontFamily: 'var(--font-mono)', minWidth: '40px', justifyContent: 'flex-end' }}>
              {progress}%
            </span>
          </div>
        </footer>
      )}

      {showNoteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }} onClick={() => {
          setShowNoteModal(false);
          setEditingHighlight(null);
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            color: 'var(--text-primary)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px 0', fontFamily: 'var(--font-display)', fontSize: '18px' }}>
              Edit Highlight Note
            </h3>
            {editingHighlight && (
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text-tertiary)', 
                background: 'rgba(0,0,0,0.15)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${editingHighlight.color || 'var(--accent)'}`,
                fontStyle: 'italic',
                maxHeight: '80px',
                overflowY: 'auto',
                marginBottom: '16px' 
              }}>
                "{editingHighlight.text}"
              </p>
            )}
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Add/Edit note:
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type your thoughts here..."
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
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowNoteModal(false);
                  setEditingHighlight(null);
                }}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveHighlightNote}
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
          onNextPage={() => renditionRef.current?.next()}
          onPrevPage={() => renditionRef.current?.prev()}
          onClose={() => setShowTtsPlayer(false)}
        />
      )}

      {selectionMenu && (
        <div 
          className="selection-menu-container"
          style={{
            position: 'fixed',
            top: `${selectionMenu.top}px`,
            left: `${selectionMenu.left}px`,
            zIndex: 9999,
            background: 'rgba(23, 28, 38, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(12px)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Color Circles */}
          <div style={{ display: 'flex', gap: '6px', borderRight: '1px solid rgba(255,255,255,0.15)', paddingRight: '8px' }}>
            {[
              { name: 'yellow', value: '#ffd166' },
              { name: 'green', value: '#06d6a0' },
              { name: 'blue', value: '#118ab2' },
              { name: 'pink', value: '#ef476f' },
            ].map(color => (
              <button
                key={color.name}
                onClick={() => handleCreateHighlight(color.value)}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleCreateHighlight(color.value);
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: color.value,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 0.1s ease',
                }}
                title={`Highlight ${color.name}`}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              />
            ))}
          </div>
          
          {/* Note Button */}
          <button
            onClick={handleCreateHighlightWithNote}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleCreateHighlightWithNote();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              borderRadius: '4px',
            }}
            title="Add Note"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Note</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopySelection}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleCopySelection();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              borderRadius: '4px',
            }}
            title="Copy Text"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy</span>
          </button>

          {/* Dismiss Button */}
          <button
            onClick={handleDismissSelection}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleDismissSelection();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
            title="Dismiss"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

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
function SpeakerMuteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M23 9l-6 6M17 9l6 6"/></svg>;
}
function SpeakerActiveIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
}
