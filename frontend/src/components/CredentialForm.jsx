import React, { useState } from 'react';
import { credentialsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import './CredentialForm.css';

const CredentialForm = ({ credentials }) => {
  const { actions, handleAsync } = useApp();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const septaCredentials = credentials?.SEPTA || {};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      actions.setError('Both username and password are required');
      return;
    }

    try {
      await handleAsync(async () => {
        await credentialsAPI.saveSeptaCredentials(formData);
        // Reload credentials to update the UI
        await actions.loadCredentials();
        // Clear form
        setFormData({ username: '', password: '' });
        setTestResult(null);
      }, 'Failed to save SEPTA credentials');
    } catch (error) {
      // Error is handled by handleAsync
    }
  };

  const handleTest = async () => {
    if (!septaCredentials.exists) {
      actions.setError('Please save credentials first before testing');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await handleAsync(async () => {
        const response = await credentialsAPI.testSeptaCredentials();
        setTestResult(response.data.data);
        // Reload credentials to update test status
        await actions.loadCredentials();
      }, 'Failed to test SEPTA credentials');
    } catch (error) {
      setTestResult({ testPassed: false, message: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete SEPTA credentials?')) {
      return;
    }

    try {
      await handleAsync(async () => {
        await credentialsAPI.deleteSeptaCredentials();
        // Reload credentials to update the UI
        await actions.loadCredentials();
        setTestResult(null);
      }, 'Failed to delete SEPTA credentials');
    } catch (error) {
      // Error is handled by handleAsync
    }
  };

  const getStatusColor = () => {
    if (!septaCredentials.exists) return 'gray';
    if (septaCredentials.lastTestOk) return 'green';
    if (septaCredentials.lastTestedAt) return 'red';
    return 'yellow';
  };

  const getStatusText = () => {
    if (!septaCredentials.exists) return 'Not configured';
    if (septaCredentials.lastTestOk) return 'Working';
    if (septaCredentials.lastTestedAt) return 'Failed';
    return 'Not tested';
  };

  return (
    <div className="credential-form">
      <div className="form-header">
        <h3>SEPTA Credentials</h3>
        <div className={`status-badge status-${getStatusColor()}`}>
          <span className="status-dot"></span>
          {getStatusText()}
        </div>
      </div>

      {septaCredentials.exists && (
        <div className="credential-info">
          <div className="info-row">
            <span className="label">Last Updated:</span>
            <span className="value">
              {septaCredentials.updatedAt 
                ? new Date(septaCredentials.updatedAt).toLocaleString()
                : 'Never'
              }
            </span>
          </div>
          {septaCredentials.lastTestedAt && (
            <div className="info-row">
              <span className="label">Last Tested:</span>
              <span className="value">
                {new Date(septaCredentials.lastTestedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="credential-form-content">
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Enter SEPTA username"
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter SEPTA password"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️‍🗨️' : '👁️'}
            </button>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!formData.username.trim() || !formData.password.trim()}
          >
            Save Credentials
          </button>

          {septaCredentials.exists && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
              >
                Delete Credentials
              </button>
            </>
          )}
        </div>
      </form>

      {testResult && (
        <div className={`test-result ${testResult.testPassed ? 'success' : 'error'}`}>
          <span className="result-icon">
            {testResult.testPassed ? '✅' : '❌'}
          </span>
          <span>{testResult.message}</span>
        </div>
      )}

      <div className="credential-help">
        <h4>🔒 Security Information</h4>
        <ul>
          <li>Credentials are encrypted before storage</li>
          <li>Passwords are never logged or displayed</li>
          <li>Connection tests verify credential validity</li>
          <li>You can delete credentials at any time</li>
        </ul>
      </div>
    </div>
  );
};

export default CredentialForm;