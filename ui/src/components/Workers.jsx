import React, { useMemo, useState } from "react";

import {
  workers,
} from "../data/mockData";

import WorkerDetails from "./WorkerDetails";


export default function Workers() {

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedWorker, setSelectedWorker] = useState(null);


  /* ==========================================================
     COUNTS
     ========================================================== */

  const healthyCount = workers.filter(
    (worker) => worker.status === "healthy"
  ).length;

  const failedCount = workers.filter(
    (worker) => worker.status === "failed"
  ).length;


  /* ==========================================================
     FILTER WORKERS
     ========================================================== */

  const filteredWorkers = useMemo(() => {

    return workers.filter((worker) => {

      const matchesSearch =
        worker.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||

        worker.id
          .toLowerCase()
          .includes(searchTerm.toLowerCase());


      const matchesFilter =
        filter === "all" ||
        worker.status === filter;


      return matchesSearch && matchesFilter;
    });

  }, [searchTerm, filter]);


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="workers-page">


      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="workers-page-header">

        <div>

          <h1>
            Workers
          </h1>

          <p>
            Monitor individual StreamForge processing workers.
          </p>

        </div>


        <div className="worker-summary">

          <div className="summary-item">

            <span className="summary-dot healthy" />

            {healthyCount} healthy

          </div>


          <div className="summary-item">

            <span className="summary-dot failed" />

            {failedCount} failed

          </div>

        </div>

      </div>


      {/* =====================================================
          TOOLBAR
      ====================================================== */}

      <div className="workers-toolbar">


        {/* Search */}

        <div className="worker-search">

          <span className="search-icon">
            ⌕
          </span>

          <input
            type="text"
            placeholder="Search workers..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
          />

        </div>


        {/* Filters */}

        <div className="worker-filters">

          <button
            className={`filter-button ${
              filter === "all"
                ? "active"
                : ""
            }`}
            onClick={() => setFilter("all")}
          >
            All ({workers.length})
          </button>


          <button
            className={`filter-button ${
              filter === "healthy"
                ? "active"
                : ""
            }`}
            onClick={() => setFilter("healthy")}
          >
            Healthy ({healthyCount})
          </button>


          <button
            className={`filter-button ${
              filter === "failed"
                ? "active"
                : ""
            }`}
            onClick={() => setFilter("failed")}
          >
            Failed ({failedCount})
          </button>

        </div>

      </div>


      {/* =====================================================
          WORKER GRID
      ====================================================== */}

      {filteredWorkers.length === 0 ? (

        <div className="workers-empty">

          <div className="empty-icon">
            ⌕
          </div>

          <h3>
            No workers found
          </h3>

          <p>
            Try changing your search or filter.
          </p>

        </div>

      ) : (

        <div className="workers-grid">

          {filteredWorkers.map((worker) => (

            <div
              key={worker.id}
              className={`worker-card ${worker.status}`}
              onClick={() =>
                setSelectedWorker(worker)
              }
            >


              {/* =============================================
                  WORKER HEADER
              ============================================== */}

              <div className="worker-card-header">

                <div className="worker-name">

                  <span
                    className={`worker-status-dot ${worker.status}`}
                  />

                  {worker.name}

                </div>


                <span className="worker-id">
                  {worker.id}
                </span>

              </div>


              {/* Status */}

              <div className="worker-status-label">

                {worker.status === "healthy"
                  ? "Healthy"
                  : "Failed"}

              </div>


              {/* =============================================
                  METRICS
              ============================================== */}

              <div className="worker-metrics">


                <div className="worker-metric">

                  <span>
                    Throughput
                  </span>

                  <strong>
                    {worker.eventsPerSecond.toLocaleString()}
                  </strong>

                  <small>
                    events/s
                  </small>

                </div>


                <div className="worker-metric">

                  <span>
                    Consumer Lag
                  </span>

                  <strong>
                    {worker.lag}
                  </strong>

                  <small>
                    events
                  </small>

                </div>

              </div>


              {/* =============================================
                  RESOURCES
              ============================================== */}

              <div className="worker-resources">


                <div className="resource-row">

                  <div className="resource-label">

                    <span>
                      CPU
                    </span>

                    <strong>
                      {worker.cpu}%
                    </strong>

                  </div>

                  <div className="resource-bar">

                    <div
                      className="resource-fill"
                      style={{
                        width: `${worker.cpu}%`,
                      }}
                    />

                  </div>

                </div>


                <div className="resource-row">

                  <div className="resource-label">

                    <span>
                      Memory
                    </span>

                    <strong>
                      {worker.memory}%
                    </strong>

                  </div>

                  <div className="resource-bar">

                    <div
                      className="resource-fill"
                      style={{
                        width: `${worker.memory}%`,
                      }}
                    />

                  </div>

                </div>

              </div>


              {/* =============================================
                  PARTITIONS
              ============================================== */}

              <div className="worker-partitions">

                <span>
                  Assigned partitions
                </span>


                <div className="partition-list">

                  {worker.partitions.length > 0 ? (

                    worker.partitions.map(
                      (partitionId) => (

                        <span
                          key={partitionId}
                          className="partition-badge"
                        >
                          P{String(partitionId).padStart(2, "0")}
                        </span>

                      )
                    )

                  ) : (

                    <span className="no-partitions">
                      No partitions assigned
                    </span>

                  )}

                </div>

              </div>

            </div>

          ))}

        </div>

      )}


      {/* =====================================================
          DETAILS PANEL
      ====================================================== */}

      {selectedWorker && (

        <WorkerDetails
          worker={selectedWorker}
          onClose={() =>
            setSelectedWorker(null)
          }
        />

      )}

    </div>
  );
}