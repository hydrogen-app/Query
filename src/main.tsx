import "./App.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "./components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";

// Enable dark mode
document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>
  </React.StrictMode>,
);
