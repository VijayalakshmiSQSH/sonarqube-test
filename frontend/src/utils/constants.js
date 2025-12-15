// SSO and Authentication Constants
export const COMPANY_CAPTION = "Digital | Cloud | Data | Cybersecurity";
export const COMPANY_NAME = "SquareShift";
export const IMAGE_URL = "https://static.wixstatic.com/media/bd5ec7_5eb8282503b74bbdbf0c66ab1256d752~mv2.png/v1/fill/w_272,h_84,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/logo%20gray.png";
export const TOKEN = "auth_token";

// API Base URL
export const getApiBaseUrl = () => {
  // Check if we have the production environment variable set
  if (import.meta.env.VITE_BACKEND_BASE_URL) {
    return import.meta.env.VITE_BACKEND_BASE_URL;
  }

  // Check if we're in production mode
  if (import.meta.env.VITE_APP_ENV === 'production') {
    return 'https://employee-app-475124303668.us-central1.run.app';
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

    if (isLocalhost) {
      return 'http://localhost:8080';  // local dev backend
    }

    // If not localhost, assume production
    return 'https://employee-app-475124303668.us-central1.run.app';
  }

  return 'https://employee-app-475124303668.us-central1.run.app'; // fallback for SSR
};

// API Endpoints
export const API_ENDPOINTS = {
  SSO_SUCCESS: '/auth/sso-success',
  SSO_VALIDATE: '/auth/validate',
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh'
};

// OAuth Configuration
export const OAUTH_CONFIG = {
  HOSTED_DOMAIN: "squareshift.co",
  SCOPES: ['openid', 'email', 'profile']
};

// Error Messages
export const ERROR_MESSAGES = {
  LOGIN_FAILED: "Login failed. Please try again.",
  SSO_FAILED: "SSO authentication failed. Please try again.",
  TOKEN_EXPIRED: "Your session has expired. Please login again.",
  UNAUTHORIZED_DOMAIN: "Unauthorized domain. Please use your organization email.",
  NETWORK_ERROR: "Network error. Please check your connection and try again."
};

// Storage Keys
export const STORAGE_KEYS = {
  USER_DATA: 'user_data',
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  LOGIN_METHOD: 'login_method'
};
