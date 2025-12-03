# Module Testing with Storybook

## Overview

Modules can be tested in isolation using Storybook, running both backend and frontend code entirely in the browser without needing the full stack (Ganymede, Gateway, containers, VPN, etc.).

> **📚 Module Documentation:** Each module has its own README documenting its features, API, dependencies, and exports. See the [Module Reference](../../packages/modules/README.md) for individual module documentation.

## How Module Stories Work

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│                                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │          Storybook Story Component             │   │
│  └────────────────────────────────────────────────┘   │
│                        │                                │
│       ┌────────────────┴────────────────┐              │
│       │                                  │              │
│  ┌────▼─────┐                     ┌─────▼────┐        │
│  │  Backend │                     │ Frontend │        │
│  │  Modules │                     │  Modules │        │
│  │          │◄──────link──────────┤          │        │
│  │ - collab │                     │ - collab │        │
│  │ - reducers│                    │ - reducers│       │
│  │ - core   │                     │ - core   │        │
│  │ - space  │                     │ - space  │        │
│  │ - jupyter│                     │ - jupyter│        │
│  │ - gateway│ (fake stub)         │          │        │
│  └──────────┘                     └──────────┘        │
│                                                          │
│  No real network, no real gateway, no VPN              │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Fake Collab Configuration

```typescript
const collabConfig = {
  type: 'none', // No real WebSocket connection
  room_id: 'space-story', // Local room ID
  simulateUsers: true, // Simulate collaborative users
  user: { username: 'test', color: 'red' },
};
```

**What `type: 'none'` does:**

- No WebSocket connection to real gateway
- State stored in browser memory only
- Changes synced via `linkDispatchToProcessEvent` (direct function calls)
- Perfect for testing module logic in isolation

#### 2. Module Setup Pattern

Every module story follows this pattern:

```typescript
// 1. Define backend modules
const modulesBackend = [
  { module: collabBackend, config: collabConfig },
  { module: reducersBackend, config: {} },
  { module: coreBackend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: ['collab', 'reducers'],
      load: () => {
        /* empty stub */
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: yourModuleBackend, config: {} },
];

// 2. Define frontend modules
const modulesFrontend = [
  { module: collabFrontend, config: collabConfig },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: yourModuleFrontend, config: {} },
];

// 3. Initialize in component
const Story = () => {
  const { frontendModules } = useMemo(() => {
    const backendModules = loadModules(modulesBackend);
    const frontendModules = loadModules(modulesFrontend);

    // Link frontend dispatch to backend event processor
    linkDispatchToProcessEvent(
      backendModules as { reducers: TReducersBackendExports },
      frontendModules as { reducers: TReducersFrontendExports }
    );

    return { backendModules, frontendModules };
  }, []);

  return (
    <ModuleProvider exports={frontendModules}>
      <YourModuleComponent />
    </ModuleProvider>
  );
};
```

#### 3. Event Flow (Without Real Gateway)

```
Frontend                Backend
   │                       │
   ├─ dispatch(event) ────►│
   │                       │
   │                  process event
   │                  update state
   │                  emit updates
   │                       │
   │◄──── state change ────┤
   │                       │
   └─ re-render           │
```

**Key: `linkDispatchToProcessEvent`**

- Directly connects frontend dispatch to backend event processor
- No HTTP, no WebSocket, just function calls
- Synchronous state updates (easier debugging)

### Example: Jupyter Module Story

```typescript
// packages/modules/jupyter/src/lib/stories/jupyter-module.stories.tsx

import { collabBackend, collabFrontend } from '@holistix/collab';
import { reducersBackend, reducersFrontend } from '@holistix/reducers';
import { jupyterBackend, jupyterFrontend } from '../index';

// ... config setup ...

const Story = () => {
  // Initialize modules
  const { frontendModules } = useMemo(() => {
    const backendModules = loadModules(modulesBackend);
    const frontendModules = loadModules(modulesFrontend);

    linkDispatchToProcessEvent(backendModules, frontendModules);

    return { backendModules, frontendModules };
  }, []);

  // Render your module UI
  return (
    <ModuleProvider exports={frontendModules}>
      <div style={{ height: '100vh', width: '100vw' }}>
        <DemiurgeSpace />
      </div>
    </ModuleProvider>
  );
};
```

### What Can You Test?

✅ **Works in Stories:**

- Module UI components
- Frontend/backend state sync
- Reducers (event processing)
- Collaborative features (simulated)
- Module interactions
- Graph/canvas interactions

❌ **Doesn't Work (requires full stack):**

- Real WebSocket connections
- Gateway features (VPN, OAuth, containers)
- User containers (Docker)
- Network requests to backend
- Database operations
- File persistence

## Running Stories

```bash
# Start Storybook
$ npx nx run <module>:storybook

# Examples:
$ npx nx run jupyter:storybook
$ npx nx run space:storybook
$ npx nx run chats:storybook
```

Browse to `http://localhost:4400` (or the port shown)

## Creating a New Module Story

1. **Create story file**: `src/lib/stories/my-module.stories.tsx`

2. **Import dependencies:**

```typescript
import { loadModules, linkDispatchToProcessEvent } from '@holistix/module';
import { collabBackend, collabFrontend } from '@holistix/collab';
import { reducersBackend, reducersFrontend } from '@holistix/reducers';
import { myModuleBackend, myModuleFrontend } from '../index';
```

3. **Follow the pattern** (see above)

4. **Export meta:**

```typescript
const meta = {
  title: 'Modules/MyModule/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
export { Story };
```

## Common Patterns

### Initializing Test Data

```typescript
const initModule: TModule = {
  name: 'story-init',
  version: '0.0.1',
  description: 'Story init module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    // Initialize test data in shared state
    loadTestData(depsExports.collab.collab.sharedData);
  },
};

// Add to modulesBackend array
```

### Simulating Multiple Users

```typescript
const collabConfig = {
  type: 'none',
  room_id: 'test-room',
  simulateUsers: true, // Enable multi-user simulation
  user: { username: 'alice', color: '#FF0000' },
};

// Collab engine will simulate other users making changes
```

### Testing API Calls

For modules that need external APIs (Airtable, Notion), use:

```typescript
const ProxyCheckWrapper = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if CORS proxy is available
    fetch('http://localhost:8080')
      .then(() => setIsChecking(false))
      .catch(() => setIsChecking(false));
  }, []);

  if (isChecking) {
    return <div>Checking proxy...</div>;
  }

  return children;
};
```

## Debugging Tips

1. **Enable logging:**

```typescript
import { Logger } from '@holistix/log';
Logger.setPriority(EPriority.Debug); // Debug level
```

2. **Inspect shared state:**

```typescript
const Story = () => {
  const { backendModules } = useMemo(() => {
    const backend = loadModules(modulesBackend);
    console.log('Shared state:', backend.collab.collab.sharedData);
    return { backendModules: backend };
  }, []);
  // ...
};
```

3. **Use React DevTools** to inspect component state

4. **Check browser console** for errors/logs

## Limitations

Stories are great for rapid development but can't replace full integration testing:

- **No authentication**: Can't test OAuth flows, user sessions
- **No persistence**: State lost on page refresh
- **No containers**: Can't test Docker-based features
- **No VPN**: Can't test container networking
- **No database**: Can't test SQL operations

For full stack testing, see [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).

## Next Steps

Once your module works in stories, test it in the full stack:

1. Deploy to local development environment
2. Test with real gateway + containers
3. Test collaborative features with multiple browsers
4. Test persistence and state recovery

See **LOCAL_DEVELOPMENT.md** for local full-stack testing setup.
