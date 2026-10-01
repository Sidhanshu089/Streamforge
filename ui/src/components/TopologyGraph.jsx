import React, { useMemo } from "react";
import { useCluster } from "../data/ClusterContext";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from "reactflow";

import "reactflow/dist/style.css";



function KafkaNode({ data }) {
  return (
    <div className="topology-node kafka-node">
      <Handle
        type="source"
        position={Position.Right}
        id="output"
      />

      <div className="topology-node-header">
        <span className="topology-node-title">
          Kafka
        </span>

        <span className={`node-status ${data.connected ? "healthy" : "failed"}`}>
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {data.partitions.length}
      </div>

      <div className="topology-node-label">
        partitions
      </div>

      <div className="topology-node-status">
        {data.connected ? "connected" : "unavailable"}
      </div>
    </div>
  );
}


function WorkerPoolNode({ data }) {

  return (
    <div className="topology-node worker-pool-node">
      <Handle
        type="target"
        position={Position.Left}
        id="input"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="data-output"
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="state-output"
      />

      <div className="topology-node-header">
        <span className="topology-node-title">
          Worker Pool
        </span>

        <span className={`node-status ${data.workers.length ? "healthy" : "failed"}`}>
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {data.workers.length}
      </div>

      <div className="topology-node-label">
        active processor consumer(s)
      </div>

      <div className="worker-health">
        <div className="health-item">
          <span>Throughput</span>
          <strong>
            {data.eventsPerSecond == null ? "—" : `${Math.round(data.eventsPerSecond)} /s`}
          </strong>
        </div>

        <div className="health-item">
          <span>Partitions</span>
          <strong>
            {data.partitions.length}
          </strong>
        </div>
      </div>

      <div className="topology-node-hint">
        Bytewax / Faust
      </div>
    </div>
  );
}


function StorageNode({ data }) {
  const healthy = data.stateStore?.healthy;
  const value = !data.workers.length
    ? "Unavailable"
    : healthy
      ? "Healthy"
      : data.stateStore?.healthyInstances
        ? "Degraded"
        : "Unavailable";
  return (
    <div className="topology-node storage-node">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
      />

      <div className="topology-node-header">
        <span className="topology-node-title">
          RocksDB
        </span>

        <span className={`node-status ${healthy ? "healthy" : "failed"}`}>
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {value}
      </div>

      <div className="topology-node-label">
        state store
      </div>

      <div className="topology-node-status">
        {data.stateStore?.healthyInstances || 0} of {data.workers.length} worker stores healthy
      </div>
    </div>
  );
}


function MetricsNode({ data }) {
  return (
    <div className="topology-node metrics-node">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
      />

      <div className="topology-node-header">
        <span className="topology-node-title">
          Processor Metrics
        </span>

        <span className="node-status">
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {data.eventsPerSecond == null ? "—" : `${Math.round(data.eventsPerSecond)} /s`}
      </div>

      <div className="topology-node-label">
        broker ingest rate
      </div>

      <div className="topology-node-status">
        Prometheus exposition
      </div>
    </div>
  );
}


const nodeTypes = {
  kafka: KafkaNode,
  workerPool: WorkerPoolNode,
  storage: StorageNode,
  metrics: MetricsNode,
};


export default function TopologyGraph() {
  const { cluster } = useCluster();
  const data = cluster || { partitions: [], workers: [], connected: false };
  const nodes = useMemo(
    () => [
      {
        id: "kafka",
        type: "kafka",
        data,
        position: {
          x: 80,
          y: 180,
        },
      },

      {
        id: "worker-pool",
        type: "workerPool",
        data,
        position: {
          x: 400,
          y: 160,
        },
      },

      {
        id: "rocksdb",
        type: "storage",
        data,
        position: {
          x: 750,
          y: 80,
        },
      },

      {
        id: "prometheus",
        type: "metrics",
        data,
        position: {
          x: 750,
          y: 300,
        },
      },
    ],
    [data]
  );


  const edges = useMemo(
    () => [
      {
        id: "kafka-worker-pool",
        source: "kafka",
        sourceHandle: "output",
        target: "worker-pool",
        targetHandle: "input",
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      },

      {
        id: "worker-pool-rocksdb",
        source: "worker-pool",
        sourceHandle: "state-output",
        target: "rocksdb",
        targetHandle: "input",
        type: "smoothstep",
        animated: false,
        style: {
          strokeDasharray: "6 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      },

      {
        id: "worker-pool-prometheus",
        source: "worker-pool",
        sourceHandle: "state-output",
        target: "prometheus",
        targetHandle: "input",
        type: "smoothstep",
        animated: false,
        style: {
          strokeDasharray: "6 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      },
    ],
    []
  );


  return (
    <div className="topology-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.25,
        }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
