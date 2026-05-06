import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary, ToastProvider } from "@api-client/ui";
import { markStart, markEnd } from "@api-client/core";
import "./i18n";
import "./styles/index.css";

markStart("app:ready");

window.addEventListener("error", (event) => {
  console.error("Uncaught error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
  markEnd("app:ready");
}
