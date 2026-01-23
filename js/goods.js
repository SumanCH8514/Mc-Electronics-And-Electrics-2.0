import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBunseGlJg3XiyXzKiepjyilYZ8n5Cl0lE",
  authDomain: "mc-electronics.firebaseapp.com",
  projectId: "mc-electronics",
  storageBucket: "mc-electronics.firebasestorage.app",
  messagingSenderId: "1021368016185",
  appId: "1:1021368016185:web:2e0dfa85d55a4c92af9ce8",
  measurementId: "G-LGB225ZZXM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allProducts = [];
let activeCategory = "all";

// Element References
const productsGrid = document.getElementById('productsGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const brandFilters = document.querySelectorAll('.brand-filter');
const searchBtn = document.getElementById('searchBtn');
const categoryTabs = document.getElementById('categoryTabs');

// Render Category Tabs
async function renderCategoryTabs() {
    if (!categoryTabs) return;
    
    let categories = [];
    
    // 1. Try fetching from Metadata
    try {
        const docRef = doc(db, "metadata", "categories");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            categories = docSnap.data().list || [];
        }
    } catch (error) {
        console.warn("Metadata fetch failed (likely permissions), falling back to product data:", error);
    }
    
    // 2. Fallback: Extract from products if metadata failed or empty
    if (categories.length === 0 && allProducts.length > 0) {
        categories = [...new Set(allProducts.map(p => p.category).filter(c => c))];
    }
    
    categories.sort();

    // 3. Render
    if (categories.length > 0) {
        let html = `<div class="cat-tab active" data-category="all" onclick="selectCategory('all', this)">All Products</div>`;
        categories.forEach(cat => {
            html += `<div class="cat-tab" data-category="${cat}" onclick="selectCategory('${cat}', this)">${cat}</div>`;
        });
        categoryTabs.innerHTML = html;
    } else {
        // Still loading or actually empty? Check if products loaded
        if (allProducts.length === 0) {
             categoryTabs.innerHTML = `<div class="cat-tab">Loading...</div>`;
        } else {
             categoryTabs.innerHTML = `<div class="cat-tab active" data-category="all">All Products</div>`;
        }
    }
}

// Select Category (Global)
window.selectCategory = (cat, tabElement) => {
    activeCategory = cat;
    
    // UI Update
    document.querySelectorAll('.cat-tab').forEach(el => el.classList.remove('active'));
    tabElement.classList.add('active');
    
    applyFilters();
}

// Render Brand Filters
async function renderBrandFilters() {
    const brandFiltersContainer = document.getElementById('brandFilters');
    if (!brandFiltersContainer) return;

    let brands = [];

    // 1. Try fetching from Metadata
    try {
        const docRef = doc(db, "metadata", "brands");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            brands = docSnap.data().list || [];
        }
    } catch (error) {
        console.warn("Brand metadata fetch failed, falling back:", error);
    }
    
    // 2. Fallback: Extract from loaded products
    if (brands.length === 0 && allProducts.length > 0) {
        brands = [...new Set(allProducts.map(p => p.brand).filter(b => b))];
    }

    brands.sort();

    if (brands.length === 0) {
         if (allProducts.length === 0) {
             brandFiltersContainer.innerHTML = '<p class="text-muted"><small>Loading...</small></p>';
         } else {
             brandFiltersContainer.innerHTML = '<p class="text-muted"><small>No brands found</small></p>';
         }
         return;
    }

    brandFiltersContainer.innerHTML = brands.map(brand => `
        <div class="custom-control custom-checkbox">
            <input type="checkbox" class="custom-control-input brand-filter" id="brand${brand.replace(/\s+/g, '')}" value="${brand}">
            <label class="custom-control-label" for="brand${brand.replace(/\s+/g, '')}">${brand}</label>
        </div>
    `).join('');

    // Re-attach event listeners
    document.querySelectorAll('.brand-filter').forEach(cb => {
        cb.addEventListener('change', applyFilters);
    });
}


// Fetch Products
async function fetchProducts() {
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allProducts = [];
        querySnapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });

        renderBrandFilters(); // Re-run to use fallback if needed
        renderCategoryTabs(); // Re-run to use fallback if needed
        renderProducts(allProducts);

    } catch (error) {
        console.error("Error fetching products:", error);
        productsGrid.innerHTML = `<div class="col-12 text-center text-danger">Failed to load products.</div>`;
    }
}


// Render Products
function renderProducts(products) {
    if (products.length === 0) {
        productsGrid.innerHTML = `<div class="col-12 text-center"><h4>No products found.</h4></div>`;
        return;
    }

    productsGrid.innerHTML = products.map(product => `
        <div class="col-md-4 col-sm-6">
            <div class="product-card">
                <div class="product-img-box">
                    <img src="${product.image || 'images/no-image.png'}" alt="${product.name}">
                </div>
                <div class="product-detail-box">
                    <div class="product-brand">${product.brand || 'Generic'}</div>
                    <div class="product-name" title="${product.name}">${product.name}</div>
                    
                    <div>
                        <span class="product-price">₹${product.price ? product.price.toLocaleString() : 'N/A'}</span>
                        ${product.mrp && product.mrp > product.price ? `<span class="product-mrp">₹${product.mrp.toLocaleString()}</span>` : ''}
                    </div>

                    <p style="font-size: 13px; color: #777; margin-top: 5px; height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${product.description || ''}
                    </p>

                    <button class="btn-add-cart" onclick="alert('Added to Cart (Demo)')">
                        <i class="fa fa-shopping-cart"></i> Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filtering & Sorting Logic
function applyFilters() {
    let filtered = [...allProducts];

    // 0. Active Category Filter
    if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
    }

    // 1. Search (Name/Brand/Desc)
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            p.brand.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }

    // 2. Brand Filter
    const brandCheckboxes = document.querySelectorAll('.brand-filter');
    const selectedBrands = Array.from(brandCheckboxes)
                                .filter(cb => cb.checked)
                                .map(cb => cb.value.toLowerCase());
    
    if (selectedBrands.length > 0) {
        filtered = filtered.filter(p => selectedBrands.includes(p.brand.toLowerCase()));
    }

    // 3. Sorting
    const sortValue = sortSelect.value;
    if (sortValue === 'price_asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortValue === 'price_desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortValue === 'newest') {
        // Already sorted by query, but good to have safety
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    renderProducts(filtered);
}

// Event Listeners
if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
    searchBtn.addEventListener('click', applyFilters);
}

if (sortSelect) {
    sortSelect.addEventListener('change', applyFilters);
}

brandFilters.forEach(cb => {
    cb.addEventListener('change', applyFilters);
});

// Initialize
renderCategoryTabs();
renderBrandFilters();
fetchProducts();
