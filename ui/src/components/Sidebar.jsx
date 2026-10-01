import React from "react";
import { useCluster } from "../data/ClusterContext";


const navigationItems = [
  {
    id: "overview",
    label: "Overview",
    icon: "⌂",
  },
  {
    id: "topology",
    label: "Topology",
    icon: "◇",
  },
  {
    id: "workers",
    label: "Workers",
    icon: "▦",
  },
  {
    id: "partitions",
    label: "Partitions",
    icon: "▤",
  },
  {
    id: "metrics",
    label: "Metrics",
    icon: "⌁",
  },
];


export default function Sidebar({
  activePage,
  setActivePage,
}) {
  const { cluster, error, loading } = useCluster();
  const workerCount = cluster?.workers?.length || 0;
  const partitions = cluster?.partitions || [];

  return (
    <aside className="sidebar">

      {/* =====================================================
          BRAND
      ====================================================== */}

      <div className="sidebar-brand">

        <div className="brand-icon">
          SF
        </div>

        <div>
          <div className="brand-name">
            StreamForge
          </div>

          <div className="brand-subtitle">
            Distributed Event Processor
          </div>
        </div>

      </div>


      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <nav className="sidebar-nav">

        <div className="nav-section-title">
          MONITORING
        </div>

        {navigationItems.map((item) => (

          <button
            key={item.id}
            className={`nav-item ${
              activePage === item.id
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage(item.id)
            }
          >

            <span className="nav-icon">
              {item.icon}
            </span>

            <span>
              {item.label}
            </span>

          </button>

        ))}

      </nav>


      {/* =====================================================
          SYSTEM STATUS
      ====================================================== */}

      <div className="sidebar-bottom">

        <div className="sidebar-system">

          <div className="sidebar-system-header">

            <span>
              SYSTEM STATUS
            </span>

            <span className={`status-dot ${error ? "failed" : ""}`} />

          </div>


          <div className="sidebar-system-status">
            {error ? "Connection unavailable" : loading ? "Connecting…" : "Kafka connected"}
          </div>


          <div className="sidebar-system-details">
            {error ? "Start API: uvicorn backend.api:app --reload --port 8000" : `${workerCount} processor workers · ${partitions.filter((item) => item.status === "active").length}/${partitions.length} partitions`}

          </div>

        </div>


        <div className="sidebar-version">
          StreamForge v0.1.0
        </div>

      </div>

    </aside>
  );
}
