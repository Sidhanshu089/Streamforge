import React from "react";


const pageNames = {
  overview: "Overview",
  topology: "Topology",
  workers: "Workers",
  partitions: "Partitions",
  metrics: "Metrics",
};


export default function Header({ activePage }) {

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

          <span className="status-dot" />

          Connected

        </div>


        <div className="last-update">

          Last updated{" "}

          <strong>
            just now
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