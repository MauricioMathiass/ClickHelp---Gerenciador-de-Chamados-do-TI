import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./shared/styles/tokens.css";
import "./shared/styles/base.css";
import "./shared/styles/ui.css";
import { clearLegacyBrowserStorageOnce } from "./shared/services/storageCleanup";

clearLegacyBrowserStorageOnce();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
