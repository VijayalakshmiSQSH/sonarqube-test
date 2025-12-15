import React from 'react'

const LoadingSpinner = ({ message = "Loading...", size = "large", fullScreen = false }) => {
  const sizeClasses = {
    small: "w-4 h-4",
    medium: "w-6 h-6", 
    large: "w-8 h-8",
    xlarge: "w-12 h-12"
  }

  const containerClasses = fullScreen 
    ? "flex flex-col items-center justify-center min-h-screen space-y-6"
    : "flex flex-col items-center justify-center min-h-[400px] space-y-6"

  return (
    <div className={containerClasses}>
      {/* Equalizer-style loading animation */}
      <div className="flex items-end space-x-1">
        <div className={`${sizeClasses[size]} bg-green-800 rounded-t-sm animate-pulse`} style={{ animationDelay: '0ms', animationDuration: '1s' }}></div>
        <div className={`${sizeClasses[size]} bg-green-800 rounded-t-sm animate-pulse`} style={{ animationDelay: '100ms', animationDuration: '1s' }}></div>
        <div className={`${sizeClasses[size]} bg-green-800 rounded-t-sm animate-pulse`} style={{ animationDelay: '200ms', animationDuration: '1s' }}></div>
        <div className={`${sizeClasses[size]} bg-green-800 rounded-t-sm animate-pulse`} style={{ animationDelay: '300ms', animationDuration: '1s' }}></div>
        <div className={`${sizeClasses[size]} bg-green-800 rounded-t-sm animate-pulse`} style={{ animationDelay: '400ms', animationDuration: '1s' }}></div>
        <div className={`${sizeClasses[size]} bg-green-800 rounded-t-sm animate-pulse`} style={{ animationDelay: '500ms', animationDuration: '1s' }}></div>
      </div>

      {/* Loading text */}
      <div className="text-center">
        <div className="text-lg font-medium text-slate-700">
          {message}
        </div>
      </div>
    </div>
  )
}

export default LoadingSpinner
