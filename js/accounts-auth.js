import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Global Logout Function
window.logout = function () {
    signOut(auth).then(() => {
        window.location.href = "../auth/login.html";
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. Update Display Name from Auth
        const name = user.displayName || user.email;

        // Update elements if they exist
        const headerName = document.getElementById('userDisplayNameHeader');
        if (headerName) headerName.textContent = name;

        const dashboardName = document.getElementById('userDisplayName');
        if (dashboardName) dashboardName.textContent = name;

        const dashboardNameSmall = document.getElementById('userDisplayNameSmall');
        if (dashboardNameSmall) dashboardNameSmall.textContent = name;

        // 2. Update Profile Image
        const userImg = document.getElementById('userImg');
        if (userImg) {
            // First check Auth profile
            if (user.photoURL) {
                userImg.src = user.photoURL;
            }

            // Then check Firestore (often fresher or larger)
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.photoURL) {
                        userImg.src = data.photoURL;
                    }
                    // Optionally update name from Firestore if it overrides Auth
                    if (data.displayName) {
                        if (headerName) headerName.textContent = data.displayName;
                        if (dashboardName) dashboardName.textContent = data.displayName;
                        if (dashboardNameSmall) dashboardNameSmall.textContent = data.displayName;
                    }

                    // Check Admin Role for Sidebar Link
                    if (data.role === 'admin') {
                        const adminItem = document.getElementById('adminSidebarItem');
                        if (adminItem) adminItem.style.display = 'block';
                    }

                    // Check Associate Role for Sidebar Link
                    if (data.role === 'associate' || data.role === 'admin') {
                        const associateItem = document.getElementById('associateSidebarItem');
                        if (associateItem) associateItem.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error("Error fetching user profile:", error);
            }
        }

        // Hide Loader and Show Content
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.remove();
                // Ensure body is fully visible (cleanup)
                document.body.style.visibility = 'visible';
                document.body.style.opacity = '1';
            }, 500);
        } else {
            // Fallback for pages without loader
            document.body.style.visibility = 'visible';
            document.body.style.opacity = '1';
            document.body.style.transition = 'opacity 0.5s ease';
        }

    } else {
        // Redirect to login if not logged in
        // Check if we are already on login page to avoid loop (though this is accounts dir)
        window.location.href = "../auth/login.html";
    }
});
