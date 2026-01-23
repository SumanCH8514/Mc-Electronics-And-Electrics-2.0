import { initAdminAuth, db } from './admin-auth.js';
import { collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth (Also exposes db)
initAdminAuth(loadMetadataOptions);

// Load Metadata (Brands & Categories)
async function loadMetadataOptions() {
    try {
        // Load Brands
        const brandSelect = document.getElementById('productBrand');
        if (brandSelect) {
            const docRef = doc(db, "metadata", "brands");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const list = docSnap.data().list || [];
                list.sort();
                let html = '<option value="">Select Brand</option>';
                list.forEach(item => html += `<option value="${item}">${item}</option>`);
                html += '<option value="Other">Other</option>';
                brandSelect.innerHTML = html;
            }
        }

        // Load Categories
        const categorySelect = document.getElementById('productCategory');
        if (categorySelect) {
             const docRef = doc(db, "metadata", "categories");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const list = docSnap.data().list || [];
                list.sort();
                let html = '<option value="">Select Category</option>';
                list.forEach(item => html += `<option value="${item}">${item}</option>`);
                categorySelect.innerHTML = html;
            }
        }

    } catch (error) {
        console.error("Error loading metadata options:", error);
    }
}
// Image Preview
const imageInput = document.getElementById('productImage');
const imagePreview = document.getElementById('imagePreview');
let base64Image = "";

if (imageInput) {
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
             // Size check (Max 550KB for Firestore Base64)
            if (file.size > 550 * 1024) {
                alert("File too large! Please upload an image under 550KB.");
                this.value = ""; // Clear input
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                base64Image = e.target.result;
                imagePreview.innerHTML = `<img src="${base64Image}" alt="Preview">`;
            }
            reader.readAsDataURL(file);
        }
    });
}

// Add Product Form Submit
const addProductForm = document.getElementById('addProductForm');
if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Note: initAdminAuth already checks login status, but the submit button might be clicked 
        // before redirect if the network is very slow (unlikely). 
        // We can trust the user is valid if they are on this page.
        
        const submitBtn = addProductForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = "Adding...";

        try {
            const name = document.getElementById('productName').value;
            const brand = document.getElementById('productBrand').value;
            const category = document.getElementById('productCategory').value;
            const price = parseFloat(document.getElementById('productPrice').value);
            const mrp = parseFloat(document.getElementById('productMrp').value) || price; // Default to price if empty
            const desc = document.getElementById('productDesc').value;

            // Simple Search Keywords Generation
            // e.g. "Samsung S24" -> ["Samsung", "S24"] (lowercase)
            const searchKeywords = [
                ...name.toLowerCase().split(' '),
                brand.toLowerCase(),
                category.toLowerCase()
            ].filter(k => k.length > 2); // Filter short words

            const productData = {
                name: name,
                brand: brand,
                category: category,
                price: price,
                mrp: mrp,
                description: desc,
                image: base64Image || null, // Store Base64 directly
                searchKeywords: searchKeywords,
                createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, "products"), productData);
            console.log("Product added with ID: ", docRef.id);
            
            alert("Product Added Successfully!");
            addProductForm.reset();
            imagePreview.innerHTML = '<small class="text-muted">No Image</small>';
            base64Image = "";

        } catch (error) {
            console.error("Error adding product: ", error);
            alert("Error adding product: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    });
}
