import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let addressesUnsub = null;

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadAddresses(user.uid);
    } else {
        window.location.href = "../login.html";
    }
});

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = "../login.html");
    });
}

// Load Addresses
function loadAddresses(uid) {
    const listEl = document.getElementById('addressesList');
    const q = query(collection(db, 'users', uid, 'addresses'), orderBy('createdAt', 'desc'));
    
    addressesUnsub = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `
                <div class="text-center p-5 text-muted" style="background:#f9f9f9; border-radius:8px;">
                    <i class="fa fa-map-marker fa-3x mb-3" style="color:#ddd;"></i>
                    <p>No addresses found. Add one now!</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const addr = doc.data();
            html += `
                <div class="address-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="badge-type mb-2 d-inline-block">${addr.type}</span>
                            <h5>${addr.name} &nbsp;<span class="text-muted" style="font-size:0.9rem;">${addr.phone}</span></h5>
                            <p class="mb-1 text-muted">
                                ${addr.line1}, ${addr.line2}
                            </p>
                            <p class="mb-0 text-muted">
                                ${addr.city}, ${addr.state} - <strong>${addr.pincode}</strong>
                            </p>
                        </div>
                        <div style="position: relative;">
                            <button class="btn btn-link text-muted p-0" onclick="window.toggleAddrOptions('${doc.id}')" style="font-size: 1.2rem;">
                                <i class="fa fa-ellipsis-v"></i>
                            </button>
                            <div id="addr-options-${doc.id}" style="display: none; position: absolute; right: 0; top: 100%; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 6px; z-index: 100; min-width: 140px; overflow: hidden; border: 1px solid #eee;">
                                <div class="edit-btn p-2 pl-3" data-id="${doc.id}" style="cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                                    <i class="fa fa-pencil text-info mr-2"></i> Edit
                                </div>
                                <div class="delete-btn p-2 pl-3" data-id="${doc.id}" style="cursor: pointer; font-size: 0.9rem; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                                    <i class="fa fa-trash text-danger mr-2"></i> Delete
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
        
        // Bind Events
        document.querySelectorAll('.edit-btn').forEach(btn => 
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openEditModal(e.target.dataset.id, snapshot);
            })
        );
        document.querySelectorAll('.delete-btn').forEach(btn => 
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                deleteAddress(e.target.dataset.id);
            })
        );
    });
}

// Global functions for HTML access
window.openAddressModal = function() {
    document.getElementById('addressForm').reset();
    document.getElementById('editAddressId').value = '';
    document.getElementById('modalTitle').innerText = 'Add New Address';
    $('#addressModal').modal('show');
}

function openEditModal(id, snapshot) {
    const docSnap = snapshot.docs.find(d => d.id === id);
    if (!docSnap) return;
    
    const data = docSnap.data();
    document.getElementById('editAddressId').value = id;
    document.getElementById('modalTitle').innerText = 'Edit Address';
    
    document.getElementById('addrName').value = data.name;
    document.getElementById('addrPhone').value = data.phone;
    document.getElementById('addrLine1').value = data.line1;
    document.getElementById('addrLine2').value = data.line2;
    document.getElementById('addrCity').value = data.city;
    document.getElementById('addrState').value = data.state;
    document.getElementById('addrPincode').value = data.pincode;
    
    if (data.type === 'Work') document.getElementById('typeWork').checked = true;
    else document.getElementById('typeHome').checked = true;
    
    $('#addressModal').modal('show');
}

// Form Submit
document.getElementById('addressForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Saving...';
    
    try {
        const id = document.getElementById('editAddressId').value;
        const data = {
            name: document.getElementById('addrName').value,
            phone: document.getElementById('addrPhone').value,
            line1: document.getElementById('addrLine1').value,
            line2: document.getElementById('addrLine2').value,
            city: document.getElementById('addrCity').value,
            state: document.getElementById('addrState').value,
            pincode: document.getElementById('addrPincode').value,
            type: document.querySelector('input[name="addrType"]:checked').value,
            updatedAt: new Date()
        };
        
        if (id) {
            // Update
             await updateDoc(doc(db, 'users', currentUser.uid, 'addresses', id), data);
        } else {
            // Create
            data.createdAt = new Date();
            await addDoc(collection(db, 'users', currentUser.uid, 'addresses'), data);
        }
        
        $('#addressModal').modal('hide');
        
    } catch (e) {
        console.error(e);
        alert("Error saving address: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

async function deleteAddress(id) {
    if(!confirm("Delete this address?")) return;
    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'addresses', id));
    } catch (e) {
        console.error(e);
        alert("Error deleting: " + e.message);
    }
}

// Toggle Options
window.toggleAddrOptions = function(id) {
    // Prevent immediate close from document click
    event.stopPropagation();
    
    const el = document.getElementById('addr-options-' + id);
    if(el) {
        const isVisible = el.style.display === 'block';
        // Hide all
        document.querySelectorAll('[id^="addr-options-"]').forEach(div => div.style.display = 'none');
        // Toggle
        if(!isVisible) el.style.display = 'block';
    }
}

// Close options when clicking outside
document.addEventListener('click', function(e) {
    document.querySelectorAll('[id^="addr-options-"]').forEach(div => div.style.display = 'none');
});
