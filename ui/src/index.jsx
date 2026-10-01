import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ClusterProvider } from "./data/ClusterContext";
import "./App.css";

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(
  <React.StrictMode>
    <ClusterProvider><App /></ClusterProvider>
  </React.StrictMode>
);
