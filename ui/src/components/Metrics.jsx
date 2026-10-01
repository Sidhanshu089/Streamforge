import React from "react";
import { useCluster } from "../data/ClusterContext";

export default function Metrics() {
  const { cluster, error, loading } = useCluster();
  const rate = cluster?.eventsPerSecond;
  const partitions = cluster?.partitions || [];
  return <div className="metrics-page">
    <div className="metrics-header"><div><h1>Metrics</h1><p>Kafka broker and processor measurements.</p></div></div>
    <div className="metrics-kpi-grid">
      <div className="metrics-card"><div className="metrics-card-title">Processing rate</div><div className="metrics-card-value">{rate == null ? "—" : `${Math.round(rate).toLocaleString()} /s`}</div><div className="metrics-card-subtitle">{cluster?.rateSource === "processor" ? "Processed events over 5 seconds" : "Kafka input offsets over 5 seconds"}</div></div>
      <div className="metrics-card"><div className="metrics-card-title">Topic partitions</div><div className="metrics-card-value">{partitions.length}</div><div className="metrics-card-subtitle">{partitions.filter((p) => p.status === "active").length} with an active leader</div></div>
      <div className="metrics-card"><div className="metrics-card-title">Events processed</div><div className="metrics-card-value">{(cluster?.processedEvents || 0).toLocaleString()}</div><div className="metrics-card-subtitle">Since processor start</div></div>
      <div className="metrics-card"><div className="metrics-card-title">Consumer lag</div><div className="metrics-card-value">{cluster?.consumerLag == null ? "—" : cluster.consumerLag.toLocaleString()}</div><div className="metrics-card-subtitle">Events behind the processor group</div></div>
      <div className="metrics-card"><div className="metrics-card-title">Processor latency</div><div className="metrics-card-value">{cluster?.processingLatency == null ? "—" : `${(cluster.processingLatency * 1000).toFixed(1)} ms`}</div><div className="metrics-card-subtitle">Most recent event duration</div></div>
    </div>
    <section className="metrics-section"><div className="metrics-section-header"><div><h2>Kafka connection</h2><p>{loading ? "Loading broker metadata…" : error || (cluster?.connected ? `Connected to ${cluster.brokerCount} broker(s), input topics ${cluster.topics?.join(", ") || cluster.topic}.` : "No connection")}</p></div></div>
      <table className="partitions-table"><thead><tr><th>Partition</th><th>Leader</th><th>Replicas</th><th>In sync</th><th>Status</th></tr></thead><tbody>{partitions.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.leader ?? "Unavailable"}</td><td>{p.replicas.join(", ") || "—"}</td><td>{p.inSyncReplicas.join(", ") || "—"}</td><td>{p.status}</td></tr>)}</tbody></table>
    </section>
  </div>;
}
