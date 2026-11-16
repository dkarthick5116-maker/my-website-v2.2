// Firebase Configuration for My Website V2.2
const firebaseConfig = {
  apiKey: "AIzaSyAP71Mis9RHEHSF_NHFhI6voPTkulswMqk",
  authDomain: "my-website-v2-2.firebaseapp.com",
  projectId: "my-website-v2-2",
  storageBucket: "my-website-v2-2.firebasestorage.app",
  messagingSenderId: "562095804702",
  appId: "1:562095804702:web:1073950b4dc7ccd1e5790f"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Authentication and Firestore services
const auth = firebase.auth();
const db = firebase.firestore();

