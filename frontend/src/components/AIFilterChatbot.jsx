import React, { useState, useRef, useEffect } from "react";
import { getApiBaseUrl, TOKEN } from "../utils/constants";
import { getCookie } from "../utils/helpers";

const AIFilterChatbot = ({ onClose, onApplyFilters, tableName, defaultMessage }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "ai",
      content: defaultMessage,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [readyToApply, setReadyToApply] = useState(false);
  const [pendingFilters, setPendingFilters] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    if (!isMinimized) {
      inputRef.current?.focus();
    }
  }, [isMinimized]);

  const addMessage = (type, content) => {
    const newMessage = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Add user message
    addMessage("user", userMessage);

    try {
      // Get conversation history for context - last 6 messages for better context
      const conversationHistory = messages.slice(-6).map((msg) => ({
        type: msg.type,
        content: msg.content,
      }));
      const token = getCookie(TOKEN);

      const response = await fetch(
        `${getApiBaseUrl()}/api/ai/filter`,
        {
          // Call AI filter API
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: userMessage,
            history: conversationHistory,
            tableName
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        addMessage("ai", `Sorry, I encountered an error: ${result.error}`);
      } else if (result.clarification) {
        // AI needs clarification
        addMessage("ai", result.clarification);
        setReadyToApply(false);
        setPendingFilters(null);
      } else if (result.filters && result.filters.length > 0) {
        // AI successfully parsed the query and generated filters
        addMessage(
          "ai",
          result.message ||
          "I understand your request. Ready to apply these filters?"
        );
        setReadyToApply(true);
        console.log(result.filters);
        setPendingFilters(result.filters);
      } else if (result.message) {
        // Conversational response (no filters generated)
        addMessage("ai", result.message);
        setReadyToApply(false);
        setPendingFilters(null);
      } else {
        addMessage(
          "ai",
          "I'm not sure how to help with that. Could you try rephrasing your request?"
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      addMessage(
        "ai",
        "Sorry, I'm having trouble processing your request right now. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleApplyFilters = async () => {
    if (pendingFilters) {
      // Set applying state to disable inputs/buttons
      setIsApplying(true);

      // Reset the ready state immediately to disable the button
      setReadyToApply(false);
      const filtersToApply = pendingFilters;
      setPendingFilters(null);

      // Add a loading message and store its ID
      const loadingMsg = addMessage("ai", "⏳ Applying filters...");

      // Call the async onApplyFilters and wait for it to complete
      try {
        await onApplyFilters(filtersToApply);

        // Remove loading message
        setMessages(prev => prev.filter(msg => msg.id !== loadingMsg.id));

        // Add confirmation message only after data is loaded
        addMessage("ai", "✅ Filters applied successfully! You can continue asking me to refine the search or apply additional filters.");
      } catch (error) {
        console.error('Error applying filters:', error);

        // Remove loading message
        setMessages(prev => prev.filter(msg => msg.id !== loadingMsg.id));

        addMessage("ai", "❌ Failed to apply filters. Please try again.");
      } finally {
        setIsApplying(false);
      }
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        type: "ai",
        content: defaultMessage,
        timestamp: new Date(),
      },
    ]);
    setReadyToApply(false);
    setPendingFilters(null);
  };

  const clearAIFilters = () => {
    // Clear AI filters and reset to show all employees
    onApplyFilters([]); // Pass empty array to clear filters
    clearChat();
    addMessage("ai", "✅ AI filters cleared! Showing all employees.");
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // If minimized, show only the floating icon
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 group"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {/* Notification dot if there are pending filters */}
          {readyToApply && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          )}
        </button>
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          AI Filter Assistant
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-80 h-[500px] flex flex-col border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-green-700 to-green-800 text-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-white hover:text-gray-200 transition-colors p-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === "user" ? "justify-end" : "justify-start"
                }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${message.type === "user"
                  ? "bg-green-800 text-white"
                  : "bg-gray-100 text-gray-800"
                  }`}
              >
                <p className="text-xs leading-relaxed">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${message.type === "user" ? "text-blue-100" : "text-gray-500"
                    }`}
                >
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 rounded-lg px-3 py-2 max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600">
                    AI is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me to filter employees..."
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent resize-none"
                rows="2"
                disabled={isLoading || isApplying}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading || isApplying}
              className="px-3 py-1 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isLoading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-2">
            <div className="flex gap-2">
              <button
                onClick={clearChat}
                disabled={isApplying}
                className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Clear Chat
              </button>

              <button
                onClick={clearAIFilters}
                disabled={isApplying}
                className="text-xs text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Clear Filters
              </button>
            </div>

            {readyToApply && (
              <button
                onClick={handleApplyFilters}
                disabled={isApplying}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Apply Filter
              </button>
            )}
          </div>

          {/* Help Text */}
          {/* <div className="mt-2 text-xs text-gray-500">
            <p>🔄 You can continue refining your search after applying filters</p>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default AIFilterChatbot;
