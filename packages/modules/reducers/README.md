# Reducers Module

Event processing system that handles collaborative events through reducer functions. Provides the foundation for all module event handling.

## Features

- **Event Processing**: Centralized event processing pipeline for all collaborative events
- **Reducer Pattern**: Modules register reducer classes that process specific event types
- **Request Context**: Provides request metadata (IP, user ID, JWT, headers) to reducers
- **Type Safety**: TypeScript support for event types and reducer interfaces
- **Periodic Events**: Support for scheduled/recurring events

## API

Modules register reducers that implement the `Reducer` abstract class. The `processEvent` function routes events to appropriate reducers based on event type. Reducers receive event data and request context for processing. The `loadReducers` function allows modules to register their event handlers.

## Dependencies

No dependencies - foundational module for event processing.

## Exports

- `TReducersBackendExports`: Backend reducer interface with `processEvent` and `loadReducers`
- `Reducer`: Abstract base class for event reducers
- `RequestData`: Abstract class for request context (includes `project_id` for multi-project support)
- `TBaseEvent`: Base event type with optional `systemEvent` flag
- `BackendEventProcessor`: Core event processing engine (generic, no gateway-specific logic)
- `TEventPeriodic`: Type for periodic/recurring system events (defined in `lib/system-events.ts`)

## System Events

System events are infrastructure-level events that don't represent user actions:

- **`systemEvent: true`**: Events that should NOT rearm project activity timers
  - `reducers:periodic` - Scheduled maintenance tasks
  - `project:init` - Automatic project initialization
  - `user-container:watchdog` - Container health checks
  - `jupyter:resources-changed` - Automatic resource updates

- **`systemEvent: false/undefined`**: User-initiated events that DO rearm activity timers
  - All user actions (`tabs:add-tab`, `whiteboard:move-node`, etc.)

See `lib/system-events.ts` for system event type definitions.

