import React, { useState, useCallback } from "react";
import { ToastContext } from "../context/ToastContext";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const vpToast = {
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info")
  };

  return (
    <ToastContext.Provider value={vpToast}>
      {children}
      <div className="toast-container" role="region" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            <i
              className={`fa-solid ${
                toast.type === "success"
                  ? "fa-circle-check"
                  : toast.type === "error"
                  ? "fa-circle-exclamation"
                  : "fa-circle-info"
              }`}
              style={{
                color:
                  toast.type === "success"
                    ? "var(--brand-success)"
                    : toast.type === "error"
                    ? "var(--brand-danger)"
                    : "var(--brand-secondary)"
              }}
            ></i>
            <span>{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
