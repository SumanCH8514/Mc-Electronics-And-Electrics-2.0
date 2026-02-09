import { initAssociateAuth, db, auth } from './associate-auth.js';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, deleteField, query, where, orderBy, limit, Timestamp, getCountFromServer, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth
initAssociateAuth(initDashboard);

let allOrders = [];
let html5QrcodeScanner = null;
let currentUser = null;

async function initDashboard() {
    currentUser = auth.currentUser;
    if (currentUser) {
        await checkAndUnassignStaleOrders(); // Auto-unassign stale orders
        setupNotifications(); // Setup Real-time Notifications
        await displayUserInfo();
        await fetchAssociateMetrics();
        await fetchRecentDeliveries();
        await fetchAllDeliveries();
    }
    await fetchOrders();
    setupScanner();
    hideLoader();
}

function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

async function displayUserInfo() {
    try {
        // Try to get data from associates collection first
        const associateDoc = await getDocs(query(collection(db, "associates"), where("__name__", "==", currentUser.uid)));
        let userData = null;

        if (!associateDoc.empty) {
            userData = associateDoc.docs[0].data();
        } else {
            // Fallback to users collection
            const userDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", currentUser.uid)));
            if (!userDoc.empty) {
                userData = userDoc.docs[0].data();
            }
        }

        if (userData) {
            const nameElement = document.getElementById('associateName');
            if (nameElement) {
                nameElement.textContent = userData.name || currentUser.email;
            }

            // Update profile image if available
            if (userData.profilePicture) {
                const imgElement = document.getElementById('associateImg');
                if (imgElement) {
                    imgElement.src = userData.profilePicture;
                }
            }
        }
    } catch (error) {
        console.error("Error fetching user info:", error);
    }
}

async function fetchAssociateMetrics() {
    try {
        const startOfDay = getStartOfDay(); // Helper function

        // 1. Daily Assigned Orders
        let assignedCount = 0;
        try {
            const assignedRef = collection(db, "associates", currentUser.uid, "assignedOrders");
            // Query for assignments today
            const qAssigned = query(assignedRef, where("assignedAt", ">=", startOfDay));
            const snapshot = await getCountFromServer(qAssigned);
            assignedCount = snapshot.data().count;
        } catch (e) {
            console.log("No assigned orders subcollection or error fetching count", e);
        }

        // 2. Daily Completed Deliveries
        const ordersRef = collection(db, "orders");
        // Query for deliveries today
        const qDelivered = query(ordersRef,
            where("deliveredBy", "==", currentUser.uid),
            where("deliveredAt", ">=", startOfDay)
        );
        const snapshotDelivered = await getCountFromServer(qDelivered);
        const completedDeliveries = snapshotDelivered.data().count;

        // 3. Revenue (Daily)
        let deliveryIncentive = 0;
        try {
            const incentiveDoc = await getDoc(doc(db, "settings", "deliveryIncentive"));
            if (incentiveDoc.exists()) {
                deliveryIncentive = incentiveDoc.data().amount || 0;
            }
        } catch (e) {
            console.log("No delivery incentive set", e);
        }

        const totalRevenue = completedDeliveries * deliveryIncentive;

        // Update UI
        document.getElementById('totalDeliveries').textContent = assignedCount;
        document.getElementById('totalRevenue').textContent = '₹' + totalRevenue.toLocaleString();
        document.getElementById('deliveriesDone').textContent = completedDeliveries;
    } catch (error) {
        console.error("Error fetching metrics:", error);
        document.getElementById('totalDeliveries').textContent = '0';
        document.getElementById('totalRevenue').textContent = '₹0';
        document.getElementById('deliveriesDone').textContent = '0';
    }
}



async function fetchRecentDeliveries_Old() {
    try {
        const ordersRef = collection(db, "orders");
        const q = query(
            ordersRef,
            where("deliveredBy", "==", currentUser.uid),
            orderBy("deliveredAt", "desc"),
            limit(10)
        );
        const querySnapshot = await getDocs(q);

        const tableBody = document.getElementById('recentDeliveriesTable');
        tableBody.innerHTML = '';

        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No deliveries yet. Scan QR codes to start delivering!</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const order = doc.data();
            const row = document.createElement('tr');

            // Order ID
            const orderId = doc.id.substring(0, 12) + '...';

            // Customer Name
            let customerName = order.userName || 'Guest';
            if (order.shippingAddress && order.shippingAddress.name) {
                customerName = order.shippingAddress.name;
            }

            // Product (first item)
            let productName = 'N/A';
            if (order.items && order.items.length > 0) {
                productName = order.items[0].name;
                if (order.items.length > 1) {
                    productName += ` + ${order.items.length - 1} others`;
                }
            }

            // Amount
            const amount = '₹' + (order.totalAmount || 0).toLocaleString();

            // Date
            let dateStr = 'N/A';
            if (order.deliveredAt) {
                const date = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
                dateStr = date.toLocaleDateString('en-IN');
            }

            row.innerHTML = `
                <td>#${orderId}</td>
                <td>${customerName}</td>
                <td>${productName}</td>
                <td>${amount}</td>
                <td>${dateStr}</td>
            `;

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error fetching recent deliveries:", error);
        const tableBody = document.getElementById('recentDeliveriesTable');
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading deliveries</td></tr>';
    }
}

async function fetchOrders() {
    try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        allOrders = [];
        querySnapshot.forEach((doc) => {
            allOrders.push({ id: doc.id, ...doc.data() });
        });
        console.log("Orders loaded for scanning:", allOrders.length);
    } catch (error) {
        console.error("Error loading orders:", error);
    }
}

function setupScanner() {
    // Check if modal is closed by clicking outside
    $('#qrScannerModal').on('hidden.bs.modal', function () {
        stopQrScanner();
    });

    // Wait for modal to be fully shown before starting scanner
    $('#qrScannerModal').on('shown.bs.modal', function () {
        console.log("QR Scanner Modal Shown - Initializing Scanner");
        try {
            if (!html5QrcodeScanner) {
                html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", {
                    fps: 10,
                    qrbox: 250,
                    aspectRatio: 1.0,
                    videoConstraints: {
                        facingMode: "environment"
                    }
                }, /* verbose= */ true);

                html5QrcodeScanner.render(onScanSuccess, onScanFailure);
                console.log("Scanner rendered successfully");
            }
        } catch (error) {
            console.error("Failed to initialize QR Scanner:", error);
            $('#qr-reader').html('<p class="text-danger">Error initializing camera: ' + error.message + '</p>');
        }
    });
}

window.stopQrScanner = function () {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().then(() => {
            html5QrcodeScanner = null;
            $('#qr-reader').empty();
        }).catch(err => console.error("Failed to clear scanner", err));
    }
}

function onScanFailure(error) {
    // handle scan failure
}

async function onScanSuccess(decodedText, decodedResult) {
    const term = decodedText.trim();

    if (!allOrders || allOrders.length === 0) {
        alert("Orders not loaded yet. Please wait or refresh.");
        await fetchOrders(); // Try fetching again
        return;
    }

    const found = allOrders.find(o => {
        if (o.id === term) return true;
        if (o.id.includes(term)) return true;
        if (term.includes(o.id)) return true;
        return false;
    });

    if (found) {
        if (html5QrcodeScanner) {
            await html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }
        $('#qrScannerModal').modal('hide');

        // Populate Delivery Verification Modal
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
            found.items.slice(0, 3).forEach(item => {
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

            dvCodConfirmWrapper.style.display = 'block';
            dvCodConfirmCheck.checked = false;
        } else {
            dvPaymentStatus.innerText = "PREPAID";
            dvPaymentStatus.classList.remove('text-warning');
            dvPaymentStatus.classList.add('text-success');

            dvCodWrapper.style.display = 'none';
            dvCodConfirmWrapper.style.display = 'none';
        }

        const updateBtn = document.getElementById('dvUpdateBtn');
        updateBtn.onclick = () => handleDeliveryUpdate(orderId);

        $('#deliveryVerificationModal').modal('show');

    } else {
        alert("Order not found!");
    }
}

async function handleDeliveryUpdate(orderId) {
    const btn = document.getElementById('dvUpdateBtn');

    // Check COD
    const dvCodConfirmWrapper = document.getElementById('dvCodConfirmWrapper');
    const dvCodConfirmCheck = document.getElementById('dvCodConfirmCheck');

    if (dvCodConfirmWrapper.style.display !== 'none' && !dvCodConfirmCheck.checked) {
        const checkboxContainer = dvCodConfirmWrapper.querySelector('.custom-control');
        checkboxContainer.classList.add('checkbox-error');
        setTimeout(() => {
            checkboxContainer.classList.remove('checkbox-error');
        }, 500);
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Updating...';

    const deliveredAt = Timestamp.now();

    try {
        const rootRef = doc(db, 'orders', orderId);
        await updateDoc(rootRef, {
            status: 'delivered',
            deliveredAt: deliveredAt,
            deliveredBy: currentUser.uid
        });

        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            if (order.originalOrderPath) {
                const userOrderRef = doc(db, order.originalOrderPath);
                await updateDoc(userOrderRef, {
                    status: 'delivered',
                    deliveredAt: deliveredAt,
                    deliveredBy: currentUser.uid
                });
            } else if (order.userId) {
                const userOrderRef = doc(db, 'users', order.userId, 'orders', orderId);
                await updateDoc(userOrderRef, {
                    status: 'delivered',
                    deliveredAt: deliveredAt,
                    deliveredBy: currentUser.uid
                });
            }
        }

        // Update local state
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            allOrders[orderIndex].status = 'delivered';
            allOrders[orderIndex].deliveredBy = currentUser.uid;
            allOrders[orderIndex].deliveredAt = deliveredAt;
        }

        $('#deliveryVerificationModal').modal('hide');

        // Refresh metrics and recent deliveries
        await fetchAssociateMetrics();
        await fetchRecentDeliveries();
        await fetchAllDeliveries();

        alert("Order Marked as Delivered Successfully!");

    } catch (e) {
        console.error("Error updating delivery status:", e);
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-truck"></i> Update Delivery';
    }
}

// Make logout function global
window.logout = function () {
    auth.signOut().then(() => {
        window.location.href = '../auth/associate-login.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        alert('Error logging out');
    });
}

// ========== PAYOUT DETAILS FUNCTIONS ==========

// Toggle payment method sections
window.togglePaymentMethod = function () {
    const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const bankSection = document.getElementById('bankDetailsSection');
    const upiSection = document.getElementById('upiDetailsSection');

    if (method === 'bank') {
        bankSection.style.display = 'block';
        upiSection.style.display = 'none';
    } else if (method === 'upi') {
        bankSection.style.display = 'none';
        upiSection.style.display = 'block';
    } else {
        bankSection.style.display = 'none';
        upiSection.style.display = 'none';
    }
}

// Load payout details when modal is shown
$('#payoutDetailsModal').on('shown.bs.modal', async function () {
    await loadPayoutDetails();
    await loadIncentiveSummary();
});

// Load payout details from Firestore
async function loadPayoutDetails() {
    try {
        const associateDoc = await getDoc(doc(db, "associates", currentUser.uid));
        if (associateDoc.exists()) {
            const data = associateDoc.data();
            const payoutDetails = data.payoutDetails || {};

            if (payoutDetails.method) {
                // Set payment method
                if (payoutDetails.method === 'bank') {
                    document.getElementById('methodBank').checked = true;
                    document.getElementById('accountHolderName').value = payoutDetails.accountHolderName || '';
                    document.getElementById('accountNumber').value = payoutDetails.accountNumber || '';
                    document.getElementById('ifscCode').value = payoutDetails.ifscCode || '';
                    document.getElementById('bankName').value = payoutDetails.bankName || '';
                } else if (payoutDetails.method === 'upi') {
                    document.getElementById('methodUPI').checked = true;
                    document.getElementById('upiId').value = payoutDetails.upiId || '';
                }
                togglePaymentMethod();
            }
        }
    } catch (error) {
        console.error("Error loading payout details:", error);
    }
}

// Load incentive summary
async function loadIncentiveSummary() {
    try {
        // Fetch delivery incentive
        let deliveryIncentive = 0;
        const incentiveDoc = await getDoc(doc(db, "settings", "deliveryIncentive"));
        if (incentiveDoc.exists()) {
            deliveryIncentive = incentiveDoc.data().amount || 0;
        }

        // Get completed deliveries count
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("deliveredBy", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const completedDeliveries = querySnapshot.size;

        // Calculate total incentive
        const totalIncentive = completedDeliveries * deliveryIncentive;

        // Update UI
        document.getElementById('perOrderIncentive').textContent = '₹' + deliveryIncentive.toLocaleString();
        document.getElementById('totalDeliveriesCount').textContent = completedDeliveries;
        document.getElementById('totalIncentiveEarned').textContent = '₹' + totalIncentive.toLocaleString();
        document.getElementById('incentiveCalculation').textContent =
            `${completedDeliveries} deliveries × ₹${deliveryIncentive} = ₹${totalIncentive}`;
    } catch (error) {
        console.error("Error loading incentive summary:", error);
    }
}

// Save payout details
document.getElementById('savePayoutBtn')?.addEventListener('click', async function () {
    const btn = this;
    const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    if (!method) {
        alert('Please select a payment method');
        return;
    }

    let payoutDetails = { method };

    if (method === 'bank') {
        const accountHolderName = document.getElementById('accountHolderName').value.trim();
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const ifscCode = document.getElementById('ifscCode').value.trim().toUpperCase();

        if (!accountHolderName || !accountNumber || !ifscCode) {
            alert('Please fill in all required bank details');
            return;
        }

        payoutDetails.accountHolderName = accountHolderName;
        payoutDetails.accountNumber = accountNumber;
        payoutDetails.ifscCode = ifscCode;
        payoutDetails.bankName = document.getElementById('bankName').value.trim();
    } else if (method === 'upi') {
        const upiId = document.getElementById('upiId').value.trim();

        if (!upiId) {
            alert('Please enter your UPI ID');
            return;
        }

        payoutDetails.upiId = upiId;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';

    try {
        await setDoc(doc(db, "associates", currentUser.uid), {
            payoutDetails: payoutDetails
        }, { merge: true });

        alert('Payment details saved successfully!');
        $('#payoutDetailsModal').modal('hide');
    } catch (error) {
        console.error("Error saving payout details:", error);
        alert('Error saving payment details: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save"></i> Save Payment Details';
    }
});

// ========== ALL DELIVERIES PAGINATION ==========

let allDeliveriesData = [];
let currentDeliveriesPage = 0;
const DELIVERIES_PER_PAGE = 10;

// Fetch all deliveries
async function fetchAllDeliveries_Old() {
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("deliveredBy", "==", currentUser.uid), orderBy("deliveredAt", "desc"));
        const querySnapshot = await getDocs(q);

        allDeliveriesData = [];
        querySnapshot.forEach((docSnap) => {
            allDeliveriesData.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderAllDeliveries();
    } catch (error) {
        console.error("Error fetching all deliveries:", error);
        document.getElementById('allDeliveriesTable').innerHTML =
            '<tr><td colspan="6" class="text-center text-danger">Error loading deliveries</td></tr>';
    }
}

// Render all deliveries table with pagination
function renderAllDeliveries_Old() {
    const tableBody = document.getElementById('allDeliveriesTable');
    const start = currentDeliveriesPage * DELIVERIES_PER_PAGE;
    const end = start + DELIVERIES_PER_PAGE;
    const pageData = allDeliveriesData.slice(start, end);

    if (allDeliveriesData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No deliveries yet. Scan QR codes to start delivering!</td></tr>';
        document.getElementById('deliveriesShowing').textContent = '0';
        document.getElementById('deliveriesTotal').textContent = '0';
        return;
    }

    let html = '';
    pageData.forEach(order => {
        const orderId = order.id.substring(0, 8) + '...';
        const customerName = order.customerName || order.shippingAddress?.name || 'N/A';
        const productName = order.items?.[0]?.name || 'N/A';
        const amount = '₹' + (order.totalAmount || 0).toLocaleString();
        const date = order.deliveredAt ? new Date(order.deliveredAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const status = order.status || 'delivered';
        const statusClass = status === 'delivered' ? 'badge-success' : 'badge-warning';

        html += `
            <tr>
                <td>${orderId}</td>
                <td>${customerName}</td>
                <td>${productName}</td>
                <td>${amount}</td>
                <td>${date}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Update pagination info
    document.getElementById('deliveriesShowing').textContent = Math.min(end, allDeliveriesData.length);
    document.getElementById('deliveriesTotal').textContent = allDeliveriesData.length;

    // Update button states
    document.getElementById('prevDeliveriesBtn').disabled = currentDeliveriesPage === 0;
    document.getElementById('nextDeliveriesBtn').disabled = end >= allDeliveriesData.length;
}

// Setup pagination buttons
function setupAllDeliveriesPagination_Old() {
    document.getElementById('prevDeliveriesBtn')?.addEventListener('click', () => {
        if (currentDeliveriesPage > 0) {
            currentDeliveriesPage--;
            renderAllDeliveries();
        }
    });

    document.getElementById('nextDeliveriesBtn')?.addEventListener('click', () => {
        if ((currentDeliveriesPage + 1) * DELIVERIES_PER_PAGE < allDeliveriesData.length) {
            currentDeliveriesPage++;
            renderAllDeliveries();
        }
    });
}

// ==========================================
// NEW IMPLEMENTATION: Daily Metrics & View More
// ==========================================

// Helper: Get Start of Day (Midnight)
function getStartOfDay() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(now);
}

// Fetch Recent Deliveries (Today, Limit 5)
async function fetchRecentDeliveries() {
    try {
        const startOfDay = getStartOfDay();
        const ordersRef = collection(db, "orders");
        // Get today's deliveries, limit 6 to check for "View More"
        const q = query(ordersRef,
            where("deliveredBy", "==", currentUser.uid),
            where("deliveredAt", ">=", startOfDay),
            orderBy("deliveredAt", "desc"),
            limit(6)
        );
        const querySnapshot = await getDocs(q);

        const tableBody = document.getElementById('recentDeliveriesTable');
        tableBody.innerHTML = '';

        const viewMoreBtn = document.getElementById('viewMoreRecentBtn');
        if (viewMoreBtn) viewMoreBtn.style.display = 'none';

        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No deliveries today.</td></tr>';
            return;
        }

        const docs = querySnapshot.docs;
        const showCount = Math.min(docs.length, 5);

        // Show "View More" if more than 5
        if (docs.length > 5 && viewMoreBtn) {
            viewMoreBtn.style.display = 'inline-block';
            viewMoreBtn.onclick = () => openRecentDeliveriesModal();
        }

        for (let i = 0; i < showCount; i++) {
            const doc = docs[i];
            const order = doc.data();
            const row = document.createElement('tr');

            // Order ID
            const orderId = doc.id.substring(0, 8) + '...';

            // Customer Name
            let customerName = order.userName || 'Guest';
            if (order.shippingAddress && order.shippingAddress.name) {
                customerName = order.shippingAddress.name;
            }

            // Product (first item)
            let productName = 'N/A';
            if (order.items && order.items.length > 0) {
                productName = order.items[0].name;
                if (order.items.length > 1) {
                    productName += ` + ${order.items.length - 1} others`;
                }
            }

            // Amount
            const amount = '₹' + (order.totalAmount || 0).toLocaleString();

            // Time
            let timeStr = 'N/A';
            if (order.deliveredAt) {
                const date = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
                timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            }

            row.innerHTML = `
                <td>${orderId}</td>
                <td>${customerName}</td>
                <td>${productName}</td>
                <td>${amount}</td>
                <td>${timeStr}</td>
            `;
            tableBody.appendChild(row);
        }

    } catch (error) {
        console.error("Error fetching recent deliveries:", error);
    }
}

// Fetch All Deliveries (For Dashboard & Modal)
async function fetchAllDeliveries() {
    try {
        const ordersRef = collection(db, "orders");
        // Fetch all history
        const q = query(ordersRef, where("deliveredBy", "==", currentUser.uid), orderBy("deliveredAt", "desc"));
        const querySnapshot = await getDocs(q);

        allDeliveriesData = [];
        querySnapshot.forEach((docSnap) => {
            allDeliveriesData.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderAllDeliveries();
    } catch (error) {
        console.error("Error fetching all deliveries:", error);
        const tableBody = document.getElementById('allDeliveriesTable');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading deliveries</td></tr>';
    }
}

// Render all deliveries table (Dashboard - Limit 5)
function renderAllDeliveries() {
    // Dashboard Table
    const tableBody = document.getElementById('allDeliveriesTable');
    if (!tableBody) return;

    // Show only first 5 on dashboard
    const dashboardData = allDeliveriesData.slice(0, 5);

    const viewAllBtn = document.getElementById('viewAllDeliveriesBtn');

    if (allDeliveriesData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No deliveries yet. Scan QR codes to start delivering!</td></tr>';
        if (viewAllBtn) viewAllBtn.style.display = 'none';
        return;
    }

    if (viewAllBtn) {
        viewAllBtn.style.display = 'block';
        viewAllBtn.onclick = () => openAllDeliveriesModal();
    }

    let html = '';
    dashboardData.forEach(order => {
        const orderId = order.id.substring(0, 8) + '...';
        const customerName = order.customerName || order.shippingAddress?.name || 'N/A';
        const productName = order.items?.[0]?.name || 'N/A';
        const amount = '₹' + (order.totalAmount || 0).toLocaleString();
        const date = order.deliveredAt ? new Date(order.deliveredAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const status = order.status || 'delivered';
        const statusClass = status === 'delivered' ? 'badge-success' : 'badge-warning';

        html += `
            <tr>
                <td>${orderId}</td>
                <td>${customerName}</td>
                <td>${productName}</td>
                <td>${amount}</td>
                <td>${date}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Open Recent Deliveries Modal
async function openRecentDeliveriesModal() {
    $('#recentDeliveriesModal').modal('show');
    const tableBody = document.getElementById('modalRecentDeliveriesTable');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const startOfDay = getStartOfDay();
        const ordersRef = collection(db, "orders");
        // Get ALL today's deliveries
        const q = query(ordersRef,
            where("deliveredBy", "==", currentUser.uid),
            where("deliveredAt", ">=", startOfDay),
            orderBy("deliveredAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        let html = '';
        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderId = doc.id.substring(0, 8) + '...';
            const customerName = order.userName || order.shippingAddress?.name || 'Guest';
            const productName = order.items?.[0]?.name || 'N/A';
            const amount = '₹' + (order.totalAmount || 0).toLocaleString();

            let timeStr = 'N/A';
            if (order.deliveredAt) {
                const date = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
                timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            }

            html += `
                <tr>
                    <td>${orderId}</td>
                    <td>${customerName}</td>
                    <td>${productName}</td>
                    <td>${amount}</td>
                    <td>${timeStr}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html || '<tr><td colspan="5" class="text-center">No deliveries found.</td></tr>';
    } catch (e) {
        console.error("Error fetching modal recent deliveries:", e);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

// Open All Deliveries Modal
function openAllDeliveriesModal() {
    $('#allDeliveriesModal').modal('show');
    currentModalPage = 0;
    renderModalAllDeliveries();
}

let currentModalPage = 0;
const MODAL_PAGE_SIZE = 10;

function renderModalAllDeliveries() {
    const tableBody = document.getElementById('modalAllDeliveriesTable');
    const start = currentModalPage * MODAL_PAGE_SIZE;
    const end = start + MODAL_PAGE_SIZE;
    const pageData = allDeliveriesData.slice(start, end);

    let html = '';
    pageData.forEach(order => {
        const orderId = order.id.substring(0, 8) + '...';
        const customerName = order.customerName || order.shippingAddress?.name || 'N/A';
        const productName = order.items?.[0]?.name || 'N/A';
        const amount = '₹' + (order.totalAmount || 0).toLocaleString();
        const date = order.deliveredAt ? new Date(order.deliveredAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const status = order.status || 'delivered';

        html += `
            <tr>
                <td>${orderId}</td>
                <td>${customerName}</td>
                <td>${productName}</td>
                <td>${amount}</td>
                <td>${date}</td>
                <td><span class="badge badge-success">${status}</span></td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    document.getElementById('modalPageNum').textContent = currentModalPage + 1;
    document.getElementById('modalPrevBtn').disabled = currentModalPage === 0;
    document.getElementById('modalNextBtn').disabled = end >= allDeliveriesData.length;

    // Setup listeners if not already
    if (!document.getElementById('modalPrevBtn').hasAttribute('data-listener')) {
        document.getElementById('modalPrevBtn').setAttribute('data-listener', 'true');
        document.getElementById('modalPrevBtn').addEventListener('click', () => {
            if (currentModalPage > 0) {
                currentModalPage--;
                renderModalAllDeliveries();
            }
        });

        document.getElementById('modalNextBtn').addEventListener('click', () => {
            if ((currentModalPage + 1) * MODAL_PAGE_SIZE < allDeliveriesData.length) {
                currentModalPage++;
                renderModalAllDeliveries();
            }
        });
    }
}

// Helper to make modals callable globally if needed (though we use onclick)
window.openRecentDeliveriesModal = openRecentDeliveriesModal;
window.openAllDeliveriesModal = openAllDeliveriesModal;

// ==========================================
// DATA INTEGRITY: Auto-Unassign Stale Orders
// ==========================================

async function checkAndUnassignStaleOrders() {
    try {
        const startOfDay = getStartOfDay();
        const assignedRef = collection(db, "associates", currentUser.uid, "assignedOrders");

        // Find orders assigned BEFORE today
        const q = query(assignedRef, where("assignedAt", "<", startOfDay));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        console.log(`Found ${snapshot.size} stale assignments. Checking statuses...`);

        const updates = [];

        for (const docSnap of snapshot.docs) {
            const orderId = docSnap.id;
            const orderRef = doc(db, "orders", orderId);

            // To properly cleanup, we need to check the order status first
            // We can add a promise to the list to process it
            updates.push(processStaleOrder(docSnap, orderRef, orderId));
        }

        await Promise.all(updates);
        console.log("Stale orders cleanup complete.");

    } catch (error) {
        console.error("Error in checkAndUnassignStaleOrders:", error);
    }
}

async function processStaleOrder(assignmentDoc, orderRef, orderId) {
    try {
        const orderSnapshot = await getDoc(orderRef);
        if (orderSnapshot.exists()) {
            const orderData = orderSnapshot.data();

            // If order is NOT delivered, unassign it in orders collection
            if (orderData.status !== 'delivered') {
                await updateDoc(orderRef, {
                    status: 'packed',
                    deliveryAgent: deleteField(),
                    deliveredBy: deleteField(),
                    deliveryAssignedTo: deleteField()
                });
                console.log(`Unassigned stale order: ${orderId}`);
            }
        } else {
            // Order doesn't exist? Just cleanup assignment.
            console.warn(`Order ${orderId} not found, removing assignment.`);
        }

        // Always remove the assignment record from associate's list
        await deleteDoc(assignmentDoc.ref);

    } catch (err) {
        console.error(`Error processing stale order ${orderId}:`, err);
    }
}

// ==========================================
// NOTIFICATIONS SYSTEM
// ==========================================

// Toggle Notification Panel
window.toggleNotificationPanel = function () {
    const panel = document.getElementById('notificationPanel');
    const overlay = document.getElementById('notificationOverlay');
    if (panel) panel.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// Setup Real-time Notifications
function setupNotifications() {
    if (!currentUser) return;

    const notifRef = collection(db, "notifications");
    const q = query(
        notifRef,
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('notificationList');
        const badge = document.getElementById('notificationBadge');
        const markAllBtn = document.getElementById('markAllReadBtn');

        if (!list || !badge) return;

        let unreadCount = 0;
        let html = '';
        const totalCount = snapshot.size;

        if (snapshot.empty) {
            list.innerHTML = `
                <div class="notification-empty">
                    <i class="fa fa-bell-slash fa-2x mb-3"></i>
                    <p>No notifications yet</p>
                </div>`;
            badge.style.display = 'none';
            if (markAllBtn) {
                markAllBtn.disabled = true;
                markAllBtn.textContent = "Mark all as read";
                markAllBtn.classList.remove('btn-outline-danger');
                markAllBtn.classList.add('btn-outline-primary');
            }
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const isUnread = !data.read;
            if (isUnread) unreadCount++;

            // Format Time
            let timeStr = '';
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);

                if (diffMins < 1) timeStr = 'Just now';
                else if (diffMins < 60) timeStr = `${diffMins} mins ago`;
                else if (diffHours < 24) timeStr = `${diffHours} hours ago`;
                else timeStr = `${diffDays} days ago`;
            }

            html += `
                <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="markNotificationRead('${doc.id}', ${data.read})">
                    <span class="title">${data.title || 'Notification'}</span>
                    <span class="message">${data.message || ''}</span>
                    <span class="time">${timeStr}</span>
                </div>
            `;
        });

        list.innerHTML = html;

        // Update Badge
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.textContent = '0';
            badge.style.display = 'none';
        }

        // Update Button State
        if (markAllBtn) {
            markAllBtn.classList.remove('btn-outline-primary', 'btn-outline-danger');

            if (unreadCount > 0) {
                markAllBtn.textContent = "Mark all as read";
                markAllBtn.onclick = markAllNotificationsRead;
                markAllBtn.disabled = false;
                markAllBtn.classList.add('btn-outline-primary');
            } else if (totalCount > 0) {
                markAllBtn.textContent = "Clear all notifications";
                markAllBtn.onclick = clearAllNotifications;
                markAllBtn.disabled = false;
                markAllBtn.classList.add('btn-outline-danger');
            } else {
                markAllBtn.textContent = "Mark all as read";
                markAllBtn.disabled = true;
                markAllBtn.classList.add('btn-outline-primary');
            }
        }

    }, (error) => {
        console.error("Error fetching notifications:", error);
    });
}

// Mark Single Notification as Read
window.markNotificationRead = async function (notifId, isRead) {
    if (isRead) return;
    try {
        const notifRef = doc(db, "notifications", notifId);
        await updateDoc(notifRef, { read: true });
    } catch (error) {
        console.error("Error marking notification read:", error);
    }
}

// Mark All As Read
window.markAllNotificationsRead = async function () {
    try {
        const notifRef = collection(db, "notifications");
        const q = query(
            notifRef,
            where("userId", "==", currentUser.uid),
            where("read", "==", false),
            limit(20)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error marking all read:", error);
    }
}

// Clear All Notifications
window.clearAllNotifications = async function () {
    if (!confirm("Are you sure you want to delete all notifications?")) return;

    try {
        const notifRef = collection(db, "notifications");
        const q = query(
            notifRef,
            where("userId", "==", currentUser.uid)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        // UI will update automatically via onSnapshot
    } catch (error) {
        console.error("Error clearing all notifications:", error);
        alert("Error clearing notifications. Please try again.");
    }
}


