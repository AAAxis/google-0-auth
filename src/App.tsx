/// <reference types="google.accounts" />

import React, { useEffect, useState, useCallback } from 'react';
import './App.css';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

declare global {
  interface Window {
    google: typeof google;
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Email verification states
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailData, setEmailData] = useState({
    email: '',
    userName: '',
    otpCode: '',
    enteredOtp: ''
  });
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  

  const handleCredentialResponse = useCallback((response: google.accounts.id.CredentialResponse) => {
    setIsLoading(true);
    setError(null);

    try {
      // Decode the JWT token to get user information
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      
      const userData: User = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
      };

      setUser(userData);
      
      // Store user data in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(userData));
      
    } catch (err) {
      setError('Failed to process login response');
      console.error('Error processing credential response:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeGoogleSignIn = useCallback(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    
    // Debug logging
    console.log('Google Client ID:', clientId ? 'Loaded' : 'Missing');
    console.log('Client ID value:', clientId);
    console.log('Current domain:', window.location.origin);
    
    if (!clientId) {
      setError('Google Client ID not configured');
      return;
    }
    
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render the sign-in button
      const buttonElement = document.getElementById('google-signin-button');
      if (buttonElement) {
        window.google.accounts.id.renderButton(
          buttonElement,
          {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
          }
        );
      }
    }
  }, [handleCredentialResponse]);

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.head.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [initializeGoogleSignIn]);

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('user');
    
    // Sign out from Google
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  // Generate 6-digit OTP code
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Send email with OTP
  const sendEmail = async () => {
    if (!emailData.email || !emailData.userName) {
      setEmailError('Please fill in all required fields');
      return;
    }

    setIsEmailLoading(true);
    setEmailError(null);
    setEmailSent(false);

    try {
      const otpCode = generateOTP();
      
      // Update state with generated OTP
      setEmailData(prev => ({ ...prev, otpCode }));
      
      // Log the OTP to console as requested
      console.log(`Generated OTP: ${otpCode}`);
      console.log(`Sending email to: ${emailData.email}`);
      
      // Construct the API URL with parameters
      const apiUrl = new URL('https://smtp.roamjet.net/api/email/send');
      apiUrl.searchParams.set('email', emailData.email);
      apiUrl.searchParams.set('project_id', 'u2LpTkbed1n7U4ff607n');
      apiUrl.searchParams.set('template_id', 'rAASNbN1sSGi9hZZjA9m');
      apiUrl.searchParams.set('user_name', emailData.userName);
      apiUrl.searchParams.set('otp_code', otpCode);

      console.log('API URL:', apiUrl.toString());

      // Use hidden iframe to bypass CORS and actually send the email
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = apiUrl.toString();
      
      iframe.onload = () => {
        setEmailSent(true);
        console.log('Email sent successfully!');
        document.body.removeChild(iframe);
      };
      
      iframe.onerror = () => {
        setEmailError('Failed to send email. Please try again.');
        document.body.removeChild(iframe);
      };
      
      document.body.appendChild(iframe);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email');
      console.error('Email sending error:', err);
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Handle form input changes
  const handleEmailInputChange = (field: string, value: string) => {
    setEmailData(prev => ({ ...prev, [field]: value }));
    setEmailError(null);
    // Only reset emailSent if we're changing email or userName, not OTP
    if (field === 'email' || field === 'userName') {
      setEmailSent(false);
    }
    setOtpVerified(false);
  };

  // Verify OTP
  const verifyOTP = () => {
    if (emailData.enteredOtp === emailData.otpCode) {
      setOtpVerified(true);
      setEmailError(null);
      
      // Create user with email verification data and redirect to dashboard
      const verifiedUser: User = {
        id: 'email-' + Date.now(),
        name: emailData.userName,
        email: emailData.email,
        picture: `https://via.placeholder.com/80x80/007acc/ffffff?text=${emailData.userName.charAt(0).toUpperCase()}`
      };
      
      setUser(verifiedUser);
      localStorage.setItem('user', JSON.stringify(verifiedUser));
      
      // Close email verification dialog and redirect to dashboard
      setShowEmailVerification(false);
      
      // Reset email data
      setEmailData({
        email: '',
        userName: '',
        otpCode: '',
        enteredOtp: ''
      });
      setEmailSent(false);
      setEmailError(null);
      
    } else {
      setEmailError('Invalid OTP code. Please try again.');
    }
  };

  // Open email verification dialog
  const openEmailVerification = () => {
    setShowEmailVerification(true);
    setEmailError(null);
    setEmailSent(false);
    setOtpVerified(false);
  };

  // Close email verification dialog
  const closeEmailVerification = () => {
    setShowEmailVerification(false);
    setEmailData({
      email: '',
      userName: '',
      otpCode: '',
      enteredOtp: ''
    });
    setEmailError(null);
    setEmailSent(false);
    setOtpVerified(false);
  };

  // Check for existing user session on component mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  if (user) {
    return (
      <div className="app">
        <div className="dashboard-container">
          <div className="welcome-card">
            <div className="user-info">
              <img 
                src={user.picture} 
                alt={user.name} 
                className="user-avatar"
              />
              <div>
                <h1>Welcome, {user.name}!</h1>
                <p className="user-email">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              className="sign-out-btn"
            >
              Sign Out
            </button>
          </div>
          
          <div className="dashboard">
            <div className="sidebar">
              <nav>
                <ul className="sidebar-nav">
                  <li>
                    <a href="#dashboard" className="active">
                      <span className="nav-icon">📊</span>
                      Dashboard
                    </a>
                  </li>
                  <li>
                    <a href="#projects">
                      <span className="nav-icon">📁</span>
                      Projects
                    </a>
                  </li>
                  <li>
                    <a href="#analytics">
                      <span className="nav-icon">📈</span>
                      Analytics
                    </a>
                  </li>
                  <li>
                    <a href="#settings">
                      <span className="nav-icon">⚙️</span>
                      Settings
                    </a>
                  </li>
                  <li>
                    <a href="#help">
                      <span className="nav-icon">❓</span>
                      Help
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
            
            <div className="main-content">
              <div className="dashboard-header">
                <div>
                  <h2 className="dashboard-title">Dashboard</h2>
                  <p className="dashboard-subtitle">Welcome back! Here's what's happening.</p>
                </div>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">24</div>
                  <div className="stat-label">Active Projects</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">1,247</div>
                  <div className="stat-label">Total Views</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">89%</div>
                  <div className="stat-label">Success Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">$12,450</div>
                  <div className="stat-label">Revenue</div>
                </div>
              </div>
              
              <div className="content-grid">
                <div className="content-card">
                  <h3>Recent Activity</h3>
                  <p>• Project "Website Redesign" completed</p>
                  <p>• New user registered</p>
                  <p>• Analytics report generated</p>
                  <p>• System backup completed</p>
                </div>
                <div className="content-card">
                  <h3>Quick Actions</h3>
                  <p>• Create new project</p>
                  <p>• View analytics</p>
                  <p>• Export data</p>
                  <p>• Update profile</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="login-card">
          <div className="login-header">
            <h1>Welcome</h1>
            <p>Sign in to continue to your account</p>
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="login-content">
            <button 
              onClick={openEmailVerification}
              className="email-verification-btn"
            >
              📧 Sign in with Email Verification
            </button>

            <div id="google-signin-button"></div>
            
            {isLoading && (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Signing you in...</p>
              </div>
            )}
          </div>
          
          <div className="login-footer">
            <p>
              By signing in, you agree to our{' '}
              <a href="/terms" className="link">Terms of Service</a> and{' '}
              <a href="/privacy" className="link">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>

      {/* Email Verification Dialog */}
      {showEmailVerification && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📧 Email Verification</h3>
              <button 
                onClick={closeEmailVerification}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              {!emailSent ? (
                <div>
                  <p>Enter your details to receive an OTP code via email:</p>
                  
                  <div className="form-group">
                    <label>Email Address:</label>
                    <input
                      type="email"
                      value={emailData.email}
                      onChange={(e) => handleEmailInputChange('email', e.target.value)}
                      placeholder="Enter your email"
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Your Name:</label>
                    <input
                      type="text"
                      value={emailData.userName}
                      onChange={(e) => handleEmailInputChange('userName', e.target.value)}
                      placeholder="Enter your name"
                      className="form-input"
                    />
                  </div>

                  {emailError && (
                    <div className="error-message">
                      {emailError}
                    </div>
                  )}

                  <button
                    onClick={sendEmail}
                    disabled={isEmailLoading || !emailData.email || !emailData.userName}
                    className="send-email-btn"
                  >
                    {isEmailLoading ? (
                      <>
                        <span className="spinner"></span>
                        Sending OTP...
                      </>
                    ) : (
                      'Send OTP Code'
                    )}
                  </button>
                </div>
              ) : !otpVerified ? (
                <div>
                  <div className="success-message">
                    ✅ OTP sent to {emailData.email}
                  </div>
                  
                  <p>Enter the 6-digit code you received:</p>
                  
                  <div className="form-group">
                    <label>OTP Code:</label>
                    <input
                      type="text"
                      value={emailData.enteredOtp}
                      onChange={(e) => handleEmailInputChange('enteredOtp', e.target.value)}
                      placeholder="Enter 6-digit code"
                      className="form-input otp-input"
                      maxLength={6}
                    />
                  </div>


                  {emailError && (
                    <div className="error-message">
                      {emailError}
                    </div>
                  )}

                  <div className="modal-actions">
                    <button
                      onClick={verifyOTP}
                      disabled={emailData.enteredOtp.length !== 6}
                      className="verify-otp-btn"
                    >
                      Verify & Sign In
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;