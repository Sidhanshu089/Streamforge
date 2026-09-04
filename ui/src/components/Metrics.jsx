import React from "react";

import {
  systemMetrics,
  throughputHistory,
  workers,
} from "../data/mockData";

// import "./Metrics.css";


function MetricCard({ title, value, subtitle }) {
  return (
    <div className="metrics-card">
      <div className="metrics-card-title">
        {title}
      </div>

      <div className="metrics-card-value">
        {value}
      </div>

      {subtitle && (
        <div className="metrics-card-subtitle">
          {subtitle}
        </div>
      )}
    </div>
  );
}


function ProgressBar({ value }) {
  return (
    <div className="metrics-progress">
      <div
        className="metrics-progress-fill"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}


export default function Metrics() {

  const averageCpu =
    workers.length > 0
      ? Math.round(
          workers.reduce(
            (total, worker) => total + worker.cpu,
            0
          ) / workers.length
        )
      : 0;


  const averageMemory =
    workers.length > 0
      ? Math.round(
          workers.reduce(
            (total, worker) => total + worker.memory,
            0
          ) / workers.length
        )
      : 0;


  const maxWorkerLag =
    workers.length > 0
      ? Math.max(
          ...workers.map((worker) => worker.lag)
        )
      : 0;


  return (
    <div className="metrics-page">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="metrics-header">

        <div>
          <h1>Metrics</h1>

          <p>
            Monitor StreamForge processing performance
            and resource usage.
          </p>
        </div>

      </div>


      {/* =====================================================
          KPI CARDS
      ====================================================== */}

      <div className="metrics-kpi-grid">

        <MetricCard
          title="Throughput"
          value={`${systemMetrics.eventsPerSecond.toLocaleString()} /s`}
          subtitle={systemMetrics.throughputTrend}
        />

        <MetricCard
          title="Consumer Lag"
          value={systemMetrics.consumerLag.toLocaleString()}
          subtitle="events behind"
        />

        <MetricCard
          title="Processing Latency"
          value={`${systemMetrics.processingLatency} ms`}
          subtitle={systemMetrics.latencyTrend}
        />

        <MetricCard
          title="Failed Workers"
          value={systemMetrics.failedWorkers}
          subtitle={`${systemMetrics.activeWorkers}/${systemMetrics.totalWorkers} healthy`}
        />

      </div>


      {/* =====================================================
          THROUGHPUT
      ====================================================== */}

      <section className="metrics-section">

        <div className="metrics-section-header">

          <div>
            <h2>Throughput</h2>

            <p>
              Events processed per second.
            </p>
          </div>

          <strong>
            {systemMetrics.eventsPerSecond.toLocaleString()} /s
          </strong>

        </div>


        <div className="throughput-chart">

          {throughputHistory.map((point, index) => {

            const maxValue = Math.max(
              ...throughputHistory.map(
                (item) => item.eventsPerSecond
              )
            );

            const height =
              maxValue > 0
                ? (point.eventsPerSecond / maxValue) * 100
                : 0;

            return (
              <div
                className="throughput-column"
                key={`${point.time}-${index}`}
              >

                <div className="throughput-value">
                  {Math.round(
                    point.eventsPerSecond / 1000
                  )}k
                </div>

                <div className="throughput-bar-container">

                  <div
                    className="throughput-bar"
                    style={{
                      height: `${height}%`,
                    }}
                  />

                </div>

                <div className="throughput-time">
                  {point.time}
                </div>

              </div>
            );
          })}

        </div>

      </section>


      {/* =====================================================
          WORKER LAG
      ====================================================== */}

      <section className="metrics-section">

        <div className="metrics-section-header">

          <div>
            <h2>Consumer Lag</h2>

            <p>
              Current lag by worker.
            </p>
          </div>

          <strong>
            {maxWorkerLag}
          </strong>

        </div>


        <div className="worker-metrics-list">

          {workers.slice(0, 10).map((worker) => (

            <div
              className="worker-metric-row"
              key={worker.id}
            >

              <div className="worker-metric-name">
                {worker.name}
              </div>

              <div className="worker-metric-bar">

                <ProgressBar
                  value={Math.min(
                    worker.lag,
                    100
                  )}
                />

              </div>

              <div className="worker-metric-value">
                {worker.lag}
              </div>

            </div>

          ))}

        </div>

        {workers.length > 10 && (
          <div className="metrics-note">
            Showing 10 of {workers.length} workers.
          </div>
        )}

      </section>


      {/* =====================================================
          RESOURCE USAGE
      ====================================================== */}

      <section className="metrics-section">

        <div className="metrics-section-header">

          <div>
            <h2>Resource Usage</h2>

            <p>
              Average worker resource utilization.
            </p>
          </div>

        </div>


        <div className="resource-grid">

          <div className="resource-card">

            <div className="resource-card-header">

              <span>CPU</span>

              <strong>
                {averageCpu}%
              </strong>

            </div>

            <ProgressBar
              value={averageCpu}
            />

          </div>


          <div className="resource-card">

            <div className="resource-card-header">

              <span>Memory</span>

              <strong>
                {averageMemory}%
              </strong>

            </div>

            <ProgressBar
              value={averageMemory}
            />

          </div>

        </div>

      </section>


      {/* =====================================================
          PROMETHEUS
      ====================================================== */}

      <section className="metrics-section prometheus-section">

        <div>

          <h2>Prometheus</h2>

          <p>
            Metrics collection service
            for StreamForge.
          </p>

        </div>


        <div className="prometheus-status">

          <span className="status-dot" />

          <span>
            {systemMetrics.failedWorkers === 0
              ? "Healthy"
              : "Attention required"}
          </span>

        </div>

      </section>

    </div>
  );
}