import React from "react";
import ReactDOM from "react-dom/client";
import "katex/dist/katex.min.css";
import "./app/styles.css";
import { App } from "./app/App";

// Keep the WebdriverIO bridge out of normal builds; the desktop smoke command
// opts in through VITE_MOYANG_DESKTOP_E2E at compile time.
if (__MOYANG_DESKTOP_E2E__) {
  void import("@wdio/tauri-plugin");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
