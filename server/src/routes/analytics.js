import express from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

router.get('/dashboard', authMiddleware, (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Fetch Heatmap (Last 365 Days)
    const heatmap = db.prepare(`
      SELECT read_date as date, SUM(pages_read) as count
      FROM reading_history
      WHERE user_id = ? AND read_date >= date('now', '-365 days')
      GROUP BY read_date
      ORDER BY read_date ASC
    `).all(userId);

    // 2. Calculate Streaks
    const datesRows = db.prepare(`
      SELECT DISTINCT read_date
      FROM reading_history
      WHERE user_id = ? AND pages_read > 0
      ORDER BY read_date DESC
    `).all(userId);

    const dates = datesRows.map(r => r.read_date);
    
    let currentStreak = 0;
    let longestStreak = 0;
    
    if (dates.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      // Check if user has read today or yesterday to continue current streak
      const hasReadRecent = dates[0] === todayStr || dates[0] === yesterdayStr;
      
      if (hasReadRecent) {
        let tempStreak = 0;
        let expectedDate = new Date(dates[0]);
        
        for (let i = 0; i < dates.length; i++) {
          const currentDate = new Date(dates[i]);
          const diffTime = Math.abs(expectedDate - currentDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 1) {
            tempStreak++;
            expectedDate = currentDate;
          } else {
            break;
          }
        }
        currentStreak = tempStreak;
      }
      
      // Calculate Longest Streak
      let maxStreak = 0;
      let currentSeq = 0;
      let lastDate = null;
      
      // Sort dates ascending for forward pass
      const ascDates = [...dates].reverse();
      
      for (const dStr of ascDates) {
        const d = new Date(dStr);
        if (!lastDate) {
          currentSeq = 1;
        } else {
          const diffTime = Math.abs(d - lastDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentSeq++;
          } else if (diffDays > 1) {
            maxStreak = Math.max(maxStreak, currentSeq);
            currentSeq = 1;
          }
        }
        lastDate = d;
      }
      longestStreak = Math.max(maxStreak, currentSeq);
    }

    // 3. Hourly reading distribution (based on highlights & progress updates)
    // We count updates grouped by UTC hour
    const progressUpdates = db.prepare(`
      SELECT strftime('%H', updated_at) as hour, COUNT(*) as count
      FROM progress
      WHERE user_id = ?
      GROUP BY hour
    `).all(userId);

    const highlightUpdates = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM highlights
      WHERE user_id = ?
      GROUP BY hour
    `).all(userId);

    const hourlyMap = Array(24).fill(0);
    progressUpdates.forEach(r => {
      const h = parseInt(r.hour, 10);
      if (!isNaN(h)) hourlyMap[h] += r.count;
    });
    highlightUpdates.forEach(r => {
      const h = parseInt(r.hour, 10);
      if (!isNaN(h)) hourlyMap[h] += r.count;
    });

    const hourlyDistribution = hourlyMap.map((count, hour) => ({ hour, count }));

    // 4. Summaries
    const totalPages = db.prepare(`
      SELECT SUM(pages_read) as total FROM reading_history WHERE user_id = ?
    `).get(userId).total || 0;

    const totalMinutes = db.prepare(`
      SELECT SUM(minutes_read) as total FROM reading_history WHERE user_id = ?
    `).get(userId).total || 0;

    const booksFinished = db.prepare(`
      SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND status = 'finished'
    `).get(userId).count || 0;

    const booksReading = db.prepare(`
      SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND status = 'reading'
    `).get(userId).count || 0;

    const activeDaysCount = db.prepare(`
      SELECT COUNT(DISTINCT read_date) as count FROM reading_history WHERE user_id = ? AND (pages_read > 0 OR minutes_read > 0)
    `).get(userId).count || 0;

    const averagePagesPerDay = activeDaysCount > 0 ? Math.round(totalPages / activeDaysCount) : 0;

    const mostActiveDayRow = db.prepare(`
      SELECT read_date as date, SUM(pages_read) as count
      FROM reading_history
      WHERE user_id = ?
      GROUP BY read_date
      ORDER BY count DESC
      LIMIT 1
    `).get(userId);

    const recentSessions = db.prepare(`
      SELECT rh.pages_read, rh.minutes_read, rh.read_date, items.title, items.id as item_id, items.cover_path
      FROM reading_history rh
      JOIN items ON items.id = rh.item_id
      WHERE rh.user_id = ?
      ORDER BY rh.read_date DESC, rh.id DESC
      LIMIT 5
    `).all(userId);

    // 5. Goals & Achievements
    const userGoals = db.prepare('SELECT daily_page_goal, daily_minute_goal FROM users WHERE id = ?').get(userId);
    const dailyPageGoal = userGoals?.daily_page_goal ?? 20;
    const dailyMinuteGoal = userGoals?.daily_minute_goal ?? 30;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare(`
      SELECT SUM(pages_read) as pages, SUM(minutes_read) as minutes
      FROM reading_history
      WHERE user_id = ? AND read_date = ?
    `).get(userId, todayStr);

    const todayPages = todayStats?.pages || 0;
    const todayMinutes = todayStats?.minutes || 0;

    const goals = {
      dailyPageGoal,
      dailyMinuteGoal,
      todayPages,
      todayMinutes,
      pageProgressPercent: Math.min(100, Math.round((todayPages / dailyPageGoal) * 100)),
      minuteProgressPercent: Math.min(100, Math.round((todayMinutes / dailyMinuteGoal) * 100))
    };

    const achievements = [
      {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Read or annotate during the night (12 AM - 4 AM)',
        unlocked: (hourlyMap[0] + hourlyMap[1] + hourlyMap[2] + hourlyMap[3] + hourlyMap[4]) > 0,
        icon: 'Moon'
      },
      {
        id: 'bookworm',
        title: 'Bookworm',
        description: 'Finish reading at least 1 book',
        unlocked: booksFinished >= 1,
        progress: { current: booksFinished, target: 1 },
        icon: 'BookOpen'
      },
      {
        id: 'speed_reader',
        title: 'Speed Reader',
        description: 'Read 50 or more pages in a single day',
        unlocked: (mostActiveDayRow?.count || 0) >= 50,
        progress: { current: mostActiveDayRow?.count || 0, target: 50 },
        icon: 'Zap'
      },
      {
        id: 'habit_builder',
        title: 'Habit Builder',
        description: 'Reach a reading streak of 3 days or more',
        unlocked: longestStreak >= 3,
        progress: { current: longestStreak, target: 3 },
        icon: 'Flame'
      },
      {
        id: 'time_tracker',
        title: 'Time Tracker',
        description: 'Accumulate 60 minutes of active focus reading',
        unlocked: totalMinutes >= 60,
        progress: { current: totalMinutes, target: 60 },
        icon: 'Clock'
      }
    ];

    res.json({
      heatmap,
      streaks: {
        current: currentStreak,
        longest: longestStreak,
      },
      hourlyDistribution,
      summary: {
        totalPages,
        totalMinutes,
        booksFinished,
        booksReading,
        averagePagesPerDay,
        mostActiveDay: mostActiveDayRow ? { date: mostActiveDayRow.date, count: mostActiveDayRow.count } : null,
      },
      recentSessions,
      goals,
      achievements
    });

  } catch (err) {
    console.error('Analytics failed:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

export default router;
