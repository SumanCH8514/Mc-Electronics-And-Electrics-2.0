# Mc Electronics And Electrics - Official Website

![Project Banner](images/hero-bg.png) 
*(Note: Use an actual screenshot of your homepage here)*

## 📋 Table of Contents
- [About the Project](#-about-the-project)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Credits](#-credits)

## 📖 About the Project

**Mc Electronics And Electrics** is a modern, responsive web application designed for a local electronics business. This platform serves as a digital storefront, providing customers with information about services, the team, and easy ways to contact or pay the business. It features a fully integrated user authentication system, allowing users to create accounts, manage their profiles, and securely access exclusive features.

This project transforms a traditional business into a digital-first experience with a sleek User Interface (UI) and robust User Experience (UX).

## 🚀 Features

### 👤 User Authentication & Management
*   **Secure Login & Registration:** Powered by **Firebase Auth**, supporting email/password sign-in.
*   **Profile Management:** unique "My Account" area where users can:
    *   Update Profile Details (Name, Phone, Address).
    *   Upload Profile Photos (Stored via Firestore Base64 encoding).
    *   Permanently Delete their Account.
*   **Role-Based System:** Architecture supports `user` and `admin` roles (defaulting to `user`).

### 💻 Modern UI/UX
*   **Responsive Design:** Fully compatible with Desktops, Tablets, and Mobile devices.
*   **Dynamic Navbar:** Smart navigation that switches between "Login" and "My Account" based on auth status.
*   **Interactive Animations:** Scroll-triggered fade-up animations (AOS style) for a modern feel.
*   **Sticky Header:** Navigation stays accessible while scrolling.

### 🛠️ Core Functionality
*   **Service Showcase:** Detailed sections for Services, About Us, and Team.
*   **Payment Gateway Interface:** A dedicated "Pay Us" page featuring:
    *   UPI QR Codes.
    *   Bank Transfer Details (with Show/Hide security toggle).
    *   Direct UPI Link generation.
*   **Contact Integration:** Embedded Google Maps and floating WhatsApp chat button.

## ⚙️ Technology Stack

*   **Frontend:**
    *   **HTML5 & CSS3:** Semantic markup and custom styling.
    *   **JavaScript (ES6+):** For DOM manipulation and Auth credential handling.
    *   **Bootstrap 4:** For responsive grid layout and components.
    *   **jQuery:** For carousel and legacy plugin support.
    *   **Owl Carousel:** For the testimonial and slider sections.
    *   **FontAwesome:** For vector icons.

*   **Backend / Serverless:**
    *   **Firebase Authentication:** Identity functionality.
    *   **Cloud Firestore:** NoSQL database for storing user profiles and roles.
    *   **Firebase Storage:** (Optional integration prepared for file hosting).

## 🏁 Getting Started

### Prerequisites
*   A browser (Chrome, Firefox, Edge).
*   A local server environment (like XAMPP, VS Code Live Server) is recommended but standard HTML opening works for most parts (except modules).

### Installation
1.  **Clone the Repo**
    ```sh
    git clone https://github.com/SumanCH8514/Mc-Electronics.git
    ```
2.  **Navigate to directory**
    ```sh
    cd Mc-Electronics/public
    ```
3.  **Setup Firebase**
    *   Create a project in [Firebase Console](https://console.firebase.google.com/).
    *   Enable **Authentication** (Email/Password).
    *   Enable **Firestore Database**.
    *   Copy your web config keys into `js/firebase-auth.js` and `js/profile-manager.js`.

## 🎈 Usage

1.  **Home Page:** Browse services and see the latest offers.
2.  **Login/Signup:** Click "Login" in the navbar.
    *   Use the **Register** tab to create an account.
    *   Use the **Login** tab to access your dashboard.
3.  **My Account:** Once logged in, go to "My Account" to edit your info or upload a picture.
4.  **Pay:** Visit the "Pay" page to scan QR codes or view bank details for payments.

## 📂 Project Structure

```
public/
├── css/             # Stylesheets (style.css, responsive.css, bootstrap.css)
├── images/          # Project assets (logos, banners, icons)
├── js/              # Application Logic
│   ├── firebase-auth.js    # Auth & Registration Logic
│   ├── profile-manager.js  # User Profile & Database Logic
│   ├── navbar-auth.js      # Navbar State Management
│   └── custom.js           # UI Interactions
├── login.html       # Authentication Page
├── my-account.html  # User Dashboard (Protected)
├── index.html       # Landing Page
├── pay-us.html      # Payment Information Page
└── ...
```

## 👨‍💻 Credits

**Developed & Maintained By:**
### [Suman Chakrabortty](https://github.com/SumanCH8514/)
*   **GitHub:** [@SumanCH8514](https://github.com/SumanCH8514/)

---
*© 2024 Mc Electronics And Electrics. All Rights Reserved.*
