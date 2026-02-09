import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, doc, updateDoc, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const ordersContainer = document.getElementById('ordersContainer');
const logoutLink = document.getElementById('logoutLink');

// Auth Check & Fetch Orders
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await fetchOrders(user.uid);
    } else {
        // Redirect to login if not authenticated
        window.location.href = "../auth/login.html";
    }
});

async function fetchOrders(uid) {
    try {
        const ordersRef = collection(db, 'users', uid, 'orders');
        // Order by createdAt desc
        const q = query(ordersRef, orderBy('createdAt', 'desc'));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            ordersContainer.innerHTML = `
                <div class="no-orders">
                    <i class="fa fa-shopping-bag fa-3x mb-3"></i>
                    <h4>No orders yet</h4>
                    <p>Looks like you haven't placed any orders yet.</p>
                    <a href="../catalogue.html" class="btn btn-primary mt-3" style="background-color: #00204a;">Start Shopping</a>
                </div>
            `;
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const order = doc.data();
            const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-GB') : 'N/A';
            const status = order.status || 'pending';
            const normalizedStatus = status.toLowerCase();

            let statusText = status;
            let statusClassSuffix = normalizedStatus.replace(/\s+/g, '-');

            if (normalizedStatus === 'processing' || normalizedStatus === 'process') {
                statusText = 'In Process';
                statusClassSuffix = 'in-process'; // Ensures matches CSS .status-in-process
            } else if (normalizedStatus === 'accepted') {
                statusText = 'Accepted';
                statusClassSuffix = 'accepted';
            } else if (normalizedStatus === 'delivered') {
                statusText = '<i class="fa fa-check"></i><i class="fa fa-check"></i> Delivered';
                statusClassSuffix = 'delivered';
            } else if (normalizedStatus === 'transit') {
                statusText = '<i class="fa fa-truck"></i> In Transit';
                statusClassSuffix = 'transit'; // Matches CSS .status-transit (need to ensure user CSS has this?) 
                // Wait, user side might not have .status-transit defined in orders.html? 
                // User side uses bootstrap/custom classes. 
                // Let's check accounts/orders.html CSS. 
                // orders.js uses `status-${statusClassSuffix}`
                // If I add it here, I assume CSS exists or I need to add it to accounts/orders.html too.
            } else if (normalizedStatus === 'out-for-delivery' || normalizedStatus === 'out for delivery') {
                statusText = '<i class="fa fa-motorcycle"></i> Out for Delivery';
                statusClassSuffix = 'out-for-delivery';
            } else {
                // Capitalize first letter for others
                statusText = status.charAt(0).toUpperCase() + status.slice(1);
            }

            const statusClass = `status-${statusClassSuffix}`;

            // Generate items HTML
            let itemsHtml = '';
            order.items.forEach(item => {
                itemsHtml += `
                    <div class="order-item">
                        <img src="${item.image || '../images/no-image.png'}" class="item-img" alt="${item.name}">
                        <div class="item-details">
                            <div class="item-name">
                                ${item.productId ? `<a href="../product-details.html?id=${item.productId}" target="_blank" style="color: inherit; text-decoration: none;" onmouseover="this.style.color='#00bbf0'" onmouseout="this.style.color='inherit'">${item.name}</a>` : item.name}
                            </div>
                            <div class="item-meta">Qty: ${item.quantity} x ₹${item.price.toLocaleString()}</div>
                        </div>
                        <div class="item-total" style="font-weight:bold;">₹${(item.price * item.quantity).toLocaleString()}</div>
                    </div>
                `;
            });

            let actionBtnHtml = '';

            // Logic for Buttons
            // 1. If Pending or COD -> Check Payment Proof
            if (normalizedStatus === 'pending' || (normalizedStatus === 'processing' && order.paymentMethod === 'COD')) {

                // If COD => Show "Pay Online" (unless proof uploaded)
                if (order.paymentMethod === 'COD' && !order.paymentProof) {
                    actionBtnHtml = `
                        <div class="mr-3">
                             <button class="btn btn-sm btn-outline-primary" onclick="window.payOnline('${doc.id}', ${order.totalAmount})" style="border-radius: 4px;">
                                <i class="fa fa-qrcode mr-1"></i> Pay Online
                             </button>
                        </div>
                     `;
                }
                // If Prepaid (or COD converted) => Show "Upload Payment" ONLY if no proof
                else if (!order.paymentProof) {
                    actionBtnHtml = `
                        <div class="mr-3">
                             <button class="btn btn-sm btn-outline-danger" onclick="window.openUploadModal('${doc.id}')" style="border-radius: 4px;">
                                <i class="fa fa-upload mr-1"></i> Upload Payment
                             </button>
                        </div>
                     `;
                } else {
                    // Proof Exists
                    actionBtnHtml = `
                        <div class="mr-3 text-success font-weight-bold">
                             <small><i class="fa fa-check-circle"></i> Payment Proof Uploaded</small>
                        </div>
                     `;
                }
            } else if (normalizedStatus === 'delivered') {
                actionBtnHtml = `
                    <div class="mr-3">
                         <button class="btn btn-sm btn-outline-success" onclick="window.downloadInvoice('${doc.id}')" style="border-radius: 4px;">
                            <i class="fa fa-download mr-1"></i> Download Invoice
                         </button>
                    </div>
                 `;
            }

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <div class="order-meta">
                            <strong>Order ID:</strong> ${doc.id}<br>
                            <strong>Date:</strong> ${date}
                        </div>
                        <div class="order-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                    <div class="order-body">
                        ${itemsHtml}
                    </div>
                    <div class="order-footer d-flex justify-content-end align-items-center">
                        ${actionBtnHtml}
                        <div class="order-total">
                            Total Amount: ₹${order.totalAmount.toLocaleString()}
                        </div>
                    </div>
                </div>
            `;
        });

        ordersContainer.innerHTML = html;

    } catch (error) {
        console.error("Error fetching orders:", error);
        ordersContainer.innerHTML = `
            <div class="alert alert-danger">
                Error fetchings orders: ${error.message}
            </div>
        `;
    }
}

// Logout Handler
if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = "../auth/login.html";
    });
}

// Upload Modal Logic
window.openUploadModal = function (orderId) {
    document.getElementById('uploadOrderId').value = orderId;
    document.getElementById('paymentFile').value = ''; // Reset file input
    $('#paymentUploadModal').modal('show');
}

window.uploadPaymentProof = async function () {
    const orderId = document.getElementById('uploadOrderId').value;
    const fileInput = document.getElementById('paymentFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file to upload.");
        return;
    }

    // Client-side size check (initial)
    if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Please select an image under 5MB.");
        return;
    }

    const btn = document.querySelector('#paymentUploadModal .btn-primary');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Processing...';

    try {
        // Convert to Base64 with compression via Canvas
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Max dimension 800px to ensure < 1MB
                    const MAX_SIZE = 800;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG 0.7 quality
                    // This typically yields 50-150KB for 800px images
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(new Error("Image load failed"));
                img.src = readerEvent.target.result;
            };
            reader.onerror = (err) => reject(new Error("File read failed"));
            reader.readAsDataURL(file);
        });

        // Update Order
        const orderRef = doc(db, 'users', auth.currentUser.uid, 'orders', orderId);
        await updateDoc(orderRef, {
            paymentProof: base64String,
            paymentStatus: 'Proof Uploaded'
        });

        // Also update root order
        const rootOrderRef = doc(db, 'orders', orderId);
        await updateDoc(rootOrderRef, {
            paymentProof: base64String,
            paymentStatus: 'Proof Uploaded'
        });

        $('#paymentUploadModal').modal('hide');
        alert("Payment proof uploaded successfully!");
        window.location.reload();

    } catch (e) {
        console.error("Upload failed:", e);
        alert("Processing failed: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }

}

// Pay Online Logic (For COD or retry)
window.payOnline = function (orderId, amount) {
    document.getElementById('qrPayAmount').innerText = 'Total: ₹' + amount.toLocaleString();

    // Generate QR
    const upiId = '8514900224@upi';
    const name = 'SUMAN CHAKRABORTTY';
    const note = 'Payment for Order #' + orderId.substring(0, 6);
    // Fixed numeric amount for UPI (2 decimal places)
    const amountFixed = parseFloat(amount).toFixed(2);

    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amountFixed}&cu=INR&tn=${encodeURIComponent(note)}`;
    const qrData = encodeURIComponent(upiUri);

    document.getElementById('qrCodeImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
    document.getElementById('payExampleUpiBtn').href = upiUri;

    $('#qrPaymentModal').modal('show');

    // Reset Checkbox
    document.getElementById('paymentMadeCheckbox').checked = false;
    document.getElementById('confirmPaymentBtn').disabled = true;

    // Store current order id for confirmation
    window.activeQrOrderId = orderId;
}

// Enable/Disable Confirm Button based on Checkbox
$(document).on('change', '#paymentMadeCheckbox', function () {
    document.getElementById('confirmPaymentBtn').disabled = !this.checked;
});

window.confirmOnlinePayment = function () {
    const orderId = window.activeQrOrderId;
    if (!orderId) return;

    $('#qrPaymentModal').modal('hide');

    // Find the button and swap it to Upload Payment
    // We search for the button that calls payOnline for this order
    const buttons = document.getElementsByTagName('button');
    for (let btn of buttons) {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`window.payOnline('${orderId}'`)) {
            // Found it. Replace styles and behavior.
            btn.className = 'btn btn-sm btn-outline-danger';
            btn.innerHTML = '<i class="fa fa-upload mr-1"></i> Upload Payment';
            btn.setAttribute('onclick', `window.openUploadModal('${orderId}')`);
            break;
        }
    }

    // Open the upload modal immediately
    setTimeout(() => {
        window.openUploadModal(orderId);
    }, 500);
}

// Download Invoice Function
window.downloadInvoice = async function (orderId) {
    // Show loading indicator
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'invoice-loading';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px 50px; border-radius: 10px; z-index: 10000; font-size: 16px; text-align: center;';
    loadingMsg.innerHTML = '<i class="fa fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>Generating invoice...<br><small>Please wait</small>';
    document.body.appendChild(loadingMsg);

    try {
        // Fetch order details
        const orderRef = doc(db, 'users', auth.currentUser.uid, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            document.body.removeChild(loadingMsg);
            alert("Order not found!");
            return;
        }


        const order = orderSnap.data();
        const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-GB') : 'N/A';

        // Fetch user profile data for billing address
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        // Format billing address from user profile
        let billToAddress = 'N/A';
        let billToMobile = '';

        // Check if address is a string (e.g., "Karakberia,Kotulpur,Bankura,WB,INDIA")
        if (typeof userData.address === 'string' && userData.address.trim()) {
            billToAddress = userData.address;
            billToMobile = userData.phone || '';
        }
        // Check if address is an object with structured fields
        else if (userData.address && typeof userData.address === 'object') {
            billToAddress = `${userData.address.line1 || ''}<br>${userData.address.city || ''}, ${userData.address.state || ''} ${userData.address.pincode || ''}`;
            billToMobile = userData.address.phone || userData.phone || '';
        }
        // Fallback to just phone if available
        else if (userData.phone) {
            billToMobile = userData.phone;
        }


        // Format shipping address
        let shipToName = 'N/A';
        let shipToAddress = 'N/A';
        let shipToMobile = 'N/A';
        let shipToEmail = order.userEmail || 'N/A';

        // If shipping address exists in order, use it
        if (order.shippingAddress) {
            const addr = order.shippingAddress;
            shipToName = addr.name || order.userName || 'N/A';

            // Build address string from available fields
            let addrParts = [];
            if (addr.line1) addrParts.push(addr.line1);
            if (addr.line2) addrParts.push(addr.line2);
            if (addr.city) addrParts.push(addr.city);
            if (addr.state) addrParts.push(addr.state);
            if (addr.pincode) addrParts.push(addr.pincode);

            shipToAddress = addrParts.length > 0 ? addrParts.join(', ') : 'N/A';
            shipToMobile = addr.phone || addr.mobile || 'N/A';
        }
        // Fallback: If no shipping address in order, try to fetch user's first address
        else {
            try {
                const addressesRef = collection(db, 'users', auth.currentUser.uid, 'addresses');
                const addressQuery = query(addressesRef, orderBy('createdAt', 'desc'), limit(1));
                const addressSnap = await getDocs(addressQuery);

                if (!addressSnap.empty) {
                    const addr = addressSnap.docs[0].data();
                    shipToName = addr.name || order.userName || 'N/A';

                    let addrParts = [];
                    if (addr.line1) addrParts.push(addr.line1);
                    if (addr.line2) addrParts.push(addr.line2);
                    if (addr.city) addrParts.push(addr.city);
                    if (addr.state) addrParts.push(addr.state);
                    if (addr.pincode) addrParts.push(addr.pincode);

                    shipToAddress = addrParts.length > 0 ? addrParts.join(', ') : 'N/A';
                    shipToMobile = addr.phone || 'N/A';
                }
            } catch (err) {
                console.error('Error fetching fallback address:', err);
            }
        }

        // Create invoice HTML matching the template
        let invoiceHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Invoice - ${orderId}</title>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 40px;
                        max-width: 800px;
                        margin: 0 auto;
                        background: #fff;
                    }
                    .invoice-container {
                        border: 2px solid #1e3a5f;
                        padding: 0;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 30px;
                        border-bottom: 2px solid #e0e0e0;
                    }
                    .company-info {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    .company-logo {
                        width: 60px;
                        height: 60px;
                    }
                    .company-name {
                        font-size: 18px;
                        font-weight: bold;
                        color: #1e3a5f;
                    }
                    .invoice-title {
                        background: #f5a623;
                        color: #1e3a5f;
                        padding: 20px 40px;
                        font-size: 32px;
                        font-weight: bold;
                    }
                    .invoice-details {
                        padding: 30px;
                    }
                    .invoice-meta {
                        margin-bottom: 30px;
                    }
                    .invoice-meta p {
                        margin: 5px 0;
                        font-size: 14px;
                    }
                    .invoice-meta strong {
                        color: #1e3a5f;
                        font-weight: bold;
                    }
                    .billing-shipping {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .bill-to, .ship-to {
                        flex: 1;
                    }
                    .section-title {
                        font-weight: bold;
                        color: #1e3a5f;
                        margin-bottom: 10px;
                        font-size: 14px;
                    }
                    .section-content {
                        font-size: 13px;
                        line-height: 1.6;
                        color: #333;
                    }
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .items-table thead {
                        background: #1e3a5f;
                        color: white;
                    }
                    .items-table th {
                        padding: 12px;
                        text-align: left;
                        font-weight: bold;
                        font-size: 13px;
                    }
                    .items-table td {
                        padding: 12px;
                        border-bottom: 1px solid #e0e0e0;
                        font-size: 13px;
                    }
                    .items-table tbody tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .totals {
                        text-align: right;
                        margin-top: 20px;
                    }
                    .total-row {
                        font-size: 16px;
                        font-weight: bold;
                        color: #1e3a5f;
                        margin-top: 10px;
                        padding-top: 10px;
                        border-top: 2px dotted #ccc;
                    }
                    .payment-info {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 2px dotted #ccc;
                    }
                    .payment-method, .additional-notes {
                        flex: 1;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #e0e0e0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .thank-you {
                        font-style: italic;
                        color: #666;
                        font-size: 13px;
                    }
                    .contact-info {
                        text-align: right;
                        font-size: 12px;
                        color: #666;
                    }
                    @media print {
                        body { padding: 0; }
                        .invoice-container { border: none; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="header">
                        <div class="company-info">
                            <img src="../images/favcon.jpeg" alt="Logo" class="company-logo">
                            <div class="company-name">Mc Electronics And Electrics
                            <br>
                            <p style="font-size: 12px;" class="fa fa-map-marker"> Karakberia | Kotulpur | Bankura | WB</p><br>
                            <p style="font-size: 12px;" class="fa fa-phone"> +918926171789</p>
                            
                            
                            </div>
                        </div>
                        <div class="invoice-title">Invoice</div>
                    </div>
                    
                    <div class="invoice-details">
                        <div class="invoice-meta">
                            <p><strong>Invoice Number</strong></p>
                            <p>#${orderId.substring(0, 12).toUpperCase()}</p>
                            <p style="margin-top: 10px;"><strong>Date</strong></p>
                            <p>${date}</p>
                        </div>
                        
                        <div class="billing-shipping">
                            <div class="bill-to">
                                <div class="section-title">Bill To</div>
                                <div class="section-content">
                                    <i class="fa fa-user" style="width: 16px; margin-right: 8px; color: #666;"></i>${order.userName || 'N/A'}<br>
                                    <i class="fa fa-map-marker" style="width: 16px; margin-right: 8px; color: #666;"></i>${billToAddress}<br>
                                    <i class="fa fa-envelope" style="width: 16px; margin-right: 8px; color: #666;"></i>${order.userEmail || ''}<br>
                                    <i class="fa fa-phone" style="width: 16px; margin-right: 8px; color: #666;"></i>${billToMobile}
                                </div>
                            </div>
                            <div class="ship-to">
                                <div class="section-title">Ship To</div>
                                <div class="section-content">
                                    <i class="fa fa-user" style="width: 16px; margin-right: 8px; color: #666;"></i><strong>Name:</strong> ${shipToName}<br>
                                    <i class="fa fa-envelope" style="width: 16px; margin-right: 8px; color: #666;"></i><strong>Email:</strong> ${shipToEmail}<br>
                                    <i class="fa fa-map-marker" style="width: 16px; margin-right: 8px; color: #666;"></i><strong>Delivery Address:</strong> ${shipToAddress}<br>
                                    <i class="fa fa-phone" style="width: 16px; margin-right: 8px; color: #666;"></i><strong>Mobile Number:</strong> ${shipToMobile}
                                </div>
                            </div>
                        </div>
                        
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th style="text-align: center;">MRP</th>
                                    <th style="text-align: center;">Quantity</th>
                                    <th style="text-align: right;">Discount</th>
                                    <th style="text-align: right;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
        `;


        // Add items - Fetch MRP from products database
        if (order.items && order.items.length > 0) {
            for (const item of order.items) {
                let mrp = item.price; // Default to price if MRP not found
                let discount = 0;

                // Try to fetch MRP from products collection
                try {
                    if (item.productId) {
                        const productRef = doc(db, 'products', item.productId);
                        const productSnap = await getDoc(productRef);
                        if (productSnap.exists()) {
                            const productData = productSnap.data();
                            mrp = productData.mrp || productData.price || item.price;
                        }
                    }
                } catch (err) {
                    console.error('Error fetching product MRP:', err);
                }

                // Calculate discount
                discount = mrp > item.price ? ((mrp - item.price) * item.quantity) : 0;

                invoiceHTML += `
                    <tr>
                        <td>${item.name}</td>
                        <td style="text-align: center;">₹${mrp.toLocaleString('en-IN')}</td>
                        <td style="text-align: center;">${item.quantity}</td>
                        <td style="text-align: right;">${discount > 0 ? '₹' + discount.toLocaleString('en-IN') : '-'}</td>
                        <td style="text-align: right;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
                    </tr>
                `;
            }
        }

        invoiceHTML += `
                            </tbody>
                        </table>
                        
                        <div class="totals">
                            <div class="total-row">
                                Total: ₹${order.totalAmount.toLocaleString('en-IN')}
                            </div>
                        </div>
                        
                        <div class="payment-info">
                            <div class="payment-method">
                                <div class="section-title">Payment Method</div>
                                <div class="section-content">${order.paymentMethod === 'prepaid' ? 'Prepaid' : order.paymentMethod === 'cod' ? 'Cash On Delivery (COD)' : 'Cash On Delivery (COD)'}</div>
                                <div class="section-title" style="margin-top: 15px;">Date</div>
                                <div class="section-content">${date}</div>
                            </div>
                            <div class="additional-notes">
                                <div class="section-title">Additional Notes</div>
                                <div class="section-content">Thank you for your purchase!</div>
                                <div class="section-content" style="text-decoration:none;">Read our <a href="../pages/return.html">Return Policy</a></div>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <div class="thank-you">
                                Thank you for your business!<br>
                                Please transfer the payment to the above account.
                            </div>
                            <div class="contact-info">
                                Mc Electronics And Electrics<br>
                                electronics.mcaudio@gmail.com<br>
                                Call: 8926171789 / 6294128631
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Remove loading indicator
        document.body.removeChild(loadingMsg);

        // Open in new window for printing/saving
        const printWindow = window.open('', '_blank');
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
        printWindow.focus();

        // Trigger print dialog
        setTimeout(() => {
            printWindow.print();
        }, 250);

    } catch (error) {
        // Remove loading indicator on error
        const loadingElement = document.getElementById('invoice-loading');
        if (loadingElement) {
            document.body.removeChild(loadingElement);
        }
        console.error("Error generating invoice:", error);
        alert("Failed to generate invoice: " + error.message);
    }
}
