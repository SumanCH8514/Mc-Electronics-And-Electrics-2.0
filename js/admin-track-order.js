import { initAdminAuth, db } from './admin-auth.js';
import { collection, query, orderBy, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Init Auth
initAdminAuth(null);

// Expose functionality to global scope for HTML button
window.searchOrder = searchOrder;

// Listen for Enter key
document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchOrder();
    }
});

async function searchOrder() {
    const input = document.getElementById('searchInput').value.trim();
    const resultContainer = document.getElementById('resultContainer');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorMsg = document.getElementById('errorMsg');

    if (!input) {
        alert("Please enter an Order ID or Invoice Number");
        return;
    }

    // Reset UI
    resultContainer.style.display = 'none';
    errorState.style.display = 'none';
    loadingState.style.display = 'block';

    try {
        let matchedOrder = null;

        // Strategy:
        // 1. Try direct fetch (assuming input is full ID)
        // 2. If not found, fetch all recent orders and scan for ID match or substring match

        // Attempt 1: Direct Fetch
        const docRef = doc(db, 'orders', input);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            matchedOrder = { id: docSnap.id, ...docSnap.data() };
        } else {
            // Attempt 2: Fetch all/recent and search
            // We fetch reasonable amount of recent orders to search
            const ordersRef = collection(db, 'orders');
            // Fetch last 500 orders? Or all? client-side string matching is safer for 'Invoice Number' logic if not indexed
            const q = query(ordersRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            // Search in snapshot
            for (const doc of querySnapshot.docs) {
                const id = doc.id;
                // Check for exact match (if case differs) or substring start (Invoice No)
                if (id === input || id.toLowerCase() === input.toLowerCase() || id.startsWith(input)) {
                    matchedOrder = { id: doc.id, ...doc.data() };
                    break;
                }
            }
        }

        if (matchedOrder) {
            await renderOrder(matchedOrder);
            loadingState.style.display = 'none';
            resultContainer.style.display = 'block';
        } else {
            throw new Error("Order not found with that ID or Invoice Number.");
        }

    } catch (e) {
        console.error("Search error:", e);
        loadingState.style.display = 'none';
        errorMsg.innerText = e.message;
        errorState.style.display = 'block';
    }
}

async function renderOrder(order) {
    // Fill Meta
    document.getElementById('dispOrderId').innerText = order.id;
    document.getElementById('dispInvoice').innerText = order.id.substring(0, 12).toUpperCase();
    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-GB') : 'N/A';
    document.getElementById('dispDate').innerText = date;

    let deliveredDate = 'Pending';
    if (order.status && order.status.toLowerCase() === 'delivered') {
        if (order.deliveredAt) {
            deliveredDate = new Date(order.deliveredAt.seconds * 1000).toLocaleString('en-GB');
        } else if (order.updatedAt) {
            deliveredDate = new Date(order.updatedAt.seconds * 1000).toLocaleString('en-GB') + ' (Est.)';
        } else {
            deliveredDate = 'Delivered (Date N/A)';
        }
    } else if (order.status && order.status.toLowerCase() !== 'delivered') {
        deliveredDate = '-';
    }
    document.getElementById('dispDeliveredDate').innerText = deliveredDate;

    // Customer
    document.getElementById('dispCustomerName').innerText = order.userName || 'Guest';
    document.getElementById('dispEmail').innerText = order.userEmail || 'N/A';

    let mobile = 'N/A';

    // 1. Try Order Shipping Address (if it has phone)
    if (order.shippingAddress) {
        const a = order.shippingAddress;
        if (typeof a === 'object') {
            if (a.phone) mobile = a.phone;
            else if (a.mobile) mobile = a.mobile;
        }
    }

    // 2. Fallback: Try User Profile Phone if missing
    if ((!mobile || mobile === 'N/A') && order.userId) {
        try {
            const userRef = doc(db, 'users', order.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.phone) mobile = userData.phone;
                else if (userData.mobile) mobile = userData.mobile;
                else if (userData.phoneNumber) mobile = userData.phoneNumber;
            }
        } catch (err) {
            console.warn("Could not fetch user profile phone:", err);
        }
    }

    document.getElementById('dispMobile').innerText = mobile;

    // Timeline and Status
    const status = (order.status || 'pending').toLowerCase();
    document.getElementById('currentStatusBadge').innerText = status.toUpperCase();
    document.getElementById('currentStatusBadge').className = `badge p-2 badge-${getStatusBadgeColor(status)}`

    updateTimeline(status);

    // Items
    const itemsContainer = document.getElementById('itemsContainer');
    let itemsHtml = '';
    if (order.items) {
        order.items.forEach(item => {
            itemsHtml += `
                <div class="item-row">
                    <img src="${item.image || '../images/no-image.png'}" class="item-img">
                    <div style="flex-grow:1;">
                        <h6 class="m-0">${item.name}</h6>
                        <small class="text-muted">Qty: ${item.quantity} | Unit: ₹${item.price}</small>
                    </div>
                    <div class="font-weight-bold">₹${item.quantity * item.price}</div>
                </div>
            `;
        });
    }
    itemsContainer.innerHTML = itemsHtml;

    // Total
    document.getElementById('dispTotal').innerText = '₹' + (order.totalAmount || 0).toLocaleString();

    // Payment Method Fallback
    let pMethod = order.paymentMethod;
    if (!pMethod && order.originalOrderPath) {
        try {
            // "users/uid/orders/orderId"
            // We need to parse this or just use doc(db, path) ?
            // Firestore doc() function usually takes (db, pathString).
            // Let's verify if order.originalOrderPath is a string like "users/..."

            // However, we need to be careful about permissions if we are admin. 
            // Admin can read everything, so it should be fine.
            const deepRef = doc(db, order.originalOrderPath);
            const deepSnap = await getDoc(deepRef);
            if (deepSnap.exists()) {
                const deepData = deepSnap.data();
                if (deepData.paymentMethod) {
                    pMethod = deepData.paymentMethod;
                    // Update the order object in memory in case we need it later?
                    order.paymentMethod = pMethod;
                }
            }
        } catch (e) {
            console.warn("Deep fetch for payment details failed:", e);
        }
    }

    document.getElementById('dispPayment').innerText = (pMethod || 'N/A').toUpperCase();
}

function getStatusBadgeColor(status) {
    if (status === 'delivered') return 'success';
    if (status === 'cancelled') return 'danger';
    if (status === 'pending') return 'warning';
    return 'info';
}

function updateTimeline(status) {
    // Reset
    const steps = ['Accepted', 'Process', 'Transit', 'Out', 'Delivered']; // IDs: stepAccepted, stepProcess, etc.
    // Map status to index
    // 0: Pending (only first active)

    let activeLevel = 0;
    if (status === 'accepted') activeLevel = 1;
    if (status.includes('process')) activeLevel = 2;
    if (status === 'transit') activeLevel = 3;
    if (status.includes('out')) activeLevel = 4;
    if (status === 'delivered' || status === 'completed') activeLevel = 5;

    // Cancelled?
    if (status === 'cancelled') {
        // Maybe turn all red or just show status badge. Timeline might be confusing.
        // For now, let's just leave pending active or reset all.
        activeLevel = -1;
    }

    // Apply classes
    const ids = ['stepAccepted', 'stepProcess', 'stepTransit', 'stepOut', 'stepDelivered'];

    ids.forEach((id, index) => {
        const el = document.getElementById(id);
        if ((index + 1) <= activeLevel) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}
