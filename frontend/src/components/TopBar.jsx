import React from 'react';
import { useApp } from '../context/AppContext';
import './TopBar.css';

const TopBar = ({ title, subtitle }) => {
  const { state, actions } = useApp();
  const { loading, error } = state;

  return (
    <div className="topbar">
      <div className="topbar-content">
        <div className="topbar-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        
        <div className="topbar-actions">
          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Loading...</span>
            </div>
          )}
          
          <button 
            className="menu-toggle"
            onClick={actions.toggleSidebar}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        </div>
      </div>
      
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button 
            className="error-close"
            onClick={actions.clearError}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default TopBar;