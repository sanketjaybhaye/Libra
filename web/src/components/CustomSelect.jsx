import { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ value, onChange, options, align = 'left', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      <button 
        type="button"
        className={`custom-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>{activeOption?.label}</span>
        <svg 
          width="10" 
          height="6" 
          viewBox="0 0 10 6" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.8" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
            transition: 'transform 0.15s ease',
            marginLeft: '8px',
            flexShrink: 0
          }}
        >
          <polyline points="1 1 5 5 9 1" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="custom-select-dropdown" 
          style={{ 
            left: align === 'left' ? 0 : 'auto', 
            right: align === 'right' ? 0 : 'auto' 
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`custom-select-option ${opt.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '12px', flexShrink: 0 }}>
                  <polyline points="1 4 4 7 9 1" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
