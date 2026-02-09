import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import firebaseConfig from './firebase-config.js';
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // Check URL params for order ID
    // Check URL params for order ID
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId') || urlParams.get('trackid');

    if (orderId) {
        document.getElementById('searchInput').value = orderId;
        trackOrder(orderId);
    }

    document.getElementById('trackBtn').addEventListener('click', () => {
        const input = document.getElementById('searchInput').value.trim();
        if (input) trackOrder(input);
    });
});

async function trackOrder(orderId) {
    const spinner = document.getElementById('loadingSpinner');
    const resultDiv = document.getElementById('trackResult');
    const errorMsg = document.getElementById('errorMsg');

    spinner.style.display = 'block';
    resultDiv.style.display = 'none';
    errorMsg.style.display = 'none';

    try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            displayOrderDetails(orderId, order);
        } else {
            showError("Order not found. Please checks the Order ID.");
        }
    } catch (error) {
        console.error("Error fetching order:", error);
        showError("An error occurred while fetching the order details.");
    } finally {
        spinner.style.display = 'none';
    }
}

function displayOrderDetails(orderId, order) {
    const resultDiv = document.getElementById('trackResult');

    // Header
    document.getElementById('displayOrderId').textContent = orderId;
    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-GB') : 'N/A';
    document.getElementById('orderDate').textContent = `Ordered on: ${date}`;
    document.getElementById('orderTotal').textContent = `Total: ₹${(order.totalAmount || 0).toLocaleString()}`;

    // Payment Badge
    const badge = document.getElementById('paymentBadge');
    badge.className = 'badge'; // reset
    if (order.paymentMethod === 'Prepaid') {
        badge.textContent = 'Prepaid';
        badge.classList.add('badge-success');
    } else {
        badge.textContent = order.paymentMethod || 'COD';
        badge.classList.add('badge-warning');
    }

    // Timeline
    updateTimeline(order.status);

    // Delivered Message
    const delMsgWrapper = document.getElementById('deliveryMsgWrapper');
    if (order.status === 'delivered' && order.deliveredAt) {
        const delDate = new Date(order.deliveredAt.seconds * 1000).toLocaleString('en-GB');
        document.getElementById('deliveredDate').textContent = delDate;
        delMsgWrapper.style.display = 'block';
    } else {
        delMsgWrapper.style.display = 'none';
    }

    // Items
    const itemsList = document.getElementById('itemsList');
    itemsList.innerHTML = '';
    if (order.items) {
        order.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'item-row d-flex align-items-center mb-3 border-bottom pb-3';
            row.innerHTML = `
                <img src="${item.image || 'images/no-image.png'}" style="width:60px; height:60px; object-fit:contain; margin-right:15px; border:1px solid #eee; border-radius:5px;">
                <div>
                    <h6 class="mb-0">${item.name}</h6>
                    <small class="text-muted">Qty: ${item.quantity} x ₹${item.price}</small>
                </div>
                <div class="ml-auto font-weight-bold">
                    ₹${item.quantity * item.price}
                </div>
            `;
            itemsList.appendChild(row);
        });
    }

    // Address
    let addrStr = 'N/A';
    // Fallback: Check 'shippingAddress' OR 'address' (legacy)
    const addr = order.shippingAddress || order.address;

    if (addr) {
        // Ensure fields exist to avoid 'undefined'
        const line1 = addr.line1 || '';
        const line2 = addr.line2 ? `, ${addr.line2}` : '';
        const city = addr.city || '';
        const state = addr.state || '';
        const pin = addr.pincode || '';
        const phone = addr.phone || addr.mobile || order.userMobile || ''; // Try address phone, then order mobile

        // Privacy Masking
        let displayPhone = phone;
        if (displayPhone && displayPhone.length > 5) {
            displayPhone = displayPhone.substring(0, displayPhone.length - 5) + '*****';
        }

        addrStr = `
            <strong>${addr.name || order.userName || ''}</strong><br>
            ${line1}${line2}<br>
            ${city}, ${state} - ${pin}<br>
            ${displayPhone ? 'Ph: ' + displayPhone : ''}
        `;
    } else if (order.userMobile) {
        // If no address object but we have mobile (e.g. pickup/quick order?)
        let displayPhone = order.userMobile;
        if (displayPhone && displayPhone.length > 5) {
            displayPhone = displayPhone.substring(0, displayPhone.length - 5) + '*****';
        }
        addrStr = `Ph: ${displayPhone}`;
    }

    document.getElementById('shippingAddress').innerHTML = addrStr;

    document.getElementById('orderDetails').style.display = 'block';
    resultDiv.style.display = 'block';
}

function updateTimeline(status) {
    // Reset
    document.querySelectorAll('.track .step').forEach(step => step.classList.remove('active'));

    // Status Map (Order of progression)
    const stages = ['placed', 'accepted', 'process', 'transit', 'delivered'];

    // Normalizing status
    let currentStage = status || 'placed';
    if (currentStage === 'in process') currentStage = 'process';
    if (currentStage === 'out-for-delivery') currentStage = 'transit'; // Treat out for delivery as part of transit or separate? 
    // UI has: Placed -> Accepted -> In Process -> In Transit -> Delivered
    // 'out-for-delivery' is usually after transit, before delivered. 
    // Let's map 'out-for-delivery' to light up 'transit' as well, or maybe all up to transit.

    let activeIndex = -1;

    if (currentStage === 'cancelled') {
        // Handle cancelled state? Maybe show everything red or just placed?
        // For now, let's just highlight placed and show error in UI?
        // Or simpler: just match exactly
        activeIndex = 0; // At least placed
    } else {
        activeIndex = stages.indexOf(currentStage);
        if (currentStage === 'out-for-delivery') activeIndex = 3; // Transit
    }

    if (activeIndex === -1 && currentStage === 'pending') activeIndex = 0;

    // specific override for out-for-delivery to maybe ensure transit is active?
    // actually, let's just loop and set active

    for (let i = 0; i <= activeIndex; i++) {
        const stageId = `step-${stages[i]}`;
        const el = document.getElementById(stageId);
        if (el) el.classList.add('active');
    }

    // Special case for 'out-for-delivery' - maybe text update?
    if (status === 'out-for-delivery') {
        const transitStep = document.getElementById('step-transit');
        if (transitStep) {
            transitStep.querySelector('.text').textContent = 'Out for Delivery';
        }
    }
}

function showError(msg) {
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}
