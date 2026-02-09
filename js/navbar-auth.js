import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const db = getFirestore(app);

const loginLink = document.getElementById('loginLink');

const adminNavItem = document.getElementById('adminNavItem');

// Function to Manage Service Worker
function manageServiceWorker(enable) {
    if (!('serviceWorker' in navigator)) return;

    if (enable) {
        // Register SW
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW Registered:', registration.scope);
        }).catch(err => {
            console.log('SW Registration Failed:', err);
        });
    } else {
        // Unregister SW
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
                console.log('SW Unregistered');
            }
        });

        // Clear Caches
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
                console.log('Cache Deleted:', cacheName);
            });
        });
    }
}

// Function to check Maintenance Mode & Settings
async function checkMaintenanceMode(user) {
    // Skip check if on maintenance page or login/admin pages
    const path = window.location.pathname;
    // Removed strict check to allow settings to load on all pages for SW control
    // if (path.includes('maintenance.html') || path.includes('login.html') || path.includes('/admin/')) {
    //    return;
    // }

    try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Manage Service Worker (Default to true if undefined)
            manageServiceWorker(data.storeCache !== false);

            // Check WhatsApp Setting
            // Default to true if undefined. CSS hides it by default, so we must explicitly show it.
            if (data.whatsappEnabled !== false) {
                const waFloats = document.querySelectorAll('.whatsapp_float');
                waFloats.forEach(el => el.style.display = 'flex');
            }

            // Maintenance is ON
            if (data.maintenanceMode) {
                // If on admin or login page, strict checking might prevent access, so we handle carefully
                if (path.includes('/admin/') || path.includes('login.html')) {
                    // allow
                } else if (user) {
                    // Check if admin
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists() && userDoc.data().role === 'admin') {
                        // Admin can stay
                        return;
                    } else {
                        // Not an admin
                        redirectToMaintenance(path);
                    }
                } else {
                    // Not logged in
                    redirectToMaintenance(path);
                }
            }
        }
    } catch (error) {
        console.error("Error checking settings/maintenance mode:", error);
    }
}

function redirectToMaintenance(path) {
    if (path.includes('maintenance.html')) return;
    // Handle relative path for redirect
    const isSubDir = path.includes('/accounts/') || path.includes('/pages/');
    const redirectPath = isSubDir ? '../maintenance.html' : 'maintenance.html';
    window.location.href = redirectPath;
}

// Function to set active nav item
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const filename = currentPath.split('/').pop() || 'index.html'; // Default to index.html if root

    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

    // Default to removing all active classes first
    navLinks.forEach(link => {
        link.parentElement.classList.remove('active');
    });

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Clean up href to compare with filename
        // Remove ../, ./, and query params
        const cleanHref = href.split('?')[0].split('/').pop();

        if (cleanHref === filename) {
            link.parentElement.classList.add('active');
        }
    });
}

// Call it immediately
setActiveNavItem();

// Function to check admin role
async function checkAdminRole(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        // Find the admin link INSIDE the dropdown
        const adminDropdownLink = document.getElementById('adminDropdownLink');
        const mobileAdminLink = document.getElementById('mobileAdminLink');

        if (docSnap.exists()) {
            const userData = docSnap.data();

            // 1. Handle Admin Role
            if (userData.role === 'admin') {
                if (adminDropdownLink) adminDropdownLink.style.display = 'flex';
                if (mobileAdminLink) mobileAdminLink.style.display = 'flex';
                if (adminNavItem) adminNavItem.style.display = 'none';
            } else {
                if (adminDropdownLink) adminDropdownLink.style.display = 'none';
                if (mobileAdminLink) mobileAdminLink.style.display = 'none';
                if (adminNavItem) adminNavItem.style.display = 'none';
            }

            // 2. Handle Profile Picture (Base64 from Firestore)
            if (userData.photoURL) {
                // Update Mobile Profile Image
                const mobileImg = document.querySelector('.mobile-profile-img');
                if (mobileImg) mobileImg.src = userData.photoURL;

                // Update Desktop/Main Navbar Image if we have one (user-account-link icon?)
                // The main navbar uses a font-awesome icon <i class="fa fa-user-circle-o"></i>. 
                // We could replace it with an image if we wanted, but user specifically asked for mobile.
            }
        } else {
            // User doc doesn't exist? Hide admin links.
            if (adminDropdownLink) adminDropdownLink.style.display = 'none';
            if (mobileAdminLink) mobileAdminLink.style.display = 'none';
            if (adminNavItem) adminNavItem.style.display = 'none';
        }
    } catch (error) {
        console.error("Error checking admin role:", error);
    }
}

// Logout global function
window.logout = function () {
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signOut }) => {
        signOut(auth).then(() => {
            window.location.reload();
        });
    });
}

if (loginLink) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in.
            const isSubDir = window.location.pathname.includes('/accounts/') || window.location.pathname.includes('/admin/') || window.location.pathname.includes('/pages/');
            const basePath = isSubDir ? '../' : '';
            const adminPath = isSubDir ? 'admin/dashboard.html' : 'admin/dashboard.html'; // Adjust relative path logic if needed
            // Actually if in accounts/orders.html (depth 1), admin is at ../admin/dashboard.html
            // If in index.html (depth 0), admin is at admin/dashboard.html
            const finalAdminPath = isSubDir ? '../admin/dashboard.html' : 'admin/dashboard.html';

            const displayName = user.displayName ? user.displayName.split(' ')[0] : 'User';

            // Transform the LI item to be a Dropdown
            const li = loginLink.parentElement;
            li.classList.add('dropdown');

            // Replace innerHTML with Dropdown Structure
            li.innerHTML = `
        <a class="nav-link dropdown-toggle user-account-link" href="#" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            <i class="fa fa-user-circle-o mr-1"></i> ${displayName}
        </a>
        <div class="dropdown-menu account-dropdown-menu" aria-labelledby="navbarDropdown">
            <a class="dropdown-item" href="${basePath}accounts/my-account.html"><i class="fa fa-user"></i> My Profile</a>
            
            <!-- Admin Panel Option (Hidden by default) -->
            <a class="dropdown-item" href="${finalAdminPath}" id="adminDropdownLink" style="display: none;"><i class="fa fa-lock"></i> Admin Panel</a>
            
            <a class="dropdown-item" href="${basePath}accounts/dashboard.html"><i class="fa fa-dashboard"></i> User Dashboard</a>

            <div class="dropdown-divider"></div>
            <a class="dropdown-item" href="${basePath}accounts/orders.html"><i class="fa fa-cube"></i> Orders</a>
            <a class="dropdown-item" href="#"><i class="fa fa-heart"></i> Wishlist (0)</a>
            <a class="dropdown-item" href="#"><i class="fa fa-ticket"></i> Coupons</a>
            <a class="dropdown-item" href="#"><i class="fa fa-gift"></i> Gift Cards</a>
            <a class="dropdown-item" href="#"><i class="fa fa-bell"></i> Notifications</a>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" href="#" onclick="logout()"><i class="fa fa-sign-out"></i> Logout</a>
        </div>
      `;



            // MOBILE SIDEBAR PROFILE LOGIC
            const mobileProfileWrapper = document.getElementById('mobileProfileWrapper');
            if (mobileProfileWrapper) {
                const defaultProfilePic = `${basePath}images/profile.png`;
                const photoURL = user.photoURL || defaultProfilePic;

                // Profile Image Section
                const img = document.createElement('img');
                img.src = photoURL;
                img.className = 'mobile-profile-img';
                img.alt = 'Profile';
                // Add error handler to fallback to default image
                img.onerror = function () {
                    this.onerror = null; // Prevent infinite loop
                    this.src = defaultProfilePic;
                };

                // Name Box Section
                const nameBox = document.createElement('div');
                nameBox.className = 'mobile-profile-box dropdown-toggle';
                nameBox.setAttribute('data-toggle', 'dropdown');
                nameBox.innerHTML = `<i class="fa fa-user-circle-o mr-2" style="font-size: 1.2rem;"></i> <span style="flex-grow: 1; text-align: left;">${displayName}</span>`;

                // Dropdown Menu Section
                const dropdownMenu = document.createElement('div');
                dropdownMenu.className = 'dropdown-menu mobile-profile-dropdown';
                dropdownMenu.innerHTML = `
                    <a class="dropdown-item" href="${basePath}accounts/my-account.html"><i class="fa fa-user"></i> My Profile</a>
                    <a class="dropdown-item" href="${finalAdminPath}" id="mobileAdminLink" style="display: none;"><i class="fa fa-lock"></i> Admin Panel</a>
                    <a class="dropdown-item" href="${basePath}accounts/dashboard.html"><i class="fa fa-tachometer"></i> User Dashboard</a>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item" href="${basePath}accounts/orders.html"><i class="fa fa-cube"></i> Orders</a>
                    <a class="dropdown-item" href="#"><i class="fa fa-heart"></i> Wishlist (0)</a>
                    <a class="dropdown-item" href="#"><i class="fa fa-ticket"></i> Coupons</a>
                    <a class="dropdown-item" href="#"><i class="fa fa-gift"></i> Gift Cards</a>
                    <a class="dropdown-item" href="#"><i class="fa fa-bell"></i> Notifications</a>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item" href="#" onclick="logout()"><i class="fa fa-sign-out"></i> Logout</a>
                `;

                // Clear previous and Append new
                mobileProfileWrapper.innerHTML = '';
                mobileProfileWrapper.appendChild(img);
                mobileProfileWrapper.appendChild(nameBox);
                mobileProfileWrapper.appendChild(dropdownMenu);

                // Hide the main Login link in sidebar (mobile only) since we have top profile
                if (li) {
                    li.classList.add('d-none', 'd-lg-block');
                }
            }

            // Check for Admin Role & Update Profile Pic
            checkAdminRole(user);

            // Check Maintenance Mode (Admin bypass handled inside)
            checkMaintenanceMode(user);

        } else {
            // User is signed out.

            // Check Maintenance Mode (Guest will be redirected)
            checkMaintenanceMode(null);

            const path = window.location.pathname;
            const isSubDir = path.includes('/accounts/') || path.includes('/admin/') || path.includes('/pages/');
            const loginPath = isSubDir ? '../auth/login.html' : (path.includes('/auth/') ? 'login.html' : 'auth/login.html');

            // Reset to original state
            const li = loginLink.parentElement;
            if (li) {
                li.style.display = 'block'; // Ensure it's visible
                if (li.classList.contains('dropdown')) {
                    li.classList.remove('dropdown');
                    li.innerHTML = `<a class="nav-link" href="${loginPath}" id="loginLink"> <i class="fa fa-user" aria-hidden="true"></i> Login</a>`;
                } else {
                    loginLink.innerHTML = '<i class="fa fa-user" aria-hidden="true"></i> Login';
                    loginLink.href = loginPath;
                }
            }

            // Clear Mobile Profile Wrapper
            const mobileProfileWrapper = document.getElementById('mobileProfileWrapper');
            if (mobileProfileWrapper) mobileProfileWrapper.innerHTML = '';

            if (adminNavItem) adminNavItem.style.display = 'none';
        }
    });
}
