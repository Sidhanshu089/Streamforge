import React, { useEffect, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

const Dashboard = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    const initializeGraph = () => {
      setNodes([
        { id: "kafka", position: { x: 0, y: 0 }, data: { label: "Kafka" }, type: "input" },
        { id: "faust", position: { x: 300, y: 0 }, data: { label: "Faust" } },
        { id: "rocketsdb", position: { x: 300, y: 200 }, data: { label: "RocketsDB" } },
        { id: "prometheus", position: { x: 300, y: 400 }, data: { label: "Prometheus" }, type: "output" },
      ]);
      setEdges([
        { id: "e1", source: "kafka", target: "faust" },
        { id: "e2", source: "faust", target: "rocketsdb" },
        { id: "e3", source: "faust", target: "prometheus" },
      ]);
    };
    initializeGraph();
  }, []);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <h1 style={{ textAlign: "center", margin: "20px" }}>StreamForge Topology Dashboard</h1>
      <div
        style={{
          height: "calc(100vh - 140px)",
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

export default Dashboard;