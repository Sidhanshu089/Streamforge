import React, { createContext, useContext, useEffect, useState } from "react";

const ClusterContext = createContext({ cluster: null, error: null, loading: true });
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export function ClusterProvider({ children }) {
  const [cluster, setCluster] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cluster`);
        if (!response.ok) {
          let detail = `API returned ${response.status}`;
          try {
            const body = await response.json();
            if (body.detail) detail = body.detail;
          } catch (_) {
            // Keep the HTTP status when the API has no JSON error body.
          }
          throw new Error(detail);
        }
        const data = await response.json();
        if (mounted) { setCluster(data); setError(null); }
      } catch (err) {
        const message = err.name === "TypeError"
          ? `Cannot reach the StreamForge API at ${API_URL}. Start it with: uvicorn backend.api:app --reload --port 8000`
          : err.message;
        if (mounted) setError(message);
      }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  return <ClusterContext.Provider value={{ cluster, error, loading: !cluster && !error }}>{children}</ClusterContext.Provider>;
}

export function useCluster() {
  return useContext(ClusterContext);
}
