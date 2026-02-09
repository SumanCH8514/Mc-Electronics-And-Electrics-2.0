import { initAdminAuth, db } from './admin-auth.js';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let allOrders = []; // Store locally for filtering

initAdminAuth(async (user) => {
    loadOrders();
    setupEventListeners();
});

async function loadOrders() {
    const tableBody = document.getElementById('ordersTableBody');
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading orders...</td></tr>';

    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        allOrders = [];
        snapshot.forEach(doc => {
            allOrders.push({ id: doc.id, ...doc.data() });
        });

        renderOrders(allOrders);

    } catch (e) {
        console.error("Error loading orders:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${e.message}</td></tr>`;
    }
}

function renderOrders(orders) {
    const tableBody = document.getElementById('ordersTableBody');
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found.</td></tr>';
        return;
    }

    let html = '';
    orders.forEach(order => {
        const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-GB') : 'N/A';

        // Status Formatting
        const status = order.status || 'pending';
        let badgeClass = 'badge-secondary';
        if (status === 'pending') badgeClass = 'badge-pending';
        else if (status === 'accepted') badgeClass = 'badge-accepted';
        else if (status === 'process' || status === 'in process') badgeClass = 'badge-process';
        else if (status === 'transit') badgeClass = 'badge-transit';
        else if (status === 'out-for-delivery') badgeClass = 'badge-out-delivery';
        else if (status === 'delivered') badgeClass = 'badge-delivered';
        else if (status === 'cancelled') badgeClass = 'badge-cancelled';

        let displayStatus = status;
        if (status === 'process' || status === 'in process') displayStatus = 'In Process';
        else if (status === 'transit') displayStatus = 'In Transit';
        else if (status === 'out-for-delivery') displayStatus = 'Out for Delivery';
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

        // Product Summary
        let productSummary = order.items && order.items.length > 0 ? order.items[0].name : 'N/A';
        if (order.items && order.items.length > 1) {
            productSummary += ` + ${order.items.length - 1} others`;
        }
        if (productSummary.length > 30) productSummary = productSummary.substring(0, 30) + '...';

        html += `
            <tr>
                <td><small>#${order.id.slice(0, 8)}</small></td>
                <td>
                    <div class="font-weight-bold">${order.userName || 'Guest'}</div>
                    <small class="text-muted">${order.userEmail || ''}</small>
                </td>
                <td>${productSummary}</td>
                <td>₹${(order.totalAmount || 0).toLocaleString()}</td>
                <td><span class="badge ${badgeClass} p-2">${displayStatus}</span></td>
                <td><small>${date}</small></td>
                <td>
                    <button class="btn btn-sm btn-primary view-btn" data-id="${order.id}">
                        <i class="fa fa-eye"></i> <span class="d-none d-md-inline">View / Edit</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Attach Click Events
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orderId = e.target.closest('.view-btn').dataset.id;
            openOrderModal(orderId);
        });
    });
}

// Filters
function setupEventListeners() {
    const filters = document.getElementById('orderFilters');

    // Desktop Filters
    if (filters) {
        filters.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn')) {
                applyFilter(e.target.dataset.filter);

                // UI Update
                filters.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    // Mobile Filters
    const mobileMenu = document.getElementById('mobileFilterMenu');
    if (mobileMenu) {
        mobileMenu.addEventListener('click', (e) => {
            e.preventDefault();
            const item = e.target.closest('.dropdown-item');
            if (item) {
                const filter = item.dataset.filter;
                applyFilter(filter);

                // UI Update
                mobileMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Update Button Text
                const btn = document.getElementById('mobileFilterBtn');
                if (btn) btn.innerHTML = `<i class="fa fa-filter mr-2"></i> Filter: ${filter === 'process' ? 'In Process' : filter.charAt(0).toUpperCase() + filter.slice(1)}`;
            }
        });
    }

    function applyFilter(filter) {
        if (filter === 'all') {
            renderOrders(allOrders);
        } else {
            const filtered = allOrders.filter(o => {
                const s = (o.status || 'pending').toLowerCase();
                if (filter === 'process') return s.includes('process');
                return s === filter;
            });
            renderOrders(filtered);
        }
    }

    document.getElementById('updateStatusBtn').addEventListener('click', updateOrderStatus);

    // Print Label Listener
    const printBtn = document.getElementById('printLabelBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (currentOrderId) {
                window.printShippingLabel(currentOrderId);
            } else {
                console.error("No order selected for printing");
            }
        });
    }
}

// Global Print Label Function
window.printShippingLabel = function (orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    // Address Logic
    let name = order.userName || 'N/A';
    let address = 'N/A';
    let cityStateZip = '';
    let country = 'India'; // Default or from data
    let mobile = 'N/A';

    if (order.shippingAddress) {
        const a = order.shippingAddress;
        name = a.name || name;
        address = a.line1 || '';
        if (a.line2) address += '<br>' + a.line2;
        cityStateZip = `${a.city || ''}, ${a.state || ''} ${a.pincode || ''}`;
        mobile = a.phone || a.mobile || mobile;
    } else if (order.userMobile) {
        mobile = order.userMobile; // Fallback
    }

    // Sender Address (Hardcoded for now as per request/context)
    const sender = {
        name: 'Mc Electronics',
        address: 'Karakberia, Kotulpur',
        cityStateZip: 'Bankura, WB 722141',
        country: 'India'
    };

    // Payment Logic
    let paymentText = 'PREPAID';
    let collectText = '';

    // Check payment method (case-insensitive)
    const pm = (order.paymentMethod || '').toUpperCase();
    if (pm === 'COD' || pm === 'CASH ON DELIVERY') {
        paymentText = 'COD';
        collectText = `Collect: ₹${(order.totalAmount || 0).toLocaleString()}`;
    }

    const labelHtml = `
    <!DOCTYPE html>
    <html>
                padding: 2px 5px;
                font-weight: bold;
                font-size: 10px;
                display: inline-block;
                margin-bottom: 5px;
            }
            .barcodes {
                padding: 10px;
                border-bottom: 2px solid #000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                flex-grow: 1;
            }
            .footer {
                padding: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-top: 2px solid #000;
            }
            .tracking-number {
                font-weight: bold;
                font-size: 14px;
            }
            .scan-box {
                background: #000;
                color: #fff;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-weight: bold;
                font-size: 20px;
            }
            .payment-info {
                text-align: center;
                font-weight: bold;
                font-size: 20px;
                margin-bottom: 15px;
                border: 2px solid #000;
                padding: 5px;
            }
            img { max-width: 100%; }
        </style>
    </head>
    <body>
        <div class="label-container">
            <div class="header">
                <div class="sender">
                    <img src="../images/favcon.jpeg" style="width: 100px; margin-bottom: 10px;" alt="Logo"><br>
                    <strong>${sender.name}</strong><br>
                    ${sender.address}<br>
                    ${sender.cityStateZip}<br>
                    ${sender.country}
                </div>
                <div class="recipient">
                    <div class="ship-to">SHIP TO</div>
                    <strong>${name}</strong>
                    ${address}<br>
                    ${cityStateZip}<br>
                    ${country}<br>
                    <strong>Ph: ${mobile}</strong>
                </div>
            </div>
            
            <div class="barcodes">
                <div class="payment-info">
                    ${paymentText}<br>
                    ${collectText}
                </div>
                <div style="font-weight:bold; font-size:18px; margin-bottom:5px;">${orderId.substring(0, 14).toUpperCase()}</div>
                <!-- Main Tracking Barcode -->
                <img src="http://bwipjs-api.metafloor.com/?bcid=code128&text=${orderId}&scale=3&height=12&incltext" style="height:60px;">
            </div>

            <div class="footer">
                <div>
                    <div style="font-weight:bold; font-size:12px;">SumanOnline Transport Service</div>
                    <div class="tracking-number">Tracking # ${orderId}</div>
                </div>
                <div class="scan-box">1</div>
            </div>
        </div>
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank', 'width=600,height=800');
    printWindow.document.write(labelHtml);
    printWindow.document.close();
}

// Modal Logic
let currentOrderId = null;
let currentUserOrderPath = null; // Important for sync

function openOrderModal(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    currentOrderId = orderId;
    currentUserOrderPath = order.originalOrderPath; // e.g., users/{uid}/orders/{id}

    // Fill Data
    document.getElementById('modalOrderId').innerText = '#' + orderId;

    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'N/A';

    // Prepare Address
    let addrStr = 'N/A';
    let mobile = 'N/A';

    if (order.shippingAddress) {
        const a = order.shippingAddress;
        addrStr = `${a.line1}, ${a.city} (${a.pincode})`;
        if (a.phone) mobile = a.phone;
        else if (a.mobile) mobile = a.mobile;
    }

    const detailsHtml = `
        <strong>Name:</strong> ${order.userName || 'N/A'}<br>
        <strong>Email:</strong> ${order.userEmail || 'N/A'}<br>
        <strong>Delivery Address:</strong> ${addrStr}<br>
        <strong>Mobile Number:</strong> ${mobile}<br>
        <strong>Date:</strong> ${date}<br>
        <strong>User ID:</strong> <small>${order.userId || 'N/A'}</small>
    `;

    document.getElementById('modalCustomerDetailsContent').innerHTML = detailsHtml;

    // Reset Collapses
    $('#customerDetailsCollapse').collapse('hide');

    document.getElementById('modalTotal').innerText = '₹' + (order.totalAmount || 0).toLocaleString();

    // Items
    let itemsHtml = '';
    if (order.items) {
        order.items.forEach(item => {
            itemsHtml += `
                <div class="d-flex align-items-center mb-2 pb-2 border-bottom">
                    <img src="${item.image || '../images/no-image.png'}" style="width:50px; height:50px; object-fit:contain; border:1px solid #ddd; border-radius:4px; margin-right:10px;">
                    <div style="flex-grow:1;">
                        <div class="font-weight-bold">${item.name}</div>
                        <small class="text-muted">Qty: ${item.quantity} x ₹${item.price}</small>
                    </div>
                    <div class="font-weight-bold">₹${item.price * item.quantity}</div>
                </div>
            `;
        });
    }
    document.getElementById('modalItems').innerHTML = itemsHtml;



    // Payment Details Population
    const paymentInfo = document.getElementById('modalPaymentInfo');
    const proofContainer = document.getElementById('paymentProofContainer');
    const proofImg = document.getElementById('paymentProofImg');
    const proofDl = document.getElementById('paymentProofDownload');

    let methodBadge = 'badge-secondary';
    if (order.paymentMethod === 'Prepaid') methodBadge = 'badge-success';
    else if (order.paymentMethod === 'COD') methodBadge = 'badge-primary';

    paymentInfo.innerHTML = `
        <span class="badge ${methodBadge}">${order.paymentMethod || 'Unknown Method'}</span> 
        <span class="ml-2 font-weight-bold">Status: ${order.paymentStatus || 'Pending'}</span>
    `;

    if (order.paymentProof) {
        proofContainer.style.display = 'block'; // Show the "View Payment" button container
        proofImg.src = order.paymentProof;
        proofDl.href = order.paymentProof;
        proofDl.download = `payment_proof_${orderId}.jpg`;

        // Add Verify Actions inside the collapse or container
        // We will append a button group to the proof container
        let verifyHtml = `
             <div class="mt-2 pt-2 border-top">
                <p class="small font-weight-bold mb-1">Verification Action:</p>
                <button class="btn btn-sm btn-success mr-1" onclick="window.verifyPaymentProof('${orderId}', 'accept')">
                    <i class="fa fa-check"></i> Accept
                </button>
                <button class="btn btn-sm btn-danger" onclick="window.verifyPaymentProof('${orderId}', 'reject')">
                    <i class="fa fa-times"></i> Reject
                </button>
             </div>
        `;

        // Attach Print Label Listener inside modal logic
        // We do this here because the modal content is refreshed
        // But wait, the buttons are static in the HTML modal footer?
        // Let's check admin/orders.html again. Yes, they are static in footer.
        // So we just need to attach the listener once or re-attach on open.
        // Since currentOrderId changes, we must re-attach or use a closure.



        // Check if already exist to prevent duplicate appended
        if (!document.getElementById('verifyActionsBlock')) {
            const div = document.createElement('div');
            div.id = 'verifyActionsBlock';
            div.innerHTML = verifyHtml;
            // Append to the Card Body inside Collapse
            document.querySelector('#proofCollapse .card-body').appendChild(div);
        } else {
            document.getElementById('verifyActionsBlock').innerHTML = verifyHtml;
        }

        // Collapse the view by default so button must be clicked
        $('#proofCollapse').collapse('hide');
    } else {
        proofContainer.style.display = 'none';
        proofImg.src = '';
    }

    // Set current Status
    const statusSelect = document.getElementById('modalStatusSelect');
    const currentStatus = (order.status || 'pending').toLowerCase();

    // Handle 'in process' variance
    if (currentStatus.includes('process')) statusSelect.value = 'process';
    else statusSelect.value = currentStatus;

    // Show Modal
    $('#orderModal').modal('show');
}

async function updateOrderStatus() {
    const newStatus = document.getElementById('modalStatusSelect').value;
    const btn = document.getElementById('updateStatusBtn');

    if (!currentOrderId) return;

    if (!confirm(`Are you sure you want to update status to "${newStatus}"?`)) return;

    btn.disabled = true;
    btn.innerText = "Updating...";

    try {
        // 1. Update Root Order
        const rootRef = doc(db, 'orders', currentOrderId);
        await updateDoc(rootRef, { status: newStatus });

        // 2. Update User Order (Dual Sync)
        if (currentUserOrderPath) {
            const userOrderRef = doc(db, currentUserOrderPath);
            await updateDoc(userOrderRef, { status: newStatus });
        } else {
            // Fallback: If we have userId, construct path
            const order = allOrders.find(o => o.id === currentOrderId);
            if (order && order.userId) {
                const userOrderRef = doc(db, 'users', order.userId, 'orders', currentOrderId);
                await updateDoc(userOrderRef, { status: newStatus });
            } else {
                console.warn("Could not sync to user subcollection: Missing userId or path");
            }
        }

        // Update Local State
        const orderIndex = allOrders.findIndex(o => o.id === currentOrderId);
        if (orderIndex !== -1) {
            allOrders[orderIndex].status = newStatus;
        }

        const activeFilter = document.querySelector('.order-filters .btn.active').dataset.filter;
        if (activeFilter === 'all') renderOrders(allOrders);
        else {
            // Re-apply filter
            const filtered = allOrders.filter(o => {
                const s = (o.status || 'pending').toLowerCase();
                if (activeFilter === 'process') return s.includes('process');
                return s === activeFilter;
            });
            renderOrders(filtered);
        }

        $('#orderModal').modal('hide');
        alert("Status Updated Successfully!");

    } catch (e) {
        console.error("Error updating status:", e);
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Status";
    }
}

// Payment Verification Logic
window.verifyPaymentProof = async function (orderId, action) {
    if (!orderId) return;

    const isAccept = action === 'accept';
    const confirmMsg = isAccept ?
        "Are you sure you want to ACCEPT this payment proof? This will mark payment as Verified." :
        "Are you sure you want to REJECT this payment proof? This will delete the proof and allow user to re-upload.";

    if (!confirm(confirmMsg)) return;

    // Find order to get path
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        alert("Order context lost. Please reload.");
        return;
    }

    try {
        const updateData = {};
        if (isAccept) {
            updateData.paymentStatus = 'Verified';
        } else {
            updateData.paymentStatus = 'Rejected - Re-upload Required';
            updateData.paymentProof = deleteField();
        }

        // 1. Update Root
        const rootRef = doc(db, 'orders', orderId);
        await updateDoc(rootRef, updateData);

        // 2. Update User Order
        if (order.originalOrderPath) {
            const userRef = doc(db, order.originalOrderPath);
            await updateDoc(userRef, updateData);
        } else if (order.userId) {
            // Fallback
            const userRef = doc(db, 'users', order.userId, 'orders', orderId);
            await updateDoc(userRef, updateData);
        }

        alert(`Payment proof ${isAccept ? 'Accepted' : 'Rejected'} successfully.`);
        $('#orderModal').modal('hide');
        loadOrders(); // Reload table

    } catch (e) {
        console.error("Verification error:", e);
        alert("Action failed: " + e.message);
    }
}

// Print Label Function
window.printShippingLabel = function (orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    // Sender Details (Fixed)
    const senderName = "Mc Audio Karakberia";
    const senderAddress = "Karakberia, Kotulpur, Bankura, West Bengal - 722141";
    const senderPhone = "+91 8926171789";

    // Recipient Details
    let rName = order.userName || 'N/A';
    let rAddress = 'N/A';
    let rPhone = 'N/A';

    if (order.shippingAddress) {
        const a = order.shippingAddress;
        rName = a.name || rName;
        rAddress = `${a.line1}, ${a.line2 ? a.line2 + ', ' : ''}${a.city}, ${a.state} - ${a.pincode}`;
        rPhone = a.phone || a.mobile || order.userMobile || 'N/A';
    }

    const date = new Date().toLocaleDateString('en-IN');
    const method = order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Prepaid';

    // COD Logic
    let codHtml = '';
    if (order.paymentMethod === 'COD') {
        codHtml = `<div class="value" style="margin-top:5px; color: red;">Collect Amount: ₹${(order.totalAmount || 0).toLocaleString()}</div>`;
    }

    // QR Code URL (Permalink)
    const trackUrl = `${window.location.origin}/track-order.html?trackid=${orderId}`;
    // Link to Order Update/Edit page (or just the ID as requested?) 
    // User said "rMQR Code with order id's middle 6 words" -> Substring
    const mid6 = orderId.length > 6 ? orderId.substring(Math.floor((orderId.length - 6) / 2), Math.floor((orderId.length - 6) / 2) + 6) : orderId;

    // Using simple QR code API
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(trackUrl)}`;
    const updateQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(mid6)}`;

    const html = `
        <html>
        <head>
            <title>Shipping Label - #${orderId}</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; border: 2px solid #000; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                .logo { max-width: 150px; margin-bottom: 5px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                .label { font-weight: bold; font-size: 0.9em; }
                .value { font-size: 1em; }
                .box { border: 1px solid #000; padding: 10px; margin-bottom: 15px; }
                .address { font-size: 0.95em; line-height: 1.4; }
                .footer { text-align: center; font-size: 0.8em; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; }
                .qr-container { display: flex; justify-content: space-around; margin-bottom: 10px; }
                .qr-box { text-align: center; }
                .qr-img { width: 80px; height: 80px; }
                .qr-tag { font-size: 0.8em; font-weight: bold; margin-top: 2px; }
            </style>
        </head>
        <body>
            <div class="header">
                 <img src="../images/logo-mc-electronics.png" class="logo" alt="Mc Electronics"><br>
                 <strong>Shipping Label</strong>
            </div>

            <div class="box">
                <div class="label">FROM:</div>
                <div class="value"><strong>${senderName}</strong></div>
                <div class="address">${senderAddress}</div>
                <div class="value">Ph: ${senderPhone}</div>
            </div>

            <div class="box">
                <div class="label">TO:</div>
                <div class="value"><strong>${rName}</strong></div>
                <div class="address">${rAddress}</div>
                <div class="value">Ph: ${rPhone}</div>
            </div>

            <div class="row">
                <div>
                    <div class="label">Order ID:</div>
                    <div class="value">#${orderId}</div>
                </div>
                <div>
                    <div class="label">Date:</div>
                    <div class="value">${date}</div>
                </div>
            </div>
            
             <div class="qr-container">
                <div class="qr-box">
                    <img src="${qrSrc}" class="qr-img" alt="Scan to Track">
                    <div class="qr-tag">Scan to Track</div>
                </div>
                <div class="qr-box">
                    <img src="${updateQrSrc}" class="qr-img" alt="Scan to Update">
                    <div class="qr-tag">Scan to Update</div>
                </div>
            </div>

            <div class="box" style="text-align: center;">
                <div class="label">Payment Method:</div>
                <div class="value" style="font-size: 1.2em; font-weight: bold;">${method}</div>
                ${codHtml}
            </div>

            <div class="footer">
                Thank you for shopping with Mc Electronics!<br>
                Service: Standard Shipping
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    const win = window.open('', '', 'width=500,height=600');
    win.document.write(html);
    win.document.close();
}

// QR Scanner Variables
let html5QrcodeScanner = null;

// Handle QR Update Button Click
window.handleQrUpdate = function () {
    $('#qrScannerModal').modal('show');

    // Wait for modal to be fully shown before starting scanner (to ensure container has size)
    $('#qrScannerModal').on('shown.bs.modal', function () {
        if (!html5QrcodeScanner) {
            // Use facingMode: "environment" to prefer back camera
            html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", {
                fps: 10,
                qrbox: 250,
                videoConstraints: {
                    facingMode: "environment"
                }
            }, /* verbose= */ false);

            html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        }
    });
}

// Stop Scanner
window.stopQrScanner = function () {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().then(() => {
            html5QrcodeScanner = null;
            $('#qr-reader').empty(); // Clean up if needed
        }).catch(err => console.error("Failed to clear scanner", err));
    }
}

// Check if modal is closed by clicking outside
$('#qrScannerModal').on('hidden.bs.modal', function () {
    stopQrScanner();
});


function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning.
    // console.warn(`Code scan error = ${error}`);
}

async function onScanSuccess(decodedText, decodedResult) {
    // console.log(`Scan result: ${decodedText}`);
    const term = decodedText.trim();

    // Ensure orders are loaded
    if (!allOrders || allOrders.length === 0) {
        alert("Orders not loaded yet. Please wait or refresh.");
        return;
    }

    // Search Order
    const found = allOrders.find(o => {
        if (o.id === term) return true;
        if (o.id.includes(term)) return true;
        if (term.includes(o.id)) return true;
        return false;
    });

    if (found) {
        // Stop Scanner
        if (html5QrcodeScanner) {
            await html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }
        $('#qrScannerModal').modal('hide');

        // Populate Delivery Verification Modal
        // Get customer name from shipping address if available
        let customerName = found.userName || 'Guest';
        if (found.shippingAddress && found.shippingAddress.name) {
            customerName = found.shippingAddress.name;
        }

        const orderId = found.id;
        const paymentMethod = (found.paymentMethod || 'Prepaid').toUpperCase();
        const codAmount = found.totalAmount || 0;

        // Populate Product Images
        const productImagesContainer = document.getElementById('dvProductImages');
        productImagesContainer.innerHTML = '';
        if (found.items && found.items.length > 0) {
            found.items.slice(0, 3).forEach(item => { // Show max 3 images
                const img = document.createElement('img');
                img.src = item.image || '../images/no-image.png';
                img.style.width = '100px';
                img.style.height = '100px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                img.style.border = '2px solid #ddd';
                productImagesContainer.appendChild(img);
            });
        }

        document.getElementById('dvCustomerName').innerText = customerName;
        document.getElementById('dvOrderId').innerText = '#' + orderId;

        const dvPaymentStatus = document.getElementById('dvPaymentStatus');
        const dvCodWrapper = document.getElementById('dvCodAmountWrapper');
        const dvCodAmount = document.getElementById('dvCodAmount');
        const dvCodConfirmWrapper = document.getElementById('dvCodConfirmWrapper');
        const dvCodConfirmCheck = document.getElementById('dvCodConfirmCheck');

        if (paymentMethod === 'COD' || paymentMethod === 'CASH ON DELIVERY') {
            dvPaymentStatus.innerText = "COD";
            dvPaymentStatus.classList.remove('text-success');
            dvPaymentStatus.classList.add('text-warning');

            dvCodWrapper.style.display = 'block';
            dvCodAmount.innerText = '₹' + codAmount.toLocaleString();

            // Show COD confirmation checkbox
            dvCodConfirmWrapper.style.display = 'block';
            dvCodConfirmCheck.checked = false; // Reset checkbox
        } else {
            dvPaymentStatus.innerText = "PREPAID";
            dvPaymentStatus.classList.remove('text-warning');
            dvPaymentStatus.classList.add('text-success');

            dvCodWrapper.style.display = 'none';
            dvCodConfirmWrapper.style.display = 'none';
        }

        // Setup Update Button
        const updateBtn = document.getElementById('dvUpdateBtn');
        updateBtn.onclick = () => handleDeliveryUpdate(orderId);

        // Show Modal
        $('#deliveryVerificationModal').modal('show');

    } else {
        console.warn("No match for:", term);
        // Optional: Toast "No order found"
    }
}

async function handleDeliveryUpdate(orderId) {
    const btn = document.getElementById('dvUpdateBtn');

    // Check if COD confirmation is required and checked
    const dvCodConfirmWrapper = document.getElementById('dvCodConfirmWrapper');
    const dvCodConfirmCheck = document.getElementById('dvCodConfirmCheck');

    if (dvCodConfirmWrapper.style.display !== 'none' && !dvCodConfirmCheck.checked) {
        // Add error class for shake animation and red color
        const checkboxContainer = dvCodConfirmWrapper.querySelector('.custom-control');
        checkboxContainer.classList.add('checkbox-error');

        // Remove the error class after animation completes
        setTimeout(() => {
            checkboxContainer.classList.remove('checkbox-error');
        }, 500);

        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Updating...';

    const deliveredAt = new Date(); // Current timestamp

    try {
        // 1. Update Root Order
        const rootRef = doc(db, 'orders', orderId);
        await updateDoc(rootRef, {
            status: 'delivered',
            deliveredAt: deliveredAt
        });

        // 2. Update User Order (Best Effort)
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            if (order.originalOrderPath) {
                const userOrderRef = doc(db, order.originalOrderPath);
                await updateDoc(userOrderRef, { status: 'delivered', deliveredAt: deliveredAt });
            } else if (order.userId) {
                const userOrderRef = doc(db, 'users', order.userId, 'orders', orderId);
                await updateDoc(userOrderRef, { status: 'delivered', deliveredAt: deliveredAt });
            }
        }

        // Update Local State
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            allOrders[orderIndex].status = 'delivered';
            allOrders[orderIndex].deliveredAt = deliveredAt; // Update local too
        }

        renderOrders(allOrders); // Refresh Table

        $('#deliveryVerificationModal').modal('hide');
        alert("Order Marked as Delivered Successfully!");

    } catch (e) {
        console.error("Error updating delivery status:", e);
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-truck"></i> Update Delivery';
    }
}

async function updateOrderStatusDirectly(orderId, newStatus) {
    try {
        // 1. Update Root Order
        const rootRef = doc(db, 'orders', orderId);
        await updateDoc(rootRef, { status: newStatus });

        // 2. Update User Order (Best Effort)
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            if (order.originalOrderPath) {
                const userOrderRef = doc(db, order.originalOrderPath);
                await updateDoc(userOrderRef, { status: newStatus });
            } else if (order.userId) {
                const userOrderRef = doc(db, 'users', order.userId, 'orders', orderId);
                await updateDoc(userOrderRef, { status: newStatus });
            }
        }

        // Update Local State & UI
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            allOrders[orderIndex].status = newStatus;
        }

        // Refresh Table
        const activeFilter = document.querySelector('.order-filters .btn.active').dataset.filter;
        if (activeFilter === 'all') renderOrders(allOrders);
        else {
            document.querySelector(`.order-filters .btn[data-filter="${activeFilter}"]`).click();
        }

        alert(`Success! Order #${orderId} marked as ${newStatus.toUpperCase()}.`);

    } catch (e) {
        console.error("Auto-update failed:", e);
        alert("Failed to update status: " + e.message);
    }
}
