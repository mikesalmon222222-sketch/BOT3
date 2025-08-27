import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Sidebar.css';

const Sidebar = () => {
  const { state } = useApp();
  const { serverHealth, credentials } = state;

  const navItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: '📊',
      description: 'Overview and statistics'
    },
    {
      path: '/hunting-data',
      label: 'Hunting Data',
      icon: '🎯',
      description: 'Browse bid listings'
    },
    {
      path: '/credentials',
      label: 'Credentials',
      icon: '🔐',
      description: 'Manage SEPTA credentials'
    }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>SEPTA Bid Scraper</h2>
        <div className="status-indicators">
          <div className={`status-dot ${serverHealth?.status === 'healthy' ? 'healthy' : 'error'}`} 
               title={`Server: ${serverHealth?.status || 'unknown'}`}>
          </div>
          <div className={`status-dot ${credentials?.SEPTA?.exists ? 'healthy' : 'warning'}`} 
               title={`SEPTA: ${credentials?.SEPTA?.exists ? 'configured' : 'not configured'}`}>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <div className="nav-content">
              <span className="nav-label">{item.label}</span>
              <span className="nav-description">{item.description}</span>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="app-info">
          <small>Version 1.0.0</small>
          {state.lastFetchTime && (
            <small>
              Last fetch: {new Date(state.lastFetchTime).toLocaleTimeString()}
            </small>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;