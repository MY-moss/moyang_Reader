import React from "react";
import ReactDOM from "react-dom/client";
import "katex/dist/katex.min.css";
import "./app/styles.css";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
