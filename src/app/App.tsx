import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '../styles/App.css';

import { Project } from '../domain/types';
import { LockScreen } from '../features/auth/LockScreen';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Settings } from '../features/settings/Settings';
import { SummaryView } from '../features/summary/SummaryView';
import { TimelineView } from '../features/timeline/TimelineView';
import { startIdleTimer, stopIdleTimer } from '../shared/utils/idleTimer';
import { AppShell, AppTab } from './AppShell';

const App = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch all projects & tasks for a specific date
  const refreshData = useCallback(
    async (date: string = selectedDate) => {
      if (!isUnlocked) return;
      try {
        const res = await invoke<Project[]>('get_projects', { date });
        setProjects(res);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    },
    [isUnlocked, selectedDate],
  );

  // Lock the database connection and update state
  const handleLock = useCallback(async () => {
    try {
      await invoke('lock_db');
      setIsUnlocked(false);
      stopIdleTimer();
    } catch (err) {
      console.error('Lock error:', err);
    }
  }, []);

  // Watch unlock state and date selection
  useEffect(() => {
    if (isUnlocked) {
      refreshData(selectedDate);

      // Initialize the idle timer based on config
      const initIdleTimer = async () => {
        try {
          const config = await invoke<{ auto_lock_timeout_mins: number }>('get_config');
          startIdleTimer(config.auto_lock_timeout_mins, () => {
            handleLock();
          });
        } catch (err) {
          console.error('Idle timer setup failed:', err);
        }
      };

      initIdleTimer();
    } else {
      stopIdleTimer();
      setProjects([]);
    }
  }, [isUnlocked, selectedDate, refreshData, handleLock]);

  // Listen to system-wide lock events from the backend (e.g., tray menu click)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen('database-locked', () => {
        setIsUnlocked(false);
        stopIdleTimer();
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
      stopIdleTimer();
    };
  }, []);

  // Listen to task/project changes from the HTTP API & Tauri commands to immediately update UI
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      const u = await listen('tasks-changed', () => {
        refreshData(selectedDate);
      });
      if (active) {
        unlistenFn = u;
      } else {
        u();
      }
    };

    setupListener();

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [isUnlocked, selectedDate, refreshData]);

  if (!isUnlocked) {
    return <LockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <AppShell activeTab={activeTab} onLock={handleLock} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
        <Dashboard
          projects={projects}
          refreshData={refreshData}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      )}
      {activeTab === 'timeline' && <TimelineView />}
      {activeTab === 'summary' && <SummaryView />}
      {activeTab === 'settings' && <Settings onLock={() => setIsUnlocked(false)} />}
    </AppShell>
  );
};

export default App;
