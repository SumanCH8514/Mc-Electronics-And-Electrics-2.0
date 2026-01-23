import { initAdminAuth, db } from './admin-auth.js';
import { collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth
initAdminAuth(fetchProducts);

async function fetchProducts() {
    const tableBody = document.getElementById('productsTableBody');
    if (!tableBody) return;

    try {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
        
        const querySnapshot = await getDocs(collection(db, "products"));
        let html = "";
        
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const pid = doc.id;
            const img = product.image || '../images/p1.png'; 

            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${img}" class="product-img-sm" alt="">
                            <span style="font-weight: 500;">${product.name}</span>
                        </div>
                    </td>
                    <td>₹${product.price}</td>
                    <td>${product.brand}</td>
                    <td>${product.category}</td>
                    <td>
                        <a href="edit-product.html?id=${pid}" class="btn btn-sm btn-info text-white mr-2">
                             <i class="fa fa-pencil"></i>
                        </a>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${pid}')">
                             <i class="fa fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        if (html === "") {
             html = '<tr><td colspan="5" class="text-center">No products found</td></tr>';
        }
        
        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Error fetching products:", error);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading products</td></tr>';
    }
}

// Delete Product (Global)
window.deleteProduct = async (pid) => {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteDoc(doc(db, "products", pid));
            fetchProducts(); // Refresh
            alert("Product deleted.");
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete product.");
        }
    }
}
