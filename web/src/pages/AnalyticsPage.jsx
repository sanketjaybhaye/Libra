import { useEffect, useState } from 'react';
import { api } from '../api';

function BadgeIcon({ name, size = 28 }) {
  switch (name) {
    case 'Moon':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'BookOpen':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'Zap':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'Flame':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case 'Clock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 19 12" />
        </svg>
      );
    default:
      return null;
  }
}

function RadialGauge({ percent, label, value, target, unit, color }) {
  const radius = 50;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="radial-gauge-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ position: 'relative', width: radius * 2, height: radius * 2 }}>
        <svg height={radius * 2} width={radius * 2}>
          <circle
            stroke="var(--border-soft)"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            style={{ strokeWidth: stroke }}
          />
          <circle
            stroke={color || "var(--accent)"}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
            style={{ strokeWidth: stroke, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{percent}%</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{value} / {target} {unit}</span>
      </div>
    </div>
  );
}

function EditIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [tempPageGoal, setTempPageGoal] = useState(20);
  const [tempMinuteGoal, setTempMinuteGoal] = useState(30);

  useEffect(() => {
    api.getAnalyticsDashboard()
      .then(res => {
        setData(res);
        if (res.goals) {
          setTempPageGoal(res.goals.dailyPageGoal || 20);
          setTempMinuteGoal(res.goals.dailyMinuteGoal || 30);
        }
      })
      .catch(err => console.error('Failed to load analytics dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveGoals = async () => {
    try {
      setLoading(true);
      await api.updateProfile({ daily_page_goal: tempPageGoal, daily_minute_goal: tempMinuteGoal });
      const freshData = await api.getAnalyticsDashboard();
      setData(freshData);
      setShowGoalsModal(false);
    } catch (err) {
      console.error('Failed to save goals:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Analyzing your library data...</div>;
  }

  if (!data) {
    return <div className="empty-state-inline"><p>Failed to load analytics dashboard. Please try again later.</p></div>;
  }

  const { heatmap, streaks, hourlyDistribution, summary, recentSessions } = data;
  const goals = data.goals || { dailyPageGoal: 20, dailyMinuteGoal: 30, todayPages: 0, todayMinutes: 0, pageProgressPercent: 0, minuteProgressPercent: 0 };
  const achievements = data.achievements || [];

  // Prepare 365 Days Heatmap Grid
  const dateMap = {};
  heatmap.forEach(h => {
    dateMap[h.date] = h.count;
  });

  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 364);
  const startDayOffset = startDate.getDay();
  // Align start date to Sunday/Monday
  startDate.setDate(startDate.getDate() - startDayOffset);

  const calendarGrid = [];
  let loopDate = new Date(startDate);
  for (let week = 0; week < 53; week++) {
    const weekDays = [];
    for (let day = 0; day < 7; day++) {
      const dateStr = loopDate.toISOString().split('T')[0];
      const count = dateMap[dateStr] || 0;
      weekDays.push({ date: dateStr, count });
      loopDate.setDate(loopDate.getDate() + 1);
    }
    calendarGrid.push(weekDays);
  }

  const monthLabels = [];
  let lastMonth = -1;
  calendarGrid.forEach((week, wIdx) => {
    const dateObj = new Date(week[0].date);
    const m = dateObj.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: dateObj.toLocaleString('default', { month: 'short' }), weekIndex: wIdx });
      lastMonth = m;
    }
  });

  const maxPagesInDay = Math.max(...heatmap.map(h => h.count), 1);

  function getHeatmapColorClass(count) {
    if (count === 0) return 'heatmap-cell-empty';
    const pct = count / maxPagesInDay;
    if (pct < 0.25) return 'heatmap-cell-low';
    if (pct < 0.5) return 'heatmap-cell-medium';
    if (pct < 0.75) return 'heatmap-cell-high';
    return 'heatmap-cell-max';
  }

  // Find max hourly count for scaling SVG bar chart
  const maxHourlyCount = Math.max(...hourlyDistribution.map(h => h.count), 1);
  const barWidth = 14;
  const gap = 6;
  const chartHeight = 100;

  return (
    <div className="analytics-page animate-fade-in">
      <header className="page-header">
        <h1>Reading Insights</h1>
      </header>

      <div className="analytics-summary-grid">
        <div className="analytics-card streak-card">
          <div className="streak-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="streak-svg">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="streak-info">
            <span className="streak-num">{streaks.current}</span>
            <span className="streak-lbl">Current Streak (days)</span>
          </div>
          <div className="streak-meta">
            <span>Longest Streak: <strong>{streaks.longest} days</strong></span>
          </div>
        </div>

        <div className="analytics-card stat-summary-card">
          <div className="stat-summary-row">
            <span className="stat-summary-num">{summary.totalPages}</span>
            <span className="stat-summary-lbl">Total Pages Read</span>
          </div>
          <div className="stat-summary-divider"></div>
          <div className="stat-summary-row">
            <span className="stat-summary-num">{summary.booksFinished}</span>
            <span className="stat-summary-lbl">Finished Titles</span>
          </div>
          <div className="stat-summary-divider"></div>
          <div className="stat-summary-row">
            <span className="stat-summary-num">{summary.booksReading}</span>
            <span className="stat-summary-lbl">Reading Now</span>
          </div>
        </div>

        <div className="analytics-card stat-summary-card">
          <div className="stat-summary-row">
            <span className="stat-summary-num">{summary.averagePagesPerDay}</span>
            <span className="stat-summary-lbl">Pages / Active Day</span>
          </div>
          <div className="stat-summary-divider"></div>
          <div className="stat-summary-row" style={{ flex: 1.2 }}>
            <span className="stat-summary-num" style={{ fontSize: '20px', lineHeight: 1.4 }}>
              {summary.mostActiveDay ? `${summary.mostActiveDay.count} p` : '—'}
            </span>
            <span className="stat-summary-lbl">
              {summary.mostActiveDay ? new Date(summary.mostActiveDay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Best Day'}
            </span>
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        <section className="analytics-section card goals-badges-section" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Today's Progress</h2>
                <p className="section-subtitle" style={{ margin: '4px 0 0 0' }}>Keep your streak alive by hitting your daily targets.</p>
              </div>
              <button 
                onClick={() => {
                  setTempPageGoal(goals.dailyPageGoal);
                  setTempMinuteGoal(goals.dailyMinuteGoal);
                  setShowGoalsModal(true);
                }}
                className="btn-ghost" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  padding: '6px 12px', 
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}
              >
                <EditIcon size={12} />
                <span>Edit Goals</span>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px' }}>
              <RadialGauge
                percent={goals.pageProgressPercent}
                label="Pages Goal"
                value={goals.todayPages}
                target={goals.dailyPageGoal}
                unit="pages"
                color="var(--accent)"
              />
              <RadialGauge
                percent={goals.minuteProgressPercent}
                label="Focus Time"
                value={goals.todayMinutes}
                target={goals.dailyMinuteGoal}
                unit="mins"
                color="#7c9885"
              />
            </div>
          </div>

          <div>
            <h2>Achievements & Badges</h2>
            <p className="section-subtitle" style={{ marginBottom: '20px' }}>Unlock achievements dynamically as you read and build your habit.</p>
            <div className="badges-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '16px' }}>
              {achievements.map((badge) => (
                <div
                  key={badge.id}
                  className={`badge-card ${badge.unlocked ? 'unlocked' : 'locked'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: badge.unlocked ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    background: badge.unlocked ? 'rgba(201, 138, 62, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    opacity: badge.unlocked ? 1 : 0.55,
                    transition: 'all 0.3s ease',
                    textAlign: 'center',
                    position: 'relative'
                  }}
                  title={badge.description}
                >
                  <div
                    className="badge-icon-wrapper"
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: badge.unlocked ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                      color: badge.unlocked ? '#fff' : 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '10px',
                      boxShadow: badge.unlocked ? '0 0 12px rgba(201, 138, 62, 0.3)' : 'none'
                    }}
                  >
                    <BadgeIcon name={badge.icon} size={24} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '13px', display: 'block', color: 'var(--text-primary)' }}>{badge.title}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px', lineHeight: 1.2 }}>{badge.description}</span>
                  {badge.progress && (
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.12)', height: '4px', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--accent)', height: '100%', width: `${Math.min(100, (badge.progress.current / badge.progress.target) * 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="analytics-section card heatmap-section">
          <h2>Reading Calendar</h2>
          <p className="section-subtitle">Your daily reading consistency over the past year. Click any day to see details.</p>
          
          <div className="heatmap-container">
            <div className="heatmap-scrollable">
              <div style={{ position: 'relative', height: '18px', width: `${53 * 14 - 3}px`, marginBottom: '6px' }}>
                {monthLabels.map((ml, idx) => (
                  <span 
                    key={idx} 
                    style={{ 
                      position: 'absolute', 
                      left: `${ml.weekIndex * 14 + 2}px`,
                      fontSize: '11px',
                      fontWeight: '600',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {ml.label}
                  </span>
                ))}
              </div>
              <div className="heatmap-grid">
                {calendarGrid.map((week, wIdx) => (
                  <div key={wIdx} className="heatmap-column">
                    {week.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        className={`heatmap-cell ${getHeatmapColorClass(day.count)} ${selectedDay?.date === day.date ? 'selected' : ''}`}
                        title={`${day.count} pages read on ${new Date(day.date).toLocaleDateString()}`}
                        onClick={() => setSelectedDay(day)}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="heatmap-legend">
              <span>Less</span>
              <div className="heatmap-cell heatmap-cell-empty"></div>
              <div className="heatmap-cell heatmap-cell-low"></div>
              <div className="heatmap-cell heatmap-cell-medium"></div>
              <div className="heatmap-cell heatmap-cell-high"></div>
              <div className="heatmap-cell heatmap-cell-max"></div>
              <span>More</span>
            </div>
          </div>

          {selectedDay && (
            <div className="selected-day-details card animate-fade-in" style={{ marginTop: '16px', padding: '14px 20px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                On <strong>{new Date(selectedDay.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</strong>:
              </span>
              <span style={{ fontSize: '14px', marginLeft: '8px', color: 'var(--accent)', fontWeight: 600 }}>
                {selectedDay.count} {selectedDay.count === 1 ? 'page' : 'pages'} read
              </span>
            </div>
          )}
        </section>

        <section className="analytics-section card hourly-section">
          <h2>Hourly Activity</h2>
          <p className="section-subtitle">What time of day you are most active reading or note-taking.</p>
          
          <div className="hourly-chart-container">
            <svg viewBox={`0 0 ${24 * (barWidth + gap)} ${chartHeight + 20}`} width="100%" height="100%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              {hourlyDistribution.map((d, idx) => {
                const height = (d.count / maxHourlyCount) * chartHeight;
                const x = idx * (barWidth + gap);
                const y = chartHeight - height;
                return (
                  <g key={d.hour}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(2, height)}
                      rx="3"
                      fill={d.count > 0 ? "url(#barGrad)" : "rgba(255, 255, 255, 0.05)"}
                      opacity={d.count > 0 ? 0.95 : 0.4}
                      title={`${d.count} reading interactions at ${d.hour}:00`}
                    />
                    {idx % 4 === 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight + 15}
                        fontSize="9"
                        fill="var(--text-tertiary)"
                        textAnchor="middle"
                        fontFamily="var(--font-mono)"
                      >
                        {d.hour}:00
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {recentSessions && recentSessions.length > 0 && (
          <section className="analytics-section card recent-sessions-section" style={{ gridColumn: 'span 2', marginTop: '24px' }}>
            <h2>Recent Activity Log</h2>
            <p className="section-subtitle">A breakdown of your most recent reading sessions.</p>
            
            <div className="recent-sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentSessions.map((session, idx) => (
                <div key={idx} className="session-log-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: 'rgba(0, 0, 0, 0.15)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', transition: 'all 0.2s ease', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                  {session.cover_path ? (
                    <img src={api.coverUrl(session.item_id)} alt="" style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-spine)' }} />
                  ) : (
                    <div style={{ width: '36px', height: '54px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', fontSize: '10px', color: 'var(--text-tertiary)' }}>Book</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{session.title}</span>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>{new Date(session.read_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    {session.pages_read > 0 && (
                      <span style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600 }}>
                        +{session.pages_read} {session.pages_read === 1 ? 'page' : 'pages'}
                      </span>
                    )}
                    {session.minutes_read > 0 && (
                      <span style={{ fontSize: '12.5px', color: '#7c9885', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {session.minutes_read}m focus
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showGoalsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowGoalsModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '340px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            color: 'var(--text-primary)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-display)', fontSize: '18px' }}>
              Edit Daily Goals
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Page Goal</label>
                <input 
                  type="number" 
                  min="1" 
                  max="500"
                  value={tempPageGoal} 
                  onChange={(e) => setTempPageGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Focus Goal (minutes)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="480"
                  value={tempMinuteGoal} 
                  onChange={(e) => setTempMinuteGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn-ghost"
                onClick={() => setShowGoalsModal(false)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveGoals}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Save Goals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
