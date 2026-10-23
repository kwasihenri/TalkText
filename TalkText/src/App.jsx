import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { ToastProvider } from "./components/Toast";
import SpeechToTextPage from "./pages/SpeechToTextPage";
import TextToSpeechPage from "./pages/TextToSpeechPage";
import SettingsPage from "./pages/SettingsPage";
import { storage } from "./services/storage";

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname && location.pathname !== "/") {
      storage.setLastRoute(location.pathname);
    }
  }, [location]);

  return null;
}

function RootRedirect() {
  const lastRoute = storage.getLastRoute();
  return <Navigate to={lastRoute || "/speech-to-text"} replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <RouteTracker />
        <div className="app-shell">
          <Header />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/speech-to-text" element={<SpeechToTextPage />} />
              <Route path="/text-to-speech" element={<TextToSpeechPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/speech-to-text" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
