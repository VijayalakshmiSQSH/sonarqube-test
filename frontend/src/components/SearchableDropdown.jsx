import React, { useState, useEffect, useRef } from 'react'

const SearchableDropdown = ({
  options,
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredOptions, setFilteredOptions] = useState(options || [])
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!Array.isArray(options)) {
      setFilteredOptions([])
      return
    }
    if (searchTerm.trim() === '') {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option => {
        if (!option || typeof option !== 'object') return false
        const label = option.label || ''
        const valStr = option.value !== undefined ? String(option.value) : ''
        return label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          valStr.toLowerCase().includes(searchTerm.toLowerCase())
      })
      setFilteredOptions(filtered)
    }
  }, [searchTerm, options])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOptionSelect = (option) => {
    onChange(option.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClearSelection = () => {
    onChange('')
    setSearchTerm('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleInputFocus = () => {
    setIsOpen(true)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleInputChange = (e) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && value && searchTerm === '') {
      onChange('')
      setSearchTerm('')
    }
  }

  const getDisplayValue = () => {
    if (searchTerm !== '') {
      return searchTerm
    }
    if (value && Array.isArray(options)) {
      // Use string comparison to handle type mismatches (e.g. number vs string IDs)
      const selectedOption = options.find(option => option && String(option.value) === String(value))
      return selectedOption ? selectedOption.label || '' : ''
    }
    return ''
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800 ${
            disabled ? 'bg-slate-100 cursor-not-allowed' : ''
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClearSelection()
              }}
              className="mr-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
              if (!isOpen && inputRef.current) {
                inputRef.current.focus()
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            title={isOpen ? "Close dropdown" : "Open dropdown"}
            disabled={disabled}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {value && (
              <button
                onClick={() => handleClearSelection()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors text-slate-500 border-b border-slate-200"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear selection
                </span>
              </button>
            )}
            {!Array.isArray(filteredOptions) || filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => {
                if (!option || typeof option !== 'object') return null
                return (
                  <button
                    key={option.value !== undefined ? `${option.value}-${index}` : `opt-${index}`}
                    onClick={() => handleOptionSelect(option)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${String(value) === String(option.value) ? 'bg-blue-50 text-blue-600' : 'text-slate-900'
                      }`}
                  >
                    {option.label || 'Unknown'}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableDropdown


