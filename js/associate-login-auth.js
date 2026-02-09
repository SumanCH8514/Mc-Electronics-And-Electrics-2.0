import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginForm = document.getElementById('associateLoginForm');

// Show body (override hidden style from CSS if present)
document.body.style.visibility = 'visible';
document.body.style.opacity = '1';

// Check if reCAPTCHA is enabled
let recaptchaEnabled = false;

async function checkRecaptchaStatus() {
    try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            recaptchaEnabled = data.recaptchaEnabled === true;
        }
    } catch (error) {
        console.error("Error checking reCAPTCHA status:", error);
    }
}

// Initialize reCAPTCHA status check
checkRecaptchaStatus();

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('associate-email').value;
        const password = document.getElementById('associate-password').value;
        const errorDiv = document.getElementById('associate-error-msg');

        // Reset error
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.innerText = '';
        }

        // Check reCAPTCHA if enabled
        if (recaptchaEnabled) {
            const recaptchaResponse = grecaptcha.getResponse();
            if (!recaptchaResponse) {
                if (errorDiv) {
                    errorDiv.innerHTML = "Please complete the reCAPTCHA verification";
                    errorDiv.style.display = 'block';

                    // Shake Animation
                    errorDiv.classList.remove('shake');
                    void errorDiv.offsetWidth; // Trigger Reflow
                    errorDiv.classList.add('shake');
                }
                return;
            }
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check Role
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && (docSnap.data().role === 'associate' || docSnap.data().role === 'admin')) {
                // Success
                window.location.href = "../Associate/dashboard.html";
            } else {
                // Wrong Role - Sign Out immediately
                await signOut(auth);

                throw new Error("NOT_ASSOCIATE");
            }

        } catch (error) {
            console.error("Login Error:", error);

            let message = "Login Failed: " + error.message;

            if (error.message === "NOT_ASSOCIATE") {
                message = "You are not Delivery Associate <br> Ask Admin to grant you Permission.";
            } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                message = "Mail or Password doesn't match";
            } else if (error.code === 'auth/user-not-found') {
                message = "User not found";
            }

            if (errorDiv) {
                errorDiv.innerHTML = message;
                errorDiv.style.display = 'block';

                // Shake Animation
                errorDiv.classList.remove('shake');
                void errorDiv.offsetWidth; // Trigger Reflow
                errorDiv.classList.add('shake');

                // Add CSS for shake if not present manually, though it might be in style.css
                // Attempting to add style just in case if class not defined
                if (!document.querySelector('#shake-style')) {
                    const style = document.createElement('style');
                    style.id = 'shake-style';
                    style.innerHTML = `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                    20%, 40%, 60%, 80% { transform: translateX(10px); }
                }
                .shake {
                    animation: shake 0.5s;
                }
             `;
                    document.head.appendChild(style);
                }
            } else {
                alert(message.replace('<br>', '\n'));
            }

            // Reset reCAPTCHA if enabled
            if (recaptchaEnabled && typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
        }
    });
}
