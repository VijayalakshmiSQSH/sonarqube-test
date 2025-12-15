import React, { useState, useEffect } from 'react'
import { parseDateToStorage, formatDateForDisplay } from '../utils/dateUtils.js'

/**
 * DateInput component that uses calendar picker only (no text input)
 * - Uses HTML5 date input (type="date")
 * - Stores: YYYY-MM-DD format (for database)
 * - Displays: dd-mm-yyyy format when not focused
 * 
 * @param {string} value - Date value in YYYY-MM-DD format (storage format)
 * @param {function} onChange - Callback with YYYY-MM-DD format value
 * @param {string} placeholder - Placeholder text (not used for date input)
 * @param {string} className - Additional CSS classes
 * @param {boolean} required - Whether field is required
 * @param {object} otherProps - Other props to pass to input
 */
const DateInput = ({ value, onChange, placeholder = 'dd-mm-yyyy', className = '', required = false, ...otherProps }) => {
  const [displayValue, setDisplayValue] = useState('')

  // Update display value when value prop changes (from storage format)
  useEffect(() => {
    if (value) {
      // For date input, we need YYYY-MM-DD format
      // If value is already in YYYY-MM-DD, use it directly
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setDisplayValue(value)
      } else {
        // Try to parse and convert to YYYY-MM-DD
        const parsed = parseDateToStorage(value)
        setDisplayValue(parsed || '')
      }
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e) => {
    const dateValue = e.target.value // Already in YYYY-MM-DD format from date input
    setDisplayValue(dateValue)
    
    if (onChange) {
      onChange(dateValue) // Pass YYYY-MM-DD format directly
    }
  }

  return (
    <div className="relative">
      <input
        type="date"
        value={displayValue}
        onChange={handleChange}
        className={className}
        required={required}
        {...otherProps}
      />
    </div>
  )
}

export default DateInput

