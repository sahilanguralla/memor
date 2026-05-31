import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saveInKeyring, setSaveInKeyring] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Try to auto-unlock using the saved keyring password on load
    const checkAutoUnlock = async () => {
      try {
        const success = await invoke<boolean>("unlock_db_with_saved_key");
        if (success) {
          onUnlock();
        } else {
          // If auto unlock fails/is disabled, check if this is the first run
          const firstRun = await invoke<boolean>("is_first_run");
          setIsFirstRun(firstRun);
          
          // Get config to see default keyring state
          const config = await invoke<{ keyring_enabled: boolean }>("get_config");
          setSaveInKeyring(config.keyring_enabled);
          setLoading(false);
        }
      } catch (err) {
        console.error("Auto unlock error:", err);
        setLoading(false);
      }
    };
    checkAutoUnlock();
  }, [onUnlock]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter a master password.");
      return;
    }

    if (isFirstRun && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await invoke("unlock_db", { password, saveInKeyring });
      onUnlock();
    } catch (err: any) {
      setError(err?.toString() || "Invalid master password");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="lock-screen-container">
        <div className="lock-card glass-panel">
          <div className="lock-icon-wrapper">
            <span>⏳</span>
          </div>
          <h2>Securing Database</h2>
          <p>Checking security credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lock-screen-container">
      <div className="lock-card glass-panel">
        <div className="lock-icon-wrapper">
          <span>🔒</span>
        </div>
        
        <h2>{isFirstRun ? "Setup Master Password" : "Memor Decryption"}</h2>
        <p>
          {isFirstRun 
            ? "Create a master password to encrypt your local database. Keep this safe; it cannot be recovered." 
            : "Enter your master password to decrypt your task database."
          }
        </p>

        <form onSubmit={handleUnlock} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group" style={{ textAlign: "left" }}>
            <label htmlFor="master-password">
              {isFirstRun ? "Choose Master Password" : "Master Password"}
            </label>
            <input
              type="password"
              id="master-password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
            />
          </div>

          {isFirstRun && (
            <div className="form-group" style={{ textAlign: "left" }}>
              <label htmlFor="confirm-password">Confirm Master Password</label>
              <input
                type="password"
                id="confirm-password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
          )}

          <label className="form-checkbox" style={{ alignSelf: "flex-start" }}>
            <input
              type="checkbox"
              checked={saveInKeyring}
              onChange={(e) => setSaveInKeyring(e.target.checked)}
            />
            <span>Remember in system keyring</span>
          </label>

          {error && <div className="lock-error">{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px" }}>
            {isFirstRun ? "Create & Initialize Database" : "Decrypt Database"}
          </button>
        </form>
      </div>
    </div>
  );
};
