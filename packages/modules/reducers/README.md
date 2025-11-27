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
- `RequestData`: Abstract class for request context
- `BackendEventProcessor`: Core event processing engine
- `TEventPeriodic`: Type for periodic/recurring events

