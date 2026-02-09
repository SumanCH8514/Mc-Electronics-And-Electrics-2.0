import { initAdminAuth, db } from './admin-auth.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    orderBy,
    limit,
    serverTimestamp,
    addDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// State variables
const PAGE_SIZE = 5;
let allAssociates = []; // Store fetched associates for modal search
let allDeliveryOrders = []; // Store fetched orders for modal search

// Initialize Auth & Load Page
initAdminAuth(async (user) => {
    // Initialize Page
    await initPage();
});

async function initPage() {
    loadAssociates();
    loadDeliveryOrders();
    setupEventListeners();
}

// --- Associates Section ---

async function loadAssociates() {
    const tableBody = document.getElementById('associatesTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const q = query(
            collection(db, "associates"),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );

        const querySnapshot = await getDocs(q);
        tableBody.innerHTML = '';

        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No associates found.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = createAssociateRow(doc.id, data);
            tableBody.appendChild(row);
        });

        // Show "View More" if needed (simple check if we got enough docs)
        if (querySnapshot.size >= PAGE_SIZE) {
            const btn = document.getElementById('viewMoreAssociatesBtn');
            if (btn) btn.style.display = 'inline-block';
        }


    } catch (error) {
        console.error("Error loading associates:", error);
        // Fallback if index missing or other error. 
        if (error.code === 'failed-precondition') {
            console.warn("Index missing, trying simple query");
            // Retry without ordering (or different order)
            const qRetry = query(collection(db, "associates"), limit(PAGE_SIZE));
            const retrySnapshot = await getDocs(qRetry);
            tableBody.innerHTML = '';
            retrySnapshot.forEach((doc) => {
                tableBody.appendChild(createAssociateRow(doc.id, doc.data()));
            });
            if (retrySnapshot.size >= PAGE_SIZE) {
                const btn = document.getElementById('viewMoreAssociatesBtn');
                if (btn) btn.style.display = 'inline-block';
            }
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        }
    }
}

function createAssociateRow(id, data, isModal = false) {
    const tr = document.createElement('tr');

    // Status Badge
    const status = data.status || 'Active';
    const badgeClass = status === 'Active' ? 'badge-success' : 'badge-warning';

    // Profile Pic
    // Note: When running from admin/ folder, images are in ../images/
    const imgSrc = data.profilePicture || '../images/client1.gif';

    tr.innerHTML = `
        <td>
            <div class="d-flex align-items-center">
                <img src="${imgSrc}" class="associate-img-small" alt="Img">
                <div>
                     <span class="d-block font-weight-bold">${data.name || 'Unknown'}</span>
                     ${isModal ? `<small class="text-muted"><i class="fa fa-envelope"></i> ${data.email}</small>` : ''}
                </div>
            </div>
        </td>
        <td>${data.mobile || 'N/A'}</td>
        ${isModal ? `<td>${data.email || 'N/A'}</td>` : ''}
        <td><span class="badge ${badgeClass}">${status}</span></td>
        ${!isModal ? `<td>Associate</td>` : ''} 
        <td>
            <button class="btn btn-sm btn-info" onclick="viewAssociateDetails('${id}')" title="View Details">
                <i class="fa fa-eye"></i>
            </button>
        </td>
    `;
    return tr;
}

// --- Delivery Orders Section ---

async function loadDeliveryOrders() {
    const tableBody = document.getElementById('assignDeliveryTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading orders...</td></tr>';

    try {
        const q = query(
            collection(db, "orders"),
            where("status", "==", "out-for-delivery"),
            limit(PAGE_SIZE)
        );


        const querySnapshot = await getDocs(q);

        tableBody.innerHTML = '';

        if (querySnapshot.empty) {

            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No orders Out for Delivery.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            tableBody.appendChild(createOrderRow(doc.id, data));
        });

        // Show "Assign More Products" button if there might be more orders
        const btn = document.getElementById('assignMoreProductsBtn');
        if (btn) {
            btn.style.display = querySnapshot.size >= PAGE_SIZE ? 'inline-block' : 'none';
        }


    } catch (error) {
        console.error("Error loading orders:", error);
        if (error.code === 'failed-precondition') {
            // Missing index or similar
            const qRetry = query(collection(db, "orders"), where("status", "==", "out-for-delivery"), limit(PAGE_SIZE));
            const retrySnapshot = await getDocs(qRetry);
            tableBody.innerHTML = '';
            retrySnapshot.forEach((doc) => {
                tableBody.appendChild(createOrderRow(doc.id, doc.data()));
            });
            // Show button if there might be more
            const btn = document.getElementById('assignMoreProductsBtn');
            if (btn) {
                btn.style.display = retrySnapshot.size >= PAGE_SIZE ? 'inline-block' : 'none';
            }
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        }
    }
}

function createOrderRow(id, data, isModal = false) {
    const tr = document.createElement('tr');

    // Customer Name - try multiple fields
    let customerName = 'N/A';
    if (data.userName) {
        customerName = data.userName;
    } else if (data.userEmail) {
        customerName = data.userEmail;
    } else if (data.userId) {
        customerName = data.userId;
    }

    // Address - check multiple possible field names
    let address = 'N/A';
    let city = '';

    // Try different possible field names
    let addressData = data.deliveryAddress || data.shippingAddress || data.address;

    if (addressData) {
        try {
            // Parse if it's a JSON string
            const addr = typeof addressData === 'string'
                ? JSON.parse(addressData)
                : addressData;



            if (addr) {
                const parts = [];
                if (addr.line1) parts.push(addr.line1);
                if (addr.line2) parts.push(addr.line2);
                if (addr.city) {
                    city = addr.city;
                    parts.push(addr.city);
                }
                if (addr.state) parts.push(addr.state);
                if (addr.pincode) parts.push(addr.pincode);

                address = parts.join(', ');


            }
        } catch (e) {
            console.error('Error parsing address:', e);
            address = 'Invalid address format';
        }
    } else {

    }

    // Assigned Associate (if any)
    const assignedTo = data.deliveryAssignedTo ? `<span class="badge badge-info ml-2">Assigned</span>` : `<span class="badge badge-secondary ml-2">Unassigned</span>`;


    tr.innerHTML = `
        <td><span class="font-weight-bold text-primary">#${id.substring(0, 8)}</span></td>
        <td>${customerName}</td>
        <td>${address}</td>
        <td>
            <span class="badge badge-warning">Out for Delivery</span>
            ${assignedTo}
        </td>
        <td>
            <button class="btn btn-sm btn-primary" onclick="openAssignModal('${id}')">
                <i class="fa fa-motorcycle"></i> Assign
            </button>
        </td>
    `;
    return tr;
}


// --- Modal & Interaction Logic ---

function setupEventListeners() {
    // View More Associates
    const viewMoreAssociatesBtn = document.getElementById('viewMoreAssociatesBtn');
    if (viewMoreAssociatesBtn) {
        viewMoreAssociatesBtn.addEventListener('click', async () => {
            // Use jQuery for bootstrap modal
            if (window.$) {
                window.$('#allAssociatesModal').modal('show');
                await loadAllAssociatesForModal();
            }
        });
    }

    // Assign More Products
    const assignMoreProductsBtn = document.getElementById('assignMoreProductsBtn');
    if (assignMoreProductsBtn) {
        assignMoreProductsBtn.addEventListener('click', async () => {
            if (window.$) {
                window.$('#assignProductsModal').modal('show');
                await loadAllOrdersForModal();
            }
        });
    }

    // Search in Modal (Associates)
    const assocSearch = document.getElementById('associateSearchInput');
    if (assocSearch) {
        assocSearch.addEventListener('keyup', function () {
            const val = this.value.toLowerCase();
            const rows = document.getElementById('modalAssociatesTableBody').getElementsByTagName('tr');
            Array.from(rows).forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });
    }

    // Search in Modal (Orders)
    const assignSearch = document.getElementById('assignSearchInput');
    if (assignSearch) {
        assignSearch.addEventListener('keyup', function () {
            const val = this.value.toLowerCase();
            const rows = document.getElementById('modalAssignTableBody').getElementsByTagName('tr');
            Array.from(rows).forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });
    }

    // Confirm Assign
    const confirmBtn = document.getElementById('confirmAssignBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', assignOrderToAssociate);
    }
}

// Load All Associates for Modal
async function loadAllAssociatesForModal() {
    const tbody = document.getElementById('modalAssociatesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading all associates...</td></tr>';

    try {
        const q = query(collection(db, "associates"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        allAssociates = [];
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No associates found.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            allAssociates.push(data);
            tbody.appendChild(createAssociateRow(doc.id, data, true));
        });

    } catch (error) {
        console.error("Error modal associates:", error);
        // Fallback query
        const q = query(collection(db, "associates"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No associates found.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            allAssociates.push(data);
            tbody.appendChild(createAssociateRow(doc.id, data, true));
        });
    }
}

// Load All Orders for Modal
async function loadAllOrdersForModal() {
    const tbody = document.getElementById('modalAssignTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading all orders...</td></tr>';

    try {
        const q = query(collection(db, "orders"), where("status", "==", "out-for-delivery"), orderBy("orderDate", "desc"));
        const snapshot = await getDocs(q);

        allDeliveryOrders = [];
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No orders found.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            tbody.appendChild(createOrderRow(doc.id, data, true));
        });

    } catch (error) {
        console.error("Error modal orders:", error);
        // Fallback
        const q = query(collection(db, "orders"), where("status", "==", "out-for-delivery"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No orders found.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            tbody.appendChild(createOrderRow(doc.id, data, true));
        });
    }
}


// --- Assignment Logic ---

window.openAssignModal = async function (orderId) {
    document.getElementById('selectedOrderId').value = orderId;
    if (window.$) window.$('#selectAssociateModal').modal('show');

    const dropdown = document.getElementById('associateSelectDropdown');
    dropdown.innerHTML = '<option value="">Loading...</option>';

    // Fetch associates if not already loaded (or refresh)
    // We want active associates.
    try {
        const q = query(collection(db, "associates")); // Add where status active if implemented
        const snapshot = await getDocs(q);
        dropdown.innerHTML = '<option value="">Select Associate</option>';

        if (snapshot.empty) {
            dropdown.innerHTML = '<option value="">No associates found</option>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            // Display name and mobile
            let label = data.name;
            if (data.mobile) label += ` (${data.mobile})`;
            option.textContent = label;
            dropdown.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading dropdown:", error);
        dropdown.innerHTML = '<option value="">Error loading</option>';
    }
};

async function assignOrderToAssociate() {
    const orderId = document.getElementById('selectedOrderId').value;
    const associateId = document.getElementById('associateSelectDropdown').value;
    const btn = document.getElementById('confirmAssignBtn');

    if (!associateId) {
        alert("Please select an associate.");
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = "Assigning...";

        // 1. Get Associate Details (for storing name in order if needed)
        const associateDoc = await getDoc(doc(db, "associates", associateId));

        if (!associateDoc.exists()) {
            throw new Error("Associate not found");
        }

        const associateData = associateDoc.data();

        // 2. Update Order (WITHOUT changing status)
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            deliveryAssignedTo: associateId,
            deliveryAssignedName: associateData.name,
            deliveryAssignedAt: serverTimestamp(),
            // Status remains "out-for-delivery" (or whatever it was)
            updatedAt: serverTimestamp()
        });

        // 3. Save to Associates Collection (assignedOrders sub-collection)
        const assignmentRef = doc(db, "associates", associateId, "assignedOrders", orderId);
        await setDoc(assignmentRef, {
            orderId: orderId,
            assignedAt: serverTimestamp(),
            status: "assigned"
        });

        // 3. Create Notification for Associate
        // Check if notifications collection exists (auto-created if not)
        await addDoc(collection(db, "notifications"), {
            userId: associateId,
            title: "New Delivery Assigned",
            message: `You have been assigned order #${orderId.substring(0, 8)} for delivery.`,
            type: "order_assignment",
            orderId: orderId,
            read: false,
            createdAt: serverTimestamp()
        });

        alert("Order assigned successfully!");
        if (window.$) window.$('#selectAssociateModal').modal('hide');
        loadDeliveryOrders(); // Refresh main list

    } catch (error) {
        console.error("Error assigning:", error);
        alert("Failed to assign order: " + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Assign Delivery";
        }
    }
}

// --- View Details Logic ---
window.viewAssociateDetails = async function (associateId) {
    if (window.$) window.$('#editAssociateModal').modal('show');
    const container = document.getElementById('associateDetailsContent');
    if (!container) return;
    container.innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const docRef = doc(db, "associates", associateId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const imgSrc = data.profilePicture || '../images/client1.gif';

            // Simple view for now
            let joinedDate = 'N/A';
            if (data.createdAt && data.createdAt.toDate) {
                joinedDate = data.createdAt.toDate().toLocaleDateString();
            } else if (data.joiningDate && data.joiningDate.toDate) {
                joinedDate = data.joiningDate.toDate().toLocaleDateString();
            }

            container.innerHTML = `
                <div class="text-center mb-4">
                    <img src="${imgSrc}" class="img-fluid rounded-circle" style="width: 120px; height: 120px; object-fit: cover; border: 3px solid #00bbf0;">
                    <h4 class="mt-2">${data.name}</h4>
                    <p class="text-muted">Associate</p>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label><strong>Email:</strong></label>
                            <p>${data.email || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="col-md-6">
                         <div class="form-group">
                            <label><strong>Mobile:</strong></label>
                            <p>${data.mobile || 'N/A'}</p>
                        </div>
                    </div>
                     <div class="col-md-6">
                         <div class="form-group">
                            <label><strong>Joined:</strong></label>
                            <p>${joinedDate}</p>
                        </div>
                    </div>
                    <div class="col-md-6">
                         <div class="form-group">
                            <label><strong>Status:</strong></label>
                            <p><span class="badge badge-success">Active</span></p>
                        </div>
                    </div>
                    <div class="col-md-6">
                         <div class="form-group">
                            <label><strong>Vehicle:</strong></label>
                            <p>${data.vehicleType || 'N/A'}</p>
                        </div>
                    </div>
                     <div class="col-md-6">
                         <div class="form-group">
                            <label><strong>Shift:</strong></label>
                            <p>${data.preferredShift || 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <hr>
                <h5>Address</h5>
                <p>
                    ${data.address ? `${data.address.street}, ${data.address.city}, ${data.address.state} - ${data.address.pinCode}` : 'No address provided'}
                </p>
             `;

        } else {
            container.innerHTML = '<p class="text-danger text-center">Associate not found.</p>';
        }
    } catch (error) {
        console.error("Error viewing details:", error);
        container.innerHTML = '<p class="text-danger text-center">Error loading details.</p>';
    }
}
