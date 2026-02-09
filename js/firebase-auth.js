// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import firebaseConfig from "./firebase-config.js";

// Initialize Firebase

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper to check ReCaptcha setting
async function isRecaptchaEnabled() {
  try {
    const docRef = doc(db, "settings", "config");
    const docSnap = await getDoc(docRef);
    // Default to true if doc doesn't exist or field is missing
    return !docSnap.exists() || docSnap.data().recaptchaEnabled !== false;
  } catch (error) {
    console.error("Error checking recaptcha setting:", error);
    return true; // Default to enabled on error for security
  }
}

// Registration Logic
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    const recaptchaEnabled = await isRecaptchaEnabled();
    if (recaptchaEnabled) {
      const recaptchaResponse = grecaptcha.getResponse(1); // Index 1 for Register Form (second widget on page)
      if (recaptchaResponse.length === 0) {
        const errorDiv = document.getElementById('register-error-msg');
        if (errorDiv) {
          errorDiv.innerText = "Please complete the CAPTCHA.";
          errorDiv.style.display = 'block';
          errorDiv.classList.remove('shake');
          void errorDiv.offsetWidth;
          errorDiv.classList.add('shake');
        } else {
          alert("Please complete the CAPTCHA.");
        }
        return;
      }
    }

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

      // 3. Send Email Verification
      await sendEmailVerification(user);

      // 4. Sign out user (they must verify email before logging in)
      await signOut(auth);

      alert("Registration Successful! A verification email has been sent to " + email + ". Please verify your email before logging in.");

      // Switch to login tab
      const loginTab = document.getElementById('login-tab');
      if (loginTab) loginTab.click();

      // Clear form
      registerForm.reset();

    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;

      const errorDiv = document.getElementById('register-error-msg');
      if (errorDiv) {
        if (errorCode === 'auth/email-already-in-use') {
          errorDiv.innerText = "Email Address already in use.";
        } else {
          errorDiv.innerText = "Error: " + errorMessage;
        }
        errorDiv.style.display = 'block';

        // Add Shake Animation (Reuse from login style)
        errorDiv.classList.remove('shake');
        void errorDiv.offsetWidth; // Trigger Reflow
        errorDiv.classList.add('shake');
      } else {
        alert("Registration Error: " + errorMessage);
      }
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

    const recaptchaEnabled = await isRecaptchaEnabled();
    if (recaptchaEnabled) {
      const recaptchaResponse = grecaptcha.getResponse(0); // Index 0 for Login Form (first widget on page)
      if (recaptchaResponse.length === 0) {
        const errorDiv = document.getElementById('login-error-msg');
        if (errorDiv) {
          errorDiv.innerText = "Please complete the CAPTCHA.";
          errorDiv.style.display = 'block';
          errorDiv.classList.remove('shake');
          void errorDiv.offsetWidth;
          errorDiv.classList.add('shake');
        } else {
          alert("Please complete the CAPTCHA.");
        }
        return;
      }
    }

    // Clear any previous error
    const errorDiv = document.getElementById('login-error-msg');
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.innerText = '';
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if email is verified
      if (!user.emailVerified) {
        // Sign out unverified user
        await signOut(auth);

        const errorDiv = document.getElementById('login-error-msg');
        if (errorDiv) {
          errorDiv.innerHTML = 'Please verify your email address before logging in. <a href="#" onclick="window.resendVerificationEmail(\'' + email + '\', \'' + password + '\'); return false;" style="color: #00bbf0; text-decoration: underline;">Resend verification email</a>';
          errorDiv.style.display = 'block';
        } else {
          alert("Please verify your email address before logging in.");
        }
        return;
      }

      // Check if user data exists in Firestore, create if not (for backward compatibility)
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Create user document for verified users
        await setDoc(userDocRef, {
          uid: user.uid,
          displayName: user.displayName || "User",
          email: user.email,
          role: "user",
          createdAt: new Date(),
          emailVerified: true
        });
      }

      alert("Login Successful! Welcome " + (user.displayName || "User"));

      // Redirect to dashboard
      window.location.href = "../accounts/dashboard.html";

    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;

      const errorDiv = document.getElementById('login-error-msg');

      let displayMessage = "Login Failed: " + errorMessage;
      let handled = false;

      if (errorCode === 'auth/invalid-credential') {
        displayMessage = "Mail or Password doesn't match";
        handled = true;
      } else if (errorCode === 'auth/user-not-found') {
        displayMessage = "You don't have an account with this email ID";
        handled = true;
      } else if (errorCode === 'auth/wrong-password') {
        // Explicitly handle wrong password if separate from invalid-credential
        displayMessage = "Mail or Password doesn't match";
        handled = true;
      }

      if (errorDiv) {
        errorDiv.innerText = displayMessage;
        errorDiv.style.display = 'block';

        // Add Shake Animation
        errorDiv.classList.remove('shake');
        void errorDiv.offsetWidth; // Trigger Reflow
        errorDiv.classList.add('shake');
      } else {
        alert(displayMessage);
      }
      console.error("Login Error:", errorCode, errorMessage);
    }
  });
}

// Forgot Password Logic
const forgotPasswordForm = document.getElementById('forgotPasswordForm');

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('reset-email').value;
    const messageDiv = document.getElementById('forgot-password-message');
    const submitBtn = document.getElementById('resetPasswordBtn');

    // Disable button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerText = 'Sending...';

    try {
      await sendPasswordResetEmail(auth, email);

      // Show success message
      messageDiv.style.display = 'block';
      messageDiv.style.color = '#28a745';
      messageDiv.innerHTML = '<i class="fa fa-check-circle"></i> Password reset email sent! Please check your inbox.';

      // Clear form
      document.getElementById('reset-email').value = '';

      // Close modal after 2 seconds
      setTimeout(() => {
        $('#forgotPasswordModal').modal('hide');
        messageDiv.style.display = 'none';
      }, 2000);

    } catch (error) {
      const errorCode = error.code;
      let errorMessage = 'Failed to send reset email. Please try again.';

      // Handle specific errors
      if (errorCode === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      }

      // Show error message
      messageDiv.style.display = 'block';
      messageDiv.style.color = '#dc3545';
      messageDiv.innerHTML = '<i class="fa fa-exclamation-circle"></i> ' + errorMessage;

      console.error('Password Reset Error:', errorCode, error.message);
    } finally {
      // Re-enable button
      submitBtn.disabled = false;
      submitBtn.innerText = 'Send Reset Link';
    }
  });
}

// Resend Verification Email Function
window.resendVerificationEmail = async function (email, password) {
  try {
    // Sign in to get the user object
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Send verification email
    await sendEmailVerification(user);

    // Sign out again
    await signOut(auth);

    const errorDiv = document.getElementById('login-error-msg');
    if (errorDiv) {
      errorDiv.style.color = '#28a745';
      errorDiv.innerHTML = '<i class="fa fa-check-circle"></i> Verification email sent! Please check your inbox.';
    } else {
      alert("Verification email sent! Please check your inbox.");
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    alert("Failed to resend verification email. Please try again.");
  }
}

// Auto Redirect if User is already logged in (Login Page Only)
if (window.location.pathname.includes('login.html')) {
  onAuthStateChanged(auth, (user) => {
    if (user && user.emailVerified) {
      window.location.href = '../accounts/dashboard.html';
    } else {
      // Show body if not logged in
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '1';
      document.body.style.transition = 'opacity 0.5s ease';
    }
  });
}
