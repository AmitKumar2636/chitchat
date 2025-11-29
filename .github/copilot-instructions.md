# Chitchat - AI Coding Instructions

## Project Overview
**Chitchat** is a cross-platform text messaging application (text-only, no media).
- **Desktop Client**: Tauri 2.x + Solid.js + TypeScript (Windows first, then macOS/Linux)
- **Backend**: Firebase (Authentication + Realtime Database for real-time messaging)
- **No custom server** — Firebase handles all cloud logic

## Architecture

```
┌─────────────────────────────────────────────┐
│            Tauri Desktop App                │
├─────────────────────────────────────────────┤
│  ┌─────────────┐  IPC   ┌────────────────┐  │
│  │ Solid.js UI │◄──────►│  Tauri/Rust    │  │
│  │  + Firebase │        │  (native APIs) │  │
│  │    JS SDK   │        └────────────────┘  │
│  └──────┬──────┘                            │
└─────────┼───────────────────────────────────┘
          │ HTTPS/WebSocket
┌─────────▼───────────┐
│      Firebase       │
│  - Authentication   │
│  - Realtime DB      │
└─────────────────────┘
```

```
chitchat/
├── src/                    # Solid.js frontend (TypeScript)
│   ├── components/         # UI components (ChatList, MessageView, etc.)
│   ├── stores/             # Solid.js reactive stores (auth, messages)
│   ├── services/           # Firebase service wrappers
│   │   ├── firebase.ts     # Firebase initialization
│   │   ├── auth.ts         # Authentication functions
│   │   ├── messages.ts     # Realtime Database operations
│   │   └── notifications.ts # Native notifications
│   ├── types/              # TypeScript interfaces
│   └── App.tsx
├── src-tauri/              # Rust backend for Tauri
│   ├── src/
│   │   ├── commands/       # Tauri IPC commands (if needed)
│   │   └── main.rs
│   └── Cargo.toml
├── package.json
└── firebase.json           # Firebase config (if using emulators)
```

## Quick Start

```bash
# Install dependencies
npm install

# Development (runs Tauri + Vite dev server)
npm run tauri dev

# Build Windows release
npm run tauri build
```

## Code Conventions

### Rust (Tauri)
- Format with `rustfmt`, lint with `clippy`
- Tauri commands: `snake_case` (e.g., `get_system_info`)
- Use `thiserror` for error types
- Minimal Rust code — most logic lives in TypeScript/Firebase

### TypeScript/Solid.js (Frontend)
- Format with Prettier, lint with ESLint
- Components: `PascalCase` (e.g., `ChatWindow.tsx`)
- Functions/variables: `camelCase`
- Firebase calls wrapped in `src/services/` modules

### Firebase Patterns (Realtime Database)
```typescript
// src/services/firebase.ts - Initialize once
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// src/services/messages.ts - Real-time listener
import { ref, onValue, push, set } from 'firebase/database';

export function subscribeToMessages(chatId: string, callback: (msgs: Message[]) => void) {
  const messagesRef = ref(db, `messages/${chatId}`);
  return onValue(messagesRef, (snapshot) => {
    const messages = [];
    snapshot.forEach((child) => {
      messages.push({ id: child.key, ...child.val() });
    });
    callback(messages);
  });
}
```

## Key Patterns

### State Management
- **Auth state**: Firebase `onAuthStateChanged` → Solid.js signal
- **Messages**: RTDB `onValue` → Solid.js store
- **UI state**: Local Solid.js signals (no Firebase)

### Realtime Database Data Model
```
/users/{userId}
  - email, displayName, createdAt, isOnline, lastSeen

/userChats/{userId}
  - {chatId}: true

/chats/{chatId}
  - participants: { userId1: true, userId2: true }
  - participantNames: { userId1: "Name", ... }
  - lastMessage, updatedAt
  - typing: { userId: boolean }

/messages/{chatId}/{messageId}
  - senderId, senderName, text, timestamp
```

### Error Handling
- Wrap Firebase calls in try/catch
- Show user-friendly errors via Solid.js signals
- Log errors to console in development

### Security
- Firebase config in environment variables (`.env`)
- RTDB Security Rules enforce access control
- Never store sensitive data in Tauri's local storage unencrypted

## Testing

```bash
# Frontend tests
npm test

# Use Firebase Emulators for local testing
firebase emulators:start
```

## Dependencies
- Pin versions in `package-lock.json` and `Cargo.lock`
- Key npm: `solid-js`, `firebase`, `@tauri-apps/api`
- Key crates: `tauri`, `serde`