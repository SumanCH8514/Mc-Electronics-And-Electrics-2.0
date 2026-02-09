import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const maintenanceToggle = document.getElementById('maintenanceToggle');
const registrationToggle = document.getElementById('registrationToggle');
const recaptchaToggle = document.getElementById('recaptchaToggle');
const whatsappToggle = document.getElementById('whatsappToggle');
const cacheToggle = document.getElementById('cacheToggle');
const deliveryIncentive = document.getElementById('deliveryIncentive');
const saveBtn = document.getElementById('saveSettingsBtn');
const cacheStatus = document.getElementById('cacheStatus');

// Update Status Text on Change
function updateStatusText(toggle, statusEl) {
    statusEl.textContent = toggle.checked ? "On" : "Off";
    statusEl.className = "status-text " + (toggle.checked ? "text-success" : "text-muted");
}

[maintenanceToggle, registrationToggle, recaptchaToggle, whatsappToggle, cacheToggle].forEach(toggle => {
    toggle.addEventListener('change', (e) => {
        const statusEl = document.getElementById(e.target.id.replace('Toggle', 'Status'));
        updateStatusText(e.target, statusEl);
    });
});

// Auth Check
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check if admin
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            const userData = userDoc.data();
            document.getElementById('adminName').textContent = userData.displayName || user.displayName || 'Admin';

            // Prefer Firestore photoURL, then Auth photoURL, then default
            const photoURL = userData.photoURL || user.photoURL || '../images/client1.gif';
            document.getElementById('adminImg').src = photoURL;

            // Load Settings
            await loadSettings();

            // Hide Loader
            const loader = document.getElementById('page-loader');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 500);
            }
        } else {
            console.log("Not an admin, redirecting...");
            window.location.href = '../index.html';
        }
    } else {
        window.location.href = '../auth/login.html';
    }
});

// Load Settings
async function loadSettings() {
    try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            maintenanceToggle.checked = data.maintenanceMode || false;
            registrationToggle.checked = data.registrationEnabled !== false; // Default true
            recaptchaToggle.checked = data.recaptchaEnabled || false;
            whatsappToggle.checked = data.whatsappEnabled !== false; // Default true
            cacheToggle.checked = data.storeCache !== false; // Default true

            // Update texts
            updateStatusText(maintenanceToggle, maintenanceStatus);
            updateStatusText(registrationToggle, registrationStatus);
            updateStatusText(recaptchaToggle, recaptchaStatus);
            updateStatusText(whatsappToggle, whatsappStatus);
            updateStatusText(cacheToggle, cacheStatus);
        }

        // Load delivery incentive (separate document)
        const incentiveDoc = await getDoc(doc(db, "settings", "deliveryIncentive"));
        if (incentiveDoc.exists()) {
            deliveryIncentive.value = incentiveDoc.data().amount || 0;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        alert("Error loading settings. See console.");
    }
}

// Save Settings
saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';

    try {
        const settings = {
            maintenanceMode: maintenanceToggle.checked,
            registrationEnabled: registrationToggle.checked,
            recaptchaEnabled: recaptchaToggle.checked,
            whatsappEnabled: whatsappToggle.checked,
            storeCache: cacheToggle.checked,
            lastUpdated: new Date()
        };

        await setDoc(doc(db, "settings", "config"), settings, { merge: true });

        // Save delivery incentive (separate document)
        const incentiveValue = parseFloat(deliveryIncentive.value) || 0;
        await setDoc(doc(db, "settings", "deliveryIncentive"), {
            amount: incentiveValue,
            lastUpdated: new Date()
        });

        // Show Success Toast (defined in HTML)
        if (window.showToast) window.showToast("Settings saved successfully!", "success");
        else alert("Settings saved!");

    } catch (error) {
        console.error("Error saving settings:", error);
        if (window.showToast) window.showToast("Error saving settings.", "danger");
        else alert("Error saving settings.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa fa-save"></i> Save Changes';
    }
});
