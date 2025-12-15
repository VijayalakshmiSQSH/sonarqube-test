/**
 * Date utility functions for parsing and formatting dates
 * Supports multiple input formats and converts to YYYY-MM-DD for storage
 * Displays dates in dd-mm-yyyy format
 */

/**
 * Parse a date string in various formats and convert to YYYY-MM-DD
 * Supports:
 * - dd-mm-yyyy (e.g., "09-07-2025")
 * - mm-dd-yyyy (e.g., "07-09-2025")
 * - dd/mm/yyyy (e.g., "09/07/2025")
 * - mm/dd/yyyy (e.g., "07/09/2025")
 * - date month (e.g., "09 Jul", "09 July", "9 Jul", "9 July")
 * - YYYY-MM-DD (already in correct format)
 * 
 * @param {string} dateString - Date string in any supported format
 * @returns {string|null} - Date in YYYY-MM-DD format or null if invalid
 */
export const parseDateToStorage = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null
  }

  const trimmed = dateString.trim()
  if (!trimmed) {
    return null
  }

  // If already in YYYY-MM-DD format, validate and return
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1])
    const month = parseInt(isoMatch[2])
    const day = parseInt(isoMatch[3])
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return trimmed
    }
  }

  // Try parsing as date month format (e.g., "09 Jul", "09 July", "9 Jul", "9 July")
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const monthNamesFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  
  const dateMonthMatch = trimmed.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)$/i)
  if (dateMonthMatch) {
    const day = parseInt(dateMonthMatch[1])
    const monthName = dateMonthMatch[2].toLowerCase()
    const monthIndex = monthNames.indexOf(monthName)
    const monthIndexFull = monthNamesFull.indexOf(monthName)
    const month = monthIndex >= 0 ? monthIndex : monthIndexFull
    
    if (month >= 0 && day >= 1 && day <= 31) {
      // Use current year if not specified
      const currentYear = new Date().getFullYear()
      const date = new Date(currentYear, month, day)
      if (date.getDate() === day && date.getMonth() === month) {
        const year = date.getFullYear()
        const monthStr = String(month + 1).padStart(2, '0')
        const dayStr = String(day).padStart(2, '0')
        return `${year}-${monthStr}-${dayStr}`
      }
    }
  }

  // Try parsing as dd-mm-yyyy or mm-dd-yyyy
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const part1 = parseInt(dashMatch[1])
    const part2 = parseInt(dashMatch[2])
    const year = parseInt(dashMatch[3])
    
    // Try dd-mm-yyyy first (if part1 > 12, it must be day)
    if (part1 > 12 && part1 <= 31 && part2 >= 1 && part2 <= 12) {
      const date = new Date(year, part2 - 1, part1)
      if (date.getDate() === part1 && date.getMonth() === part2 - 1 && date.getFullYear() === year) {
        const monthStr = String(part2).padStart(2, '0')
        const dayStr = String(part1).padStart(2, '0')
        return `${year}-${monthStr}-${dayStr}`
      }
    }
    
    // Try mm-dd-yyyy (if part1 <= 12 and part2 <= 31)
    if (part1 >= 1 && part1 <= 12 && part2 >= 1 && part2 <= 31) {
      const date = new Date(year, part1 - 1, part2)
      if (date.getDate() === part2 && date.getMonth() === part1 - 1 && date.getFullYear() === year) {
        const monthStr = String(part1).padStart(2, '0')
        const dayStr = String(part2).padStart(2, '0')
        return `${year}-${monthStr}-${dayStr}`
      }
    }
  }

  // Try parsing as dd/mm/yyyy or mm/dd/yyyy
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1])
    const part2 = parseInt(slashMatch[2])
    const year = parseInt(slashMatch[3])
    
    // Try dd/mm/yyyy first (if part1 > 12, it must be day)
    if (part1 > 12 && part1 <= 31 && part2 >= 1 && part2 <= 12) {
      const date = new Date(year, part2 - 1, part1)
      if (date.getDate() === part1 && date.getMonth() === part2 - 1 && date.getFullYear() === year) {
        const monthStr = String(part2).padStart(2, '0')
        const dayStr = String(part1).padStart(2, '0')
        return `${year}-${monthStr}-${dayStr}`
      }
    }
    
    // Try mm/dd/yyyy (if part1 <= 12 and part2 <= 31)
    if (part1 >= 1 && part1 <= 12 && part2 >= 1 && part2 <= 31) {
      const date = new Date(year, part1 - 1, part2)
      if (date.getDate() === part2 && date.getMonth() === part1 - 1 && date.getFullYear() === year) {
        const monthStr = String(part1).padStart(2, '0')
        const dayStr = String(part2).padStart(2, '0')
        return `${year}-${monthStr}-${dayStr}`
      }
    }
  }

  // Try JavaScript Date parsing as last resort
  const parsedDate = new Date(trimmed)
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear()
    const month = parsedDate.getMonth() + 1
    const day = parsedDate.getDate()
    if (year >= 1900 && year <= 2100) {
      const monthStr = String(month).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    }
  }

  return null
}

/**
 * Format a date from YYYY-MM-DD storage format to dd-mm-yyyy display format
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Date in dd-mm-yyyy format or empty string if invalid
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return ''
  }

  const trimmed = dateString.trim()
  if (!trimmed) {
    return ''
  }

  // If already in YYYY-MM-DD format
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2]
    const day = isoMatch[3]
    return `${day}-${month}-${year}`
  }

  // Try to parse and format
  const parsedDate = parseDateToStorage(trimmed)
  if (parsedDate) {
    const parts = parsedDate.split('-')
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }

  // If it's already in dd-mm-yyyy format, return as is
  const displayMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (displayMatch) {
    return trimmed
  }

  return trimmed
}

/**
 * Format a date from YYYY-MM-DD storage format to date month format (e.g., "09 Jul")
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Date in "dd MMM" format or empty string if invalid
 */
export const formatDateToMonthFormat = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return ''
  }

  const trimmed = dateString.trim()
  if (!trimmed) {
    return ''
  }

  // Parse to YYYY-MM-DD first
  const storageDate = parseDateToStorage(trimmed)
  if (!storageDate) {
    return trimmed // Return original if can't parse
  }

  const parts = storageDate.split('-')
  if (parts.length === 3) {
    const year = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const day = parseInt(parts[2])
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dayStr = String(day).padStart(2, '0')
    return `${dayStr} ${monthNames[month]}`
  }

  return trimmed
}

