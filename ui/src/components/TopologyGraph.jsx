import React, { useMemo } from "react";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from "reactflow";

import "reactflow/dist/style.css";

import {
  workers,
  partitions,
  systemMetrics,
  topologyStatus,
} from "../data/mockData";


function KafkaNode() {
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

        <span className="node-status healthy">
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {partitions.length}
      </div>

      <div className="topology-node-label">
        partitions
      </div>

      <div className="topology-node-status">
        {topologyStatus.kafka.status}
      </div>
    </div>
  );
}


function WorkerPoolNode() {
  const healthyWorkers = workers.filter(
    (worker) => worker.status === "healthy"
  ).length;

  const totalThroughput = workers.reduce(
    (total, worker) =>
      total + worker.eventsPerSecond,
    0
  );

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

        <span className="node-status healthy">
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {healthyWorkers}/{workers.length}
      </div>

      <div className="topology-node-label">
        workers healthy
      </div>

      <div className="worker-health">
        <div className="health-item">
          <span>Throughput</span>
          <strong>
            {Math.round(
              totalThroughput / 1000
            )}
            k/s
          </strong>
        </div>

        <div className="health-item">
          <span>Partitions</span>
          <strong>
            {partitions.length}
          </strong>
        </div>
      </div>

      <div className="topology-node-hint">
        Bytewax / Faust
      </div>
    </div>
  );
}


function StorageNode() {
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

        <span className="node-status healthy">
          ●
        </span>
      </div>

      <div className="topology-node-value">
        OK
      </div>

      <div className="topology-node-label">
        state store
      </div>

      <div className="topology-node-status">
        Checkpoint & recovery
      </div>
    </div>
  );
}


function MetricsNode() {
  return (
    <div className="topology-node metrics-node">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
      />

      <div className="topology-node-header">
        <span className="topology-node-title">
          Prometheus
        </span>

        <span className="node-status healthy">
          ●
        </span>
      </div>

      <div className="topology-node-value">
        {systemMetrics.processingLatency}ms
      </div>

      <div className="topology-node-label">
        processing latency
      </div>

      <div className="topology-node-status">
        Metrics collection active
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
  const nodes = useMemo(
    () => [
      {
        id: "kafka",
        type: "kafka",
        position: {
          x: 80,
          y: 180,
        },
      },

      {
        id: "worker-pool",
        type: "workerPool",
        position: {
          x: 400,
          y: 160,
        },
      },

      {
        id: "rocksdb",
        type: "storage",
        position: {
          x: 750,
          y: 80,
        },
      },

      {
        id: "prometheus",
        type: "metrics",
        position: {
          x: 750,
          y: 300,
        },
      },
    ],
    []
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