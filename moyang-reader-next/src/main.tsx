import "katex/dist/katex.min.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RootApp } from "./application/RootApp";
import { isTauriRuntime } from "./platform/bridge";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import "./styles/index.css";

// Match the native window title so window selection and assistive tools agree.
if (isTauriRuntime()) document.title = "Moyang Reader Next";

// Keep the WebdriverIO bridge out of normal builds; the desktop smoke command
// opts in through VITE_MOYANG_DESKTOP_E2E at compile time.
if (__MOYANG_DESKTOP_E2E__) {
  void import("@wdio/tauri-plugin");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RootApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
