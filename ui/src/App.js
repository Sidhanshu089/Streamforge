import React, { useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import MetricCard from "./components/MetricCard";
import TopologyGraph from "./components/TopologyGraph";
import Topology from "./components/Topology";
import Workers from "./components/Workers";
import Partitions from "./components/Partitions";
import Metrics from "./components/Metrics";

import { systemMetrics } from "./data/mockData";

import "./App.css";


export default function App() {

  const [activePage, setActivePage] =
    useState("overview");


  /* ==========================================================
     OVERVIEW
     ========================================================== */

  const renderOverview = () => {

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


          <div className="system-status">

            <span className="status-dot" />

            {systemMetrics.failedWorkers === 0
              ? "All systems operational"
              : "Attention required"}

          </div>

        </div>


        {/* ==================================================
            METRICS
        =================================================== */}

        <div className="metrics-grid">

          <MetricCard
            title="Throughput"
            value={`${systemMetrics.eventsPerSecond.toLocaleString()} /s`}
            subtitle="Events processed"
            trend={systemMetrics.throughputTrend}
            trendType="positive"
          />


          <MetricCard
            title="Active Workers"
            value={`${systemMetrics.activeWorkers}/${systemMetrics.totalWorkers}`}
            subtitle="Workers healthy"
            trend={
              systemMetrics.failedWorkers === 0
                ? "Healthy"
                : `${systemMetrics.failedWorkers} failed`
            }
            trendType={
              systemMetrics.failedWorkers === 0
                ? "positive"
                : "negative"
            }
          />


          <MetricCard
            title="Consumer Lag"
            value={systemMetrics.consumerLag.toLocaleString()}
            subtitle="Events behind"
          />


          <MetricCard
            title="Processing Latency"
            value={`${systemMetrics.processingLatency} ms`}
            subtitle="Current latency"
            trend={systemMetrics.latencyTrend}
            trendType="positive"
          />

        </div>


        {/* ==================================================
            TOPOLOGY
        =================================================== */}

        <section className="topology-section">

          <div className="section-header">

            <div>
              <h2>
                Live Topology
              </h2>

              <p>
                Current StreamForge processing architecture.
              </p>
            </div>


            <div className="live-indicator">

              <span className="status-dot" />

              LIVE

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