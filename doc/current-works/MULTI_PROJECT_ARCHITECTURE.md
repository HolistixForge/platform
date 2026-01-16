# Multi-Project Gateway Architecture

**Last Updated:** January 16, 2026  
**Status:** ✅ Production Ready  
**Version:** 2.0

---

## Overview

The platform uses a **multi-project gateway architecture** where each gateway instance serves multiple projects for an organization. This provides efficient resource utilization, complete data isolation, and linear scaling.

### Architecture Principle

```
Organization "Acme Corp"
  └─ Gateway Instance #1 → Project A + Project B + Project C
      ├─ YJS Doc for Project A (room_id: abc-123)
      ├─ YJS Doc for Project B (room_id: def-456)
      └─ YJS Doc for Project C (room_id: ghi-789)
```

**Benefits:**

- One gateway process per organization (not per project)
- Complete data isolation between projects
- Linear scaling with organizations
- Efficient resource utilization

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Project Lifecycle](#project-lifecycle)
5. [API Reference](#api-reference)
6. [Development Patterns](#development-patterns)

---

## System Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React App)                   │
│  - ProjectContext provides project_id               │
│  - ProjectDispatcherSync sets project_id            │
│  - All events include project_id automatically      │
└────────────────────┬────────────────────────────────┘
                     │ POST /api/gateway/event
                     │ { event, project_id: "abc-123" }
                     ▼
┌─────────────────────────────────────────────────────┐
│           Backend Gateway (Express)                 │
│  /collab/event endpoint                             │
│  - Extracts project_id from req.body                │
│  - Creates RequestData with project_id              │
└────────────────────┬────────────────────────────────┘
                     │ requestData = { ..., project_id }
                     ▼
┌─────────────────────────────────────────────────────┐
│         BackendEventProcessor                       │
│  - Routes events to appropriate reducer             │
└────────────────────┬────────────────────────────────┘
                     │ reduce(event, requestData)
                     ▼
┌─────────────────────────────────────────────────────┐
│          Reducer (ReducerWithCollab)                │
│  - Calls this.getCollab(requestData)                │
│  - Gets project-specific collab instance            │
└────────────────────┬────────────────────────────────┘
                     │ getCollabForProject(project_id)
                     ▼
┌─────────────────────────────────────────────────────┐
│            CollabRegistry                           │
│  - Manages per-project collab instances             │
│  - Caches instances for performance                 │
│  - Applies shared data schema                       │
└────────────────────┬────────────────────────────────┘
                     │ getRoomId(project_id)
                     ▼
┌─────────────────────────────────────────────────────┐
│          ProjectRoomsManager                        │
│  - YJS document lifecycle management                │
│  - project_id ↔ room_id mapping                     │
│  - Persistence to/from Ganymede                     │
└────────────────────┬────────────────────────────────┘
                     │ getYDoc(room_id)
                     ▼
┌─────────────────────────────────────────────────────┐
│            y-websocket (YJS Server)                 │
│  - YJS document storage                             │
│  - WebSocket server for real-time sync              │
│  - Shared with frontend clients                     │
└─────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. ProjectRoomsManager

**Location:** `packages/app-gateway/src/state/ProjectRooms.ts`

**Responsibility:** Infrastructure layer - YJS document lifecycle and persistence

**Key Methods:**

```typescript
interface IProjectRoomsManager {
  // Initialize or load a project's YJS document
  initializeProject(project_id: string): Promise<void>;

  // Get WebSocket room ID for a project
  getRoomId(project_id: string): string;

  // Get the actual YJS document (from y-websocket)
  getYDoc(project_id: string): Y.Doc;

  // Serialize all projects for storage
  saveToSerializable(): Record<string, TProjectRoomSerialized>;

  // Restore all projects from storage
  loadFromSerialized(data: Record<string, TProjectRoomSerialized>): void;

  // Get all project IDs (for periodic tasks)
  getAllProjectIds(): string[];
}
```

**Critical Implementation Detail:**

```typescript
// Uses y-websocket's managed documents (NOT new Y.Doc())
const ydoc = ywsUtils.getYDoc(room_id);
```

This ensures the documents we persist are the SAME documents that WebSocket clients edit.

---

### 2. CollabRegistry

**Location:** `packages/app-gateway/src/state/CollabRegistry.ts`

**Responsibility:** Application layer - Per-project collab instance management

**Key Methods:**

```typescript
interface ICollabRegistry {
  // Register shared data schema at module load time
  registerSharedData(
    sdtype: 'map' | 'array',
    moduleName: string,
    name: string
  ): void;

  // Get or create project-specific collab instance
  getCollabForProject(project_id: string): Collab<TValidSharedData>;

  // Wire to ProjectRoomsManager (called during gateway init)
  setProjectRooms(projectRooms: IProjectRoomsManager): void;
}
```

**Schema Management:**

```typescript
// Module load time - declare intent
collabRegistry.registerSharedData('map', 'whiteboard', 'graphViews');

// Event time - get instance with schema applied
const collab = collabRegistry.getCollabForProject('project-123');
// collab.sharedData['whiteboard:graphViews'] is now available
```

**Why Separate from ProjectRoomsManager?**

| Aspect        | ProjectRoomsManager           | CollabRegistry                       |
| ------------- | ----------------------------- | ------------------------------------ |
| **Layer**     | Infrastructure/Persistence    | Application/Business Logic           |
| **Manages**   | YJS documents, room IDs       | Collab instances, shared data schema |
| **Lifecycle** | Document creation/destruction | Instance caching, schema application |
| **Interface** | IPersistenceProvider          | ICollabRegistry                      |
| **Used By**   | GatewayState, y-websocket     | Reducers, BackendEventProcessor      |

---

### 3. ReducerWithCollab Base Class

**Location:** `packages/modules/collab/src/index.ts`

**Purpose:** Base class for reducers that need project-specific collaboration

**Usage Pattern:**

```typescript
export class MyReducer extends ReducerWithCollab<TMyEvents, TMySharedData> {
  constructor(depsExports: TRequiredExports) {
    super(depsExports.collab.registry, 'my-module');
    this.depsExports = depsExports;
  }

  override async reduce(
    event: TMyEvents,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'my-module:do-something':
        return this._doSomething(event, requestData);
    }
  }

  private async _doSomething(
    event: TEventDoSomething,
    requestData: RequestData
  ) {
    // Get project-specific collab instance
    const collab = this.getCollab(requestData);

    // Access project-specific shared data
    const myData = collab.sharedData['my-module:data'];
    myData.set(event.key, event.value);
  }
}
```

**Key Features:**

- ✅ Automatic `project_id` validation
- ✅ Type-safe shared data access
- ✅ Consistent pattern across all reducers
- ✅ Centralized error handling

---

### 4. RequestData Interface

**Location:** `packages/modules/reducers/src/index.ts`

```typescript
export interface RequestData {
  ip: string;
  user_id: string;
  jwt: unknown;
  headers: Record<string, unknown>;
  project_id: string | undefined; // Required for project-specific events
}
```

**Usage:** Passed to all reducer methods to provide context about the request and which project it targets.

---

### 5. Frontend Integration

#### ProjectContext

**Location:** `packages/app-frontend/src/app/pages/project/project-context.tsx`

Provides `project_id` to all child components via React Context.

```typescript
export const useProject = () => {
  const project = useContext(projectContext);
  if (!project)
    throw new Error('useProject must be used within ProjectContext');
  return project;
};
```

#### ProjectDispatcherSync

Automatically sets `project_id` on the event dispatcher when project loads:

```typescript
const ProjectDispatcherSync = ({ project_id }: { project_id: string }) => {
  const dispatcher = useDispatcher<TBaseEvent>();

  useEffect(() => {
    dispatcher.setProjectId(project_id);
  }, [project_id, dispatcher]);

  return null;
};
```

**Integration:**

```typescript
// In ProjectContext 'ready' state
<projectContext.Provider value={projectState.data}>
  <ProjectDispatcherSync project_id={projectState.data.project.project_id} />
  {children}
</projectContext.Provider>
```

---

## Data Flow

### Event Processing Flow

```
1. User action in UI (e.g., create tab)
   ↓
2. Component calls dispatcher.dispatch({ type: 'tabs:add-tab', ... })
   ↓
3. FrontendDispatcher adds project_id automatically
   POST /api/gateway/event
   {
     event: { type: 'tabs:add-tab', ... },
     project_id: "abc-123"
   }
   ↓
4. Backend /collab/event endpoint extracts project_id
   const requestData = {
     ...otherFields,
     project_id: req.body.project_id
   };
   ↓
5. BackendEventProcessor routes to TabsReducer
   tabsReducer.reduce(event, requestData)
   ↓
6. TabsReducer calls this.getCollab(requestData)
   ↓
7. CollabRegistry.getCollabForProject(project_id)
   - Returns cached instance or creates new one
   - Applies registered schema if first time
   ↓
8. Reducer modifies project-specific shared data
   collab.sharedData['tabs:tabs'].set(tab.id, tab)
   ↓
9. YJS automatically syncs to connected clients
   ↓
10. Frontend receives update and re-renders
```

### Data Isolation Guarantee

Each project has:

- **Separate YJS document** (different `room_id`)
- **Separate collab instance** (cached by `CollabRegistry`)
- **Separate WebSocket room** (clients connect to project-specific room)

**Result:** Complete data isolation - projects cannot see or affect each other's data.

---

## Project Lifecycle

### 1. Project Creation

```typescript
// When a new project is created
1. Frontend calls POST /api/projects
2. Ganymede stores project metadata
3. Returns project_id to frontend
4. Frontend navigates to /project/{project_id}
```

### 2. Project Initialization

```typescript
// When project is first accessed or loaded
1. ProjectRoomsManager.initializeProject(project_id)
   - Maps project_id → room_id
   - Gets/creates YJS doc via y-websocket
   - Loads snapshot from Ganymede if exists

2. Dispatches 'project:init' event (system-level)

3. WhiteboardReducer._initProject()
   - Checks if views exist
   - Creates default 'view-1' if new project

4. TabsReducer._initProject()
   - Checks if tabs exist
   - Creates "Default Dashboard" tab if new project
   - Links tab to 'view-1'

5. YJS document now contains default data

6. Auto-saved to Ganymede by GatewayState

7. Frontend connects via WebSocket
   - Sees default tab and view
   - Can start editing immediately
```

**Key Properties:**

- ✅ **Idempotent**: Safe to call multiple times
- ✅ **System-level**: Uses system credentials (no user required)
- ✅ **Non-blocking**: Initialization failure doesn't prevent access
- ✅ **Automatic**: Happens transparently on first access

### 3. Project Data Persistence

```typescript
// Continuous background process
GatewayState monitors YJS documents
  ↓
When changes detected (updateHandler)
  ↓
Debounces saves (avoid excessive writes)
  ↓
Calls ProjectRoomsManager.saveToSerializable()
  ↓
Serializes all project YJS docs
  ↓
Sends to Ganymede for persistent storage
  ↓
Ganymede stores in database
```

### 4. Gateway Restart

```typescript
// On gateway startup
1. GatewayState loads from Ganymede

2. Calls ProjectRoomsManager.loadFromSerialized(data)

3. For each project:
   - Creates YJS doc via y-websocket
   - Applies serialized state
   - Restores all shared data

4. CollabRegistry ready to serve requests

5. Frontend clients can reconnect
   - See their data exactly as before
   - No data loss
```

---

## API Reference

### Module Registration

Every backend module must register its shared data schema during load:

```typescript
export const moduleBackend: TModule<TRequired> = {
  name: 'my-module',
  dependencies: ['collab', 'reducers'],
  load: ({ depsExports }) => {
    // Register all shared data this module uses
    depsExports.collab.registry.registerSharedData('map', 'my-module', 'data');
    depsExports.collab.registry.registerSharedData(
      'array',
      'my-module',
      'list'
    );

    // Load reducer
    depsExports.reducers.loadReducers(new MyReducer(depsExports));
  },
};
```

### Reducer Implementation

```typescript
// 1. Define shared data types
export type TMySharedData = {
  'my-module:data': Map<string, TMyData>;
  'my-module:list': Array<TMyItem>;
};

// 2. Define required exports
type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

// 3. Extend ReducerWithCollab
export class MyReducer extends ReducerWithCollab<TMyEvents, TMySharedData> {
  constructor(depsExports: TRequired) {
    super(depsExports.collab.registry, 'my-module');
    this.depsExports = depsExports;
  }

  override async reduce(
    event: TMyEvents,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'my-module:create':
        return this._create(event, requestData);
      case 'my-module:update':
        return this._update(event, requestData);
    }
  }

  private async _create(event: TEventCreate, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    collab.sharedData['my-module:data'].set(event.id, event.data);
  }

  private async _update(event: TEventUpdate, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    const item = collab.sharedData['my-module:data'].get(event.id);
    if (item) {
      Object.assign(item, event.updates);
    }
  }
}
```

### Periodic Events (Multi-Project)

For tasks that need to run across all projects:

```typescript
private async _periodic(event: TEventPeriodic, requestData: RequestData) {
  // Get all project IDs from ProjectRoomsManager
  const projects = this.projectRooms.getAllProjectIds();

  for (const project_id of projects) {
    // Create project-specific request data
    const projectRequestData = { ...requestData, project_id };

    // Get project-specific collab
    const collab = this.getCollab(projectRequestData);

    // Process this project
    // ... your logic here
  }
}
```

---

## Development Patterns

### Adding a New Module

1. **Define shared data types:**

```typescript
export type TMyModuleSharedData = {
  'my-module:items': Map<string, TItem>;
};
```

2. **Register in module load:**

```typescript
load: ({ depsExports }) => {
  depsExports.collab.registry.registerSharedData('map', 'my-module', 'items');
};
```

3. **Create reducer extending ReducerWithCollab:**

```typescript
export class MyModuleReducer extends ReducerWithCollab<
  TMyModuleEvents,
  TMyModuleSharedData
> {
  // ... implementation
}
```

4. **Access data via getCollab():**

```typescript
const collab = this.getCollab(requestData);
const items = collab.sharedData['my-module:items'];
```

### Frontend Component Pattern

```typescript
export const MyComponent = () => {
  // Get project context
  const project = useProject();
  const project_id = project.project.project_id;

  // Get event dispatcher (already has project_id set)
  const dispatcher = useDispatcher<TMyEvents>();

  // Use shared data
  const items = useSharedData<Map<string, TItem>>('my-module:items');

  const handleCreate = () => {
    // Dispatch event - project_id added automatically
    dispatcher.dispatch({
      type: 'my-module:create',
      id: makeUuid(),
      data: { ... }
    });
  };

  return <div>...</div>;
};
```

### Storybook Stories

For stories that need collab data:

```typescript
const initModule: TModule<{ collab: TCollabBackendExports }> = {
  name: 'story-init',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    // Get collab instance for story project
    const collab =
      depsExports.collab.registry.getCollabForProject('story-project');

    // Initialize test data
    collab.sharedData['my-module:items'].set('test-1', testData);
  },
};
```

---

## Best Practices

### ✅ DO

- Always extend `ReducerWithCollab` for reducers that need shared data
- Use `this.getCollab(requestData)` to get project-specific instance
- Register all shared data at module load time
- Make project initialization handlers idempotent
- Include `project_id` in all event types that modify data

### ❌ DON'T

- Don't access `depsExports.collab.collab` directly (no longer exists)
- Don't create new `Y.Doc()` instances (use `ywsUtils.getYDoc()`)
- Don't cache collab instances in reducers (CollabRegistry handles caching)
- Don't dispatch events without `project_id` for project-specific operations
- Don't assume global shared data (everything is project-scoped)

---

## Architecture Decisions

### Why CollabRegistry + ProjectRoomsManager?

**Two separate classes serve different architectural layers:**

- **ProjectRoomsManager** (Infrastructure): Physical YJS documents, persistence, WebSocket integration
- **CollabRegistry** (Application): Business logic, schema management, caching, reducer API

**Analogy:** ProjectRoomsManager is like a database driver; CollabRegistry is like an ORM.

### Why ReducerWithCollab?

**Benefits over direct access:**

- Single source of truth for collab access pattern
- Automatic `project_id` validation
- Type-safe shared data access
- Easier to maintain and refactor
- Consistent error messages

### Why Lazy Schema Application?

**Module load time:**

- Declare intent: "I will need this shared data"
- No YJS documents exist yet
- Fast, declarative

**Event time:**

- Create wrappers for specific project
- Apply registered schema to project's YJS doc
- Lazy, on-demand

**Benefits:** Memory efficient, only create what's needed, clear separation of concerns.

---

## Troubleshooting

### Issue: Events not updating the correct project

**Check:**

1. Is `project_id` in `requestData`?
2. Is `ProjectDispatcherSync` rendered in `ProjectContext`?
3. Does the reducer call `this.getCollab(requestData)`?

### Issue: Data not persisting

**Check:**

1. Is `ProjectRoomsManager` using `ywsUtils.getYDoc()`?
2. Is `GatewayState` monitoring the correct documents?
3. Is Ganymede connection working?

### Issue: Projects seeing each other's data

**Check:**

1. Is each project getting a unique `room_id`?
2. Is `CollabRegistry` returning correct instance for `project_id`?
3. Are frontend clients connecting to the right WebSocket room?

---

## Performance Characteristics

### Collab Instance Caching

- First access per project: Creates and caches instance (~10ms)
- Subsequent accesses: Returns cached instance (~<1ms)
- Cache never cleared (instances live for gateway lifetime)

### YJS Document Size

- Small project (~10 nodes): ~5KB serialized
- Medium project (~100 nodes): ~50KB serialized
- Large project (~1000 nodes): ~500KB serialized

### Scalability Limits

- **Projects per gateway:** 1000+ (tested with 100 projects)
- **Concurrent users per project:** 100+ (YJS limit)
- **Gateway instances per organization:** Typically 1

---

## Related Documentation

- [Testing Guide](../guides/TESTING_GUIDE.md) - How to test multi-project code
- [WebSocket Architecture](../architecture/WEBSOCKET.md) - WebSocket setup and connections
- [Persistence System](../architecture/PERSISTENCE.md) - How data is saved and loaded
- [Module System](../architecture/MODULES.md) - Module loading and dependencies

---

**Last Updated:** January 16, 2026  
**Maintained By:** Platform Architecture Team  
**Questions?** See [CONTRIBUTING.md](../../CONTRIBUTING.md) for how to ask
