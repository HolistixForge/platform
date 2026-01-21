# Frontend Data Architecture

**Last Updated:** January 2026  
**Status:** ✅ Implemented

---

## Overview

The Holistix Forge frontend follows a **data-centric architecture** that cleanly separates data access concerns from UI concerns.

### Key Principle

**`collab` module = Collaboration ENGINE + HOOKS (self-contained)**  
**`frontend-data` = Everything about DATA (API, queries, contexts)**  
**`app-frontend` = Everything about UI (components, routing, presentation)**

---

## Package Responsibilities

### 📦 `frontend-data` (Data Infrastructure Layer)

**Purpose**: Complete data access layer for the application (excluding collab)

**Responsibilities**:
- ✅ API clients (GanymedeApi)
- ✅ React Query hooks (useQueryProject, useMutation*, etc.)
- ✅ Data contexts (ProjectProvider, OrganizationProvider)
- ✅ Data access hooks (useProject, useProjectId, useOrganization)
- ✅ Module loading infrastructure (ModuleDataProvider)
- ✅ Gateway management (hostname resolution, WebSocket URLs)

**Exports**:
```typescript
// API Layer
export { useApi, GanymedeApi }
export { useQueryProject, useQueryOrganization, ... }

// Data Contexts
export { ProjectProvider, useProject, useProjectId }
export { OrganizationProvider, useOrganization }

// Module Infrastructure
export { ModuleDataProvider, createModuleConfigs }
```

**Does NOT include**:
- ❌ UI components
- ❌ Routing
- ❌ Styling
- ❌ Collab hooks (those are in collab module!)

---

### 📦 `collab` module (Self-Contained Collaboration Package)

**Purpose**: Complete collaboration solution - engine, hooks, and context

**Responsibilities**:
- ✅ YJS WebSocket connection management
- ✅ CollabRegistryFrontend (multi-project instance manager)
- ✅ LocalOverrider (observable shared data wrapper)
- ✅ **CollabProjectProvider** (React context for project_id)
- ✅ **React hooks** (useLocalSharedData, useAwareness, etc.)

**Exports**:
```typescript
// Context Provider (lightweight, only provides project_id)
export { CollabProjectProvider, useCollabProjectId }

// React Hooks (for accessing collab data)
export { 
  useLocalSharedData, 
  useAwareness, 
  useAwarenessUserList,
  useAwarenessSelections,
  useBindEditor,
  useSharedDataDirect
}

// Pure classes (for advanced use cases)
export { YjsClientCollab, CollabRegistryFrontend, LocalOverrider }
export type { YjsClientCollabConfig, TValidSharedDataToCopy }
```

**Key Design**: 
- **Self-contained**: No dependency on app-level infrastructure
- **Reusable**: Can be used in any React app
- **Lightweight context**: Only provides `project_id`, nothing more

**Does NOT include**:
- ❌ Full project data (use ProjectProvider from frontend-data)
- ❌ Module loading logic
- ❌ Gateway management

---

### 📦 `app-frontend` (Pure UI Layer)

**Purpose**: User interface, routing, and presentation

**Responsibilities**:
- ✅ UI components (pages, layouts, widgets)
- ✅ Routing (React Router configuration)
- ✅ Styling (SCSS, themes)
- ✅ User interactions (click handlers, forms)
- ✅ **Wiring contexts together** (ProjectProvider + CollabProjectProvider)

**Imports from `frontend-data`**:
```typescript
import {
  ModuleDataProvider,      // Module loading & gateway
  ProjectProvider,         // Project data context
  useProject,              // Access project data
  useQueryProject,         // Fetch project
} from '@holistix-forge/frontend-data';
```

**Imports from `collab`**:
```typescript
import { 
  CollabProjectProvider,   // Provide project_id to collab hooks
  useLocalSharedData,      // Access collab data
  useAwareness,            // Access awareness
} from '@holistix-forge/collab/frontend';
```

**Does NOT include**:
- ❌ Data contexts implementation (imports from frontend-data & collab)
- ❌ Module loading logic (imports from frontend-data)
- ❌ Gateway management (frontend-data handles it)
- ❌ Collaboration engine (collab module handles it)

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────┐
│  collab module (Self-Contained)                      │
│  • YJS WebSocket + CollabRegistryFrontend            │
│  • CollabProjectProvider (context)                   │
│  • useLocalSharedData, useAwareness (hooks)          │
│  • No external dependencies!                         │
└───────────────────────────────────────────────────────┘
            ▲                        ▲
            │                        │
            │                        │ imports hooks
            │ imports classes        │ imports context
            │                        │
┌───────────┴────────────────────────┴───────────────┐
│  frontend-data (Data Infrastructure)               │
│  • API clients & React Query hooks                 │
│  • ProjectProvider (full project data)             │
│  • OrganizationProvider                            │
│  • ModuleDataProvider (loads modules + gateway)    │
│  • Uses collab classes for config only             │
└───────────┬────────────────────────────────────────┘
            │ imports data layer
            ▼
┌───────────────────────────────────────────────────────┐
│  app-frontend (UI + Wiring)                           │
│  • React components & pages                           │
│  • Routing & navigation                               │
│  • Wires contexts:                                    │
│    <ProjectProvider>                                  │
│      <CollabProjectProvider project_id={...}>         │
│        <YourComponents />                             │
│      </CollabProjectProvider>                         │
│    </ProjectProvider>                                 │
└───────────────────────────────────────────────────────┘
```

**Dependency Flow**: 
- ✅ `collab` is independent (no external deps)
- ✅ `frontend-data` imports collab classes (for config)
- ✅ `app-frontend` imports from both (data + hooks)
- ✅ No circular dependencies!

---

## Multi-Project Collaboration

### Backend Pattern (Reference)

```typescript
// Backend CollabRegistry
class CollabRegistry {
  private collabs: Map<project_id, YjsServerCollab>;
  
  getCollabForProject(project_id: string) {
    // Lazy load & cache
  }
}

// Reducer usage
const collab = this.collabRegistry.getCollabForProject(requestData.project_id);
collab.sharedData['tabs:tabs'].set(...);
```

### Frontend Pattern (Matching)

```typescript
// Frontend CollabRegistryFrontend (in collab module)
class CollabRegistryFrontend {
  private collabs: Map<project_id, { collab, localOverrider }>;
  
  getCollabForProject(project_id: string) {
    // Lazy load & cache
  }
}

// Hook usage (in collab module)
export const useLocalSharedData = (...) => {
  const project_id = useCollabProjectId(); // From collab's own context!
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>();
  const { localOverrider } = exports.collab.getCollabForProject(project_id);
  // ... observe and return data
};

// Component usage (anywhere)
import { useLocalSharedData } from '@holistix-forge/collab/frontend';

function MyComponent() {
  const tabs = useLocalSharedData(['tabs:tabs'], d => d['tabs:tabs'].get('unique'));
  return <div>{tabs.length} tabs</div>;
}
```

**Key Design**:
- Backend: Explicit `project_id` in every request
- Frontend: Implicit `project_id` from **collab's own context** (CollabProjectProvider)
- Collab module is **self-contained** - no dependency on app-level contexts
- Both: Lazy loading via registry pattern
- Both: On-demand instance creation

---

## Context Hierarchy

```
BrowserRouter
  └── ApiContext (app-wide)
      └── Routes
          └── ProjectWrapper Component (UI wrapper in app-frontend)
              └── ModuleDataProvider (from frontend-data)
                  ├── OrganizationProvider (from frontend-data)
                  ├── ModuleProvider (loaded modules)
                  └── ProjectProvider (from frontend-data)
                      └── CollabProjectProvider (from collab module)
                          └── Project Pages & Components
```

**Key Points**:
- `ModuleDataProvider` handles module loading and gateway setup
- `ProjectProvider` provides full project data (name, owner, permissions, etc.)
- `CollabProjectProvider` provides ONLY `project_id` for collab hooks
- **Two separate contexts with different purposes**:
  - `ProjectProvider` (frontend-data): Complete project info for UI
  - `CollabProjectProvider` (collab): Minimal context for hooks
- Collab hooks get `project_id` from their own `CollabProjectProvider`
- No dependency between frontend-data and collab module!

---

## Usage Examples

### Component in app-frontend

```typescript
// Import project data from frontend-data
import { useProject } from '@holistix-forge/frontend-data';

// Import collab hooks from collab module
import { useLocalSharedData } from '@holistix-forge/collab/frontend';

export const MyComponent = () => {
  // Access project data (from ProjectProvider)
  const { project } = useProject();
  
  // Access collab data (project_id from CollabProjectProvider)
  const tabs = useLocalSharedData(['tabs:tabs'], (d) => 
    d['tabs:tabs'].get('unique')
  );
  
  return (
    <div>
      <h1>{project.project_name}</h1>
      <p>Tabs: {tabs?.tree.children.length}</p>
    </div>
  );
};
```

### Page wrapper in app-frontend

```typescript
import { 
  ModuleDataProvider, 
  ProjectProvider,
  useQueryProjectByName 
} from '@holistix-forge/frontend-data';
import { CollabProjectProvider } from '@holistix-forge/collab/frontend';

export const ProjectWrapper = () => {
  const { data: project } = useQueryProjectByName(owner, projectName);
  
  return (
    <ModuleDataProvider
      organization_id={project.organization_id}
      modules={getAllModules()}
      loadingUI={<Spinner />}
      unavailableUI={(org_id) => <StartGatewayButton org_id={org_id} />}
    >
      <ProjectProvider
        project={project}
        organization_id={project.organization_id}
        isOwner={false}
      >
        {/* Collab context wraps the children */}
        <CollabProjectProvider project_id={project.project_id}>
          <ProjectEditor />
          <ProjectSidebar />
        </CollabProjectProvider>
      </ProjectProvider>
    </ModuleDataProvider>
  );
};
```

---

## Benefits of This Architecture

### 1. **Module Independence** ✅
- `collab` module is **fully self-contained**
- No dependency on app-level infrastructure (frontend-data)
- Can be used in **any React app**, not just Holistix Forge
- Other modules (whiteboard, jupyter) only depend on collab, not on app infrastructure

### 2. **No Circular Dependencies** ✅
```
collab (independent)
  ↑
frontend-data (imports collab classes for config)
  ↑
app-frontend (imports from both)
```
Clean one-way dependency flow with independent modules!

### 3. **Clear Separation of Concerns** ✅
- **Collab module**: Collaboration engine + hooks (self-contained)
- **Frontend-data**: API, queries, project/org contexts, module loading
- **App-frontend**: UI, routing, wiring contexts together

### 4. **Testability** ✅
```typescript
// Test collab hooks with minimal setup
import { useLocalSharedData, CollabProjectProvider } from '@holistix-forge/collab/frontend';

test('useLocalSharedData', () => {
  const wrapper = ({ children }) => (
    <ModuleProvider modules={...}>
      <CollabProjectProvider project_id="test-project">
        {children}
      </CollabProjectProvider>
    </ModuleProvider>
  );
  
  const { result } = renderHook(() => useLocalSharedData(...), { wrapper });
  // Test without frontend-data or app-frontend!
});
```

### 5. **Reusability** ✅
- **Collab module**: Can be dropped into any React + modules app
- **Frontend-data**: Holistix-specific data layer
- **Clear boundary**: Collaboration is a standalone concern

### 6. **Matches Backend Pattern** ✅
Frontend registry pattern mirrors backend CollabRegistry design.

### 7. **Two Contexts, Two Purposes** ✅
- `ProjectProvider` (frontend-data): Full project data for UI needs
- `CollabProjectProvider` (collab): Minimal `project_id` for hooks only
- No overlap, no confusion

---

## Migration Guide

### For Existing Components

**Before** (if importing from old locations):
```typescript
// Old - from app-frontend
import { useProject } from '../../project/project-context';

// Old - from frontend-data (incorrect!)
import { useLocalSharedData } from '@holistix-forge/frontend-data';
```

**After**:
```typescript
// New - project data from frontend-data
import { useProject } from '@holistix-forge/frontend-data';

// New - collab hooks from collab module
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
```

### For New Components

**Import pattern**:
```typescript
// Project/organization data - from frontend-data
import {
  useProject,
  useProjectId,
  useOrganization,
  useQueryProject,
  useQueryOrganization,
} from '@holistix-forge/frontend-data';

// Collab data - from collab module
import {
  useLocalSharedData,
  useAwareness,
  useAwarenessUserList,
  useAwarenessSelections,
  useBindEditor,
} from '@holistix-forge/collab/frontend';
```

### For Page Wrappers

**Must wrap with both contexts**:
```typescript
import { ProjectProvider } from '@holistix-forge/frontend-data';
import { CollabProjectProvider } from '@holistix-forge/collab/frontend';

<ProjectProvider project={project} organization_id={org_id} isOwner={false}>
  <CollabProjectProvider project_id={project.project_id}>
    <YourComponents />
  </CollabProjectProvider>
</ProjectProvider>
```

---

## Related Documentation

- [Architecture Overview](./OVERVIEW.md)
- [Frontend Architecture](./FRONTEND_ARCHITECTURE.md)
- [Gateway Architecture](./GATEWAY_ARCHITECTURE.md)
- [Multi-Project Architecture](../current-works/MULTI_PROJECT_ARCHITECTURE.md)

---

**Key Insight**: The collab module is a **self-contained package** with its own context and hooks.

**Why not put hooks in frontend-data?**
- ❌ Creates coupling: Other modules (whiteboard, jupyter) would depend on app-level infrastructure
- ❌ Breaks reusability: Collab module becomes app-specific
- ❌ Wrong abstraction: Collab is a standalone concern, like `react-query` or `yjs`

**Why this is the right pattern:**
- ✅ `collab` is independent (like `react-query`)
- ✅ Modules only depend on collab (not on app infrastructure)
- ✅ Can be used in any React app
- ✅ Two contexts serve different purposes:
  - `ProjectProvider`: Full project data for UI
  - `CollabProjectProvider`: Minimal `project_id` for hooks
