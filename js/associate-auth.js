import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Role Guard Function
export function initAssociateAuth(onAuthorized) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "../auth/login.html";
        } else {
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && (docSnap.data().role === 'associate' || docSnap.data().role === 'admin')) {
                    // Admins also allowed for testing/management
                    if (onAuthorized) onAuthorized(user);

                    // Update User Name in UI if elements exist
                    const userData = docSnap.data();
                    const userNameEl = document.getElementById('associateName');
                    if (userNameEl) userNameEl.textContent = userData.displayName || user.displayName || "Associate";

                    // Hide Loader and Show Content
                    const loader = document.getElementById('page-loader');
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => {
                            loader.remove();
                        }, 500);
                    }

                } else {
                    // Not an associate or admin
                    window.location.href = "../index.html";
                }
            } catch (error) {
                console.error("Auth Error:", error);
                window.location.href = "../index.html";
            }
        }
    });
}

// Global Logout
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = "../auth/login.html";
    } catch (error) {
        console.error("Sign out error", error);
    }
};

// Toggle Sidebar (Mobile)
window.toggleSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');

    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.toggle('active');
};

export { auth, db };
