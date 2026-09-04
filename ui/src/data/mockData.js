// ============================================================
// StreamForge Mock Data
// ============================================================
//
// Frontend testing only.
//
// Change workerCount / partitionCount to test different
// cluster sizes. The UI itself has no fixed worker limit.
//
// Examples:
//   20 workers / 20 partitions
//   50 workers / 50 partitions
//   100 workers / 50 partitions
//
// Later, this file can be replaced by data from FastAPI.
// ============================================================


// ============================================================
// TEST CONFIGURATION
// ============================================================

export const testConfig = {
  workerCount: 100,
  partitionCount: 50,
};


// ============================================================
// WORKERS
// ============================================================

export const workers = Array.from(
  { length: testConfig.workerCount },
  (_, index) => {

    const workerNumber = index + 1;

    return {
      id: `worker-${String(workerNumber).padStart(2, "0")}`,

      name: `Worker ${String(workerNumber).padStart(2, "0")}`,

      status: "healthy",

      // Deterministic values make UI testing easier.
      eventsPerSecond:
        4500 + (index * 137) % 1200,

      lag:
        20 + (index * 7) % 20,

      cpu:
        35 + (index * 3) % 25,

      memory:
        50 + (index * 2) % 20,

      partitions: [],
    };
  }
);


// ============================================================
// PARTITIONS
// ============================================================

export const partitions = Array.from(
  { length: testConfig.partitionCount },
  (_, index) => {

    const assignedWorker =
      workers.length > 0
        ? workers[index % workers.length]
        : null;

    return {
      id: index,

      name:
        `Partition ${String(index).padStart(2, "0")}`,

      status: "active",

      lag:
        20 + (index * 7) % 20,

      workerId:
        assignedWorker
          ? assignedWorker.id
          : null,
    };
  }
);


// ============================================================
// CONNECT PARTITIONS TO WORKERS
// ============================================================

partitions.forEach((partition) => {

  if (!partition.workerId) {
    return;
  }

  const worker = workers.find(
    (item) => item.id === partition.workerId
  );

  if (worker) {
    worker.partitions.push(partition.id);
  }
});


// ============================================================
// DERIVED SYSTEM METRICS
// ============================================================

const totalEventsPerSecond = workers.reduce(
  (total, worker) =>
    total + worker.eventsPerSecond,
  0
);

const totalConsumerLag = workers.reduce(
  (total, worker) =>
    total + worker.lag,
  0
);

const failedWorkerCount = workers.filter(
  (worker) => worker.status === "failed"
).length;

const activeWorkerCount = workers.filter(
  (worker) => worker.status === "healthy"
).length;

const activePartitionCount = partitions.filter(
  (partition) => partition.status === "active"
).length;


export const systemMetrics = {

  eventsPerSecond:
    totalEventsPerSecond,

  activeWorkers:
    activeWorkerCount,

  totalWorkers:
    workers.length,

  activePartitions:
    activePartitionCount,

  totalPartitions:
    partitions.length,

  processingLatency: 24,

  consumerLag:
    totalConsumerLag,

  failedWorkers:
    failedWorkerCount,

  uptime: "2h 34m",

  throughputTrend: "+4.2%",

  latencyTrend: "-3.1%",
};


// ============================================================
// THROUGHPUT HISTORY
// ============================================================

export const throughputHistory = [
  {
    time: "10:00",
    eventsPerSecond: 78200,
  },

  {
    time: "10:01",
    eventsPerSecond: 81600,
  },

  {
    time: "10:02",
    eventsPerSecond: 85400,
  },

  {
    time: "10:03",
    eventsPerSecond: 90100,
  },

  {
    time: "10:04",
    eventsPerSecond: 93200,
  },

  {
    time: "10:05",
    eventsPerSecond: 91800,
  },

  {
    time: "10:06",
    eventsPerSecond: 95600,
  },

  {
    time: "10:07",
    eventsPerSecond: totalEventsPerSecond,
  },
];


// ============================================================
// BACKWARD-COMPATIBLE METRICS HISTORY
// ============================================================
//
// Metrics.jsx currently expects:
//
//   { eventsPerSecond: number }
//
// Keep this export for now so the existing component
// does not break.
//
// Later we can remove this duplicate once Metrics.jsx
// is changed to use throughputHistory directly.
// ============================================================

export const metricsHistory =
  throughputHistory.map((item) => ({
    eventsPerSecond:
      item.eventsPerSecond,
  }));


// ============================================================
// STREAM PROCESSING PIPELINE
// ============================================================

export const pipeline = {

  inputTopic:
    "truck-telemetry",

  outputTopic:
    "truck-temperature-averages",

  filter:
    "temperature > 0",

  window:
    "5-minute",

  processor:
    "Bytewax / Faust",

  stateStore:
    "RocksDB",

  metrics:
    "Prometheus",
};


// ============================================================
// TOPOLOGY STATUS
// ============================================================

export const topologyStatus = {

  kafka: {
    status: "healthy",

    partitions:
      partitions.length,
  },

  processor: {
    status: "healthy",

    workers:
      workers.length,
  },

  rocksdb: {
    status: "healthy",
  },

  prometheus: {
    status: "healthy",
  },
};