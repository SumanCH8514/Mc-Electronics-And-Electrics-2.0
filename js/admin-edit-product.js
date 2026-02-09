import { initAdminAuth, db } from './admin-auth.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth
initAdminAuth(initPage);

let currentImage = "";
let base64Image = "";

async function initPage() {
    await loadMetadataOptions();
    await loadProductData();
}

// 1. Load Brands/Categories (Reuse logic, slightly adapted)
async function loadMetadataOptions() {
    try {
        const brandSelect = document.getElementById('productBrand');
        const categorySelect = document.getElementById('productCategory');

        // Brands
        const bDoc = await getDoc(doc(db, "metadata", "brands"));
        if (bDoc.exists()) {
            const list = bDoc.data().list || [];
            list.sort();
            let html = '<option value="">Select Brand</option>';
            list.forEach(item => html += `<option value="${item}">${item}</option>`);
            html += '<option value="Other">Other</option>';
            brandSelect.innerHTML = html;
        }

        // Categories
        const cDoc = await getDoc(doc(db, "metadata", "categories"));
        if (cDoc.exists()) {
            const list = cDoc.data().list || [];
            list.sort();
            let html = '<option value="">Select Category</option>';
            list.forEach(item => html += `<option value="${item}">${item}</option>`);
            categorySelect.innerHTML = html;
        }
    } catch (error) {
        console.error("Error loading options:", error);
    }
}

// 2. Load Product
async function loadProductData() {
    const urlParams = new URLSearchParams(window.location.search);
    const pid = urlParams.get('id');
    
    if (!pid) {
        alert("No product ID provided!");
        window.location.href = "manage-products.html";
        return;
    }
    
    document.getElementById('editProductId').value = pid;

    try {
        const docRef = doc(db, "products", pid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const p = docSnap.data();
            
            document.getElementById('productName').value = p.name;
            document.getElementById('productBrand').value = p.brand;
            document.getElementById('productCategory').value = p.category;
            document.getElementById('productPrice').value = p.price;
            document.getElementById('productMrp').value = p.mrp || p.price;
            document.getElementById('productDesc').value = p.description;
            
            // Populate Highlights
            if (p.highlights && Array.isArray(p.highlights)) {
                document.getElementById('productHighlights').value = p.highlights.join('\n');
            } else {
                document.getElementById('productHighlights').value = "";
            }

            // Populate Warranty (Extract number)
            // e.g. "2 Year Manufacturer Warranty" -> 2
            // "No Warranty" -> 0
            // Simple parseInt works for "2 Year..." but returns NaN for "No Warranty"
            document.getElementById('productWarranty').value = parseInt(p.warranty) || 0;

            currentImage = p.image;
            if (currentImage) {
                document.getElementById('imagePreview').innerHTML = `<img src="${currentImage}" alt="Preview">`;
            } else {
                 document.getElementById('imagePreview').innerHTML = '<small class="text-muted">No Image</small>';
            }

        } else {
            alert("Product not found!");
            window.location.href = "manage-products.html";
        }
    } catch (error) {
        console.error("Error loading product:", error);
    }
}

// 3. Image Handle
const imageInput = document.getElementById('productImage');
if (imageInput) {
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 550 * 1024) {
                alert("File too large! < 550KB required.");
                this.value = ""; 
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                base64Image = e.target.result;
                document.getElementById('imagePreview').innerHTML = `<img src="${base64Image}" alt="Preview">`;
            }
            reader.readAsDataURL(file);
        }
    });
}

// 4. Update
const form = document.getElementById('editProductForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Saving...";

        try {
            const pid = document.getElementById('editProductId').value;
            const name = document.getElementById('productName').value;
            const brand = document.getElementById('productBrand').value;
            const category = document.getElementById('productCategory').value;
            const price = parseFloat(document.getElementById('productPrice').value);
            const mrp = parseFloat(document.getElementById('productMrp').value) || price;
            const desc = document.getElementById('productDesc').value;
            
            // Process Highlights
            const highlightsRaw = document.getElementById('productHighlights').value;
            const highlights = highlightsRaw.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            // Process Warranty
            const warrantyYears = parseInt(document.getElementById('productWarranty').value) || 0;
            let warrantyStr = "No Warranty";
            if (warrantyYears > 0) {
                warrantyStr = `${warrantyYears} Year Manufacturer Warranty`;
            }

            // Generate Keywords
            const searchKeywords = [
                ...name.toLowerCase().split(' '),
                brand.toLowerCase(),
                category.toLowerCase()
            ].filter(k => k.length > 2);

            await updateDoc(doc(db, "products", pid), {
                name: name,
                brand: brand,
                category: category,
                price: price,
                mrp: mrp,
                description: desc,
                highlights: highlights,
                warranty: warrantyStr,
                image: base64Image || currentImage,
                searchKeywords: searchKeywords,
                updatedAt: new Date().toISOString()
            });

            alert("Product updated successfully!");
            window.location.href = "manage-products.html";

        } catch (error) {
            console.error("Update error:", error);
            alert("Error updating product: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}
