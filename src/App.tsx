import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

import { Project } from "./types";
import { LockScreen } from "./components/LockScreen";
import { Dashboard } from "./components/Dashboard";
import { SummaryView } from "./components/SummaryView";
import { Settings } from "./components/Settings";
import { TimelineView } from "./components/TimelineView";
import { startIdleTimer, stopIdleTimer } from "./utils/idle_timer";

type Tab = "dashboard" | "summary" | "settings" | "timeline";

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch all projects & tasks for a specific date
  const refreshData = async (date: string = selectedDate) => {
    if (!isUnlocked) return;
    try {
      const res = await invoke<Project[]>("get_projects", { date });
      setProjects(res);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  // Lock the database connection and update state
  const handleLock = async () => {
    try {
      await invoke("lock_db");
      setIsUnlocked(false);
      stopIdleTimer();
    } catch (err) {
      console.error("Lock error:", err);
    }
  };

  // Watch unlock state and date selection
  useEffect(() => {
    if (isUnlocked) {
      refreshData(selectedDate);
      
      // Initialize the idle timer based on config
      const initIdleTimer = async () => {
        try {
          const config = await invoke<{ auto_lock_timeout_mins: number }>("get_config");
          startIdleTimer(config.auto_lock_timeout_mins, () => {
            handleLock();
          });
        } catch (err) {
          console.error("Idle timer setup failed:", err);
        }
      };
      
      initIdleTimer();
    } else {
      stopIdleTimer();
      setProjects([]);
    }
  }, [isUnlocked, selectedDate]);

  // Listen to system-wide lock events from the backend (e.g., tray menu click)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    
    const setupListener = async () => {
      unlisten = await listen("database-locked", () => {
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
      const u = await listen("tasks-changed", () => {
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
  }, [isUnlocked, selectedDate]);

  if (!isUnlocked) {
    return <LockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Navigation Bar */}
        <nav className="top-nav">
          <div className="brand">
            <span style={{ fontSize: "22px" }}>🛡️</span>
            <h1>Memor</h1>
          </div>

          <div className="nav-links">
            <button
              className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              📋 Dashboard
            </button>
            <button
              className={`nav-btn ${activeTab === "timeline" ? "active" : ""}`}
              onClick={() => setActiveTab("timeline")}
            >
              📜 Activity
            </button>
            <button
              className={`nav-btn ${activeTab === "summary" ? "active" : ""}`}
              onClick={() => setActiveTab("summary")}
            >
              📈 Summaries
            </button>
            <button
              className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              ⚙️ Settings
            </button>
          </div>
          
          <div>
            <button className="btn btn-secondary" onClick={handleLock} style={{ padding: "6px 12px", fontSize: "13px" }}>
              🔒 Lock
            </button>
          </div>
        </nav>

        {/* View Selection */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {activeTab === "dashboard" && (
            <Dashboard 
              projects={projects} 
              refreshData={refreshData} 
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          )}
          {activeTab === "timeline" && <TimelineView />}
          {activeTab === "summary" && <SummaryView />}
          {activeTab === "settings" && <Settings onLock={() => setIsUnlocked(false)} />}
        </div>
      </div>
    </div>
  );
}

export default App;
