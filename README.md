# Stream Forge

**Distributed Python Event Processor** - A pure-Python distributed stream processor built on Apache Kafka and Faust/Bytewax, designed for massive IoT sensor data processing.

## Overview

When Python developers need to process massive streams of data (e.g., millions of IoT sensor readings), they typically rely on Java-based frameworks like Apache Flink or Spark. Stream Forge provides a pure-Python distributed stream processor that handles fault tolerance, state management, and strict exactly-once processing semantics.

## Use Case

An IoT fleet manager needs to aggregate temperature data from 50,000 trucks every 10 seconds. Stream Forge deploys 20 parallel Python worker nodes that partition the incoming data stream. As trucks send data, workers perform "Windowed Aggregations" (calculating the 5-minute rolling average temperature per truck). If a worker crashes, StreamForge automatically rebalances the partition and recovers state from a RocksDB changelog, ensuring no sensor reading is dropped or processed twice.

## Architecture

```
┌────────────────────┐       ┌────────────────────┐
│   Apache Kafka     │──→────▶│   Faust/Bytewax    │
│   (Message Broker) │       │   (Stream Processor)│
└────────────────────┘       └────────────────────┘
           │                           │
           ▼                           ▼
┌────────────────────┐       ┌────────────────────┐
│   RocksDB Store    │──────▶│   Prometheus Metrics│
│   (State Store)    │       │   (Metrics Export) │
└────────────────────┘       └────────────────────┘
           │                           │
           └──────▶──── React Flow ────┘
              (Topology Monitor)
```

## Week-wise Development Plan

| Week | Stream Processing | State Management & UI |
|------|-------------------|----------------------|
| **Week 1** | Kafka Foundation: Local cluster, Python producer (confluent-kafka) for mock IoT truck telemetry. Topology UI: React Flow dashboard scaffold. | |
| **Week 2** | Stream Topology: Faust/Bytewax processing graph (Consume → Filter → Map). Windowing Logic: 5-minute tumbling/hopping windows. | |
| **Week 3** | Stateful Recovery: RocksDB integration with Kafka changelog topic. Chaos Testing: Kill worker mid-calculation, prove auto-rebalance & state recovery. | |
| **Week 4** | Metrics Export: Prometheus client libraries for processing lag, events/sec. Refine & Polish: Connect Prometheus to React Flow dashboard. | |

## Project Structure

```
streamforge/
├── kafka/           # Week 1: Kafka foundation & producer
│   ├── docker-compose.yml
│   └── producer.py
├── faust/           # Week 2-4: Stream topology
├── rocketsdb/       # Week 3: RocksDB state store
├── ui/              # Week 1-4: Topology dashboard (React + React Flow)
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   └── ...
│   ├── package.json
│   └── ...
├── tests/           # Test suite
└── requirements.txt # Python dependencies
```

## Getting Started (Week 1)

### 1. Start Kafka Cluster

```bash
docker compose -f kafka/docker-compose.yml up -d
python kafka/topic_setup.py
```

This starts:
- Zookeeper (port 2181)
- Kafka (port 9092, 20 partitions)
- Schema Registry (port 8081)
- Creates `truck-telemetry` topic with 20 partitions

### 2. Produce Mock IoT Data

```bash
python kafka/producer.py --events 100000
```

Produces 10,000 events/second for 60 seconds with:
- Truck IDs (TTRK-00001 to TTRK-50000)
- Random temperature readings (-10°C to 50°C)
- UTC timestamps
- JSON-encoded messages with truck_id as key

### Week 2 Kafka Integration and Throughput Audit

Member 2's processor consumes from `truck-telemetry` and publishes results to
`truck-temperature-averages`. Both topics have 20 partitions; `truck_id` is the
message key so readings for a truck retain their partition order.

For a deterministic producer run, use `--events`; add `--rate` to cap the send
rate. The producer prints JSON containing delivered records and events/sec.

```bash
python kafka/producer.py --events 100000 --rate 10000
```

After starting the processor, measure a consumer's read rate with a separate
terminal. Use a freshly recreated local Kafka cluster so the requested count
belongs to the audit run.

```bash
python kafka/throughput_audit.py --topic truck-telemetry --events 100000
```

### 3. Start Topology Dashboard

```bash
cd ui
npm start
```

Runs the React Flow dashboard at `http://localhost:3000` visualizing:
- Kafka partitions
- Worker node health
- Processing throughput

## Dependencies

See `requirements.txt` for full Python package list.

## License

Proprietary - Internal use for IoT fleet management platform.
