// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
  apiKey: "AIzaSyBunseGlJg3XiyXzKiepjyilYZ8n5Cl0lE",
  authDomain: "mc-electronics.firebaseapp.com",
  projectId: "mc-electronics",
  storageBucket: "mc-electronics.firebasestorage.app",
  messagingSenderId: "1021368016185",
  appId: "1:1021368016185:web:2e0dfa85d55a4c92af9ce8",
  measurementId: "G-LGB225ZZXM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Registration Logic
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update Display Name
      await updateProfile(user, {
        displayName: fullName
      });

      // 3. Save User Data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: fullName,
        email: email,
        role: "user", // Default Role
        createdAt: new Date()
      });

      alert("Registration Successful! Please Login.");
      // Switch to login tab
      const loginTab = document.getElementById('login-tab');
      if (loginTab) loginTab.click();
      
      // Clear form
      registerForm.reset();
      
    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      alert("Registration Error: " + errorMessage);
      console.error("Registration Error:", errorCode, errorMessage);
    }
  });
}

// Login Logic
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      alert("Login Successful! Welcome " + (user.displayName || "User"));
      console.log("Logged in user:", user);
      
      // Optional: Redirect to home page
      window.location.href = "accounts/dashboard.html"; 

    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      alert("Login Failed: " + errorMessage);
      console.error("Login Error:", errorCode, errorMessage);
    }
  });
}
