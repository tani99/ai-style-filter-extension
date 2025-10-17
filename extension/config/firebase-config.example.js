// Firebase configuration TEMPLATE
// Copy this file to firebase-config.js and fill in your actual values
// DO NOT commit firebase-config.js to git (it's in .gitignore)

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}

