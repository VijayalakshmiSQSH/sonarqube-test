import axios from 'axios';
import { API_ENDPOINTS, ERROR_MESSAGES, TOKEN } from './constants.js';
import { parseJwt, getCookie, setCookie, handleApiError } from './helpers.js';

// Create axios instance with default config
const getBaseURL = () => {
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

const baseURL = getBaseURL();

const apiClient = axios.create({
  baseURL: baseURL,
  timeout: 30000, // Default timeout for regular API calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getCookie(TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function for file uploads with extended timeout
export const uploadFile = async (url, formData, onUploadProgress = null) => {
  return apiClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 120000, // 2 minutes for file uploads
    onUploadProgress: onUploadProgress
  });
};

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const errorMessage = handleApiError(error);
    console.error('API Error:', errorMessage);

    // Handle token expiration
    if (error.response?.status === 401) {
      const loginMethod = localStorage.getItem('login_method');

      // For Google SSO, redirect to login since we can't refresh Google tokens
      if (loginMethod === 'google_sso') {
        console.warn('Service token expired, redirecting to login');
        SSOAuthService.clearAuthData();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // For email/password, try to refresh token
      if (loginMethod === 'email_password') {
        try {
          await SSOAuthService.refreshToken();
          // Retry the original request
          return apiClient.request(error.config);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          SSOAuthService.clearAuthData();
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

/**
 * SSO Authentication Service
 */
export class SSOAuthService {
  /**
   * Handle successful Google OAuth login
   * @param {object} googleResponse - Response from Google OAuth
   * @returns {Promise<object>} - Authentication result
   */
  static async handleGoogleSSOSuccess(googleResponse) {
    try {
      const payload = parseJwt(googleResponse.credential);

      if (!payload) {
        throw new Error('Invalid token payload');
      }

      // Validate domain if required
      const allowedDomain = import.meta.env.VITE_ALLOWED_DOMAIN || 'squareshift.co';
      if (allowedDomain && !payload.email.endsWith(`@${allowedDomain}`)) {
        throw new Error(ERROR_MESSAGES.UNAUTHORIZED_DOMAIN);
      }

      // Send credential to backend for validation

      const response = await apiClient.post(API_ENDPOINTS.SSO_SUCCESS, {
        email: payload.email,
      }, {
        headers: {
          Authorization: `Bearer ${googleResponse.credential}`,
        },
      });

      const { token: serviceToken } = response.data;

      if (!serviceToken) {
        throw new Error('No service token returned from backend');
      }

      // Decode the service token to get permissions and role
      const servicePayload = parseJwt(serviceToken);
      
      // Store service token in secure cookie (not the Google credential)
      setCookie(TOKEN, serviceToken, 7); // 7 days expiry

      // Store user data in localStorage for quick access (without permissions - they come from user_info API)
      const userData = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
        email_verified: payload.email_verified,
        loginMethod: 'google_sso',
        loginTime: Date.now(),
        // Note: permissions are now fetched separately from user_info API with encryption
        role: servicePayload.role, // Keep role for reference
      };

      localStorage.setItem('user_data', JSON.stringify(userData));
      localStorage.setItem('login_method', 'google_sso');

      return {
        success: true,
        user: userData,
        token: serviceToken,
        googleCredential: googleResponse.credential,
      };
    } catch (error) {
      console.error('SSO Login Error:', error);
      throw new Error(error.message || ERROR_MESSAGES.SSO_FAILED);
    }
  }

  /**
   * Handle email/password login
   * @param {object} credentials - Email and password
   * @returns {Promise<object>} - Authentication result
   */
  static async handleEmailLogin(credentials) {
    try {
      const response = await apiClient.post(API_ENDPOINTS.AUTH_LOGIN, {
        email: credentials.email,
        password: credentials.password,
      });

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      // Store token in secure cookie
      setCookie(TOKEN, token, 7);

      // Store user data (without permissions - they come from user_info API)
      const userData = {
        ...user,
        loginMethod: 'email_password',
        loginTime: Date.now(),
        // Note: permissions are now fetched separately from user_info API with encryption
      };

      localStorage.setItem('user_data', JSON.stringify(userData));
      localStorage.setItem('login_method', 'email_password');

      return {
        success: true,
        user: userData,
        token,
      };
    } catch (error) {
      console.error('Email Login Error:', error);
      throw new Error(error.response?.data?.message || ERROR_MESSAGES.LOGIN_FAILED);
    }
  }

  /**
   * Validate current token with backend
   * @returns {Promise<object>} - Validation result
   */
  static async validateToken() {
    try {
      const token = getCookie(TOKEN);
      if (!token) {
        throw new Error('No token found');
      }

      const response = await apiClient.get(API_ENDPOINTS.SSO_VALIDATE);
      return {
        valid: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Token Validation Error:', error);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Logout user and clear all auth data
   * @returns {Promise<void>}
   */
  static async logout() {
    try {
      // Call backend logout endpoint
      await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT);
    } catch (error) {
      console.warn('Backend logout failed:', error);
      // Continue with local logout even if backend fails
    } finally {
      // Clear all local auth data
      this.clearAuthData();
    }
  }

  /**
   * Clear local authentication data
   */
  static clearAuthData() {
    // Clear cookies
    document.cookie = `${TOKEN}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;

    // Clear localStorage
    localStorage.removeItem('user_data');
    localStorage.removeItem('login_method');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  /**
   * Refresh authentication token
   * @returns {Promise<object>} - Refresh result
   */
  static async refreshToken() {
    try {
      const response = await apiClient.post(API_ENDPOINTS.AUTH_REFRESH);
      const { token } = response.data;

      if (token) {
        setCookie(TOKEN, token, 7);
        return { success: true, token };
      }

      throw new Error('No token in refresh response');
    } catch (error) {
      console.error('Token Refresh Error:', error);
      throw new Error('Failed to refresh authentication');
    }
  }

  /**
   * Get current user data
   * @returns {object|null} - Current user data
   */
  static getCurrentUser() {
    try {
      const userData = localStorage.getItem('user_data');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} - Authentication status
   */
  static isAuthenticated() {
    const token = getCookie(TOKEN);
    const userData = this.getCurrentUser();

    if (!token || !userData) {
      return false;
    }

    // For service tokens, we'll validate with the backend
    // For Google credentials, check expiration
    const loginMethod = localStorage.getItem('login_method');

    if (loginMethod === 'google_sso') {
      // For Google SSO, the token is now a service token, not a Google credential
      // We'll let the backend handle validation
      return true;
    } else {
      // For email/password login, check JWT expiration
      const payload = parseJwt(token);
      if (payload && payload.exp) {
        const now = Date.now() / 1000;
        return payload.exp > now;
      }
      return true;
    }
  }
}

export default apiClient;
