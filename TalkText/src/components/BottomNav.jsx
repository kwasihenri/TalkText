import React from "react";
import { NavLink } from "react-router-dom";

export default function BottomNav() {
  const navItems = [
    {
      to: "/speech-to-text",
      label: "Dictate",
      icon: "fa-solid fa-microphone-lines",
      badge: null,
    },
    {
      to: "/text-to-speech",
      label: "Speak",
      icon: "fa-solid fa-volume-high",
      badge: null,
    },
    {
      to: "/exam-recorder",
      label: "Exam",
      icon: "fa-solid fa-graduation-cap",
      badge: "Fast",
    },
    {
      to: "/settings",
      label: "Settings",
      icon: "fa-solid fa-sliders",
      badge: null,
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Application Navigation">
      <div className="bottom-nav-inner">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? "active" : ""}`
            }
          >
            <div className="bottom-nav-icon-wrap">
              <i className={item.icon}></i>
              {item.badge && <span className="bottom-nav-badge">{item.badge}</span>}
            </div>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
