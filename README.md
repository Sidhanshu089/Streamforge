# Stream Forge

Stream Forge is a Python event-processing pipeline for IoT telemetry. It uses Apache Kafka for partitioned input/output, a transactional consumer/producer for processing, RocksDB for local window state, a compacted Kafka topic for recovery, FastAPI for monitoring data, and a React Flow dashboard.

## Processing behavior

The processor consumes one or more comma-separated input topics, validates event fields, and filters temperatures at or below 0°C. For remaining records it calculates a five-minute UTC tumbling-window average per truck and input topic. Each new average is written to `truck-temperature-averages`; the matching state snapshot is written to `truck-temperature-averages-changelog`. The input topic is included in state keys and output records so readings from separate streams do not mix.

The processor commits output, changelog, and source offset in one Kafka transaction. Each process uses its own RocksDB directory and a unique Kafka transactional ID. On startup and whenever Kafka assigns it input partitions, it refreshes local state from the committed changelog before consuming. Consumers of transactional output should use `isolation.level=read_committed`.

## Topics

| Topic | Partitions | Purpose |
| --- | ---: | --- |
| `truck-telemetry` | 20 | Input telemetry events |
| `truck-telemetry-secondary` | 20 | Optional second input stream |
| `truck-temperature-averages` | 20 | Per-event window average updates |
| `truck-temperature-averages-changelog` | 20 | Compacted state snapshots for recovery |

Run topic setup after Kafka starts. It creates missing topics, expands topics that have fewer than 20 partitions, and configures the changelog for compaction.

To prepare two input streams, pass both names to topic setup:

```powershell
.venv\Scripts\python.exe kafka/topic_setup.py --input-topics truck-telemetry,truck-telemetry-secondary
```

## Start the local stack

Install Python requirements once:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Start Kafka and initialize topics:

```powershell
docker compose -f kafka/docker-compose.yml up -d
.venv\Scripts\python.exe kafka/topic_setup.py
```

Run the processor from the repository root in its own terminal:

```powershell
.venv\Scripts\python.exe -m faust.processor
```

The processor serves Prometheus-format metrics on port `9101`. It samples process CPU use and resident memory every two seconds using native operating-system APIs and exports those values alongside its processing metrics. CPU is normalized as a share of all logical host CPUs; memory is the process working set as a share of total physical host memory. To run four processor instances, open four terminals and run the command below in each, changing the metrics port to `9101`, `9102`, `9103`, and `9104`:

```powershell
.venv\Scripts\python.exe -m faust.processor --metrics-port 9101
```

Pass the same `--input-topics` list to each worker to process multiple streams:

```powershell
.venv\Scripts\python.exe -m faust.processor --input-topics truck-telemetry,truck-telemetry-secondary --metrics-port 9101
```

Each process joins the same Kafka group. Kafka distributes all configured topic partitions across the live consumers. With the two example inputs there are 40 partitions total. The dashboard's worker count is the live group member count; partitions are not separate worker processes. Each process creates a unique transactional ID and uses a separate default state directory. If setting `--state-path` explicitly, give each process a different path. Start the API in another terminal:

```powershell
.venv\Scripts\python.exe -m uvicorn backend.api:app --reload --port 8000
```

The API serves `/api/health`, `/api/cluster`, and `/metrics`. It reads the Kafka broker, configured input topics, partition assignments, consumer lag, and processor metrics. It checks RocksDB's live open status from metrics ports `9101` through `9120`; configure `STREAMFORGE_PROCESSOR_METRICS_URLS` when using other ports. Defaults are `localhost:9092`, input topic `truck-telemetry`, and processor group `streamforge-temperature-processor`.

When using multiple input topics, start the API with the same list so the dashboard monitors every stream:

```powershell
$env:KAFKA_INPUT_TOPICS = "truck-telemetry,truck-telemetry-secondary"
.venv\Scripts\python.exe -m uvicorn backend.api:app --reload --port 8000
```

Start the React dashboard in another terminal:

```powershell
cd ui
npm install
npm start
```

Open `http://localhost:3000`. The dashboard refreshes live Kafka and processor data every five seconds. Worker CPU and memory remain blank because the current processor does not export host resource measurements.

## Produce telemetry

The producer emits schema-valid sample truck telemetry with unique event IDs and UTC timestamps. Run a bounded test stream with:

```powershell
.venv\Scripts\python.exe kafka/producer.py --events 100000 --rate 10000
```

The producer supports `--events`, `--duration`, `--rate`, `--topic`, `--topics`, and `--bootstrap-servers`. `--topics` distributes generated records round-robin across multiple source topics:

```powershell
.venv\Scripts\python.exe kafka/producer.py --topics truck-telemetry,truck-telemetry-secondary --events 1000 --duration 60
```

It uses idempotent delivery, acknowledgements from all replicas, batching, and compression.

## Measure consumer throughput

Run a fixed-count read audit in a separate terminal:

```powershell
.venv\Scripts\python.exe kafka/throughput_audit.py --topic truck-telemetry --events 100000
```

The command prints the consumed count, elapsed time, and events per second.

## Processor options

`python -m faust.processor --help` lists the options. Useful settings are:

- `--state-path PATH` selects the local RocksDB directory (default `./rocksdb/state`).
- `--stop-after N` exits after processing N source records, for bounded verification.
- `--metrics-port N` selects the Prometheus exposition port (default `9101`; use `0` to disable it).
- `--bootstrap-servers HOSTS` selects the Kafka bootstrap addresses.

Environment variables can configure topics and services: `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_INPUT_TOPICS` (comma-separated; `KAFKA_INPUT_TOPIC` remains supported), `KAFKA_OUTPUT_TOPIC`, `KAFKA_CHANGELOG_TOPIC`, `KAFKA_PROCESSOR_GROUP`, `KAFKA_TRANSACTIONAL_ID`, `STREAMFORGE_STATE_PATH`, `STREAMFORGE_METRICS_PORT`, `STREAMFORGE_PROCESSOR_METRICS_URL`, `STREAMFORGE_PROCESSOR_METRICS_URLS`, and `REACT_APP_API_URL`.

## Tests and build

Run Python unit tests (using the repository-local temp folder in restricted Windows environments):

```powershell
.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp .venv\test-tmp tests\test_kafka_producer.py tests\test_processor.py tests\test_state_store.py
```

Build the React dashboard:

```powershell
cd ui
npm run build
```

## Current limits

The transaction guarantees cover Kafka output, changelog, and input offsets. RocksDB is local and is repaired from the committed changelog at startup and on partition assignment. Multi-process failover and chaos behavior have not been exhaustively tested. The provided telemetry producer generates sample input; connect a real truck event source by publishing the same JSON contract to one or more configured input topics.
