# Chats Module

Real-time chat functionality integrated into the collaborative workspace, allowing users to communicate within projects.

## Features

- **Real-time Messaging**: Collaborative chat rooms synchronized across all users
- **Project Integration**: Chats are associated with graph nodes and spaces
- **Shared State**: Chat messages stored in collaborative shared data
- **Event-driven**: Chat operations handled through collaborative events

## API

Manages shared data for chat rooms. Processes chat events through reducers. Chat data is stored as a map keyed by chat identifiers. Events include message creation and chat management operations.

## Dependencies

- `core-graph`: For graph node integration
- `collab`: For shared data synchronization
- `reducers`: For event processing

## Exports

- `TChatSharedData`: Type for chat shared data
- `TChatEvent`: Chat event type definitions
- Chat reducer for processing chat-related events

