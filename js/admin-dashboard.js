import { initAdminAuth, db } from './admin-auth.js';
import { collection, query, orderBy, limit, getDocs, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth & Load Dashboard
initAdminAuth(async (user) => {
    loadStats();
    loadRecentOrders();

    // Hide Page Loader
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
    }
});

async function loadStats() {
    try {
        // Fetch all orders once to calculate everything locally
        // This avoids Index errors with Aggregation queries and multiple network calls
        const ordersColl = collection(db, "orders");
        // We get all docs. For larger scale, we'd use count() and aggregate() with indexes.
        // Given current scale (small), client-side is more robust.
        const ordersSnap = await getDocs(ordersColl);

        const totalOrders = ordersSnap.size;
        document.getElementById('totalOrders').innerText = totalOrders;

        // Calculate Revenue from Delivered Orders
        let totalRevenue = 0;
        ordersSnap.forEach(doc => {
            const data = doc.data();
            const status = (data.status || 'pending').toLowerCase();
            if (status === 'delivered' || status === 'completed') {
                totalRevenue += (Number(data.totalAmount) || 0);
            }
        });
        document.getElementById('totalRevenue').innerText = '₹' + totalRevenue.toLocaleString();

        // Products Count
        try {
            const productsColl = collection(db, "products");
            const productsSnap = await getCountFromServer(productsColl);
            document.getElementById('totalProducts').innerText = productsSnap.data().count;
        } catch (e) {
            console.error("Products count error:", e);
            document.getElementById('totalProducts').innerText = "-";
        }

        // Users Count
        try {
            const usersColl = collection(db, "users");
            const usersSnap = await getCountFromServer(usersColl);
            document.getElementById('totalUsers').innerText = usersSnap.data().count;
        } catch (e) {
            console.error("Users count error:", e);
            document.getElementById('totalUsers').innerText = "-";
        }

    } catch (e) {
        console.error("Error fetching stats:", e);
        // Fallbacks
        document.getElementById('totalOrders').innerText = "0";
        document.getElementById('totalRevenue').innerText = "₹0";
    }
}

async function loadRecentOrders() {
    const tableBody = document.querySelector('.custom-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading orders...</td></tr>';

    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No recent orders found.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-GB') : 'N/A';

            // Format Status Badge (Synced with accounts/orders.html logic)
            let statusClass = 'status-pending';
            const s = (order.status || 'pending').toLowerCase();

            if (s === 'completed' || s === 'delivered') statusClass = 'status-delivered';
            else if (s === 'cancelled') statusClass = 'status-cancelled';
            else if (s === 'shipped') statusClass = 'status-shipped';
            else if (s === 'transit') statusClass = 'status-transit';
            else if (s === 'out-for-delivery') statusClass = 'status-out-for-delivery';
            else if (s === 'accepted') statusClass = 'status-accepted';
            else if (s === 'processing' || s === 'in process') statusClass = 'status-processing';

            // Product Name (First item + others count)
            let productName = order.items && order.items.length > 0 ? order.items[0].name : 'Unknown Product';
            if (order.items && order.items.length > 1) {
                productName += ` + ${order.items.length - 1} others`;
            }

            html += `
                <tr>
                    <td>#${doc.id.substring(0, 8)}...</td>
                    <td>${order.userName || order.userEmail || 'Guest'}</td>
                    <td>${productName}</td>
                    <td>₹${(order.totalAmount || 0).toLocaleString()}</td>
                    <td><span class="order-status ${statusClass}">${order.status || 'Pending'}</span></td>
                    <td>${date}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Error loading recent orders:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading orders: ${error.message}</td></tr>`;
    }
}
