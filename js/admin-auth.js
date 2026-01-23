import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);

// Role Guard Function
export function initAdminAuth(onAuthorized) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            alert("You must be logged in to access the Admin Panel.");
            window.location.href = "../login.html";
        } else {
            console.log("Checking permissions for:", user.email);
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().role === 'admin') {
                    console.log("Admin Authorized");
                    if (onAuthorized) onAuthorized(user);
                    
                    // Update User Name in UI if elements exist
                    const userData = docSnap.data();
                    const userNameEl = document.getElementById('adminName');
                    if (userNameEl) userNameEl.textContent = userData.displayName || user.displayName || "Admin";
                    
                    const userImgEl = document.getElementById('adminImg');
                    if (userImgEl) {
                        userImgEl.src = userData.photoURL || user.photoURL || "../images/client1.jpg";
                    }

                } else {
                    alert("Access Denied: You do not have admin permissions.");
                    window.location.href = "../index.html";
                }
            } catch (error) {
                console.error("Auth Error:", error);
                alert("Authorization check failed.");
                window.location.href = "../index.html";
            }
        }
    });
}

// Global Logout for Admin
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = "../login.html";
    } catch (error) {
        console.error("Sign out error", error);
    }
};

export { auth, db };
