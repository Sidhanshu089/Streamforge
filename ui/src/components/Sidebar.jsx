import React from "react";

import { systemMetrics } from "../data/mockData";


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

            <span className="status-dot" />

          </div>


          <div className="sidebar-system-status">
            {systemMetrics.failedWorkers === 0
              ? "All systems operational"
              : "Attention required"}
          </div>


          <div className="sidebar-system-details">

            {systemMetrics.activeWorkers}/
            {systemMetrics.totalWorkers} workers ·{" "}

            {systemMetrics.activePartitions}/
            {systemMetrics.totalPartitions} partitions

          </div>

        </div>


        <div className="sidebar-version">
          StreamForge v0.1.0
        </div>

      </div>

    </aside>
  );
}