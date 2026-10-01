import React from "react";
import { useCluster } from "../data/ClusterContext";


const pageNames = {
  overview: "Overview",
  topology: "Topology",
  workers: "Workers",
  partitions: "Partitions",
  metrics: "Metrics",
};


export default function Header({ activePage }) {
  const { cluster, error, loading } = useCluster();

  const currentPage =
    pageNames[activePage] || "Overview";


  const handleRefresh = () => {
    window.location.reload();
  };


  return (
    <header className="header">

      {/* =====================================================
          LEFT
      ====================================================== */}

      <div className="header-left">

        <div className="breadcrumb">

          <span>
            StreamForge
          </span>

          <span className="breadcrumb-separator">
            /
          </span>

          <span>
            {currentPage}
          </span>

        </div>

      </div>


      {/* =====================================================
          RIGHT
      ====================================================== */}

      <div className="header-right">

        <div className="connection-status">

          <span className={`status-dot ${error ? "failed" : loading ? "pending" : ""}`} />

          {error ? "Unavailable" : loading ? "Connecting" : "Connected"}

        </div>


        <div className="last-update">

          Last updated{" "}

          <strong>
            {cluster?.updatedAt ? new Date(cluster.updatedAt * 1000).toLocaleTimeString() : "—"}
          </strong>

        </div>


        <button
          className="refresh-button"
          onClick={handleRefresh}
          title="Refresh dashboard"
          aria-label="Refresh dashboard"
        >
          ↻
        </button>

      </div>

    </header>
  );
}
