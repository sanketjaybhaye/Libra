import { useEffect, useState, useRef } from 'react';
import CustomSelect from './CustomSelect';

export default function TtsPlayer({ text, onNextPage, onPrevPage, onClose }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1); // speed multiplier
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPageTurn, setAutoPageTurn] = useState(true);
  
  const utteranceRef = useRef(null);
  const synth = window.speechSynthesis;

  useEffect(() => {
    function loadVoices() {
      const allVoices = synth.getVoices();
      setVoices(allVoices);
      
      // Select default english voice if possible
      const englishVoice = allVoices.find(v => v.lang.startsWith('en')) || allVoices[0];
      setSelectedVoice(englishVoice?.name || null);
    }

    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return () => {
      synth.cancel();
    };
  }, [synth]);

  // Handle text changes (when page turns)
  useEffect(() => {
    if (isPlaying) {
      // Re-trigger speech for new page text
      speakText();
    }
  }, [text]);

  function speakText() {
    synth.cancel(); // stop current speech
    if (!text || text.trim().length === 0) {
      if (autoPageTurn && onNextPage) {
        // Empty page, skip to next page
        onNextPage();
      }
      return;
    }

    const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (selectedVoice) {
      const voiceObj = voices.find(v => v.name === selectedVoice);
      if (voiceObj) utterance.voice = voiceObj;
    }
    
    utterance.rate = rate;
    
    utterance.onend = () => {
      if (autoPageTurn && onNextPage) {
        onNextPage();
      } else {
        setIsPlaying(false);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        console.error('Speech synthesis error:', e);
        setIsPlaying(false);
      }
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  }

  function handlePlayPause() {
    if (isPlaying) {
      synth.cancel();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speakText();
    }
  }

  // Handle rate change
  function handleRateChange(newRate) {
    setRate(newRate);
    if (isPlaying) {
      // Restart speech with new speed
      setTimeout(() => speakText(), 100);
    }
  }

  return (
    <div className="tts-player-card">
      <div className="tts-player-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="tts-title">🔊 Screen Narrator</span>
          {isPlaying && (
            <div className="audio-wave">
              <div className="wave-bar bar-1"></div>
              <div className="wave-bar bar-2"></div>
              <div className="wave-bar bar-3"></div>
              <div className="wave-bar bar-4"></div>
            </div>
          )}
        </div>
        <button className="btn-close-tts" onClick={() => { synth.cancel(); onClose(); }} title="Close player">×</button>
      </div>

      <div className="tts-controls">
        <button className="tts-nav-btn" onClick={onPrevPage} title="Previous Page">◀</button>
        
        <button className={`tts-play-btn ${isPlaying ? 'playing' : ''}`} onClick={handlePlayPause}>
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="4" height="16" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>

        <button className="tts-nav-btn" onClick={onNextPage} title="Next Page">▶</button>
      </div>

      <div className="tts-settings-row">
        <div className="tts-setting">
          <label>Voice</label>
          <CustomSelect 
            value={selectedVoice || ''} 
            onChange={(val) => {
              setSelectedVoice(val);
              if (isPlaying) setTimeout(() => speakText(), 100);
            }}
            options={voices.map(v => ({ value: v.name, label: `${v.name} (${v.lang})` }))}
            className="tts-voice-select"
            align="left"
          />
        </div>

        <div className="tts-setting speed-setting">
          <label>Speed: {rate}x</label>
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={rate} 
            onChange={(e) => handleRateChange(parseFloat(e.target.value))} 
          />
        </div>
      </div>

      <label className="tts-auto-turn-checkbox">
        <input 
          type="checkbox" 
          checked={autoPageTurn} 
          onChange={(e) => setAutoPageTurn(e.target.checked)} 
        />
        <span>Auto-turn page on finish</span>
      </label>
    </div>
  );
}
