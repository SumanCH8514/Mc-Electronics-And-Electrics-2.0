import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// REUSE CONFIG FROM firebase-auth.js
const firebaseConfig = {
  apiKey: "AIzaSyBunseGlJg3XiyXzKiepjyilYZ8n5Cl0lE",
  authDomain: "mc-electronics.firebaseapp.com",
  projectId: "mc-electronics",
  storageBucket: "mc-electronics.firebasestorage.app",
  messagingSenderId: "1021368016185",
  appId: "1:1021368016185:web:2e0dfa85d55a4c92af9ce8",
  measurementId: "G-LGB225ZZXM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginLink = document.getElementById('loginLink');

if (loginLink) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in.
      loginLink.innerHTML = '<i class="fa fa-user" aria-hidden="true"></i> My Account';
      loginLink.href = 'accounts/my-account.html';
    } else {
      // User is signed out.
      loginLink.innerHTML = '<i class="fa fa-user" aria-hidden="true"></i> Login';
      loginLink.href = 'login.html';
    }
  });
}
