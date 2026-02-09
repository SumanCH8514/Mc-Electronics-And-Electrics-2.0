import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Role Guard Function
export function initAdminAuth(onAuthorized) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // alert("You must be logged in to access the Admin Panel.");
            window.location.href = "../auth/login.html";
        } else {
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().role === 'admin') {
                    if (onAuthorized) onAuthorized(user);

                    // Update User Name in UI if elements exist
                    const userData = docSnap.data();
                    const userNameEl = document.getElementById('adminName');
                    if (userNameEl) userNameEl.textContent = userData.displayName || user.displayName || "Admin";

                    const userImgEl = document.getElementById('adminImg');
                    if (userImgEl) {
                        userImgEl.src = userData.photoURL || user.photoURL || "../images/client1.jpg";
                    }

                    // Hide Loader and Show Content
                    const loader = document.getElementById('page-loader');
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => {
                            loader.remove();
                        }, 500);
                    }

                } else {
                    // alert("Access Denied: You do not have admin permissions.");
                    window.location.href = "../index.html";
                }
            } catch (error) {
                console.error("Auth Error:", error);
                // alert("Authorization check failed.");
                window.location.href = "../index.html";
            }
        }
    });
}

// Global Logout for Admin
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = "../auth/login.html";
    } catch (error) {
        console.error("Sign out error", error);
    }
};

export { auth, db };
