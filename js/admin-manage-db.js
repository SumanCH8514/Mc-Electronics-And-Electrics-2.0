import { initAdminAuth, db } from './admin-auth.js';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let allOrders = [];

initAdminAuth(async (user) => {
    setupEventListeners();
    loadOrders();
    loadImages();
});

async function loadOrders() {
    const tableBody = document.getElementById('dbOrdersTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading orders...</td></tr>';

    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        allOrders = [];
        snapshot.forEach(doc => {
            allOrders.push({ id: doc.id, ...doc.data() });
        });

        renderOrders(allOrders);
        currentFilteredOrders = allOrders;
        // setupSearch() removed from here to separate setup function

    } catch (e) {
        console.error("Error loading orders:", e);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${e.message}</td></tr>`;
    }
}

// Logic to filter orders for search
let currentFilteredOrders = [];

function renderOrders(orders, targetId = 'dbOrdersTableBody', limit = 5) {
    const tableBody = document.getElementById(targetId);
    if (!tableBody) return;

    // If we are rendering the main list (limit applied), update the "View More" button visibility
    if (limit && targetId === 'dbOrdersTableBody') {
        const btn = document.getElementById('viewMoreOrdersBtn');
        if (btn) {
            if (orders.length > limit) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    }

    // Apply Limit
    const displayOrders = limit ? orders.slice(0, limit) : orders;

    if (displayOrders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No orders found.</td></tr>';
        return;
    }

    let html = '';
    displayOrders.forEach(order => {
        const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

        html += `
            <tr>
                <td><small>#${order.id.slice(0, 8)}...</small></td>
                <td>
                    ${order.userName || 'Guest'}<br>
                    <small class="text-muted">${order.userEmail || ''}</small>
                </td>
                <td>₹${(order.totalAmount || 0).toLocaleString()}</td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${order.id}">
                        <i class="fa fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Attach Click Events (scoped)
    tableBody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orderId = e.target.closest('.delete-btn').dataset.id;
            deleteOrder(orderId);
        });
    });
}

// Global Event Listeners Setup
function setupEventListeners() {
    // 1. Order Search
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            const term = e.target.value.toLowerCase();
            currentFilteredOrders = allOrders.filter(order =>
                order.id.toLowerCase().includes(term) ||
                (order.userName && order.userName.toLowerCase().includes(term)) ||
                (order.userEmail && order.userEmail.toLowerCase().includes(term))
            );
            renderOrders(currentFilteredOrders);
        });
    }

    // 2. View More Orders
    const viewMoreOrdersBtn = document.getElementById('viewMoreOrdersBtn');
    if (viewMoreOrdersBtn) {
        viewMoreOrdersBtn.addEventListener('click', () => {
            // Use currentFilteredOrders if search represents that, or just allOrders if not searching? 
            // Best to use currentFilteredOrders as it tracks the current view's dataset.
            renderOrders(currentFilteredOrders, 'modalOrdersTableBody', null);
            $('#allOrdersModal').modal('show');
        });
    }

    // 3. Image Filter
    const imageFilter = document.getElementById('imageFilter');
    if (imageFilter) {
        imageFilter.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'all') {
                currentFilteredImages = allImages;
            } else {
                currentFilteredImages = allImages.filter(img => img.type === type);
            }
            renderImages(currentFilteredImages);
        });
    }

    // 4. View More Images
    const viewMoreImagesBtn = document.getElementById('viewMoreImagesBtn');
    if (viewMoreImagesBtn) {
        viewMoreImagesBtn.addEventListener('click', () => {
            renderImages(currentFilteredImages, 'modalImagesGrid', null);
            $('#allImagesModal').modal('show');
        });
    }
}

async function deleteOrder(orderId) {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE order #${orderId}? This cannot be undone.`)) return;

    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        alert("Order not found in local data. Please reload.");
        return;
    }

    try {
        // 1. Delete from Root 'orders' collection
        await deleteDoc(doc(db, 'orders', orderId));

        // 2. Delete from User Subcollection if path exists
        if (order.originalOrderPath) {
            await deleteDoc(doc(db, order.originalOrderPath));
        } else if (order.userId) {
            // Attempt callback logic if path is missing
            try {
                await deleteDoc(doc(db, 'users', order.userId, 'orders', orderId));
            } catch (err) {
                console.warn("Could not delete from user subcollection (might not exist):", err);
            }
        }

        alert("Order deleted successfully.");
        loadOrders(); // Reload list

    } catch (e) {
        console.error("Error deleting order:", e);
        alert("Error deleting order: " + e.message);
    }
}

// Manage Pictures Logic
let allImages = []; // Global for filtering

async function loadImages() {
    const grid = document.getElementById('imagesGrid');
    const loader = document.getElementById('loadingImages');

    grid.innerHTML = '';
    loader.style.display = 'block';

    try {
        const images = [];

        // 1. Fetch Product Images
        const productsRef = collection(db, 'products');
        const productsSnap = await getDocs(productsRef);
        productsSnap.forEach(doc => {
            const data = doc.data();
            if (data.image) {
                images.push({
                    type: 'product',
                    id: doc.id,
                    name: data.name,
                    src: data.image,
                    date: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A'
                });
            }
        });

        // 2. Fetch Payment Proofs (from Root Orders)
        const ordersRef = collection(db, 'orders');
        const ordersSnap = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));
        ordersSnap.forEach(doc => {
            const data = doc.data();
            if (data.paymentProof) {
                images.push({
                    type: 'proof',
                    id: doc.id,
                    name: `Order #${doc.id.substring(0, 8)}`, // Display ID
                    src: data.paymentProof,
                    date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
                    originalOrderPath: data.originalOrderPath // Needed for deep delete
                });
            }
        });

        allImages = images; // Store globally
        currentFilteredImages = images;

        renderImages(allImages);

    } catch (e) {
        console.error("Error loading images:", e);
        grid.innerHTML = `<div class="col-12 text-center text-danger">Error loading images: ${e.message}</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

let currentFilteredImages = [];

function renderImages(images, targetId = 'imagesGrid', limit = 5) {
    const grid = document.getElementById(targetId);

    // Manage Button Visibility (only if rendering to main grid)
    if (limit && targetId === 'imagesGrid') {
        const btn = document.getElementById('viewMoreImagesBtn');
        if (images.length > limit) {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    }

    const displayImages = limit ? images.slice(0, limit) : images;

    if (displayImages.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center text-muted"><p>No images found matching filter.</p></div>`;
        return;
    }

    let html = '';
    displayImages.forEach(img => {
        const badgeColor = img.type === 'product' ? 'primary' : 'success';
        const badgeText = img.type === 'product' ? 'Product' : 'Pay Proof';

        const name = img.name.length > 20 ? img.name.substring(0, 20) + '...' : img.name;

        html += `
            <div class="col-xl-3 col-lg-3 col-md-3 col-sm-6 col-12 mb-4">
                <div class="card shadow-sm h-100">
                    <div style="height: 150px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
                        <img src="${img.src}" style="max-height: 100%; max-width: 100%; object-fit: contain;" alt="${img.type}">
                    </div>
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge badge-${badgeColor}">${badgeText}</span>
                            <small class="text-muted">${img.date}</small>
                        </div>
                        <h6 class="card-title mb-2 text-truncate" title="${img.name}">${name}</h6>
                        <div class="d-flex justify-content-between mt-3">
                            <a href="${img.src}" download="${img.type}_${img.id}.jpg" class="btn btn-sm btn-outline-secondary" title="Download">
                                <i class="fa fa-download"></i>
                            </a>
                            <button class="btn btn-sm btn-outline-danger delete-img-btn" 
                                data-type="${img.type}" 
                                data-id="${img.id}" 
                                data-path="${img.originalOrderPath || ''}">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;

    // Attach Events (scoped)
    grid.querySelectorAll('.delete-img-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('.delete-img-btn');
            deleteImage(
                btnEl.dataset.type,
                btnEl.dataset.id,
                btnEl.dataset.path // For orders
            );
        });
    });
}

async function deleteImage(type, id, originalPath) {
    if (!confirm("Are you sure you want to delete this image? \nThis will remove it from the product/order record.")) return;

    try {
        if (type === 'product') {
            const docRef = doc(db, 'products', id);
            await updateDoc(docRef, {
                image: deleteField()
            });
        } else if (type === 'proof') {
            // Delete from Root
            const rootRef = doc(db, 'orders', id);
            await updateDoc(rootRef, {
                paymentProof: deleteField(),
                paymentStatus: 'Pending'
            });

            // Delete from Original Path (User subcollection)
            if (originalPath) {
                const userOrderRef = doc(db, originalPath);
                await updateDoc(userOrderRef, {
                    paymentProof: deleteField()
                });
            }
        }

        alert("Image deleted successfully.");
        loadImages(); // Reload

    } catch (e) {
        console.error("Error deleting image:", e);
        alert("Error: " + e.message);
    }
}
