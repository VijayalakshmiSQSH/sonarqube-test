import React from 'react'
import { formatDateForDisplay } from '../utils/dateUtils.js'

/**
 * DateHistoryTracker Component
 * Displays a modal showing the history of date changes for a participant
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback to close the modal
 * @param {object} participant - The participant object
 * @param {array} history - Array of date change history entries
 * @param {boolean} loading - Whether history is being loaded
 */
const DateHistoryTracker = ({ isOpen, onClose, participant, history = [], loading = false }) => {
  if (!isOpen) return null

  // Debug: Log the history to help diagnose issues
  React.useEffect(() => {
    if (isOpen && history && history.length > 0) {
      console.log('DateHistoryTracker - History:', history)
      console.log('DateHistoryTracker - Participant:', participant)
      console.log('DateHistoryTracker - History length:', history?.length)
      console.log('DateHistoryTracker - First entry:', history[0])
      console.log('DateHistoryTracker - First entry keys:', Object.keys(history[0] || {}))
    }
  }, [isOpen, history, participant])

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    try {
      // Handle timestamps with or without timezone indicator
      // If timestamp doesn't end with 'Z' or timezone offset, treat it as UTC
      let dateString = timestamp
      if (!timestamp.endsWith('Z') && !timestamp.match(/[+-]\d{2}:\d{2}$/)) {
        // If no timezone info, assume it's UTC and add 'Z'
        dateString = timestamp + 'Z'
      }
      
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp)
        return timestamp // Return original if parsing failed
      }
      
      // Format in local timezone (toLocaleString automatically converts UTC to local time)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    } catch (e) {
      console.error('Error formatting timestamp:', timestamp, e)
      return timestamp
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Date Change History
            </h2>
            {participant && (
              <p className="text-sm text-slate-600 mt-1">
                {participant.employee_name} - {participant.employee_title}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <svg className="animate-spin h-12 w-12 text-slate-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-slate-500 text-lg">Loading date history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-slate-500 text-lg">No date changes recorded yet</p>
              <p className="text-slate-400 text-sm mt-2">Date changes will appear here once you start editing dates</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Module</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Submodule</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider ">Field</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Previous Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Updated Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Changed At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {history.map((entry, index) => {
                    // Handle both camelCase (from frontend) and snake_case (from backend) field names
                    const moduleName = entry.module_name || entry.moduleName || '-'
                    const submoduleName = entry.submodule_name || entry.submoduleName || '-'
                    const field = entry.field || '-'
                    const oldValue = entry.old_value || entry.oldValue || null
                    const newValue = entry.new_value || entry.newValue || null
                    const timestamp = entry.timestamp || entry.changed_at || null
                    
                    return (
                      <tr key={entry.id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {moduleName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {submoduleName}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium whitespace-nowrap">
                            {field}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {oldValue ? formatDateForDisplay(oldValue) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-green-700">
                            {newValue ? formatDateForDisplay(newValue) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatTimestamp(timestamp)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DateHistoryTracker

