// ═══════════════════════════════════════════════════
// VictoryEdge Pro — firebase-config.js
// ═══════════════════════════════════════════════════
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project → "victoryedge-pro"
// 3. Add a Web App → copy the config below
// 4. Enable Realtime Database (Build → Realtime Database)
//    → Start in TEST MODE (we use rules below)
// 5. Set Database Rules to:
//    {
//      "rules": {
//        "devices": {
//          ".read": true,
//          ".write": true
//        },
//        "tips": {
//          ".read": true,
//          ".write": true
//        },
//        "history": {
//          ".read": true,
//          ".write": true
//        }
//      }
//    }
// ═══════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://REPLACE_WITH_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};
