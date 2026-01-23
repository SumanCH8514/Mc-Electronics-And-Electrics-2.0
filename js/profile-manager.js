import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile, deleteUser, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// REUSE CONFIG FROM firebase-auth.js (Ideally should be in a shared config file)
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

// AUTH GUARD & DATA LOADING
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in.
    console.log("Current User:", user.email);
    
    // Populate Basic Auth Data
    document.getElementById('profileName').value = user.displayName || "";
    document.getElementById('profileEmail').value = user.email || "";
    if (user.photoURL) {
      document.getElementById('profileImage').src = user.photoURL;
    }

    // Fetch Additional Data from Firestore
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('profilePhone').value = data.phone || "";
        document.getElementById('profileAddress').value = data.address || "";
        
        // Load Profile Photo from Firestore (Base64)
        if (data.photoURL) {
          document.getElementById('profileImage').src = data.photoURL;
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }

  } else {
    // User is NOT signed in. Redirect to Homepage.
    alert("You must be logged in to view this page.");
    window.location.href = "../index.html";
  }
});



// PROFILE PHOTO UPLOAD (Base64 Version - No Storage Required)
const fileInput = document.getElementById('uploadProfileInput');
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const user = auth.currentUser;
    
    if (!file || !user) return;

    // Limit file size to 550KB to prevent Firestore issues
    if (file.size > 550 * 1024) {
      alert("Please select an image smaller than 550KB.");
      return;
    }

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64String = e.target.result;

        // 1. Update UI immediately
        document.getElementById('profileImage').src = base64String;

        // 2. Save Base64 string to Firestore
        // Note: We skip updateProfile(photoURL) because it has a short character limit.
        // We rely on Firestore for the image source.
        await setDoc(doc(db, "users", user.uid), {
          photoURL: base64String,
          updatedAt: new Date()
        }, { merge: true });

        alert("Profile photo updated successfully!");
      };

      reader.readAsDataURL(file);

    } catch (error) {
      console.error("Error processing photo:", error);
      alert("Failed to process photo: " + error.message);
    }
  });
}

// UPDATE PROFILE
const profileForm = document.getElementById('profileForm');
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const name = document.getElementById('profileName').value;
    const phone = document.getElementById('profilePhone').value;
    const address = document.getElementById('profileAddress').value;

    try {
      // 1. Update Auth Profile
      await updateProfile(user, {
        displayName: name
      });

      // 2. Update Firestore Data (Merge to keep email/created props)
      await setDoc(doc(db, "users", user.uid), {
        displayName: name,
        phone: phone,
        address: address,
        updatedAt: new Date()
      }, { merge: true });

      alert("Profile Updated Successfully!");

    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile: " + error.message);
    }
  });
}

// UPDATE PASSWORD
const passwordForm = document.getElementById('passwordForm');
if (passwordForm) {
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      await updatePassword(user, newPassword);
      alert("Password updated successfully!");
      passwordForm.reset();
    } catch (error) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/requires-recent-login') {
         alert("Security Check: You need to re-login to change your password.");
         // Optionally logout user to force re-login
         await logout();
      } else {
         alert("Failed to update password: " + error.message);
      }
    }
  });
}


// DELETE ACCOUNT
window.deleteAccount = async () => {
  if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // 1. Delete Firestore Data
      await deleteDoc(doc(db, "users", user.uid));

      // 2. Delete Auth User
      await deleteUser(user);

      alert("Account deleted. We are sorry to see you go.");
      window.location.href = "login.html";

    } catch (error) {
      console.error("Error deleting account:", error);
      // Re-authentication might be needed if critical action fails
      alert("Error: " + error.message + " (You may need to re-login to prove your identity before deleting)");
    }
  }
};

// LOGOUT
window.logout = async () => {
  try {
    await signOut(auth);
    window.location.href = "../login.html";
  } catch (error) {
    console.error("Error signing out:", error);
  }
};
