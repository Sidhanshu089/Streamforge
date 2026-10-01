import React from "react";


export default function WorkerDetails({
  worker,
  onClose,
}) {

  if (!worker) {
    return null;
  }


  const isHealthy =
    worker.status === "healthy";


  return (
    <div
      className="worker-details-overlay"
      onClick={onClose}
    >

      <aside
        className="worker-details-panel"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        {/* ==================================================
            HEADER
        =================================================== */}

        <div className="worker-details-header">

          <div>

            <div className="worker-details-title">

              <span
                className={`worker-status-dot ${worker.status}`}
              />

              <h2>
                {worker.name}
              </h2>

            </div>

            <span className="worker-details-id">
              {worker.id}
            </span>

          </div>


          <button
            className="worker-details-close"
            onClick={onClose}
            aria-label="Close worker details"
          >
            ×
          </button>

        </div>


        {/* ==================================================
            STATUS
        =================================================== */}

        <div
          className={`worker-details-status ${
            worker.status
          }`}
        >

          <span
            className={`worker-status-dot ${
              worker.status
            }`}
          />

          {isHealthy
            ? "Processor consumer is active"
            : "Processor consumer is not active"}

        </div>


        {/* ==================================================
            PERFORMANCE
        =================================================== */}

        <section className="details-section">

          <h3>
            Performance
          </h3>


          <div className="details-metric-grid">

            <div className="details-metric">

              <span>
                Throughput
              </span>

              <strong>
                {worker.eventsPerSecond == null ? "—" : worker.eventsPerSecond.toLocaleString()}
              </strong>

              <small>
                events/s
              </small>

            </div>


            <div className="details-metric">

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

        </section>


        {/* ==================================================
            RESOURCE USAGE
        =================================================== */}

        <section className="details-section">

          <h3>
            Resource Usage
          </h3>


          {/* CPU */}

          <div className="details-resource">

            <div className="details-resource-header">

              <span>
                CPU
              </span>

              <strong>
                {worker.cpu == null ? "Unavailable" : `${worker.cpu.toFixed(1)}%`}
              </strong>

            </div>


            <div className="details-resource-bar">

              <div
                className="details-resource-fill"
                style={{
                  width: `${Math.min(Math.max(worker.cpu || 0, 0), 100)}%`,
                }}
              />

            </div>

          </div>


          {/* Memory */}

          <div className="details-resource">

            <div className="details-resource-header">

              <span>
                Memory
              </span>

              <strong>
                {worker.memory == null ? "Unavailable" : `${worker.memory.toFixed(1)}%`}
              </strong>

            </div>


            <div className="details-resource-bar">

              <div
                className="details-resource-fill"
                style={{
                  width: `${Math.min(Math.max(worker.memory || 0, 0), 100)}%`,
                }}
              />

            </div>

          </div>

        </section>


        {/* ==================================================
            PARTITIONS
        =================================================== */}

        <section className="details-section">

          <h3>
            Assigned Partitions
          </h3>


          {worker.partitions.length > 0 ? (

            <div className="details-partition-list">

              {worker.partitions.map(
                (partitionRef) => {
                  const [topicName, partitionId] = partitionRef.split(":");
                  return (

                  <span
                    key={partitionRef}
                    className="details-partition-badge"
                    title={`${topicName}, partition ${partitionId}`}
                  >
                    {topicName} / P
                    {String(partitionId).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  );
                }
              )}

            </div>

          ) : (

            <div className="details-empty">
              No partitions assigned.
            </div>

          )}

        </section>


        {/* ==================================================
            STATE
        =================================================== */}

        <section className="details-section">

          <h3>
            State & Recovery
          </h3>


          <div className="details-info-list">

            <div className="details-info-row">

              <span>
                RocksDB
              </span>

              <strong className="healthy-text">
                Synced
              </strong>

            </div>


            <div className="details-info-row">

              <span>
                Checkpoint
              </span>

              <strong className="healthy-text">
                Active
              </strong>

            </div>


            <div className="details-info-row">

              <span>
                Recovery
              </span>

              <strong className="healthy-text">
                Ready
              </strong>

            </div>

          </div>

        </section>


        {/* ==================================================
            FOOTER
        =================================================== */}

        <div className="worker-details-footer">

          <span>
            StreamForge Worker
          </span>

          <span>
            Live monitoring
          </span>

        </div>

      </aside>

    </div>
  );
}
