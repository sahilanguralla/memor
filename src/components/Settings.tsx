import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../types';
import { showAlert } from '../utils/dialogs';

interface SettingsProps {
  onLock: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLock }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await invoke<AppConfig>('get_config');
        setConfig(res);
      } catch (err) {
        console.error('Failed to load config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const saveConfig = async (newConfig: AppConfig) => {
    setSaving(true);
    setMessage('');
    try {
      await invoke('update_config', { config: newConfig });
      setMessage('Settings saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      showAlert(`Failed to save settings: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKeyring = async (enabled: boolean) => {
    if (!config) return;
    const newConfig = { ...config, keyring_enabled: enabled };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleUpdateTimeout = async (mins: number) => {
    if (!config) return;
    const newConfig = { ...config, auto_lock_timeout_mins: mins };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleUpdateTrashRetention = async (days: number) => {
    if (!config) return;
    const newConfig = { ...config, trash_retention_days: days };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleManualLock = async () => {
    try {
      await invoke('lock_db');
      onLock();
    } catch (err) {
      console.error('Failed to lock db:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-med)', padding: '40px', textAlign: 'center' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="settings-view">
      <h2 className="view-title" style={{ marginBottom: '24px' }}>
        ⚙️ Application Settings
      </h2>

      {/* Security Section */}
      <div className="settings-section">
        <h3 className="settings-section-title">Security & Biometrics</h3>

        <label
          className="form-checkbox"
          style={{ padding: '8px 0' }}
          htmlFor="keyring-toggle-checkbox"
        >
          <input
            id="keyring-toggle-checkbox"
            type="checkbox"
            checked={config?.keyring_enabled || false}
            onChange={(e) => handleUpdateKeyring(e.target.checked)}
            disabled={saving}
          />
          <div>
            <div style={{ fontWeight: '500', color: 'var(--text-high)' }}>Secure Auto-Unlock</div>
            <div style={{ fontSize: '12px', color: 'var(--text-low)', marginTop: '2px' }}>
              Store the database decryption key in your system&apos;s secure keyring. Uses native
              biometrics or system login password to decrypt automatically on startup.
            </div>
          </div>
        </label>
      </div>

      {/* Auto-Lock Section */}
      <div className="settings-section">
        <h3 className="settings-section-title">Session Lock Timeout</h3>

        <div className="form-group">
          <label htmlFor="lock-timeout">
            Idle Auto-Lock Timeout
            <select
              id="lock-timeout"
              className="form-select"
              value={config?.auto_lock_timeout_mins ?? 15}
              onChange={(e) => handleUpdateTimeout(Number(e.target.value))}
              disabled={saving}
              style={{ marginTop: '6px' }}
            >
              <option value={0}>Never Auto-Lock</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-low)', marginTop: '6px' }}>
            The application will automatically lock and clear decrypted keys from memory if no
            keyboard or mouse activity is detected for the selected period.
          </p>
        </div>
      </div>

      {/* Trash Retention Section */}
      <div className="settings-section">
        <h3 className="settings-section-title">Trash Retention</h3>

        <div className="form-group">
          <label htmlFor="trash-retention">
            Auto-Cleanup Period
            <select
              id="trash-retention"
              className="form-select"
              value={config?.trash_retention_days ?? 30}
              onChange={(e) => handleUpdateTrashRetention(Number(e.target.value))}
              disabled={saving}
              style={{ marginTop: '6px' }}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days (Default)</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-low)', marginTop: '6px' }}>
            Deleted projects and tasks will be kept in the trash and permanently purged from the
            database after the selected retention period.
          </p>
        </div>
      </div>

      {/* Session Controls */}
      <div className="settings-section">
        <h3 className="settings-section-title">Manual Control</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-med)', marginBottom: '8px' }}>
          Lock your workspace immediately. You will need to re-authenticate to decrypt the database.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleManualLock}
          style={{ width: 'fit-content', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
        >
          🔒 Lock Database Now
        </button>
      </div>

      {message && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--accent)',
            fontSize: '14px',
            fontWeight: '500',
            marginTop: '16px',
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
};
