# Chitchat

A cross-platform text messaging application built with Tauri, Solid.js, and Firebase.

## Features

- 💬 Real-time text messaging
- 👤 User authentication (email/password)
- 🟢 Online/offline status indicators
- ⌨️ Typing indicators
- ⏰ Message timestamps
- ♿ Accessibility support (ARIA labels, keyboard navigation)
- 🌙 Dark mode support

## Tech Stack

- **Desktop Framework**: [Tauri 2.x](https://tauri.app/) (Rust)
- **Frontend**: [Solid.js](https://www.solidjs.com/) + TypeScript
- **Backend**: [Firebase](https://firebase.google.com/) (Authentication + Firestore)
- **Build Tool**: [Vite](https://vitejs.dev/)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Firebase Project](https://console.firebase.google.com/) with:
  - Email/Password Authentication enabled
  - Firestore Database created

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chitchat.git
   cd chitchat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   Copy `.env.example` to `.env` and fill in your Firebase credentials:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Firebase config from the Firebase Console.

4. **Set up Firestore Security Rules**
   
   In the Firebase Console, go to Firestore > Rules and add:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read/write their own document
       match /users/{userId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Chat participants can read/write chat documents
       match /chats/{chatId} {
         allow read, write: if request.auth != null && 
           request.auth.uid in resource.data.participants;
         allow create: if request.auth != null;
         
         // Messages within chats
         match /messages/{messageId} {
           allow read, write: if request.auth != null &&
             request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
         }
       }
     }
   }
   ```

## Development

```bash
# Start development server with hot reload
npm run tauri dev

# Lint code
npm run lint

# Format code
npm run format
```

## Building for Production

```bash
# Build Windows installer
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
chitchat/
├── src/                    # Solid.js frontend
│   ├── components/         # UI components
│   ├── services/           # Firebase service wrappers
│   ├── stores/             # Solid.js reactive stores
│   ├── types/              # TypeScript interfaces
│   └── App.tsx             # Main app component
├── src-tauri/              # Tauri/Rust backend
│   ├── src/
│   │   └── main.rs
│   └── tauri.conf.json     # Tauri configuration
├── .env.example            # Environment variables template
└── package.json
```

## License

[MIT](LICENSE)
