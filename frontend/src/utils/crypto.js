/**
 * Frontend encryption/decryption utilities for permissions
 * Uses XOR cipher to match backend implementation
 */

class CryptoManager {
  constructor() {
    // This should match the backend ENCRYPTION_SECRET
    this.secretKey = 'default-secret-key-change-in-production';
  }

  /**
   * Generate a key from user email and secret (matches backend)
   * @param {string} email - User's email
   * @returns {Promise<Uint8Array>} - The derived key
   */
  async getKeyFromEmail(email) {
    const combined = `${email}:${this.secretKey}`;
    const hash = await this.sha256(combined);
    return new Uint8Array(hash);
  }

  /**
   * Simple SHA-256 implementation
   * @param {string} str - String to hash
   * @returns {ArrayBuffer} - SHA-256 hash
   */
  async sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return hashBuffer;
  }

  /**
   * XOR encrypt/decrypt data with key
   * @param {Uint8Array} data - Data to encrypt/decrypt
   * @param {Uint8Array} key - Key to use
   * @returns {Uint8Array} - Encrypted/decrypted data
   */
  xorEncryptDecrypt(data, key) {
    const result = new Uint8Array(data.length);
    const keyLen = key.length;
    
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % keyLen];
    }
    
    return result;
  }

  /**
   * Decrypt data using XOR cipher
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} userEmail - User's email to use as decryption key
   * @returns {Promise<any>} - The decrypted data
   */
  async decrypt(encryptedData, userEmail) {
    try {
      // Decode base64
      const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
      
      // Get decryption key from user email
      const key = await this.getKeyFromEmail(userEmail);
      
      // Decrypt the data
      const decryptedBuffer = this.xorEncryptDecrypt(encryptedBuffer, key);
      
      // Convert to string and parse JSON
      const decryptedString = new TextDecoder().decode(decryptedBuffer);
      
      return JSON.parse(decryptedString);
      
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Convert base64 string to Uint8Array
   * @param {string} base64 - Base64 encoded string
   * @returns {Uint8Array} - The decoded data
   */
  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Decrypt permissions list
   * @param {string} encryptedPermissions - Base64 encoded encrypted permissions
   * @param {string} userEmail - User's email to use as decryption key
   * @returns {Promise<string[]>} - Array of permission strings
   */
  async decryptPermissions(encryptedPermissions, userEmail) {
    const decryptedData = await this.decrypt(encryptedPermissions, userEmail);
    
    if (!Array.isArray(decryptedData)) {
      throw new Error('Decrypted data is not an array of permissions');
    }
    
    return decryptedData;
  }
}

// Create a global instance
const cryptoManager = new CryptoManager();

// Convenience functions
export const decryptPermissions = (encryptedPermissions, userEmail) => {
  return cryptoManager.decryptPermissions(encryptedPermissions, userEmail);
};

export const decryptData = (encryptedData, userEmail) => {
  return cryptoManager.decrypt(encryptedData, userEmail);
};

export default cryptoManager;
