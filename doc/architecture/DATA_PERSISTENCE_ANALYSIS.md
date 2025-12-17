# Data Persistence Architecture Analysis

> **Status:** Requirements Analysis & Technology Survey  
> **Last Updated:** 2025-12-17  
> **Purpose:** Comprehensive analysis of data persistence requirements and possible solutions

---

## Table of Contents

1. [Requirements & Constraints](#requirements--constraints)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Technology Options by Aspect](#technology-options-by-aspect)
4. [Architecture Patterns](#architecture-patterns)
5. [Algorithms & Strategies](#algorithms--strategies)
6. [Trade-off Analysis](#trade-off-analysis)
7. [Recommended Combinations](#recommended-combinations)

---

## Requirements & Constraints

### Functional Requirements

#### FR-1: Data Storage

- **FR-1.1** Store project collaboration data (nodes, edges, chat, etc.)
- **FR-1.2** Store organization metadata (permissions, OAuth, settings)
- **FR-1.3** Store user-generated content with arbitrary schemas
- **FR-1.4** Support module-defined data structures (unknown at design time)
- **FR-1.5** Store CRDT operations for real-time collaboration
- **FR-1.6** Store binary data (images, files, attachments)

#### FR-2: Search & Query

- **FR-2.1** Full-text search across all project data
- **FR-2.2** Semantic/vector search ("car" matches "vehicle")
- **FR-2.3** Search across arbitrary JSON schemas
- **FR-2.4** Filter by entity type, module, project, date
- **FR-2.5** Query nested JSON structures
- **FR-2.6** Graph traversal queries (relationships between entities)

#### FR-3: Versioning & History

- **FR-3.1** Track complete change history per entity
- **FR-3.2** Point-in-time recovery
- **FR-3.3** Diff between versions
- **FR-3.4** Audit trail (who changed what when)
- **FR-3.5** Restore to previous version

#### FR-4: Real-Time Collaboration

- **FR-4.1** Store Yjs CRDT operations
- **FR-4.2** Sync operations across multiple clients
- **FR-4.3** Merge concurrent edits without conflicts
- **FR-4.4** Handle offline/online transitions

#### FR-5: Performance

- **FR-5.1** Lazy loading (load entities on-demand)
- **FR-5.2** Pagination for large datasets
- **FR-5.3** Sub-second query response times
- **FR-5.4** Handle projects with 10,000+ entities
- **FR-5.5** Support 100+ concurrent users per organization

#### FR-6: Backup & Recovery

- **FR-6.1** Automated daily backups
- **FR-6.2** Point-in-time recovery
- **FR-6.3** Disaster recovery procedures
- **FR-6.4** Data export capabilities
- **FR-6.5** Backup verification

### Non-Functional Requirements

#### NFR-1: Scalability

- **NFR-1.1** Support 1,000+ organizations
- **NFR-1.2** Support 10,000+ projects
- **NFR-1.3** Support millions of entities
- **NFR-1.4** Linear scaling with data growth
- **NFR-1.5** Horizontal scaling capability

#### NFR-2: Reliability

- **NFR-2.1** 99.9% uptime
- **NFR-2.2** No data loss (ACID compliance where needed)
- **NFR-2.3** Automatic failover
- **NFR-2.4** Data consistency guarantees
- **NFR-2.5** Transaction support

#### NFR-3: Maintainability

- **NFR-3.1** Simple operational procedures
- **NFR-3.2** Clear monitoring and alerting
- **NFR-3.3** Easy schema evolution
- **NFR-3.4** Standard tools and practices
- **NFR-3.5** Good documentation

#### NFR-4: Security

- **NFR-4.1** Encryption at rest
- **NFR-4.2** Encryption in transit
- **NFR-4.3** Organization data isolation
- **NFR-4.4** Access control
- **NFR-4.5** Audit logging

#### NFR-5: Cost

- **NFR-5.1** Predictable costs
- **NFR-5.2** Efficient storage utilization
- **NFR-5.3** Minimal operational overhead
- **NFR-5.4** Open-source preferred

### Constraints

#### C-1: Cloud Agnostic

- **C-1.1** No AWS-specific services (S3, DynamoDB, etc.)
- **C-1.2** No GCP-specific services (Firestore, etc.)
- **C-1.3** No Azure-specific services
- **C-1.4** Must run on any VPS/bare metal
- **C-1.5** Self-hosted solutions preferred

#### C-2: Gateway Architecture

- **C-2.1** Gateways are organization-agnostic (can serve any org)
- **C-2.2** Gateways are stateless (can restart without data loss)
- **C-2.3** Multiple gateways may exist in a pool
- **C-2.4** Gateway allocation is dynamic (per-org on-demand)
- **C-2.5** Gateways must push data to central persistence

#### C-3: Schema Flexibility

- **C-3.1** Module data structures are unknown at design time
- **C-3.2** New modules can define new entity types
- **C-3.3** No schema migrations when modules are added
- **C-3.4** Support arbitrary nested JSON structures
- **C-3.5** Support arrays, maps, and complex objects

#### C-4: CRDT Management

- **C-4.1** CRDT operations are relative to history
- **C-4.2** Cannot delete old operations without snapshots
- **C-4.3** CRDT metadata grows unbounded
- **C-4.4** Must keep only recent CRDT ops (24h suggested)
- **C-4.5** Must compact old operations periodically

#### C-5: Data Isolation

- **C-5.1** Organizations must be fully isolated
- **C-5.2** Cross-organization queries not required
- **C-5.3** Data breach in one org must not affect others
- **C-5.4** Per-organization backup/restore capability

#### C-6: Lazy Loading

- **C-6.1** Cannot load entire project into memory
- **C-6.2** Must load entities on-demand
- **C-6.3** LRU eviction when memory pressure
- **C-6.4** Background loading for prefetch

---

## Current Architecture Analysis

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│                     Current Architecture                     │
├─────────────────────────────────────────────────────────────┤
│ PostgreSQL (app-ganymede)                                   │
│ • users, organizations, projects, gateways (11 tables)      │
│                                                              │
│ File System (app-ganymede)                                  │
│ • /root/.local-dev/{env}/org-data/{org-uuid}.json          │
│ • Contains: permissions, OAuth, project snapshots            │
│                                                              │
│ In-Memory (app-gateway)                                     │
│ • Yjs documents (one per project)                           │
│ • All projects for an org loaded simultaneously             │
│ • Auto-save every 5 minutes                                 │
└─────────────────────────────────────────────────────────────┘
```

### Current Issues

| Issue                                | Impact                                     | Severity |
| ------------------------------------ | ------------------------------------------ | -------- |
| **5-minute data loss window**        | Lost work if gateway crashes               | HIGH     |
| **No version history**               | Cannot undo/recover from mistakes          | HIGH     |
| **Project-level granularity**        | Must load entire project (no lazy loading) | HIGH     |
| **File-based storage**               | Hard to scale, no transactions             | MEDIUM   |
| **No search capability**             | Cannot find data across projects           | MEDIUM   |
| **CRDT ops not persisted**           | Only in memory until snapshot              | HIGH     |
| **No backup strategy**               | Risk of data loss                          | HIGH     |
| **Single JSON file grows unbounded** | Performance degradation                    | MEDIUM   |

---

## Technology Options by Aspect

### 1. Primary Data Store

#### Option 1.1: PostgreSQL (Relational + JSONB)

**Pros:**

- ✅ ACID compliance
- ✅ JSONB for schema-less data
- ✅ Full-text search (tsvector)
- ✅ Vector search (pgvector extension)
- ✅ Mature backup tools (pg_dump, pg_basebackup)
- ✅ Already in use (no new infrastructure)
- ✅ Excellent query optimizer
- ✅ JSONB GIN indexes for fast queries
- ✅ Cloud-agnostic
- ✅ Recursive CTEs for graph-like queries

**Cons:**

- ⚠️ Write amplification with frequent updates
- ⚠️ Vacuum overhead
- ⚠️ Limited horizontal scaling
- ⚠️ Graph traversal not optimized (slower than native graph DBs)
- ⚠️ Relationship queries can be complex

**Best For:** Core data, versioned data, searchable content, mixed workloads

**PostgreSQL Extensions:**

- **TimescaleDB** (time-series data)
- **Citus** (horizontal sharding)
- **AGE (Apache Graph Extension)** (native graph queries in PostgreSQL!)
- **pg_partman** (table partitioning)

---

#### Option 1.2: Neo4j (Native Graph Database)

**Type:** ACID-compliant labeled property graph database

**Pros:**

- ✅ **Native graph storage** - optimized for relationships
- ✅ **Cypher query language** - intuitive for graph queries
- ✅ **Constant-time traversals** - O(1) relationship lookup
- ✅ **ACID compliance** - full transactions
- ✅ **Schema-optional** - flexible property model
- ✅ **Path finding algorithms** - shortest path, PageRank, etc.
- ✅ **Graph algorithms library** - community detection, centrality
- ✅ **Full-text search** - built-in indexes
- ✅ **Vector search** - via vector index (4.4+)
- ✅ **Cloud-agnostic** - self-hosted or managed
- ✅ **Causal clustering** - high availability

**Cons:**

- ⚠️ Additional infrastructure (separate from PostgreSQL)
- ⚠️ JVM-based (memory overhead)
- ⚠️ Dual database approach (need both Neo4j + PostgreSQL?)
- ⚠️ Licensing: Community (GPLv3) vs Enterprise (commercial)
- ⚠️ Limited aggregation compared to SQL
- ⚠️ Backup/restore more complex than PostgreSQL

**Use Cases for Your Project:**

- ✅ **Graph whiteboard** - nodes/edges are native concepts
- ✅ **Entity relationships** - traverse module interconnections
- ✅ **Dependency tracking** - "what depends on this node?"
- ✅ **Impact analysis** - "what breaks if I change this?"
- ✅ **Recommendation** - "find similar projects/nodes"
- ✅ **Version graph** - versions as nodes, changes as edges

**Query Example (Cypher):**

```cypher
// Find all nodes connected to a node within 3 hops
MATCH (n:Node {id: $nodeId})-[*1..3]-(connected)
RETURN DISTINCT connected

// Find shortest path between two nodes
MATCH path = shortestPath(
  (a:Node {id: $nodeA})-[*]-(b:Node {id: $nodeB})
)
RETURN path

// PageRank for node importance
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC LIMIT 10
```

**Best For:**

- Graph-heavy workloads
- Relationship-centric queries
- Path finding and traversal
- Social networks, recommendation engines
- Dependency management

---

#### Option 1.3: ArangoDB (Multi-Model)

**Type:** Multi-model (document, graph, key-value)

**Pros:**

- ✅ **Single database for multiple models**
- ✅ **Native graph** - similar performance to Neo4j
- ✅ **Document store** - JSON documents like MongoDB
- ✅ **AQL query language** - unified query across models
- ✅ **Full-text search** - built-in
- ✅ **Distributed** - horizontal scaling, sharding
- ✅ **ACID transactions** - across documents and graphs
- ✅ **Apache 2.0 license**
- ✅ **Cloud-agnostic**
- ✅ **Foxx microservices** - JavaScript functions in DB

**Cons:**

- ⚠️ Smaller community than Neo4j or PostgreSQL
- ⚠️ Learning curve (AQL is different)
- ⚠️ Less mature graph algorithms than Neo4j
- ⚠️ C++ based (harder to extend)

**Use Cases for Your Project:**

- ✅ **Single database** - graph + documents + key-value
- ✅ **Flexible data model** - switch between models per use case
- ✅ **Complex queries** - join documents with graph traversal
- ✅ **Microservices** - Foxx for custom logic

**Query Example (AQL):**

```aql
// Graph traversal + document filtering
FOR node IN 1..3 OUTBOUND 'nodes/start' EDGES
  FILTER node.type == 'component'
  RETURN node

// Join documents with graph
FOR doc IN documents
  FOR node IN 1..2 OUTBOUND doc._id GRAPH 'myGraph'
    RETURN {doc: doc, related: node}
```

**Best For:**

- Mixed workloads (graph + document)
- Wanting to consolidate databases
- Distributed graph queries

---

#### Option 1.4: JanusGraph (Distributed Graph)

**Type:** Distributed graph database (built on Cassandra/HBase)

**Pros:**

- ✅ **Massively scalable** - billions of vertices/edges
- ✅ **Gremlin query language** (Apache TinkerPop)
- ✅ **Pluggable storage** - Cassandra, HBase, BerkeleyDB
- ✅ **Pluggable indexes** - Elasticsearch, Solr, Lucene
- ✅ **Apache 2.0 license**
- ✅ **OLTP + OLAP** - real-time + batch analytics
- ✅ **Cloud-agnostic**

**Cons:**

- ⚠️ **Very complex** - multiple components (Cassandra + ES + JanusGraph)
- ⚠️ **Eventual consistency** (with Cassandra backend)
- ⚠️ **Heavy operational burden**
- ⚠️ **Overkill for small/medium scale**
- ⚠️ Development less active than Neo4j

**Best For:**

- Web-scale graphs (Google, Facebook level)
- Multi-datacenter deployments
- Big data analytics on graphs

**Not Recommended** for your use case (too complex)

---

#### Option 1.5: Dgraph (Distributed Graph + GraphQL)

**Type:** Native distributed graph database

**Pros:**

- ✅ **GraphQL native** - query with GraphQL
- ✅ **Distributed** - horizontal scaling
- ✅ **ACID transactions** (within shard)
- ✅ **DQL query language** - graph-specific
- ✅ **Full-text + vector search**
- ✅ **Apache 2.0 license** (Dgraph Community)
- ✅ **Cloud-agnostic**
- ✅ **High performance** (written in Go)

**Cons:**

- ⚠️ Smaller community
- ⚠️ Less mature than Neo4j
- ⚠️ GraphQL only (no other query interface)
- ⚠️ Limited graph algorithms

**Best For:**

- GraphQL-first applications
- Distributed graph queries
- Modern API design

---

#### Option 1.6: Memgraph (In-Memory Graph)

**Type:** In-memory graph database (disk persistence optional)

**Pros:**

- ✅ **Extremely fast** - in-memory, C++ implementation
- ✅ **Cypher compatible** - same as Neo4j
- ✅ **ACID transactions**
- ✅ **Streaming support** - Kafka, Pulsar integration
- ✅ **Graph algorithms** - built-in library
- ✅ **BSL 1.1 license** (free for <4 cores, then commercial)
- ✅ **Cloud-agnostic**

**Cons:**

- ⚠️ Memory-bound (dataset must fit in RAM)
- ⚠️ More expensive (need more RAM)
- ⚠️ Licensing restrictions for larger deployments
- ⚠️ Smaller ecosystem than Neo4j

**Best For:**

- Real-time graph analytics
- Streaming data processing
- Performance-critical applications

---

#### Option 1.7: Apache AGE (Graph Extension for PostgreSQL)

**Type:** PostgreSQL extension that adds graph database capabilities

**Pros:**

- ✅ **No additional infrastructure** - runs in PostgreSQL!
- ✅ **Cypher queries** in PostgreSQL
- ✅ **Hybrid queries** - SQL + Cypher in same query
- ✅ **ACID compliance** (PostgreSQL transactions)
- ✅ **All PostgreSQL features** - JSONB, full-text, pgvector
- ✅ **PostgreSQL tooling** - pg_dump, replication, etc.
- ✅ **Apache 2.0 license**
- ✅ **Cloud-agnostic**
- ✅ **Already have PostgreSQL** - minimal change

**Cons:**

- ⚠️ Slower than native graph DBs (not index-free adjacency)
- ⚠️ Young project (PostgreSQL 11+, released 2021)
- ⚠️ Limited graph algorithms
- ⚠️ Community smaller than Neo4j
- ⚠️ Performance degrades with deep traversals

**Use Cases for Your Project:**

- ✅ **Best of both worlds** - SQL + Graph
- ✅ **No new infrastructure**
- ✅ **Gradual adoption** - add graph queries where needed
- ✅ **Unified backup/restore**
- ✅ **Single query language** for mixed queries

**Query Example (AGE + SQL):**

```sql
-- Create graph
SELECT create_graph('project_graph');

-- Cypher query in SQL
SELECT * FROM cypher('project_graph', $$
  MATCH (n:Node)-[:CONNECTS_TO]->(m:Node)
  WHERE n.type = 'component'
  RETURN n.name, m.name
$$) as (from_node agtype, to_node agtype);

-- Mixed SQL + Cypher
SELECT e.entity_id, graph.connections
FROM entities e
CROSS JOIN LATERAL (
  SELECT * FROM cypher('project_graph', $$
    MATCH (n {entity_id: $entity_id})-[*1..2]-(connected)
    RETURN connected.name
  $$, json_build_object('entity_id', e.entity_id)
  ) as (name agtype)
) as graph(connections);
```

**Best For:**

- Projects already on PostgreSQL
- Don't want operational complexity
- Need both relational + graph queries
- Moderate graph workloads

---

### Graph Database Deep Dive for Your Use Case

#### Your Project's Graph Nature

Your platform is **inherently a graph**:

- **Nodes** in whiteboard
- **Edges** connecting nodes
- **Entity relationships** (containers → services, notebooks → cells)
- **Module dependencies** (module A uses data from module B)
- **Version trees** (version 1 → version 2 → version 3)
- **User collaboration** (user A modified node X)

#### Graph Database Benefits for Your Requirements

| Requirement                | PostgreSQL        | Neo4j            | Apache AGE            | Verdict            |
| -------------------------- | ----------------- | ---------------- | --------------------- | ------------------ |
| **Schema-less**            | ✅ JSONB          | ✅ Properties    | ✅ JSONB + Properties | Tie                |
| **Entity relationships**   | ⚠️ JOINs slow     | ✅ Native O(1)   | ⚠️ Better than JOINs  | **Neo4j/AGE**      |
| **Graph traversal**        | ⚠️ Recursive CTEs | ✅ Optimized     | ⚠️ OK for shallow     | **Neo4j**          |
| **Lazy loading**           | ✅ Easy           | ✅ Easy          | ✅ Easy               | Tie                |
| **Full-text search**       | ✅ Excellent      | ⚠️ Basic         | ✅ Excellent          | **PostgreSQL/AGE** |
| **Vector search**          | ✅ pgvector       | ⚠️ Limited       | ✅ pgvector           | **PostgreSQL/AGE** |
| **ACID**                   | ✅ Yes            | ✅ Yes           | ✅ Yes                | Tie                |
| **Backup/Restore**         | ✅ Mature         | ⚠️ Complex       | ✅ Mature             | **PostgreSQL/AGE** |
| **Operational complexity** | ✅ Simple         | ⚠️ Additional DB | ✅ Simple             | **PostgreSQL/AGE** |
| **Cloud-agnostic**         | ✅ Yes            | ✅ Yes           | ✅ Yes                | Tie                |
| **Already using**          | ✅ Yes            | ❌ No            | ✅ Extension          | **PostgreSQL/AGE** |

#### Specific Use Cases Where Graph DB Shines

**1. "Find all nodes impacted by changing this node"**

```cypher
// Neo4j/AGE - Simple and fast
MATCH (start:Node {id: $nodeId})-[:DEPENDS_ON*1..]->(affected)
RETURN DISTINCT affected

// PostgreSQL (without AGE) - Complex
WITH RECURSIVE deps AS (
  SELECT to_entity_id as id, 1 as depth
  FROM entity_relationships
  WHERE from_entity_id = $nodeId
  UNION ALL
  SELECT r.to_entity_id, d.depth + 1
  FROM deps d
  JOIN entity_relationships r ON r.from_entity_id = d.id
  WHERE d.depth < 10
)
SELECT DISTINCT e.* FROM entities e
JOIN deps d ON e.entity_id = d.id;
```

**2. "Find shortest path between two nodes"**

```cypher
// Neo4j/AGE - Built-in
MATCH path = shortestPath(
  (a:Node {id: $nodeA})-[*]-(b:Node {id: $nodeB})
)
RETURN path, length(path)

// PostgreSQL - Very complex recursive CTE
-- Not practical for deep graphs
```

**3. "Find all nodes similar to this one" (collaborative filtering)**

```cypher
// Neo4j/AGE - Pattern matching
MATCH (target:Node {id: $nodeId})-[:HAS_TAG]->(tag)<-[:HAS_TAG]-(similar)
WHERE similar <> target
RETURN similar, count(tag) as commonTags
ORDER BY commonTags DESC
LIMIT 10

// PostgreSQL - Joins and aggregations
-- Slower for many-to-many relationships
```

**4. "Community detection" (find clusters of related nodes)**

```cypher
// Neo4j - Built-in algorithms
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).name)

// PostgreSQL - Would need custom implementation
-- No built-in graph algorithms
```

#### When Graph DB is NOT Needed

- **Simple CRUD operations** - PostgreSQL is simpler
- **Reporting/analytics** - SQL aggregations better
- **Shallow relationships** (1-2 levels) - PostgreSQL recursive CTEs fine
- **Mostly independent entities** - Relational model sufficient

---

### Hybrid Approach: PostgreSQL + Graph

#### Option A: Apache AGE Extension (Recommended)

```
PostgreSQL with AGE extension
├── Core tables (users, orgs, projects) - SQL
├── Entity properties - JSONB
├── Entity relationships - Graph edges (Cypher)
├── Full-text search - tsvector
├── Vector search - pgvector
└── Backup - pg_dump (everything in one DB)
```

**Pros:**

- ✅ Single database
- ✅ SQL for structured queries
- ✅ Cypher for graph queries
- ✅ No operational complexity
- ✅ Gradual adoption (add graph where needed)

**Cons:**

- ⚠️ Not as fast as native graph DB
- ⚠️ Limited graph algorithms

**Best For:** Most use cases (yours included)

---

#### Option B: PostgreSQL + Neo4j (Dual Database)

```
PostgreSQL (source of truth)
├── Users, orgs, projects
├── Entity properties (full data)
├── Version history
├── Permissions, OAuth
└── Search index

Neo4j (graph projection)
├── Entities as nodes (metadata only)
├── Relationships as edges
├── Graph algorithms
└── Synced from PostgreSQL
```

**Pros:**

- ✅ Best of both worlds
- ✅ Neo4j performance for graph queries
- ✅ PostgreSQL for everything else

**Cons:**

- ⚠️ Two databases to maintain
- ⚠️ Sync complexity
- ⚠️ Potential consistency issues
- ⚠️ More operational overhead

**Best For:** Large-scale with heavy graph workloads

---

#### Option C: PostgreSQL Only (Current Baseline)

```
PostgreSQL
├── All data in tables
├── Relationships via foreign keys
├── Recursive CTEs for traversal
└── JSONB for flexibility
```

**Pros:**

- ✅ Simplest
- ✅ No new technology
- ✅ Mature tooling

**Cons:**

- ⚠️ Graph queries are slow
- ⚠️ Complex recursive CTEs
- ⚠️ No graph algorithms

**Best For:** Small scale, simple relationships

---

### 2. Search Technology

#### Option 2.1: PostgreSQL Full-Text Search

**Technology:** `tsvector`, `tsquery`, GIN indexes

**Pros:**

- ✅ No additional infrastructure
- ✅ ACID guarantees
- ✅ Synchronous updates
- ✅ Cloud-agnostic
- ✅ Multi-language support

**Cons:**

- ⚠️ Limited relevance ranking
- ⚠️ No fuzzy search
- ⚠️ No faceting
- ⚠️ Basic stemming

**Performance:** ~100ms for 1M documents

---

#### Option 2.2: Elasticsearch

**Pros:**

- ✅ Best-in-class full-text search
- ✅ Fuzzy search, phrase search, proximity
- ✅ Excellent relevance ranking
- ✅ Aggregations/faceting
- ✅ Distributed by design
- ✅ Real-time indexing

**Cons:**

- ⚠️ Additional infrastructure (JVM, memory-hungry)
- ⚠️ Eventual consistency
- ⚠️ Complex to operate
- ⚠️ Licensing (Elastic License since v7.11)

**Performance:** ~10ms for 10M+ documents

---

#### Option 2.3: OpenSearch (Elasticsearch fork)

**Pros:**

- ✅ All Elasticsearch features
- ✅ Apache 2.0 license
- ✅ Community-driven
- ✅ AWS backing (but cloud-agnostic)

**Cons:**

- ⚠️ Same operational complexity as ES
- ⚠️ Memory-hungry
- ⚠️ JVM overhead

**Performance:** Similar to Elasticsearch

---

#### Option 2.4: Meilisearch

**Pros:**

- ✅ Extremely fast (Rust-based)
- ✅ Simple to deploy (single binary)
- ✅ Typo-tolerant by default
- ✅ Low memory footprint
- ✅ MIT license
- ✅ Great developer experience

**Cons:**

- ⚠️ Not distributed (single node)
- ⚠️ Limited aggregations
- ⚠️ Young project
- ⚠️ Max ~10M documents per instance

**Performance:** ~1ms for 1M documents

---

#### Option 2.5: Typesense

**Pros:**

- ✅ Fast (C++ based)
- ✅ Typo tolerance
- ✅ Faceting/filtering
- ✅ Easy deployment
- ✅ GPL3 license

**Cons:**

- ⚠️ Not distributed
- ⚠️ Limited ecosystem
- ⚠️ Smaller community

**Performance:** ~5ms for 1M documents

---

#### Option 2.6: pg_trgm (PostgreSQL Trigram)

**Technology:** PostgreSQL extension for similarity search

**Pros:**

- ✅ No additional infrastructure
- ✅ Fuzzy/similarity search
- ✅ Works with any text
- ✅ GIN/GiST indexes

**Cons:**

- ⚠️ Slower than dedicated search engines
- ⚠️ Limited features

**Performance:** ~200ms for fuzzy search on 1M rows

---

### 3. Vector/Semantic Search

#### Option 3.1: pgvector (PostgreSQL Extension)

**Pros:**

- ✅ No additional infrastructure
- ✅ ACID guarantees
- ✅ Hybrid search (SQL + vectors)
- ✅ Cloud-agnostic
- ✅ PostgreSQL 11+
- ✅ IVFFlat and HNSW indexes

**Cons:**

- ⚠️ Limited to ~1M vectors per table
- ⚠️ Slower than specialized vector DBs
- ⚠️ Memory overhead for large vectors

**Performance:** ~10-50ms for kNN search on 1M vectors

**Supported Distances:** L2, inner product, cosine

---

#### Option 3.2: Qdrant

**Pros:**

- ✅ Purpose-built for vectors
- ✅ Extremely fast (Rust)
- ✅ Filtering + vector search
- ✅ Distributed/sharded
- ✅ Snapshots, backups
- ✅ Apache 2.0 license

**Cons:**

- ⚠️ Additional infrastructure
- ⚠️ Separate from main database
- ⚠️ Eventual consistency

**Performance:** ~1-5ms for kNN on 10M+ vectors

---

#### Option 3.3: Milvus

**Pros:**

- ✅ Massive scale (billions of vectors)
- ✅ GPU acceleration
- ✅ Multiple index types
- ✅ Cloud-native
- ✅ Apache 2.0 license

**Cons:**

- ⚠️ Complex architecture (multiple components)
- ⚠️ Heavy resource requirements
- ⚠️ Overkill for small/medium scale

**Performance:** ~1ms for kNN on 1B+ vectors

---

#### Option 3.4: Weaviate

**Pros:**

- ✅ Vector + graph database
- ✅ Built-in ML models
- ✅ RESTful + GraphQL API
- ✅ Schema-based
- ✅ BSD license

**Cons:**

- ⚠️ Additional infrastructure
- ⚠️ Go-based (less ecosystem)
- ⚠️ Complex for simple use cases

**Performance:** ~5-10ms for kNN

---

#### Option 3.5: Chroma

**Pros:**

- ✅ Simple embedding database
- ✅ Python-native
- ✅ Perfect for LLM apps
- ✅ Apache 2.0 license
- ✅ Easy to embed

**Cons:**

- ⚠️ Not production-ready (as of 2025)
- ⚠️ Limited scalability
- ⚠️ Young project

**Performance:** Suitable for <100K vectors

---

### 4. Embedding Models (for Semantic Search)

#### Option 4.1: Ollama (Local LLM Server)

**Models:**

- `nomic-embed-text` (768d, 137M params)
- `all-minilm` (384d, 33M params)

**Pros:**

- ✅ Self-hosted (cloud-agnostic)
- ✅ No API costs
- ✅ Privacy (data stays local)
- ✅ MIT license
- ✅ Easy deployment

**Cons:**

- ⚠️ Requires GPU/CPU resources
- ⚠️ Slower than cloud APIs
- ⚠️ Need to manage model updates

**Performance:** ~50-200ms per embedding (CPU), ~5-20ms (GPU)

---

#### Option 4.2: Sentence Transformers (Local)

**Models:**

- `all-MiniLM-L6-v2` (384d)
- `all-mpnet-base-v2` (768d)

**Pros:**

- ✅ Python library
- ✅ No external service
- ✅ Apache 2.0 license
- ✅ Wide model selection

**Cons:**

- ⚠️ Requires Python runtime
- ⚠️ Model download/management
- ⚠️ CPU/GPU requirements

**Performance:** ~100ms per embedding (CPU)

---

#### Option 4.3: OpenAI Embeddings (Cloud)

**Models:**

- `text-embedding-3-small` (1536d, $0.02/1M tokens)
- `text-embedding-3-large` (3072d, $0.13/1M tokens)

**Pros:**

- ✅ Best quality
- ✅ No infrastructure
- ✅ Fast
- ✅ Latest models

**Cons:**

- ❌ Not cloud-agnostic
- ❌ API costs
- ❌ Data leaves premises
- ❌ Rate limits

**Performance:** ~50ms per embedding

---

#### Option 4.4: FastEmbed (Rust)

**Pros:**

- ✅ Extremely fast (Rust + ONNX)
- ✅ No Python required
- ✅ Small binary
- ✅ Apache 2.0 license

**Cons:**

- ⚠️ Limited model selection
- ⚠️ Young project

**Performance:** ~20ms per embedding (CPU)

---

### 5. Object Storage (for Large Files)

#### Option 5.1: MinIO

**Pros:**

- ✅ S3-compatible API
- ✅ Self-hosted
- ✅ Cloud-agnostic
- ✅ AGPL license (free) or commercial
- ✅ Web console
- ✅ Erasure coding
- ✅ Versioning, lifecycle policies

**Cons:**

- ⚠️ Additional infrastructure
- ⚠️ Requires multiple disks for erasure coding

**Performance:** Similar to S3

---

#### Option 5.2: SeaweedFS

**Pros:**

- ✅ Fast and scalable
- ✅ S3-compatible
- ✅ Apache 2.0 license
- ✅ Efficient for small files
- ✅ POSIX FUSE mount

**Cons:**

- ⚠️ Smaller community
- ⚠️ Less mature than MinIO
- ⚠️ Complex architecture

**Performance:** Very fast for small files

---

#### Option 5.3: File System (Direct)

**Pros:**

- ✅ No additional infrastructure
- ✅ Simple
- ✅ Fast local access
- ✅ POSIX tools work

**Cons:**

- ⚠️ No replication
- ⚠️ No versioning
- ⚠️ Hard to distribute
- ⚠️ Backup complexity

**Best For:** Single-server deployments

---

#### Option 5.4: Ceph

**Pros:**

- ✅ Distributed object store
- ✅ S3-compatible (via RGW)
- ✅ Block + file + object storage
- ✅ LGPL license
- ✅ Production-proven

**Cons:**

- ⚠️ Complex to deploy/operate
- ⚠️ High resource requirements
- ⚠️ Steep learning curve

**Best For:** Large-scale deployments (100TB+)

---

### 6. CRDT/Collaboration Technology

#### Option 6.1: Yjs (Current)

**Pros:**

- ✅ Best-in-class CRDT
- ✅ Extremely fast
- ✅ Rich data types (Text, Array, Map, XML)
- ✅ Great ecosystem
- ✅ MIT license
- ✅ Binary protocol (efficient)

**Cons:**

- ⚠️ Operations grow unbounded
- ⚠️ Binary format (harder to debug)
- ⚠️ Need custom persistence

**Persistence Options:**

- `y-leveldb` (LevelDB backend)
- `y-indexeddb` (browser)
- Custom (current approach)

---

#### Option 6.2: Automerge

**Pros:**

- ✅ JSON-like API
- ✅ Immutable snapshots
- ✅ Time travel
- ✅ MIT license
- ✅ Great for audit trails

**Cons:**

- ⚠️ Slower than Yjs
- ⚠️ Larger document size
- ⚠️ More memory usage

**Best For:** Audit-focused applications

---

#### Option 6.3: Operational Transform (OT)

**Examples:** Google Docs, ShareDB

**Pros:**

- ✅ Mature technology
- ✅ Proven at scale
- ✅ Simpler mental model

**Cons:**

- ⚠️ Requires central server
- ⚠️ Complex transformation functions
- ⚠️ Hard to extend

**Not Recommended:** CRDTs are better for P2P and multi-master

---

### 7. Versioning Strategies

#### Option 7.1: Event Sourcing

**Pattern:** Store all events, rebuild state by replaying

**Pros:**

- ✅ Complete history
- ✅ Audit trail
- ✅ Time travel
- ✅ Easy to add new projections

**Cons:**

- ⚠️ Complex to implement
- ⚠️ Replay can be slow
- ⚠️ Storage grows linearly

**Best For:** Financial systems, audit-critical apps

---

#### Option 7.2: Snapshot + Deltas

**Pattern:** Periodic full snapshots, deltas in between

**Pros:**

- ✅ Fast recovery (from snapshot)
- ✅ Bounded replay time
- ✅ Storage efficient

**Cons:**

- ⚠️ More complex than snapshots-only
- ⚠️ Need delta calculation

**Best For:** Collaboration tools (Figma, Notion)

---

#### Option 7.3: Copy-on-Write (COW)

**Pattern:** Never modify, always create new version

**Pros:**

- ✅ Simple versioning
- ✅ Fast reads (immutable)
- ✅ Safe concurrent access

**Cons:**

- ⚠️ Storage overhead
- ⚠️ Garbage collection needed

**Best For:** Git-like systems

---

#### Option 7.4: Diff/Patch

**Pattern:** Store diffs between versions (JSON Patch RFC 6902)

**Pros:**

- ✅ Space efficient
- ✅ Human-readable
- ✅ Standard format

**Cons:**

- ⚠️ Need to apply patches to reconstruct
- ⚠️ Slow for deep history

**Best For:** Document editors

---

### 8. Backup Strategies

#### Option 8.1: pg_dump (PostgreSQL)

**Type:** Logical backup

**Pros:**

- ✅ Simple
- ✅ Cross-platform
- ✅ Can restore to different versions
- ✅ Built-in

**Cons:**

- ⚠️ Slow for large databases
- ⚠️ No point-in-time recovery

**Recovery Time:** ~1 hour for 100GB

---

#### Option 8.2: pg_basebackup + WAL Archiving

**Type:** Physical backup + continuous archiving

**Pros:**

- ✅ Point-in-time recovery
- ✅ Fast restore
- ✅ Continuous protection

**Cons:**

- ⚠️ More complex setup
- ⚠️ More storage required

**Recovery Time:** ~10 minutes for 100GB

---

#### Option 8.3: pgBackRest

**Type:** Backup management tool

**Pros:**

- ✅ Incremental backups
- ✅ Compression
- ✅ Parallel backup/restore
- ✅ S3-compatible storage
- ✅ PITR support

**Cons:**

- ⚠️ Additional tool to learn

**Recovery Time:** ~5 minutes for 100GB (incremental)

---

#### Option 8.4: Borg Backup

**Type:** Deduplicating backup

**Pros:**

- ✅ Deduplication (saves space)
- ✅ Encryption
- ✅ Compression
- ✅ BSD license
- ✅ Any destination (SSH, disk)

**Cons:**

- ⚠️ Not database-aware
- ⚠️ Need to stop writes during backup

**Best For:** File-level backups

---

#### Option 8.5: Restic

**Type:** Deduplicating backup

**Pros:**

- ✅ Similar to Borg
- ✅ Multiple backends (S3, SFTP, local)
- ✅ BSD license
- ✅ Snapshots

**Cons:**

- ⚠️ Not database-aware

**Best For:** File-level backups, MinIO backups

---

### 9. Caching Strategies

#### Option 9.1: Redis

**Pros:**

- ✅ Extremely fast (in-memory)
- ✅ Rich data structures
- ✅ Pub/sub for real-time
- ✅ Persistence options (RDB, AOF)
- ✅ BSD license

**Cons:**

- ⚠️ Additional infrastructure
- ⚠️ Memory-bound
- ⚠️ Single-threaded (per instance)

**Best For:** Session cache, hot data

---

#### Option 9.2: KeyDB

**Pros:**

- ✅ Redis fork with multi-threading
- ✅ Faster than Redis (2-5x)
- ✅ Drop-in replacement
- ✅ BSD license

**Cons:**

- ⚠️ Smaller community
- ⚠️ Less mature

**Best For:** High-throughput caching

---

#### Option 9.3: In-Memory LRU (Application)

**Pros:**

- ✅ No additional infrastructure
- ✅ Simple
- ✅ Fast

**Cons:**

- ⚠️ Not shared across processes
- ⚠️ Lost on restart

**Best For:** Per-process caching

---

---

## Architecture Patterns

### Pattern 1: Centralized PostgreSQL (Simple)

```
┌─────────────────────────────────────────┐
│         PostgreSQL (Central)             │
│  • Core data (users, orgs, projects)    │
│  • Entity storage (JSONB)               │
│  • Search index (tsvector)              │
│  • Vector embeddings (pgvector)         │
│  • CRDT operations (24h)                │
│  • Version history                      │
│  • Relationships (foreign keys)         │
└─────────────────────────────────────────┘
              ▲          ▲
              │          │
      ┌───────┴──┐   ┌──┴───────┐
      │ Gateway 1│   │ Gateway 2│
      │ (Org A)  │   │ (Org B)  │
      └──────────┘   └──────────┘
```

**Pros:**

- ✅ Simple architecture
- ✅ ACID guarantees
- ✅ Easy queries across all data
- ✅ Centralized backups
- ✅ Single database to maintain

**Cons:**

- ⚠️ Single point of failure
- ⚠️ Write bottleneck
- ⚠️ Network latency from gateways
- ⚠️ Graph queries slow (recursive CTEs)

**Best For:** Small to medium scale (<10K orgs), simple relationships

---

### Pattern 1a: PostgreSQL + Apache AGE (Hybrid)

```
┌──────────────────────────────────────────────┐
│         PostgreSQL + AGE Extension           │
│  ┌────────────────────────────────────────┐  │
│  │ Relational (SQL)                       │  │
│  │ • Users, orgs, projects                │  │
│  │ • Entity properties (JSONB)            │  │
│  │ • Version history                      │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Graph (Cypher)                         │  │
│  │ • Nodes (entities)                     │  │
│  │ • Edges (relationships)                │  │
│  │ • Graph traversal                      │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Search & Vectors                       │  │
│  │ • tsvector (full-text)                 │  │
│  │ • pgvector (semantic)                  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
              ▲          ▲
              │          │
      ┌───────┴──┐   ┌──┴───────┐
      │ Gateway 1│   │ Gateway 2│
      │ (Org A)  │   │ (Org B)  │
      └──────────┘   └──────────┘
```

**Pros:**

- ✅ Single database (operational simplicity)
- ✅ SQL for structured queries
- ✅ Cypher for graph queries
- ✅ Fast graph traversal (better than CTEs)
- ✅ All PostgreSQL benefits
- ✅ Unified backup/restore

**Cons:**

- ⚠️ Not as fast as native graph DB
- ⚠️ Limited graph algorithms
- ⚠️ Young project (less mature)

**Best For:** Projects with significant graph aspects (RECOMMENDED FOR YOUR USE CASE)

---

### Pattern 1b: PostgreSQL + Neo4j (Dual Database)

```
┌────────────────────────────────────┐
│     PostgreSQL (Source of Truth)   │
│  • Users, orgs, projects           │
│  • Entity properties (full data)   │
│  • Version history                 │
│  • Permissions, OAuth              │
│  • Search index                    │
└────────────────┬───────────────────┘
                 │ Sync
                 │ (Change Data Capture)
                 ▼
┌────────────────────────────────────┐
│     Neo4j (Graph Projection)       │
│  • Entities as nodes (metadata)    │
│  • Relationships as edges          │
│  • Graph algorithms                │
│  • Fast traversal                  │
└────────────────────────────────────┘
          ▲              ▲
          │              │
   ┌──────┴──┐    ┌──────┴──┐
   │Gateway 1│    │Gateway 2│
   │  (SQL)  │    │ (Cypher)│
   └─────────┘    └─────────┘
```

**Pros:**

- ✅ Best of both worlds
- ✅ Neo4j performance for graph queries
- ✅ PostgreSQL for ACID, search, etc.
- ✅ Specialized tools for each workload

**Cons:**

- ⚠️ Two databases to maintain
- ⚠️ Sync complexity (CDC required)
- ⚠️ Potential consistency lag
- ⚠️ Higher operational overhead
- ⚠️ More expensive (2 databases)

**Sync Strategies:**

1. **Trigger-based** - PostgreSQL triggers push to Neo4j
2. **CDC (Debezium)** - Stream changes via Kafka
3. **Application-level** - Gateway writes to both
4. **Batch sync** - Periodic full sync (eventual consistency)

**Best For:** Large scale with heavy graph workloads (1000+ orgs, complex graphs)

---

### Pattern 2: Database per Organization

```
┌─────────────────┐  ┌─────────────────┐
│  PostgreSQL A   │  │  PostgreSQL B   │
│  (Org A data)   │  │  (Org B data)   │
└─────────────────┘  └─────────────────┘
        ▲                    ▲
        │                    │
   ┌────┴────┐         ┌────┴────┐
   │Gateway A│         │Gateway B│
   └─────────┘         └─────────┘
```

**Pros:**

- ✅ Perfect isolation
- ✅ Independent scaling
- ✅ No cross-org queries needed

**Cons:**

- ⚠️ Complex orchestration
- ⚠️ High operational overhead
- ⚠️ More expensive

**Best For:** Multi-tenant SaaS at scale (10K+ orgs)

---

### Pattern 3: Hybrid (DB + Object Storage)

```
┌──────────────────────────────────────────┐
│          PostgreSQL (Metadata)           │
│  • Users, orgs, projects                │
│  • Entity metadata + small data         │
│  • Search index                         │
│  • References to object storage         │
└──────────────────────────────────────────┘
         │
         ├──────────────────────────────────┐
         ▼                                  ▼
┌─────────────────┐           ┌─────────────────────┐
│ MinIO (Objects) │           │ Gateways (In-Memory)│
│ • Large snapshots│◄─────────┤ • Yjs docs (hot)    │
│ • Binary files   │          │ • LRU cache         │
└─────────────────┘           └─────────────────────┘
```

**Pros:**

- ✅ Database for structured queries
- ✅ Object storage for large data
- ✅ Cost-effective storage
- ✅ Good separation of concerns

**Cons:**

- ⚠️ Two systems to manage
- ⚠️ Consistency between DB and object store

**Best For:** Mixed workloads (small + large data)

---

### Pattern 4: Event Sourcing + CQRS

```
┌────────────────────────────────────────┐
│        Event Store (PostgreSQL)        │
│  • All events (append-only)           │
│  • Immutable history                  │
└────────────────────────────────────────┘
         │
         ├────────────┬─────────────┐
         ▼            ▼             ▼
┌───────────┐  ┌───────────┐  ┌──────────┐
│ Read Model│  │Search Index│  │Analytics │
│(PostgreSQL)│  │(Meilisearch)│  │ (Parquet)│
└───────────┘  └───────────┘  └──────────┘
```

**Pros:**

- ✅ Perfect audit trail
- ✅ Multiple read models
- ✅ Time travel
- ✅ Scalable reads

**Cons:**

- ⚠️ Complex to implement
- ⚠️ Eventual consistency
- ⚠️ Projection management

**Best For:** Audit-critical, event-driven systems

---

### Pattern 5: Per-Project Storage

```
┌──────────────────────────────────────────┐
│     PostgreSQL (Core + Metadata)         │
│  • Users, orgs, projects                │
│  • Project → Storage location mapping   │
└──────────────────────────────────────────┘
         │
         ├─────────────┬────────────┬───────────┐
         ▼             ▼            ▼           ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────┐
    │Project A│  │Project B│  │Project C│  │ ...  │
    │(SQLite) │  │(SQLite) │  │(SQLite) │  │      │
    └─────────┘  └─────────┘  └─────────┘  └──────┘
```

**Pros:**

- ✅ Perfect lazy loading
- ✅ Easy backup (per project)
- ✅ Independent scaling
- ✅ Simple per-project queries

**Cons:**

- ⚠️ Cross-project queries hard
- ⚠️ Many files to manage
- ⚠️ Aggregation complexity

**Best For:** Project-centric apps with weak relationships

---

### Pattern 6: Microservices (Separate Persistence Service)

```
┌──────────────┐      ┌──────────────────────┐
│   Ganymede   │─────►│ Persistence Service  │
│   (API)      │      │ • Entity CRUD        │
└──────────────┘      │ • Search API         │
                      │ • Version history    │
┌──────────────┐      └──────────┬───────────┘
│   Gateway    │─────────────────┘
└──────────────┘             │
                             ▼
                   ┌──────────────────┐
                   │   PostgreSQL +   │
                   │   MinIO +        │
                   │   Meilisearch    │
                   └──────────────────┘
```

**Pros:**

- ✅ Clear separation
- ✅ Independent scaling
- ✅ Technology flexibility
- ✅ Easier to test

**Cons:**

- ⚠️ Network overhead
- ⚠️ More complex deployment
- ⚠️ Distributed transactions

**Best For:** Microservices architecture

---

## Algorithms & Strategies

### 1. CRDT Compaction Algorithms

#### Algorithm 1.1: Periodic Snapshot

```
Every N minutes or M operations:
1. Create full snapshot of current state
2. Delete all operations before snapshot
3. Keep operations after snapshot

Pros: Simple, predictable
Cons: Fixed interval may not be optimal
```

#### Algorithm 1.2: Size-Based Compaction

```
When operation log exceeds threshold:
1. Create snapshot
2. Delete old operations
3. Reset counter

Pros: Adapts to activity level
Cons: May create too many snapshots
```

#### Algorithm 1.3: Hybrid (Time + Size)

```
Create snapshot if:
  - Time since last snapshot > 1 hour OR
  - Operation count > 1000 OR
  - Operation log size > 10MB

Delete operations if:
  - Age > 24 hours AND
  - Newer snapshot exists

Pros: Best of both worlds
Cons: More parameters to tune
```

---

### 2. Lazy Loading Strategies

#### Strategy 2.1: LRU Cache with Prefetch

```
On entity request:
1. Check cache → return if present
2. Load from database
3. Add to LRU cache
4. If cache full, evict LRU item
5. Background: prefetch related entities

Pros: Minimizes latency
Cons: Complex prefetch logic
```

#### Strategy 2.2: Reference Counting

```
Track active references to each entity:
1. Load entity → ref_count++
2. Release entity → ref_count--
3. Evict when ref_count == 0 and memory pressure

Pros: Never evicts active data
Cons: Memory leaks if refs not released
```

#### Strategy 2.3: Time-Based Eviction

```
Evict entities that haven't been accessed in N minutes

Pros: Simple
Cons: May evict frequently-used data
```

---

### 3. Search Indexing Strategies

#### Strategy 3.1: Synchronous Indexing

```
On entity save:
1. Save to database (transaction)
2. Update search index (same transaction)
3. Commit both

Pros: Always consistent
Cons: Slower writes
```

#### Strategy 3.2: Asynchronous Indexing

```
On entity save:
1. Save to database
2. Queue indexing job
3. Background worker indexes

Pros: Fast writes
Cons: Search lag, eventual consistency
```

#### Strategy 3.3: Batch Indexing

```
Every N seconds:
1. Find entities modified since last batch
2. Bulk index to search engine

Pros: Efficient for high write rates
Cons: Search lag up to N seconds
```

---

### 4. Versioning Strategies

#### Strategy 4.1: Full Snapshot per Version

```
Store complete entity state for each version

Storage: version_count × avg_entity_size
Restore: O(1) - just read version

Best For: Small entities, few versions
```

#### Strategy 4.2: Forward Deltas

```
Store base version + deltas forward

Storage: base + (version_count × avg_delta)
Restore: O(n) - apply n deltas from base

Best For: Frequent updates, large entities
```

#### Strategy 4.3: Reverse Deltas

```
Store latest version + deltas backward

Storage: latest + (version_count × avg_delta)
Restore: O(1) for latest, O(n) for old

Best For: Most accesses to latest version
```

#### Strategy 4.4: Periodic Snapshots + Deltas

```
Snapshot every 10 versions, deltas in between

Storage: (version_count / 10) × avg_size + deltas
Restore: O(10) max - load snapshot + ≤10 deltas

Best For: Balance storage and speed
```

---

### 5. Backup Strategies

#### Strategy 5.1: Full Backup Daily

```
Every 24 hours: Full backup

Storage: N × avg_db_size (N days retention)
Recovery: Fast (restore one file)

Best For: Small databases (<100GB)
```

#### Strategy 5.2: Full Weekly + Incremental Daily

```
Sunday: Full backup
Monday-Saturday: Incremental

Storage: 1 × full + 6 × incremental
Recovery: Medium (restore full + incrementals)

Best For: Medium databases (100GB-1TB)
```

#### Strategy 5.3: Continuous (WAL Archiving)

```
Continuously archive transaction logs

Storage: base + continuous log stream
Recovery: Point-in-time to any second

Best For: Mission-critical data
```

---

### 6. Sharding Strategies (if needed for scale)

#### Strategy 6.1: Organization-Based Sharding

```
Hash(organization_id) % num_shards → shard

Pros: Perfect isolation
Cons: Unbalanced if org sizes vary
```

#### Strategy 6.2: Project-Based Sharding

```
Hash(project_id) % num_shards → shard

Pros: More even distribution
Cons: Cross-project queries harder
```

#### Strategy 6.3: Consistent Hashing

```
Use consistent hash ring for shard assignment

Pros: Easy to add/remove shards
Cons: More complex to implement
```

---

## Trade-off Analysis

### Simplicity vs Features

| Approach                    | Simplicity | Features   | Best For                    |
| --------------------------- | ---------- | ---------- | --------------------------- |
| **PostgreSQL only**         | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | Small-medium scale          |
| **PostgreSQL + MinIO**      | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | Most use cases              |
| **PostgreSQL + ES + MinIO** | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | Search-heavy                |
| **MongoDB + MinIO**         | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | Schema flexibility priority |
| **Event Sourcing + CQRS**   | ⭐⭐       | ⭐⭐⭐⭐⭐ | Audit-critical              |

### Cost vs Performance

| Technology            | Cost ($/month for 100GB) | Performance | Cloud-Agnostic |
| --------------------- | ------------------------ | ----------- | -------------- |
| **PostgreSQL**        | $0 (open-source)         | ⭐⭐⭐⭐    | ✅             |
| **+ pgvector**        | $0                       | ⭐⭐⭐      | ✅             |
| **+ Meilisearch**     | $0                       | ⭐⭐⭐⭐⭐  | ✅             |
| **+ MinIO**           | $0 + storage             | ⭐⭐⭐⭐    | ✅             |
| **+ Elasticsearch**   | $0 + resources           | ⭐⭐⭐⭐⭐  | ✅             |
| **MongoDB Atlas**     | $57-$200                 | ⭐⭐⭐⭐    | ⚠️             |
| **OpenAI Embeddings** | Variable                 | ⭐⭐⭐⭐⭐  | ❌             |

### Operational Complexity

| Setup                  | Components | Complexity | Monitoring | Backup       |
| ---------------------- | ---------- | ---------- | ---------- | ------------ |
| **PostgreSQL only**    | 1          | ⭐         | Simple     | pg_dump      |
| **PostgreSQL + MinIO** | 2          | ⭐⭐       | Medium     | pg_dump + mc |
| **+ Meilisearch**      | 3          | ⭐⭐⭐     | Medium     | + snapshots  |
| **+ Redis**            | 4          | ⭐⭐⭐     | Medium     | + RDB        |
| **+ Elasticsearch**    | 5+         | ⭐⭐⭐⭐⭐ | Complex    | + snapshots  |

---

## Recommended Combinations

### Tier 1: Minimal (Best for MVP/Small Scale)

```yaml
Primary Storage: PostgreSQL
  - Core data
  - Entity storage (JSONB)
  - Full-text search (tsvector)
  - No vector search initially

CRDT: Yjs
  - In-memory during collaboration
  - Periodic snapshots to PostgreSQL

Files: File system
  - Direct storage
  - Simple backup with rsync

Backup: pg_dump
  - Daily full backups
  - 7-day retention

Estimated Cost: $0 (open-source)
Operational Complexity: ⭐
Scales To: 100 orgs, 1K projects
```

---

### Tier 2: Recommended (Production-Ready)

```yaml
Primary Storage: PostgreSQL + Apache AGE
  - Core data (SQL)
  - Entity storage (JSONB)
  - Graph relationships (Cypher)
  - Full-text search (tsvector)
  - Vector search (pgvector)
  - Entity-level versioning

Object Storage: MinIO
  - Large snapshots (>1MB)
  - File attachments
  - Backup destination

Search: Meilisearch
  - Fast full-text search
  - Typo tolerance
  - Faceting

Embeddings: Ollama (self-hosted)
  - nomic-embed-text model
  - Local inference

CRDT: Yjs
  - In-memory hot data
  - Operations logged to PostgreSQL (24h)
  - Hourly snapshots

Backup: pgBackRest
  - Incremental backups
  - Point-in-time recovery
  - MinIO as backup destination

Estimated Cost: $50-100/month (VPS + storage)
Operational Complexity: ⭐⭐⭐
Scales To: 1K orgs, 10K projects, 1M entities

Why AGE:
  - No additional infrastructure
  - Graph queries where needed (traversal, path finding)
  - SQL queries for everything else
  - Single database = simpler operations
```

---

### Tier 2b: Recommended with Neo4j (Graph-Heavy Workloads)

```yaml
Primary Storage: PostgreSQL
  - Core data (users, orgs, projects)
  - Entity properties (full data)
  - Version history
  - Permissions, OAuth

Graph Database: Neo4j
  - Entity graph (nodes + edges)
  - Graph algorithms
  - Fast traversal
  - Synced from PostgreSQL (CDC)

Object Storage: MinIO
  - Large snapshots
  - File attachments

Search: Meilisearch
  - Full-text search

Embeddings: Ollama
  - Self-hosted embeddings

Sync: Debezium + Kafka
  - Change Data Capture
  - PostgreSQL → Neo4j sync

CRDT: Yjs
  - Real-time collaboration

Backup:
  - pgBackRest (PostgreSQL)
  - Neo4j backup tool

Estimated Cost: $100-200/month (need more resources for Neo4j)
Operational Complexity: ⭐⭐⭐⭐
Scales To: 1K orgs, 10K projects, complex graphs

When to choose this:
  - Heavy graph traversal (5+ levels deep)
  - Graph algorithms needed (PageRank, community detection)
  - Relationship queries are primary workload
  - Willing to manage two databases
```

---

### Tier 3: Enterprise (High Scale)

```yaml
Primary Storage: PostgreSQL (Citus extension)
  - Sharded by organization
  - Core data
  - Entity metadata

Entity Storage: Per-project PostgreSQL databases
  - SQLite or PostgreSQL
  - Lazy loading
  - LRU cache

Object Storage: MinIO (distributed)
  - Erasure coding
  - Multi-node cluster
  - Lifecycle policies

Search: OpenSearch
  - Distributed cluster
  - Replicated indexes
  - Advanced analytics

Vector Search: Qdrant
  - Dedicated vector database
  - Sharded collections
  - GPU acceleration option

Embeddings: Ollama cluster
  - Multiple inference nodes
  - Load-balanced

Cache: KeyDB
  - Multi-threaded Redis
  - Hot data cache
  - Session storage

CRDT: Yjs + Redis
  - Redis for operation log
  - PostgreSQL for snapshots

Backup: pgBackRest + Velero
  - Continuous archiving
  - Kubernetes-native
  - Automated testing

Estimated Cost: $500-2000/month
Operational Complexity: ⭐⭐⭐⭐⭐
Scales To: 10K+ orgs, 100K+ projects, 100M+ entities
```

---

## Summary Table: Quick Comparison

| Aspect                | Minimal      | Recommended        | Recommended + Graph   | Enterprise           |
| --------------------- | ------------ | ------------------ | --------------------- | -------------------- |
| **Primary DB**        | PostgreSQL   | PostgreSQL + AGE   | PostgreSQL + Neo4j    | PostgreSQL (Citus)   |
| **Graph Model**       | Foreign keys | Cypher (AGE)       | Neo4j native          | Distributed graph    |
| **Entity Storage**    | JSONB        | JSONB              | JSONB + Neo4j props   | Per-project DB       |
| **Full-Text Search**  | tsvector     | Meilisearch        | Meilisearch           | OpenSearch           |
| **Vector Search**     | None         | pgvector           | pgvector              | Qdrant               |
| **Embeddings**        | None         | Ollama             | Ollama                | Ollama cluster       |
| **Object Storage**    | File system  | MinIO              | MinIO                 | MinIO (distributed)  |
| **Cache**             | None         | In-memory          | In-memory             | KeyDB                |
| **CRDT**              | Yjs (memory) | Yjs (DB log)       | Yjs (DB log)          | Yjs (Redis log)      |
| **Backup**            | pg_dump      | pgBackRest         | pgBackRest + Neo4j    | Full automation      |
| **Versioning**        | Snapshots    | Snapshots + deltas | Snapshots + deltas    | Event sourcing       |
| **Cost**              | $0           | $50-100/mo         | $100-200/mo           | $500-2000/mo         |
| **Complexity**        | ⭐           | ⭐⭐⭐             | ⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐           |
| **Scales To**         | 100 orgs     | 1K orgs            | 1K orgs (graph-heavy) | 10K+ orgs            |
| **Graph Performance** | ⚠️ Slow      | ⭐⭐⭐ Good        | ⭐⭐⭐⭐⭐ Excellent  | ⭐⭐⭐⭐⭐ Excellent |

---

## Graph Database Decision Matrix

### Choose **PostgreSQL Only** if:

- ❌ Minimal graph traversal (1-2 levels max)
- ❌ Simple parent-child relationships only
- ❌ Mostly CRUD operations
- ✅ Want simplest possible setup
- ✅ Cost is primary concern

**Graph Query Performance:** Slow (recursive CTEs)

---

### Choose **PostgreSQL + Apache AGE** if:

- ✅ Moderate graph traversal (2-4 levels)
- ✅ Graph is important but not dominant
- ✅ Want single database
- ✅ Want SQL + Graph in one place
- ✅ Gradual adoption (add graph where needed)
- ⚠️ Can accept slower graph performance than native

**Graph Query Performance:** Good (better than CTEs, slower than Neo4j)

**Your Use Case Fit:** ⭐⭐⭐⭐⭐ **EXCELLENT** - Best balance of features and simplicity

---

### Choose **PostgreSQL + Neo4j** if:

- ✅ Heavy graph traversal (5+ levels)
- ✅ Graph is dominant workload
- ✅ Need graph algorithms (PageRank, community detection, etc.)
- ✅ Performance-critical graph queries
- ⚠️ Can manage two databases
- ⚠️ Can handle sync complexity

**Graph Query Performance:** Excellent (native graph, optimized)

**Your Use Case Fit:** ⭐⭐⭐ **GOOD** - If graph performance is critical

---

### Choose **ArangoDB** if:

- ✅ Want single multi-model database
- ✅ Need graph + document + key-value
- ✅ Want simpler than dual database
- ⚠️ Willing to learn AQL
- ⚠️ Smaller community than PostgreSQL/Neo4j

**Graph Query Performance:** Excellent

**Your Use Case Fit:** ⭐⭐⭐⭐ **VERY GOOD** - Consolidates multiple needs

---

## Specific Recommendation for YOUR Project

### Primary Recommendation: PostgreSQL + Apache AGE

**Rationale:**

1. **Your Graph Nature:**

   - Whiteboard with nodes/edges → Perfect for graph model
   - Entity relationships → Graph traversal
   - Module dependencies → Graph queries
   - Version trees → Graph structure

2. **Your Constraints:**

   - ✅ Cloud-agnostic → AGE is PostgreSQL extension
   - ✅ Schema-less → JSONB properties + graph structure
   - ✅ Already on PostgreSQL → Just add extension
   - ✅ Single database → Simpler operations
   - ✅ Gateway-agnostic → Centralized PostgreSQL

3. **Your Requirements:**

   - ✅ Lazy loading → Query entities as needed
   - ✅ Search → tsvector + pgvector + Meilisearch
   - ✅ Versioning → Standard PostgreSQL approaches
   - ✅ Backup → pg_dump handles everything

4. **Operational Simplicity:**
   - ✅ No new infrastructure
   - ✅ Same backup strategy
   - ✅ Same monitoring
   - ✅ Same deployment

**Migration Path:**

```
Phase 1: Current PostgreSQL (no changes)
  ↓
Phase 2: Add AGE extension
  ↓
Phase 3: Create graph nodes for entities
  ↓
Phase 4: Create graph edges for relationships
  ↓
Phase 5: Gradually add Cypher queries where beneficial
  ↓
Phase 6: Keep SQL for everything else
```

**Example Queries:**

```sql
-- Find all nodes within 3 hops (Cypher in PostgreSQL)
SELECT * FROM cypher('project_graph', $$
  MATCH (start:Node {id: $nodeId})-[*1..3]-(connected)
  RETURN DISTINCT connected
$$, json_build_object('nodeId', 'node-123'))
as (node agtype);

-- Combine SQL and Cypher (powerful!)
SELECT
  e.entity_id,
  e.data->>'title' as title,
  graph.connections
FROM entities e
CROSS JOIN LATERAL (
  SELECT array_agg(connected) as connections
  FROM cypher('project_graph', $$
    MATCH (n {entity_id: $eid})-[:CONNECTS_TO]-(connected)
    RETURN connected.name
  $$, json_build_object('eid', e.entity_id))
  as (name agtype)
) as graph
WHERE e.project_id = $projectId;

-- Find shortest path
SELECT * FROM cypher('project_graph', $$
  MATCH path = shortestPath(
    (a:Node {id: $nodeA})-[*]-(b:Node {id: $nodeB})
  )
  RETURN path, length(path) as hops
$$, json_build_object('nodeA', 'n1', 'nodeB', 'n2'))
as (path agtype, hops agtype);
```

**When to Reconsider (Move to Neo4j):**

- Graph queries are >50% of workload
- Need graph algorithms (community detection, centrality)
- Traversal depth regularly >5 levels
- AGE performance becomes bottleneck
- Scale to 10K+ organizations

---

## AGE Extension Setup

### Installation (PostgreSQL 11+)

```bash
# Ubuntu/Debian
sudo apt install postgresql-15-age

# Or build from source
git clone https://github.com/apache/age.git
cd age
make install
```

### Enable in Database

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS age;

-- Load AGE into search path
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Create a graph
SELECT create_graph('holistix_graph');
```

### Create Nodes and Edges

```sql
-- Create node
SELECT * FROM cypher('holistix_graph', $$
  CREATE (n:Node {
    entity_id: 'node-123',
    type: 'component',
    name: 'User Service',
    data: '{"color": "blue", "x": 100, "y": 200}'
  })
  RETURN n
$$) as (node agtype);

-- Create edge
SELECT * FROM cypher('holistix_graph', $$
  MATCH (a:Node {entity_id: 'node-123'})
  MATCH (b:Node {entity_id: 'node-456'})
  CREATE (a)-[r:CONNECTS_TO {type: 'data_flow'}]->(b)
  RETURN r
$$) as (relationship agtype);
```

### Sync with Existing Tables

```sql
-- Populate graph from existing entities table
DO $$
DECLARE
  entity_row RECORD;
BEGIN
  FOR entity_row IN
    SELECT entity_id, entity_type, data
    FROM entities
    WHERE deleted_at IS NULL
  LOOP
    PERFORM cypher('holistix_graph', $$
      CREATE (n:Node {
        entity_id: $entity_id,
        type: $entity_type,
        properties: $data
      })
    $$, json_build_object(
      'entity_id', entity_row.entity_id,
      'entity_type', entity_row.entity_type,
      'data', entity_row.data
    ));
  END LOOP;
END $$;

-- Populate edges from relationships table
DO $$
DECLARE
  rel_row RECORD;
BEGIN
  FOR rel_row IN
    SELECT from_entity_id, to_entity_id, relationship_type
    FROM entity_relationships
    WHERE deleted_at IS NULL
  LOOP
    PERFORM cypher('holistix_graph', $$
      MATCH (a:Node {entity_id: $from_id})
      MATCH (b:Node {entity_id: $to_id})
      CREATE (a)-[r:RELATIONSHIP {type: $rel_type}]->(b)
    $$, json_build_object(
      'from_id', rel_row.from_entity_id,
      'to_id', rel_row.to_entity_id,
      'rel_type', rel_row.relationship_type
    ));
  END LOOP;
END $$;
```

### Maintain Sync with Triggers

```sql
-- Trigger to sync entities table to graph
CREATE OR REPLACE FUNCTION sync_entity_to_graph()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Upsert node in graph
    PERFORM cypher('holistix_graph', $$
      MERGE (n:Node {entity_id: $entity_id})
      SET n.type = $entity_type,
          n.properties = $data
    $$, json_build_object(
      'entity_id', NEW.entity_id,
      'entity_type', NEW.entity_type,
      'data', NEW.data
    ));
  ELSIF TG_OP = 'DELETE' THEN
    -- Delete node from graph
    PERFORM cypher('holistix_graph', $$
      MATCH (n:Node {entity_id: $entity_id})
      DETACH DELETE n
    $$, json_build_object('entity_id', OLD.entity_id));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entity_graph_sync
AFTER INSERT OR UPDATE OR DELETE ON entities
FOR EACH ROW EXECUTE FUNCTION sync_entity_to_graph();
```

---

## Next Steps

1. **Choose Tier** based on current scale and budget
2. **Prototype** with Minimal tier
3. **Migrate** to Recommended tier before production
4. **Plan** for Enterprise tier if growth demands

---

## References

- PostgreSQL JSONB: https://www.postgresql.org/docs/current/datatype-json.html
- pgvector: https://github.com/pgvector/pgvector
- Meilisearch: https://www.meilisearch.com/
- MinIO: https://min.io/
- Yjs: https://yjs.dev/
- Ollama: https://ollama.ai/
- pgBackRest: https://pgbackrest.org/
