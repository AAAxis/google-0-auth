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
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
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
            width: '100%',
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
        <div className="container">
          <div className="welcome-card">
            <div className="user-info">
              <img 
                src={user.picture} 
                alt={user.name} 
                className="user-avatar"
              />
              <h1>Welcome, {user.name}!</h1>
              <p className="user-email">{user.email}</p>
            </div>
            <button 
              onClick={handleSignOut}
              className="sign-out-btn"
            >
              Sign Out
            </button>
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
    </div>
  );
}

export default App;