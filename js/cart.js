import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, limit, getDocs, getDoc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let cartUnsubscribe = null;
let currentAddress = null; // Store fetched address

// UI Elements
const floatingCartIcon = document.getElementById('floatingCartIcon');
const cartBadge = document.getElementById('cartBadge');
const cartSidebar = document.getElementById('cartSidebar');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartTotalAmount = document.getElementById('cartTotalAmount');
const cartOverlay = document.getElementById('cartOverlay');
const addToCartBtn = document.getElementById('addToCartBtn');
const addToCartBtnMobile = document.getElementById('addToCartBtnMobile');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const cartAddressEl = document.getElementById('cartDeliveryAddress'); // New Element

// 1. Auth Listener
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        // User is logged in
        // floatingCartIcon.style.display = 'flex'; // Wait for cart listener
        listenToCart(user.uid);
        loadUserAddress(user.uid); // Fetch address
    } else {
        // User is logged out
        if (cartUnsubscribe) cartUnsubscribe();
        updateCartUI([]);
        cartBadge.style.display = 'none';
        floatingCartIcon.style.display = 'none';
        if (cartAddressEl) cartAddressEl.innerHTML = 'Please login to see address';
    }
});

// Load User Address
async function loadUserAddress(uid) {
    if (!cartAddressEl) return;
    cartAddressEl.textContent = "Loading...";

    try {
        // Check if multiple addresses exist to show "Change" option
        const q = query(collection(db, 'users', uid, 'addresses'), limit(2));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            currentAddress = data; // Store for order

            let changeLink = '';
            if (snapshot.size > 1) {
                changeLink = `<br><a href="#" onclick="window.openAddressSelectionModal(); return false;" class="text-primary small">Change</a>`;
            }

            cartAddressEl.innerHTML = `
                ${data.line1}, ${data.city} (${data.pincode})
                ${changeLink}
            `;
        } else {
            currentAddress = null;
            cartAddressEl.innerHTML = 'Not set. <a href="accounts/addresses.html" style="text-decoration: underline;">Add Address</a>';
        }
    } catch (e) {
        console.error("Error loading address:", e);
        cartAddressEl.textContent = "Error loading address.";
    }
}

// 2. Add to Cart Logic
// Helper to update button state (Add to Cart / Go to Cart)
function updateButtonState(isInCart) {
    if (!addToCartBtn) return; // Only proceed if the button exists

    if (isInCart) {
        addToCartBtn.innerHTML = '<i class="fa fa-shopping-cart"></i> Go to Cart';
        addToCartBtn.classList.remove('btn-warning');
        addToCartBtn.classList.add('btn-success'); // Change color to indicate state
        addToCartBtn.dataset.mode = 'goto';
        if (addToCartBtnMobile) {
            addToCartBtnMobile.innerHTML = '<i class="fa fa-shopping-cart"></i> Go to Cart';
            addToCartBtnMobile.classList.remove('btn-warning');
            addToCartBtnMobile.classList.add('btn-success');
            addToCartBtnMobile.dataset.mode = 'goto';
        }
    } else {
        addToCartBtn.innerHTML = '<i class="fa fa-shopping-cart"></i> Add to Cart';
        addToCartBtn.classList.remove('btn-success');
        addToCartBtn.classList.add('btn-warning');
        addToCartBtn.dataset.mode = 'add';
        if (addToCartBtnMobile) {
            addToCartBtnMobile.innerHTML = '<i class="fa fa-shopping-cart"></i> Add to Cart';
            addToCartBtnMobile.classList.remove('btn-success');
            addToCartBtnMobile.classList.add('btn-warning');
            addToCartBtnMobile.dataset.mode = 'add';
        }
    }
}

// Helper to check if current page product is in cart
function checkCurrentProductInCart(items) {
    const currentProductId = new URLSearchParams(window.location.search).get('id');
    if (!currentProductId) {
        updateButtonState(false); // If no product ID, assume not in cart
        return;
    }

    const isInCart = items.some(item => item.productId === currentProductId);
    updateButtonState(isInCart);
}

if (addToCartBtn) {
    addToCartBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert("Please login to add items to your cart.");
            window.location.href = "auth/login.html";
            return;
        }

        // Check mode: If 'goto', just open cart
        if (addToCartBtn.dataset.mode === 'goto') {
            openCart();
            return;
        }

        // Get Product Details from DOM
        const productId = new URLSearchParams(window.location.search).get('id');
        const pName = document.getElementById('p_name').textContent;
        const pPriceText = document.getElementById('p_price').textContent;
        const pImage = document.getElementById('p_image').src;

        // Parse Price (Remove non-numeric except dot)
        const price = parseFloat(pPriceText.replace(/[^\d.]/g, ''));

        if (!productId) {
            alert("Error: Product ID missing.");
            return;
        }

        const cartItemRef = doc(db, 'users', currentUser.uid, 'cart', productId);

        try {
            // Check if exists logic is handled by listenToCart usually, 
            // but for instant feedback we proceed.
            // Actually, we just set merge: true.

            // We want to increment if exists, but our new logic says if it exists, button is "Go to Cart".
            // So if we are here (mode !== goto), it implies it's NOT in cart (or we haven't synced yet).
            // So we can assume quantity 1. 
            // BUT, strictly speaking, if there's a latency, we might duplicate. 
            // Safe to read once to be sure, or just set to 1.
            // "if an item is added to cart then show Go to Cart... instead of Add to cart"
            // This implies: Add -> becomes Go.

            const docSnap = await getDoc(cartItemRef);

            let newQty = 1;
            if (docSnap.exists()) {
                newQty = docSnap.data().quantity + 1;
            }

            await setDoc(cartItemRef, {
                productId: productId,
                name: pName,
                price: price,
                image: pImage,
                quantity: newQty,
                updatedAt: new Date()
            }, { merge: true });

            // Removed alert("Item added to cart!");
            openCart(); // Open cart to show the item

            // The listener will update the button text automatically

        } catch (e) {
            console.error("Error adding to cart:", e);
            alert("Failed to add to cart: " + e.message);
        }
    });
}

// Add event listener for mobile button (same functionality)
if (addToCartBtnMobile) {
    addToCartBtnMobile.addEventListener('click', async () => {
        if (!currentUser) {
            alert("Please login to add items to your cart.");
            window.location.href = "auth/login.html";
            return;
        }

        // Check mode: If 'goto', just open cart
        if (addToCartBtnMobile.dataset.mode === 'goto') {
            openCart();
            return;
        }

        // Get Product Details from DOM
        const productId = new URLSearchParams(window.location.search).get('id');
        const pName = document.getElementById('p_name').textContent;
        const pPriceText = document.getElementById('p_price').textContent;
        const pImage = document.getElementById('p_image').src;

        // Parse Price (Remove non-numeric except dot)
        const price = parseFloat(pPriceText.replace(/[^\d.]/g, ''));

        if (!productId) {
            alert("Error: Product ID missing.");
            return;
        }

        const cartItemRef = doc(db, 'users', currentUser.uid, 'cart', productId);

        try {
            const docSnap = await getDoc(cartItemRef);

            let newQty = 1;
            if (docSnap.exists()) {
                newQty = docSnap.data().quantity + 1;
            }

            await setDoc(cartItemRef, {
                productId: productId,
                name: pName,
                price: price,
                image: pImage,
                quantity: newQty,
                updatedAt: new Date()
            }, { merge: true });

            openCart(); // Open cart to show the item

        } catch (e) {
            console.error("Error adding to cart:", e);
            alert("Failed to add to cart: " + e.message);
        }
    });
}

// 3. Listen to Cart
function listenToCart(uid) {
    const q = collection(db, 'users', uid, 'cart');

    cartUnsubscribe = onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
            items.push(doc.data());
        });
        updateCartUI(items);
        checkCurrentProductInCart(items); // Check button state
    });
}

// 4. Update UI
function updateCartUI(items) {
    // Update Badge
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = totalItems;

    // Toggle Icon Visibility based on items
    if (totalItems > 0) {
        cartBadge.style.display = 'flex';
        floatingCartIcon.style.display = 'flex';
    } else {
        cartBadge.style.display = 'none';
        floatingCartIcon.style.display = 'none';
    }

    // Update List
    cartItemsContainer.innerHTML = '';
    let totalPrice = 0;

    if (items.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your cart is empty.</p>';

        // Auto-close cart after a short delay when it becomes empty
        setTimeout(() => {
            if (cartSidebar.classList.contains('open')) {
                closeCart();
            }
        }, 1500); // 1.5 second delay to show the empty message

        // Also ensure button reset if cart empty
        if (addToCartBtn) {
            addToCartBtn.innerHTML = '<i class="fa fa-shopping-cart"></i> Add to Cart';
            addToCartBtn.classList.remove('btn-success');
            addToCartBtn.classList.add('btn-warning');
            addToCartBtn.dataset.mode = 'add';
        }
        if (addToCartBtnMobile) {
            addToCartBtnMobile.innerHTML = '<i class="fa fa-shopping-cart"></i> Add to Cart';
            addToCartBtnMobile.classList.remove('btn-success');
            addToCartBtnMobile.classList.add('btn-warning');
            addToCartBtnMobile.dataset.mode = 'add';
        }
    } else {
        items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            totalPrice += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">₹${item.price.toLocaleString()}</div>
                    <div class="cart-item-controls">
                        <button class="qty-btn minus-btn" data-id="${item.productId}">-</button>
                        <span class="qty-display">${item.quantity}</span>
                        <button class="qty-btn plus-btn" data-id="${item.productId}">+</button>
                        <button class="remove-item-btn" data-id="${item.productId}"><i class="fa fa-trash"></i></button>
                    </div>
                </div>
            `;
            cartItemsContainer.appendChild(div);
        });
    }

    cartTotalAmount.textContent = '₹' + totalPrice.toLocaleString();

    // Attach Event Listeners to dynamic buttons
    document.querySelectorAll('.minus-btn').forEach(btn => {
        btn.addEventListener('click', (e) => updateItemQuantity(e.target.dataset.id, -1));
    });
    document.querySelectorAll('.plus-btn').forEach(btn => {
        btn.addEventListener('click', (e) => updateItemQuantity(e.target.dataset.id, 1));
    });
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        // Handle icon click vs button click
        const id = btn.dataset.id || btn.closest('.remove-item-btn').dataset.id;
        btn.addEventListener('click', () => removeItem(id));
    });
}

// 5. Cart Operations
async function updateItemQuantity(productId, change) {
    if (!currentUser) return;
    const cartItemRef = doc(db, 'users', currentUser.uid, 'cart', productId);

    // We need current qty. We could pass it, but read is safer.
    // Or we can find it in our local "items" if we made "items" global. 
    // Let's just do a getDoc to be safe and simple.
    // Optimization: find in DOM? No.

    try {
        const docSnap = await getDoc(cartItemRef);
        if (docSnap.exists()) {
            const currentQty = docSnap.data().quantity;
            const newQty = currentQty + change;

            if (newQty <= 0) {
                // Confirm delete?
                if (confirm("Remove this item from cart?")) {
                    await deleteDoc(cartItemRef);
                }
            } else {
                await setDoc(cartItemRef, { quantity: newQty }, { merge: true });
            }
        }
    } catch (e) {
        console.error("Error updating quantity:", e);
    }
}

async function removeItem(productId) {
    if (!currentUser) return;
    if (confirm("Are you sure you want to remove this item?")) {
        const cartItemRef = doc(db, 'users', currentUser.uid, 'cart', productId);
        await deleteDoc(cartItemRef);
    }
}

// 6. Sidebar Toggle
function openCart() {
    cartSidebar.classList.add('open');
    cartOverlay.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeCart() {
    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('show');
    document.body.style.overflow = 'auto';
}

floatingCartIcon.addEventListener('click', openCart);
closeCartBtn.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// 7. Place Order Logic
placeOrderBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please login to place an order.");
        window.location.href = "auth/login.html";
        return;
    }
    const itemsCount = cartBadge.textContent;
    if (itemsCount == '0') {
        alert("Your cart is empty!");
        return;
    }

    // Check Address
    if (!currentAddress) {
        alert("Please add a delivery address to your account before placing an order.");
        window.location.href = "accounts/addresses.html";
        return;
    }

    // Open Payment Modal
    document.getElementById('paymentTotalDisplay').innerHTML = cartTotalAmount.innerHTML;
    document.getElementById('payOnline').checked = false;
    document.getElementById('payCOD').checked = false;
    window.togglePaymentDetails();
    $('#paymentModal').modal('show');
});

// Toggle Payment Details
window.togglePaymentDetails = function () {
    const isOnline = document.getElementById('payOnline').checked;
    const isCOD = document.getElementById('payCOD').checked;

    const codSection = document.getElementById('codSection');
    const qrSection = document.getElementById('qrPaymentSection');

    if (isOnline) {
        codSection.style.display = 'none';
        qrSection.style.display = 'block';

        // Generate QR and Link
        const totalStr = cartTotalAmount.innerHTML.replace(/[^\d.]/g, '');
        const amount = parseFloat(totalStr).toFixed(2);
        const upiId = '8514900224@upi';
        const name = 'SUMAN CHAKRABORTTY';
        const note = 'Payment to Mc Electronics';

        // UPI URI with proper encoding
        // pa = payee address, pn = payee name, am = amount, cu = currency, tn = transaction note
        const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

        document.getElementById('payGenericUpiBtn').href = upiUri;

        // QR Code (Google Charts API)
        // Encode the URI for the QR
        const qrData = encodeURIComponent(upiUri);
        document.getElementById('paymentQRCode').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    } else if (isCOD) {
        qrSection.style.display = 'none';
        codSection.style.display = 'block';
    } else {
        qrSection.style.display = 'none';
        codSection.style.display = 'none';
    }
}

// Process Order Button Handler
window.processOrder = function (method) {
    if (method === 'Prepaid') {
        if (!confirm("Have you successfully completed the payment?")) return;
        finalizeOrder('Prepaid', 'Completed');
    } else {
        finalizeOrder('COD', 'Pending');
    }
}

// Finalize Order Logic
async function finalizeOrder(paymentMethod, paymentStatus) {
    const btn = paymentMethod === 'Prepaid' ?
        document.querySelector('#qrPaymentSection button') :
        document.querySelector('#codSection button');

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Processing...';

    try {
        // 1. Get current cart items
        const cartRef = collection(db, 'users', currentUser.uid, 'cart');
        const cartSnapshot = await getDocs(cartRef);

        const orderItems = [];
        let calculatedTotal = 0;

        cartSnapshot.forEach(doc => {
            const data = doc.data();
            orderItems.push(data);
            calculatedTotal += (data.price * data.quantity);
        });

        if (orderItems.length === 0) {
            alert("Cart is empty (sync error).");
            return;
        }

        // 2. Create Order Document
        const ordersRef = collection(db, 'users', currentUser.uid, 'orders');

        const newOrderRef = await addDoc(ordersRef, {
            items: orderItems,
            totalAmount: calculatedTotal,
            status: 'pending',
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus, // Pending for COD, Completed for Prepaid (user confirmed)
            createdAt: new Date(),
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            userId: currentUser.uid,
            shippingAddress: currentAddress
        });

        // 3. Dual Write: Also write to root 'orders' collection for Admin
        const rootOrderRef = doc(db, 'orders', newOrderRef.id);
        await setDoc(rootOrderRef, {
            items: orderItems,
            totalAmount: calculatedTotal,
            status: 'pending',
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            createdAt: new Date(),
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            userId: currentUser.uid,
            shippingAddress: currentAddress,
            originalOrderPath: `users/${currentUser.uid}/orders/${newOrderRef.id}`
        });

        // 4. Clear Cart
        await clearCart(currentUser.uid);

        $('#paymentModal').modal('hide');
        alert("Order Placed Successfully!");
        window.location.href = "accounts/orders.html";

    } catch (error) {
        console.error("Error placing order:", error);
        alert("Failed to place order: " + error.message);
        btn.disabled = false;
        btn.innerText = originalText;
    }
}



async function clearCart(uid) {
    const q = collection(db, 'users', uid, 'cart');
    const snapshot = await getDocs(q);

    // Batch delete would be better
    snapshot.forEach(async (docSnap) => {
        await deleteDoc(docSnap.ref);
    });
}

// Global Address Selection Logic
window.openAddressSelectionModal = async function () {
    if (!currentUser) return;
    const listEl = document.getElementById('addressSelectionList');
    listEl.innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading...</div>';
    $('#selectAddressModal').modal('show');

    try {
        const q = query(collection(db, 'users', currentUser.uid, 'addresses'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-center text-muted">No saved addresses.</p>';
            return;
        }

        let html = '<div class="list-group">';
        snapshot.docs.forEach((doc, index) => {
            const addr = doc.data();
            // Pass data safely
            const safeAddr = encodeURIComponent(JSON.stringify(addr));
            html += `
                <a href="#" class="list-group-item list-group-item-action" onclick="window.selectOrderAddress('${doc.id}', '${safeAddr}'); return false;">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${addr.name} <span class="badge badge-light border">${addr.type}</span></h6>
                    </div>
                    <p class="mb-1 text-muted small">${addr.line1}, ${addr.city} (${addr.pincode})</p>
                </a>
            `;
        });
        html += '</div>';
        listEl.innerHTML = html;

    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<p class="text-danger">Error loading addresses.</p>';
    }
}

window.selectOrderAddress = function (id, encodedAddr) {
    try {
        const addrData = JSON.parse(decodeURIComponent(encodedAddr));
        currentAddress = addrData; // Update global variable used for order
        const cartAddressEl = document.getElementById('cartDeliveryAddress');
        if (cartAddressEl) {
            cartAddressEl.innerHTML = `
                ${addrData.line1}, ${addrData.city} (${addrData.pincode})
                <br><a href="#" onclick="window.openAddressSelectionModal(); return false;" class="text-primary small">Change</a>
            `;
        }
        $('#selectAddressModal').modal('hide');
    } catch (e) {
        console.error("Error parsing address", e);
    }
}
