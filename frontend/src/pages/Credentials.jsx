import React from 'react';
import { useApp } from '../context/AppContext';
import TopBar from '../components/TopBar';
import CredentialForm from '../components/CredentialForm';
import './Credentials.css';

const Credentials = () => {
  const { state } = useApp();

  return (
    <div className="credentials">
      <TopBar 
        title="Credentials" 
        subtitle="Manage SEPTA portal credentials for automated bid scraping"
      />
      
      <div className="credentials-content">
        <div className="credentials-intro">
          <div className="intro-card">
            <div className="intro-icon">🔐</div>
            <div className="intro-content">
              <h3>Secure Credential Management</h3>
              <p>
                Store your SEPTA portal credentials securely to enable automated bid scraping. 
                All credentials are encrypted before storage and never exposed in logs or frontend code.
              </p>
            </div>
          </div>
        </div>

        <div className="credentials-form-section">
          <CredentialForm credentials={state.credentials} />
        </div>

        <div className="credentials-info">
          <div className="info-grid">
            <div className="info-card">
              <div className="info-header">
                <span className="info-icon">🛡️</span>
                <h4>Security Features</h4>
              </div>
              <ul className="info-list">
                <li>AES-256-GCM encryption for all stored credentials</li>
                <li>Credentials never logged or exposed in frontend</li>
                <li>Secure API endpoints with proper validation</li>
                <li>Optional credential testing without storage</li>
              </ul>
            </div>

            <div className="info-card">
              <div className="info-header">
                <span className="info-icon">🔄</span>
                <h4>How It Works</h4>
              </div>
              <ul className="info-list">
                <li>Enter your SEPTA portal username and password</li>
                <li>Credentials are encrypted and stored securely</li>
                <li>Test connection to verify credentials work</li>
                <li>Automated scraping uses stored credentials</li>
              </ul>
            </div>

            <div className="info-card">
              <div className="info-header">
                <span className="info-icon">📋</span>
                <h4>SEPTA Portal Access</h4>
              </div>
              <ul className="info-list">
                <li>Valid SEPTA vendor portal account required</li>
                <li>Credentials used only for bid information access</li>
                <li>No data modification or unauthorized actions</li>
                <li>Regular connection tests ensure validity</li>
              </ul>
            </div>

            <div className="info-card">
              <div className="info-header">
                <span className="info-icon">⚙️</span>
                <h4>Troubleshooting</h4>
              </div>
              <ul className="info-list">
                <li>Connection failures may indicate invalid credentials</li>
                <li>SEPTA portal changes may require credential updates</li>
                <li>Delete and re-enter credentials if issues persist</li>
                <li>Contact system admin for technical support</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="credentials-footer">
          <div className="footer-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <h4>Important Security Notice</h4>
              <p>
                Never share your SEPTA portal credentials with unauthorized users. 
                These credentials provide access to your vendor account and should be 
                treated with the same security as your banking information.
              </p>
              <p>
                If you suspect your credentials have been compromised, immediately 
                change your SEPTA portal password and update the credentials here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Credentials;