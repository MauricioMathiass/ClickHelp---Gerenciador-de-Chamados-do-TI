import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import { clearClickHelpBrowserStorageOnce } from "./services/storageCleanup";

clearClickHelpBrowserStorageOnce();

ReactDOM.createRoot(document.getElementById("root")).render(

    <App />

);
