import React, { useMemo, useState } from "react";

import {
  partitions,
  workers,
} from "../data/mockData";


export default function Partitions() {

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");


  /* ==========================================================
     COUNTS
     ========================================================== */

  const activeCount = partitions.filter(
    (partition) => partition.status === "active"
  ).length;

  const inactiveCount = partitions.filter(
    (partition) => partition.status === "inactive"
  ).length;


  /* ==========================================================
     FILTER PARTITIONS
     ========================================================== */

  const filteredPartitions = useMemo(() => {

    const search = searchTerm.toLowerCase();

    return partitions.filter((partition) => {

      const assignedWorker = workers.find(
        (worker) =>
          worker.id === partition.workerId
      );

      const workerName =
        assignedWorker?.name || "";

      const matchesSearch =
        partition.name
          .toLowerCase()
          .includes(search) ||

        String(partition.id)
          .includes(search) ||

        workerName
          .toLowerCase()
          .includes(search);


      const matchesFilter =
        filter === "all" ||
        partition.status === filter;


      return (
        matchesSearch &&
        matchesFilter
      );
    });

  }, [searchTerm, filter]);


  /* ==========================================================
     WORKER LOOKUP
     ========================================================== */

  const getWorker = (workerId) => {

    return workers.find(
      (worker) =>
        worker.id === workerId
    );
  };


  /* ==========================================================
     RENDER
     ========================================================== */

  return (

    <div className="partitions-page">


      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="partitions-page-header">

        <div>

          <h1>
            Partitions
          </h1>

          <p>
            Monitor Kafka partition assignments and consumer lag.
          </p>

        </div>


        <div className="partition-summary">

          <div className="summary-item">

            <span className="summary-dot healthy" />

            {activeCount} active

          </div>


          <div className="summary-item">

            <span className="summary-dot failed" />

            {inactiveCount} inactive

          </div>

        </div>

      </div>


      {/* =====================================================
          TOOLBAR
      ====================================================== */}

      <div className="partitions-toolbar">


        {/* Search */}

        <div className="partition-search">

          <span className="search-icon">
            ⌕
          </span>

          <input
            type="text"
            placeholder="Search partitions or workers..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
          />

        </div>


        {/* Filters */}

        <div className="partition-filters">

          <button
            className={`filter-button ${
              filter === "all"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setFilter("all")
            }
          >
            All ({partitions.length})
          </button>


          <button
            className={`filter-button ${
              filter === "active"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setFilter("active")
            }
          >
            Active ({activeCount})
          </button>


          <button
            className={`filter-button ${
              filter === "inactive"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setFilter("inactive")
            }
          >
            Inactive ({inactiveCount})
          </button>

        </div>

      </div>


      {/* =====================================================
          TABLE
      ====================================================== */}

      {filteredPartitions.length === 0 ? (

        <div className="partitions-table-container">

          <div className="partitions-empty">

            <div className="empty-icon">
              ⌕
            </div>

            <h3>
              No partitions found
            </h3>

            <p>
              Try changing your search or filter.
            </p>

          </div>

        </div>

      ) : (

        <div className="partitions-table-container">

          <table className="partitions-table">

            <thead>

              <tr>

                <th>
                  Partition
                </th>

                <th>
                  Status
                </th>

                <th>
                  Assigned Worker
                </th>

                <th>
                  Consumer Lag
                </th>

                <th>
                  Assignment
                </th>

              </tr>

            </thead>


            <tbody>

              {filteredPartitions.map(
                (partition) => {

                  const worker =
                    getWorker(
                      partition.workerId
                    );

                  const isHighLag =
                    partition.lag >= 35;


                  return (

                    <tr
                      key={partition.id}
                    >


                      {/* ==================================
                          PARTITION
                      =================================== */}

                      <td>

                        <div className="partition-name">

                          <div className="partition-icon">
                            P
                          </div>

                          <div>

                            <strong>
                              {partition.name}
                            </strong>

                            <span>
                              partition-{partition.id}
                            </span>

                          </div>

                        </div>

                      </td>


                      {/* ==================================
                          STATUS
                      =================================== */}

                      <td>

                        <span
                          className={`partition-status ${
                            partition.status
                          }`}
                        >

                          <span className="status-dot" />

                          {partition.status}

                        </span>

                      </td>


                      {/* ==================================
                          WORKER
                      =================================== */}

                      <td>

                        {worker ? (

                          <div className="assigned-worker">

                            <span
                              className={`worker-status-dot ${
                                worker.status
                              }`}
                            />

                            {worker.name}

                          </div>

                        ) : (

                          <span className="unassigned">
                            Unassigned
                          </span>

                        )}

                      </td>


                      {/* ==================================
                          LAG
                      =================================== */}

                      <td>

                        <span
                          className={`lag ${
                            isHighLag
                              ? "high"
                              : ""
                          }`}
                        >
                          {partition.lag}
                        </span>

                      </td>


                      {/* ==================================
                          ASSIGNMENT
                      =================================== */}

                      <td>

                        <span className="assignment-state">
                          {worker
                            ? "Assigned"
                            : "Unassigned"}
                        </span>

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

      )}


      {/* =====================================================
          FOOTER
      ====================================================== */}

      <div className="partitions-footer">

        Showing{" "}

        <strong>
          {filteredPartitions.length}
        </strong>{" "}

        of{" "}

        <strong>
          {partitions.length}
        </strong>{" "}

        partitions

      </div>

    </div>
  );
}