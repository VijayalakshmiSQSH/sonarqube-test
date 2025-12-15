/**
 * Permission utility functions for RBAC
 * DEPRECATED: Use usePermissions() from PermissionContext instead
 * This file is kept for backward compatibility but should be replaced
 */

import { usePermissions } from '../context/PermissionContext.jsx';

/**
 * Check if user has a specific permission
 * @param {string} permission - The permission to check
 * @returns {boolean} - True if user has permission, false otherwise
 * @deprecated Use usePermissions().hasPermission() instead
 */
export const hasPermission = (permission) => {
  console.warn('permissionUtils.hasPermission() is deprecated. Use usePermissions().hasPermission() from PermissionContext instead.');
  
  try {
    // Fallback to localStorage for backward compatibility
    // Try both 'user' and 'user_data' keys for compatibility
    const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
    
    // Check if user has the required permission
    return user.permissions?.includes(permission) || false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Check if user has any of the provided permissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} - True if user has any of the permissions
 * @deprecated Use usePermissions().hasAnyPermission() instead
 */
export const hasAnyPermission = (permissions) => {
  console.warn('permissionUtils.hasAnyPermission() is deprecated. Use usePermissions().hasAnyPermission() from PermissionContext instead.');
  return permissions.some(permission => hasPermission(permission));
};

/**
 * Check if user has all of the provided permissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} - True if user has all permissions
 * @deprecated Use usePermissions().hasAllPermissions() instead
 */
export const hasAllPermissions = (permissions) => {
  console.warn('permissionUtils.hasAllPermissions() is deprecated. Use usePermissions().hasAllPermissions() from PermissionContext instead.');
  return permissions.every(permission => hasPermission(permission));
};

/**
 * Get all user permissions
 * @returns {string[]} - Array of user permissions
 * @deprecated Use usePermissions().permissions instead
 */
export const getUserPermissions = () => {
  console.warn('permissionUtils.getUserPermissions() is deprecated. Use usePermissions().permissions from PermissionContext instead.');
  try {
    // Try both 'user' and 'user_data' keys for compatibility
    const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
    return user.permissions || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
};

