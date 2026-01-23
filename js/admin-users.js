import { initAdminAuth, db } from './admin-auth.js';
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Auth
initAdminAuth(fetchUsers);

async function fetchUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    try {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
        
        const querySnapshot = await getDocs(collection(db, "users"));
        let html = "";
        
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const uid = doc.id;
            const photo = user.photoURL || '../images/client1.jpg'; // Default image
            const roleBadge = user.role === 'admin' 
                ? `<span class="role-badge-admin">Admin</span>` 
                : `<span class="role-badge-user">User</span>`;

            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${photo}" class="profile-img-sm" alt="">
                            <span style="font-weight: 500;">${user.displayName || 'No Name'}</span>
                        </div>
                    </td>
                    <td>${user.email || '-'}</td>
                    <td>${roleBadge}</td>
                    <td>${user.phone || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-info text-white mr-2" 
                            onclick="openEditModal('${uid}', '${user.role || 'user'}', '${(user.displayName || '').replace(/'/g, "\\'")}', '${user.email || ''}', '${user.phone || ''}')">
                             <i class="fa fa-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUserDoc('${uid}')">
                             <i class="fa fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        if (html === "") {
             html = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
        }
        
        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Error fetching users:", error);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading users</td></tr>';
    }
}

// Open Edit Modal (Global Scope)
window.openEditModal = (uid, currentRole, name, email, phone) => {
    document.getElementById('editUserId').value = uid;
    document.getElementById('editUserName').value = name;
    document.getElementById('editUserEmail').value = email;
    document.getElementById('editUserPhone').value = phone;
    document.getElementById('editUserRole').value = currentRole;
    $('#editUserModal').modal('show');
};

// Handle Edit Submit
const editForm = document.getElementById('editUserForm');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('editUserId').value;
        const newRole = document.getElementById('editUserRole').value;
        const newName = document.getElementById('editUserName').value;
        const newEmail = document.getElementById('editUserEmail').value;
        const newPhone = document.getElementById('editUserPhone').value;

        const btn = editForm.querySelector('button[type="submit"]');
        
        try {
            btn.disabled = true;
            btn.innerText = "Saving...";
            
            await updateDoc(doc(db, "users", uid), {
                displayName: newName,
                email: newEmail,
                phone: newPhone,
                role: newRole
            });
            
            $('#editUserModal').modal('hide');
            fetchUsers(); // Refresh table
            alert("User details updated successfully!");
            
        } catch (error) {
            console.error("Update error:", error);
            alert("Failed to update role: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Save Changes";
        }
    });
}

// Delete User Document (Global Scope)
window.deleteUserDoc = async (uid) => {
    if (confirm("Are you sure? This will delete the user's profile data (Address, Phone, etc). Note: The login account must still be deleted from the Firebase Console.")) {
        try {
            await deleteDoc(doc(db, "users", uid));
            fetchUsers(); // Refresh
            alert("User profile deleted.");
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete user data.");
        }
    }
}
