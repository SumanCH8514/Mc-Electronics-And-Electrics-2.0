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
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const db = getFirestore(app);

const loginLink = document.getElementById('loginLink');
const adminNavItem = document.getElementById('adminNavItem');

// Function to check admin role
async function checkAdminRole(user) {
    if (!adminNavItem) return;
    
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().role === 'admin') {
            adminNavItem.style.display = 'block';
        } else {
            adminNavItem.style.display = 'none';
        }
    } catch (error) {
        console.error("Error checking admin role:", error);
        adminNavItem.style.display = 'none';
    }
}

if (loginLink) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in.
      // Update Navbar Text to match relative path or absolute? 
      // Checking if we are in a subdirectory based on the href being set
      const isSubDir = window.location.pathname.includes('/accounts/') || window.location.pathname.includes('/admin/');
      const dashboardPath = isSubDir ? 'dashboard.html' : 'accounts/dashboard.html';

      loginLink.innerHTML = '<i class="fa fa-user" aria-hidden="true"></i> My Account';
      loginLink.href = dashboardPath;

      // Check for Admin Role
      checkAdminRole(user);

    } else {
      // User is signed out.
      const isSubDir = window.location.pathname.includes('/accounts/') || window.location.pathname.includes('/admin/');
      const loginPath = isSubDir ? '../login.html' : 'login.html';

      loginLink.innerHTML = '<i class="fa fa-user" aria-hidden="true"></i> Login';
      loginLink.href = loginPath;
      
      if (adminNavItem) adminNavItem.style.display = 'none';
    }
  });
}
