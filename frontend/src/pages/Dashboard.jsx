import React, { useEffect, useState } from 'react';
import { bidsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import TopBar from '../components/TopBar';
import './Dashboard.css';

const Dashboard = () => {
  const { state, handleAsync } = useApp();
  const [stats, setStats] = useState({
    totalBids: 0,
    todaysBids: 0,
    activeBids: 0,
    overdueBids: 0
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      await handleAsync(async () => {
        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        // Fetch different bid statistics
        const [totalResponse, todaysResponse, activeResponse, overdueResponse] = await Promise.all([
          bidsAPI.getBids({ limit: 1 }), // Just to get total count
          bidsAPI.getBids({ 
            dateFrom: startOfDay.toISOString(),
            dateTo: endOfDay.toISOString(),
            limit: 1 
          }),
          bidsAPI.getBids({ 
            dateTo: new Date().toISOString(),
            limit: 1 
          }),
          bidsAPI.getBids({ 
            dateTo: startOfDay.toISOString(),
            limit: 1 
          })
        ]);

        setStats({
          totalBids: totalResponse.data.data.pagination.totalItems,
          todaysBids: todaysResponse.data.data.pagination.totalItems,
          activeBids: activeResponse.data.data.pagination.totalItems,
          overdueBids: overdueResponse.data.data.pagination.totalItems
        });
      }, 'Failed to load dashboard statistics');
    } catch (error) {
      // Error handled by handleAsync
    }
  };

  const formatLastFetch = () => {
    if (!state.lastFetchTime) return 'Never';
    const date = new Date(state.lastFetchTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  const StatCard = ({ title, value, icon, color = 'blue', subtitle }) => (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
        {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      </div>
    </div>
  );

  const getServerStatusInfo = () => {
    const health = state.serverHealth;
    if (!health) return { status: 'Unknown', color: 'gray', icon: '❓' };
    
    switch (health.status) {
      case 'healthy':
        return { status: 'Healthy', color: 'green', icon: '✅' };
      case 'degraded':
        return { status: 'Degraded', color: 'yellow', icon: '⚠️' };
      case 'error':
        return { status: 'Error', color: 'red', icon: '❌' };
      default:
        return { status: 'Unknown', color: 'gray', icon: '❓' };
    }
  };

  const getCredentialStatusInfo = () => {
    const septa = state.credentials?.SEPTA;
    if (!septa?.exists) return { status: 'Not Configured', color: 'gray', icon: '🔒' };
    if (septa.lastTestOk) return { status: 'Working', color: 'green', icon: '🔓' };
    if (septa.lastTestedAt) return { status: 'Failed', color: 'red', icon: '🔒' };
    return { status: 'Not Tested', color: 'yellow', icon: '🔐' };
  };

  const serverStatus = getServerStatusInfo();
  const credentialStatus = getCredentialStatusInfo();

  return (
    <div className="dashboard">
      <TopBar 
        title="Dashboard" 
        subtitle="Overview of SEPTA bid scraping activity"
      />
      
      <div className="dashboard-content">
        <div className="stats-grid">
          <StatCard
            title="Total Bids"
            value={stats.totalBids}
            icon="📊"
            color="blue"
            subtitle="All time"
          />
          
          <StatCard
            title="Today's Bids"
            value={stats.todaysBids}
            icon="📅"
            color="green"
            subtitle="Posted today"
          />
          
          <StatCard
            title="Active Bids"
            value={stats.activeBids}
            icon="🎯"
            color="purple"
            subtitle="Not yet due"
          />
          
          <StatCard
            title="Overdue Bids"
            value={stats.overdueBids}
            icon="⏰"
            color="red"
            subtitle="Past due date"
          />
        </div>

        <div className="status-grid">
          <div className="status-section">
            <h3>System Status</h3>
            <div className="status-cards">
              <div className={`status-card status-${serverStatus.color}`}>
                <span className="status-icon">{serverStatus.icon}</span>
                <div className="status-content">
                  <div className="status-title">Server</div>
                  <div className="status-value">{serverStatus.status}</div>
                  {state.serverHealth?.services?.mongodb && (
                    <div className="status-detail">
                      MongoDB: {state.serverHealth.services.mongodb.status}
                    </div>
                  )}
                </div>
              </div>

              <div className={`status-card status-${credentialStatus.color}`}>
                <span className="status-icon">{credentialStatus.icon}</span>
                <div className="status-content">
                  <div className="status-title">SEPTA Credentials</div>
                  <div className="status-value">{credentialStatus.status}</div>
                  {state.credentials?.SEPTA?.lastTestedAt && (
                    <div className="status-detail">
                      Last tested: {new Date(state.credentials.SEPTA.lastTestedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="activity-section">
            <h3>Recent Activity</h3>
            <div className="activity-card">
              <div className="activity-item">
                <span className="activity-icon">🔄</span>
                <div className="activity-content">
                  <div className="activity-title">Last Fetch</div>
                  <div className="activity-value">{formatLastFetch()}</div>
                  <div className="activity-detail">
                    Next automatic fetch in ~{Math.max(0, 15 - (new Date().getMinutes() % 15))} minutes
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button 
              className="action-btn action-btn-primary"
              onClick={() => window.location.href = '/hunting-data'}
            >
              📋 View All Bids
            </button>
            <button 
              className="action-btn action-btn-secondary"
              onClick={() => window.location.href = '/credentials'}
            >
              🔐 Manage Credentials
            </button>
            <button 
              className="action-btn action-btn-accent"
              onClick={loadDashboardStats}
              disabled={state.loading}
            >
              🔄 Refresh Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;