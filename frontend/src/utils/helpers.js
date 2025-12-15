import { TOKEN } from "./constants.js";

/**
 * Parse JWT token to extract payload
 * @param {string} token - JWT token to parse
 * @returns {object} - Parsed token payload
 */
export const parseJwt = (token) => {
  if (!token) return null;
  
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error parsing JWT token:", error);
    return null;
  }
};

/**
 * Get cookie by name
 * @param {string} cookieName - Name of the cookie to retrieve
 * @returns {string|undefined} - Cookie value or undefined
 */
export const getCookie = (cookieName) => {
  const cookies = {};
  document.cookie.split(";").forEach(function (el) {
    const [key, value] = el.split("=");
    cookies[key.trim()] = value;
  });
  return cookies[cookieName];
};

/**
 * Set cookie with optional expiration
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (optional)
 */
export const setCookie = (name, value, days = 7) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + value + expires + "; path=/; SameSite=Strict; Secure";
};

/**
 * Clear all cookies
 */
export const clearCookies = () => {
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  }
};

/**
 * Check if user is logged in by verifying token
 * @returns {boolean} - True if user is logged in
 */
export const isUserLoggedIn = () => {
  const token = getCookie(TOKEN);
  if (!token || token.toString().length === 0) {
    return false;
  }
  
  // Check if token is expired
  const payload = parseJwt(token);
  if (payload && payload.exp) {
    const now = Date.now() / 1000;
    return payload.exp > now;
  }
  
  return !!token;
};

/**
 * Get user data from token
 * @returns {object|null} - User data or null
 */
export const getUserFromToken = () => {
  const token = getCookie(TOKEN);
  if (!token) return null;
  
  return parseJwt(token);
};

/**
 * Clear authentication data
 */
export const clearAuthData = () => {
  clearCookies();
  localStorage.removeItem('user_data');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('login_method');
};

/**
 * Format user display name
 * @param {object} user - User object
 * @returns {string} - Formatted display name
 */
export const formatUserDisplayName = (user) => {
  if (!user) return "Unknown User";
  
  if (user.name) return user.name;
  if (user.given_name && user.family_name) {
    return `${user.given_name} ${user.family_name}`;
  }
  if (user.email) return user.email.split('@')[0];
  
  return "User";
};

/**
 * Get user avatar/initials
 * @param {object} user - User object
 * @returns {string} - User initials for avatar
 */
export const getUserInitials = (user) => {
  if (!user) return "?";
  
  if (user.given_name && user.family_name) {
    return `${user.given_name.charAt(0)}${user.family_name.charAt(0)}`.toUpperCase();
  }
  
  const name = user.name || user.email || "Unknown";
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  
  return name.charAt(0).toUpperCase();
};

/**
 * Validate email domain
 * @param {string} email - Email to validate
 * @param {string} allowedDomain - Allowed domain (optional)
 * @returns {boolean} - True if domain is allowed
 */
export const isValidEmailDomain = (email, allowedDomain = null) => {
  if (!email) return false;
  
  if (!allowedDomain) return true;
  
  return email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`);
};

/**
 * Handle API errors consistently
 * @param {Error} error - Error object
 * @returns {string} - User-friendly error message
 */
export const handleApiError = (error) => {
  if (!error.response) {
    return "Network error. Please check your connection.";
  }
  
  const { status, data } = error.response;
  
  switch (status) {
    case 401:
      return "Authentication failed. Please login again.";
    case 403:
      return "Access denied. You don't have permission for this action.";
    case 404:
      return "The requested resource was not found.";
    case 429:
      return "Too many requests. Please try again later.";
    case 500:
      return "Server error. Please try again later.";
    default:
      return data?.message || data?.error || "An unexpected error occurred.";
  }
};
