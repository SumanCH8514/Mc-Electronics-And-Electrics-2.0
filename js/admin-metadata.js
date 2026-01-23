import { initAdminAuth, db } from './admin-auth.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth
initAdminAuth(loadAllMetadata);

async function loadAllMetadata() {
    await loadMetadata('brands', 'brandsList');
    await loadMetadata('categories', 'categoriesList');
}

async function loadMetadata(docId, listElementId) {
    const listEl = document.getElementById(listElementId);
    if (!listEl) return;

    try {
        const docRef = doc(db, "metadata", docId);
        const docSnap = await getDoc(docRef);

        let items = [];
        if (docSnap.exists()) {
            items = docSnap.data().list || [];
        } else {
            // Create doc if empty
            await setDoc(docRef, { list: [] });
        }

        renderList(items, listElementId, docId);

    } catch (error) {
        console.error(`Error loading ${docId}:`, error);
        listEl.innerHTML = `<li class="text-danger">Error loading data</li>`;
    }
}

function renderList(items, listElementId, docId) {
    const listEl = document.getElementById(listElementId);
    items.sort(); // Alphabetical
    
    let html = "";
    items.forEach(item => {
        // Escape quotes for onclick params
        const safeItem = item.replace(/'/g, "\\'");
        html += `
            <li>
                <span>${item}</span>
                <span class="btn-delete" onclick="removeItem('${docId}', '${safeItem}')">
                    <i class="fa fa-trash"></i>
                </span>
            </li>
        `;
    });

    if (items.length === 0) {
        html = '<li class="text-muted text-center">No items found</li>';
    }

    listEl.innerHTML = html;
}

// Add Item (Global)
window.addItem = async (docId, inputId) => {
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    if (!value) return;

    try {
        const docRef = doc(db, "metadata", docId);
        await updateDoc(docRef, {
            list: arrayUnion(value)
        });
        
        input.value = "";
        loadMetadata(docId, docId === 'brands' ? 'brandsList' : 'categoriesList');
        
    } catch (error) {
        console.error("Add error:", error);
        alert("Failed to add item. Ensure database permissions.");
    }
}

// Remove Item (Global)
window.removeItem = async (docId, value) => {
    if (!confirm(`Delete "${value}"?`)) return;

    try {
        const docRef = doc(db, "metadata", docId);
        await updateDoc(docRef, {
            list: arrayRemove(value)
        });
        
        loadMetadata(docId, docId === 'brands' ? 'brandsList' : 'categoriesList');
        
    } catch (error) {
        console.error("Remove error:", error);
        alert("Failed to delete item.");
    }
}

// Expose wrappers for HTML buttons
window.addBrand = () => window.addItem('brands', 'newBrandInput');
window.addCategory = () => window.addItem('categories', 'newCategoryInput');
