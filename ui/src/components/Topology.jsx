import React, { useMemo, useState } from "react";

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  ReactFlow,
} from "reactflow";

import "reactflow/dist/style.css";

import {
  workers,
  partitions,
  topologyStatus,
} from "../data/mockData";


/* ============================================================
   KAFKA NODE
   ============================================================ */

function KafkaNode() {
  return (
    <div className="detailed-topology-node">

      {/* Output to processor */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
      />

      <div className="detailed-node-header">
        <strong>Kafka</strong>

        <span className="topology-health-dot">
          ●
        </span>
      </div>

      <div className="detailed-node-main-value">
        {partitions.length}
      </div>

      <div className="detailed-node-label">
        partitions
      </div>

      <div className="detailed-node-info">
        truck-telemetry
      </div>

    </div>
  );
}


/* ============================================================
   STREAM PROCESSOR NODE
   ============================================================ */

function ProcessorNode() {

  const healthyWorkers = workers.filter(
    (worker) => worker.status === "healthy"
  ).length;

  return (
    <div className="detailed-topology-node processor-node">

      {/* Input from Kafka */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
      />

      {/* Main data-flow output */}
      <Handle
        type="source"
        position={Position.Right}
        id="data-output"
      />

      {/* Monitoring/state output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="monitoring-output"
      />

      <div className="detailed-node-header">
        <strong>
          Stream Processor
        </strong>

        <span className="topology-health-dot">
          ●
        </span>
      </div>

      <div className="detailed-node-main-value">
        {healthyWorkers}/{workers.length}
      </div>

      <div className="detailed-node-label">
        workers healthy
      </div>

      <div className="detailed-node-info">
        <span className="processor-name">
          Bytewax / Faust
        </span>
      </div>

    </div>
  );
}


/* ============================================================
   TEMPERATURE AGGREGATION NODE
   ============================================================ */

function AggregationNode() {
  return (
    <div className="detailed-topology-node">

      {/* Input from processor */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
      />

      <div className="detailed-node-header">
        <strong>
          Temperature Aggregation
        </strong>

        <span className="topology-health-dot">
          ●
        </span>
      </div>

      <div className="detailed-node-main-value">
        5m
      </div>

      <div className="detailed-node-label">
        rolling window
      </div>

      <div className="detailed-node-info">
        Filter: temperature &gt; 0
      </div>

    </div>
  );
}


/* ============================================================
   ROCKSDB NODE
   ============================================================ */

function RocksDBNode() {
  return (
    <div className="detailed-topology-node">

      {/* Input from processor */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
      />

      <div className="detailed-node-header">
        <strong>
          RocksDB
        </strong>

        <span className="topology-health-dot">
          ●
        </span>
      </div>

      <div className="detailed-node-main-value">
        OK
      </div>

      <div className="detailed-node-label">
        local state store
      </div>

      <div className="detailed-node-info">
        Checkpoint / recovery state
      </div>

    </div>
  );
}


/* ============================================================
   PROMETHEUS NODE
   ============================================================ */

function PrometheusNode() {
  return (
    <div className="detailed-topology-node">

      {/* Input from processor */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
      />

      {/* Output to UI */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
      />

      <div className="detailed-node-header">
        <strong>
          Prometheus
        </strong>

        <span className="topology-health-dot">
          ●
        </span>
      </div>

      <div className="detailed-node-main-value">
        OK
      </div>

      <div className="detailed-node-label">
        metrics service
      </div>

      <div className="detailed-node-info">
        Monitoring
      </div>

    </div>
  );
}


/* ============================================================
   STREAMFORGE UI NODE
   ============================================================ */

function UINode() {
  return (
    <div className="detailed-topology-node">

      {/* Input from Prometheus */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
      />

      <div className="detailed-node-header">
        <strong>
          StreamForge UI
        </strong>

        <span className="topology-health-dot">
          ●
        </span>
      </div>

      <div className="detailed-node-main-value">
        UI
      </div>

      <div className="detailed-node-label">
        monitoring dashboard
      </div>

      <div className="detailed-node-info">
        Live cluster monitoring
      </div>

    </div>
  );
}


/* ============================================================
   NODE TYPES
   ============================================================ */

const nodeTypes = {
  kafka: KafkaNode,
  processor: ProcessorNode,
  aggregation: AggregationNode,
  rocksdb: RocksDBNode,
  prometheus: PrometheusNode,
  ui: UINode,
};


/* ============================================================
   TOPOLOGY PAGE
   ============================================================ */

export default function Topology() {

  const [showMinimap, setShowMinimap] = useState(true);


  /* ==========================================================
     DERIVED DATA
     ========================================================== */

  const healthyWorkers = workers.filter(
    (worker) => worker.status === "healthy"
  ).length;


  const failedWorkers = workers.filter(
    (worker) => worker.status === "failed"
  ).length;


  const activePartitions = partitions.filter(
    (partition) => partition.status === "active"
  ).length;


  /* ==========================================================
     NODES
     ========================================================== */

  const nodes = useMemo(
    () => [

      {
        id: "kafka",
        type: "kafka",
        position: {
          x: 80,
          y: 150,
        },
      },

      {
        id: "processor",
        type: "processor",
        position: {
          x: 380,
          y: 150,
        },
      },

      {
        id: "aggregation",
        type: "aggregation",
        position: {
          x: 700,
          y: 150,
        },
      },

      {
        id: "rocksdb",
        type: "rocksdb",
        position: {
          x: 700,
          y: 350,
        },
      },

      {
        id: "prometheus",
        type: "prometheus",
        position: {
          x: 1000,
          y: 350,
        },
      },

      {
        id: "ui",
        type: "ui",
        position: {
          x: 1300,
          y: 350,
        },
      },

    ],
    []
  );


  /* ==========================================================
     EDGES
     ========================================================== */

  const edges = useMemo(
    () => [

      /* ------------------------------------------------------
         MAIN DATA FLOW
         Kafka → Processor
      ------------------------------------------------------ */

      {
        id: "kafka-to-processor",

        source: "kafka",
        sourceHandle: "output",

        target: "processor",
        targetHandle: "input",

        type: "smoothstep",

        animated: true,

        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      },


      /* ------------------------------------------------------
         MAIN DATA FLOW
         Processor → Aggregation
      ------------------------------------------------------ */

      {
        id: "processor-to-aggregation",

        source: "processor",
        sourceHandle: "data-output",

        target: "aggregation",
        targetHandle: "input",

        type: "smoothstep",

        animated: true,

        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      },


      /* ------------------------------------------------------
         STATE FLOW
         Processor → RocksDB
      ------------------------------------------------------ */

      {
        id: "processor-to-rocksdb",

        source: "processor",
        sourceHandle: "monitoring-output",

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


      /* ------------------------------------------------------
         MONITORING FLOW
         Processor → Prometheus
      ------------------------------------------------------ */

      {
        id: "processor-to-prometheus",

        source: "processor",
        sourceHandle: "monitoring-output",

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


      /* ------------------------------------------------------
         MONITORING FLOW
         Prometheus → UI
      ------------------------------------------------------ */

      {
        id: "prometheus-to-ui",

        source: "prometheus",
        sourceHandle: "output",

        target: "ui",
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


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="topology-page">


      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="topology-page-header">

        <div>

          <h1>
            Topology
          </h1>

          <p>
            Detailed StreamForge processing architecture.
          </p>

        </div>

      </div>


      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <div className="topology-summary">

        <div className="topology-summary-item">

          <span>
            Workers
          </span>

          <strong>
            {healthyWorkers}/{workers.length}
          </strong>

          <small>
            healthy
          </small>

        </div>


        <div className="topology-summary-item">

          <span>
            Partitions
          </span>

          <strong>
            {activePartitions}/{partitions.length}
          </strong>

          <small>
            active
          </small>

        </div>


        <div className="topology-summary-item">

          <span>
            Processor
          </span>

          <strong>
            {topologyStatus.processor.status}
          </strong>

          <small>
            Bytewax / Faust
          </small>

        </div>


        <div className="topology-summary-item">

          <span>
            Worker Failures
          </span>

          <strong
            className={
              failedWorkers > 0
                ? "failure-value"
                : ""
            }
          >
            {failedWorkers}
          </strong>

          <small>
            detected
          </small>

        </div>

      </div>


      {/* =====================================================
          TOOLBAR
      ====================================================== */}

      <div className="topology-toolbar">

        <div>

          <strong>
            Stream Processing Pipeline
          </strong>

          <span>
            Data flow and monitoring architecture
          </span>

        </div>


        <div className="topology-toolbar-actions">

          <button
            className="topology-toolbar-button"
            onClick={() =>
              setShowMinimap(
                (value) => !value
              )
            }
          >
            {showMinimap
              ? "Hide Minimap"
              : "Show Minimap"}
          </button>

        </div>

      </div>


      {/* =====================================================
          REACT FLOW GRAPH
      ====================================================== */}

      <div className="detailed-topology-container">

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

          minZoom={0.4}
          maxZoom={1.5}
        >

          <Background />

          <Controls />

          {showMinimap && (
            <MiniMap />
          )}

        </ReactFlow>

      </div>


      {/* =====================================================
          LEGEND
      ====================================================== */}

      <div className="topology-legend">

        <span className="legend-title">
          Legend
        </span>


        <div className="legend-item">

          <span className="legend-line" />

          <span>
            Data Flow
          </span>

        </div>


        <div className="legend-item">

          <span className="legend-dashed-line" />

          <span>
            Monitoring / State
          </span>

        </div>

      </div>

    </div>
  );
}