# Chitchat - AI Coding Instructions

## Project Overview
**Chitchat** is a cross-platform text messaging application (text-only, no media).
- **Desktop Client**: Tauri 2.x + Solid.js + TypeScript (Windows first, then macOS/Linux)
- **Backend**: Firebase (Authentication + Firestore for real-time messaging)
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
│  - Firestore (RT)   │
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
│   │   └── messages.ts     # Firestore message operations
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

### Firebase Patterns
```typescript
// src/services/firebase.ts - Initialize once
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// src/services/messages.ts - Real-time listener
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export function subscribeToMessages(chatId: string, callback: (msgs: Message[]) => void) {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
  });
}
```

## Key Patterns

### State Management
- **Auth state**: Firebase `onAuthStateChanged` → Solid.js signal
- **Messages**: Firestore `onSnapshot` → Solid.js store
- **UI state**: Local Solid.js signals (no Firebase)

### Firestore Data Model
```
/users/{userId}
  - email, displayName, createdAt

/chats/{chatId}
  - participants: [userId1, userId2]
  - lastMessage, updatedAt

/chats/{chatId}/messages/{messageId}
  - senderId, text, timestamp
```

### Error Handling
- Wrap Firebase calls in try/catch
- Show user-friendly errors via Solid.js signals
- Log errors to console in development

### Security
- Firebase config in environment variables (`.env`)
- Firestore Security Rules enforce access control
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