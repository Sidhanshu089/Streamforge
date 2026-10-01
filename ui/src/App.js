import React, { useState } from "react";
import { useCluster } from "./data/ClusterContext";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import MetricCard from "./components/MetricCard";
import TopologyGraph from "./components/TopologyGraph";
import Topology from "./components/Topology";
import Workers from "./components/Workers";
import Partitions from "./components/Partitions";
import Metrics from "./components/Metrics";


import "./App.css";


export default function App() {

  const { cluster, error, loading } = useCluster();

  const [activePage, setActivePage] =
    useState("overview");


  /* ==========================================================
     OVERVIEW
     ========================================================== */

  const renderOverview = () => {

    const partitions = cluster?.partitions || [];
    const metrics = {
      activeWorkers: cluster?.workers?.length || 0,
      totalWorkers: cluster?.workers?.length || 0,
      failedWorkers: 0,
      activePartitions: partitions.filter((p) => p.status === "active").length,
      totalPartitions: partitions.length,
      eventsPerSecond: cluster?.eventsPerSecond,
    };

    return (
      <>

        <div className="page-title">

          <div>
            <h1>
              Overview
            </h1>

            <p>
              Real-time monitoring of the
              StreamForge event processing cluster.
            </p>
          </div>


          <div className={`system-status ${error ? "is-error" : loading ? "is-pending" : ""}`}>
            <span className={`status-dot ${error ? "failed" : loading ? "pending" : ""}`} />
            {error ? "API unavailable" : loading ? "Connecting to Kafka…" : "Kafka connected"}
          </div>

        </div>

        {error && <div className="connection-alert" role="alert">
          <strong>Can’t load live cluster data.</strong>
          <span>{error}</span>
          <small>Start Kafka and the StreamForge API, then use the refresh button.</small>
        </div>}


        {/* ==================================================
            METRICS
        =================================================== */}

        <div className="metrics-grid">

          <MetricCard
            title="Throughput"
            value={metrics.eventsPerSecond == null ? "—" : `${Math.round(metrics.eventsPerSecond).toLocaleString()} /s`}
            subtitle={`${cluster?.rateSource === "processor" ? "Processed events" : "Kafka input"} rate over 5s`}
          />


          <MetricCard
            title="Active Workers"
            value={`${cluster?.workers?.length ?? "—"}`}
            subtitle={cluster?.processorUp ? "Processor workers online" : "Processor not running"}
          />


          <MetricCard
            title="Consumer Lag"
            value={cluster?.consumerLag == null ? "—" : cluster.consumerLag.toLocaleString()}
            subtitle="Events behind in the processor group"
          />


          <MetricCard
            title="Processing Latency"
            value={cluster?.processingLatency == null ? "—" : `${(cluster.processingLatency * 1000).toFixed(1)} ms`}
            subtitle="Latest processing duration"
          />

        </div>


        {/* ==================================================
            TOPOLOGY
        =================================================== */}

        <section className="topology-section">

          <div className="section-header">

            <div>
              <h2>Topology</h2>

              <p>
                Current StreamForge processing architecture.
              </p>
            </div>


            <div className={`live-indicator ${error ? "is-error" : loading ? "is-pending" : ""}`}>

              <span className={`status-dot ${error ? "failed" : loading ? "pending" : ""}`} />

              {error ? "OFFLINE" : loading ? "CONNECTING" : "LIVE"}

            </div>

          </div>


          <div className="topology-container">

            <TopologyGraph />

          </div>

        </section>

      </>
    );
  };


  /* ==========================================================
     PAGE ROUTING
     ========================================================== */

  const renderPage = () => {

    switch (activePage) {

      case "topology":
        return <Topology />;

      case "workers":
        return <Workers />;

      case "partitions":
        return <Partitions />;

      case "metrics":
        return <Metrics />;

      case "overview":
      default:
        return renderOverview();

    }
  };


  /* ==========================================================
     APPLICATION
     ========================================================== */

  return (

    <div className="app">

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />


      <main className="main-content">

        <Header
          activePage={activePage}
        />


        <div className="dashboard-content">

          {renderPage()}

        </div>

      </main>

    </div>

  );
}
