import React from "react";
import ReactDOM from "react-dom/client";
import "./app/styles.css";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/components/ErrorBoundary";

// Keep the WebdriverIO bridge out of normal builds; the desktop smoke command
// opts in through VITE_MOYANG_DESKTOP_E2E at compile time.
if (__MOYANG_DESKTOP_E2E__) {
  void import("@wdio/tauri-plugin");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
