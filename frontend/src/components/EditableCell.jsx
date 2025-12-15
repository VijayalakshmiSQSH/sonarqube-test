import React, { useEffect, useState } from 'react'

const EditableCell = ({ value, type, onChange, min, max, isEditMode, suffix, options }) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  // Update tempValue when the external 'value' prop changes, but only if not actively editing
  // This ensures that if the parent state updates (e.g., due to another field's change),
  // the non-editing cells reflect the latest data.
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(tempValue); // Call parent's onChange first
    setEditing(false);    // Then exit editing mode
  };

  const handleCancel = () => {
    setTempValue(value); // Revert to original value
    setEditing(false);
  };

  // ✏️ Active editing mode
  if (editing) {
    if (type === "select") {
      return (
        <select
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full px-1 py-1 text-[10px] border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        >
          {Array.isArray(options) && options.length > 0 ? (
            options.map(opt => (
              <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
            ))
          ) : (
            <>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </>
          )}
        </select>
      );
    } else if (type === "date") {
      return (
        <input
          type="date"
          value={tempValue || ""}
          onChange={(e) => { const v = e.target.value; setTempValue(v); onChange(v); setEditing(false); }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full px-1 py-1 text-[10px] border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      );
    } else if (type === "number") {
      return (
        <input
          type="number"
          value={tempValue}
          onChange={(e) =>
            setTempValue(
              Math.max(min ?? 0, Math.min(max ?? 100, Number(e.target.value) || 0))
            )
          }
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full px-1 py-1 text-[10px] border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          min={min}
          max={max}
          autoFocus
        />
      );
    } else {
      // default text input (title editing, etc.)
      return (
        <input
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full px-1 py-1 text-[10px] border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      );
    }
  }

  // 🧱 Default display mode (click to enter edit mode)
  return (
    <div
      onClick={() => isEditMode && setEditing(true)}
      className={`w-full h-full px-1 py-1 rounded text-[10px] ${
        isEditMode ? "cursor-pointer hover:bg-gray-100" : "cursor-not-allowed opacity-75"
      }`}
    >
      {type === "number" ? `${value}${suffix ?? '%'}` : (
        type === "select" && Array.isArray(options) && options.length > 0
          ? (options.find(opt => String(opt.value) === String(value))?.label ?? '')
          : value
      )}
    </div>
  );
};

export default EditableCell
