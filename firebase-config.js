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
  apiKey:            "AIzaSyBGDP2QlZYQg0wUsIWKHyvzGuluzVTNIDE",
  authDomain:        "victoryedge-pro.firebaseapp.com",
  databaseURL:       "https://victoryedge-pro-default-rtdb.firebaseio.com/",
  projectId:         "victoryedge-pro",
  storageBucket:     "victoryedge-pro.firebasestorage.app",
  messagingSenderId: "362346490085",
  appId:             "1:362346490085:web:b1db5eb49feb9eb7068c0c"
};
