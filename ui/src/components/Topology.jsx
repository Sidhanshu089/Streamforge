import React from "react";
import { useCluster } from "../data/ClusterContext";
import TopologyGraph from "./TopologyGraph";

export default function Topology() {
  const { cluster, error, loading } = useCluster();
  const partitions = cluster?.partitions || [];
  return <div className="topology-page">
    <div className="topology-page-header"><div><h1>Topology</h1><p>Kafka broker metadata reported by the live cluster.</p></div></div>
    <div className="topology-summary">
      <div className="topology-summary-item"><span>Kafka brokers</span><strong>{cluster?.brokerCount ?? "—"}</strong><small>{error || (loading ? "Connecting" : cluster ? "connected" : "unavailable")}</small></div>
      <div className="topology-summary-item"><span>Input topics</span><strong>{cluster?.topics?.length ?? 0}</strong><small>{cluster?.topics?.join(", ") || "—"}</small></div>
      <div className="topology-summary-item"><span>Partitions</span><strong>{partitions.length}</strong><small>{partitions.filter((p) => p.status === "active").length} active leaders</small></div>
      <div className="topology-summary-item"><span>Processor</span><strong>{cluster?.processorUp ? "Running" : "Stopped"}</strong><small>{cluster?.workers?.length || 0} active consumer(s)</small></div>
    </div>
    <div className="detailed-topology-container"><TopologyGraph /></div>
  </div>;
}
