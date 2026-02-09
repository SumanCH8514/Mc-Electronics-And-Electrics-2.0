import { auth, db } from './associate-auth.js';
import { doc, getDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
let selectedProfilePic = null;

// Initialize profile management
$(document).ready(function () {
    setupProfileHandlers();
});

function setupProfileHandlers() {
    // Load profile when modal is shown
    $('#profileModal').on('show.bs.modal', async function () {
        await loadProfileData();
    });

    // Handle profile picture selection
    $('#profilePicInput').on('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Image size should be less than 5MB');
                return;
            }

            selectedProfilePic = file;

            // Preview image
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#profilePicPreview').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle save button
    $('#saveProfileBtn').on('click', async function () {
        await saveProfile();
    });

    // Mobile number validation
    $('#profileMobile, #emergencyPhone').on('input', function () {
        this.value = this.value.replace(/\D/g, '').substring(0, 10);
    });

    // PIN code validation
    $('#profilePinCode').on('input', function () {
        this.value = this.value.replace(/\D/g, '').substring(0, 6);
    });
}

async function loadProfileData() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const data = userDoc.data();

        // Personal Info
        $('#profileName').val(data.name || '');
        $('#profileEmail').val(user.email || '');
        $('#profileMobile').val(data.mobile || '');

        if (data.dateOfBirth) {
            const dob = data.dateOfBirth.toDate ? data.dateOfBirth.toDate() : new Date(data.dateOfBirth);
            $('#profileDOB').val(dob.toISOString().split('T')[0]);
        }

        $('#profileGender').val(data.gender || '');

        // Profile Picture
        if (data.profilePicture) {
            $('#profilePicPreview').attr('src', data.profilePicture);
        }

        // Employment Details
        if (data.employmentType) {
            $(`input[name="employmentType"][value="${data.employmentType}"]`).prop('checked', true);
        }

        $('#profileAvailability').val(data.availability || '');
        $('#profileShift').val(data.preferredShift || '');
        $('#profileVehicle').val(data.vehicleType || '');

        if (data.joiningDate) {
            const joining = data.joiningDate.toDate ? data.joiningDate.toDate() : new Date(data.joiningDate);
            $('#profileJoiningDate').val(joining.toLocaleDateString('en-IN'));
        }

        // Address
        if (data.address) {
            $('#profileStreet').val(data.address.street || '');
            $('#profileCity').val(data.address.city || '');
            $('#profileState').val(data.address.state || '');
            $('#profilePinCode').val(data.address.pinCode || '');
        }

        // Emergency Contact
        if (data.emergencyContact) {
            $('#emergencyName').val(data.emergencyContact.name || '');
            $('#emergencyPhone').val(data.emergencyContact.phone || '');
            $('#emergencyRelation').val(data.emergencyContact.relationship || '');
        }

    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error loading profile data');
    }
}

async function saveProfile() {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert('Not authenticated');
            return;
        }

        // Validate required fields
        const name = $('#profileName').val().trim();
        const mobile = $('#profileMobile').val().trim();
        const employmentType = $('input[name="employmentType"]:checked').val();

        if (!name) {
            alert('Please enter your name');
            $('#personal-tab').tab('show');
            $('#profileName').focus();
            return;
        }

        if (!mobile || mobile.length !== 10) {
            alert('Please enter a valid 10-digit mobile number');
            $('#personal-tab').tab('show');
            $('#profileMobile').focus();
            return;
        }

        if (!employmentType) {
            alert('Please select employment type');
            $('#employment-tab').tab('show');
            return;
        }

        // Validate PIN code if provided
        const pinCode = $('#profilePinCode').val().trim();
        if (pinCode && pinCode.length !== 6) {
            alert('PIN code must be 6 digits');
            $('#address-tab').tab('show');
            $('#profilePinCode').focus();
            return;
        }

        // Validate emergency phone if provided
        const emergencyPhone = $('#emergencyPhone').val().trim();
        if (emergencyPhone && emergencyPhone.length !== 10) {
            alert('Emergency contact number must be 10 digits');
            $('#address-tab').tab('show');
            $('#emergencyPhone').focus();
            return;
        }

        // Disable save button
        const saveBtn = $('#saveProfileBtn');
        saveBtn.prop('disabled', true);
        saveBtn.html('<i class="fa fa-spinner fa-spin"></i> Saving...');

        // Prepare profile data
        const profileData = {
            name: name,
            mobile: mobile,
            gender: $('#profileGender').val() || null,
            employmentType: employmentType,
            availability: $('#profileAvailability').val() || null,
            preferredShift: $('#profileShift').val() || null,
            vehicleType: $('#profileVehicle').val() || null,
            address: {
                street: $('#profileStreet').val().trim() || null,
                city: $('#profileCity').val().trim() || null,
                state: $('#profileState').val().trim() || null,
                pinCode: pinCode || null
            },
            emergencyContact: {
                name: $('#emergencyName').val().trim() || null,
                phone: emergencyPhone || null,
                relationship: $('#emergencyRelation').val().trim() || null
            }
        };

        // Handle date of birth
        const dob = $('#profileDOB').val();
        if (dob) {
            profileData.dateOfBirth = Timestamp.fromDate(new Date(dob));
        }

        // Set joining date if not already set
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && !userDoc.data().joiningDate) {
            profileData.joiningDate = Timestamp.now();
        }

        // Upload profile picture if selected
        if (selectedProfilePic) {
            try {
                const storageRef = ref(storage, `profile-pictures/${user.uid}/${Date.now()}_${selectedProfilePic.name}`);
                await uploadBytes(storageRef, selectedProfilePic);
                const downloadURL = await getDownloadURL(storageRef);
                profileData.profilePicture = downloadURL;

                // Update topbar image immediately
                $('#associateImg').attr('src', downloadURL);
            } catch (uploadError) {
                console.error('Error uploading profile picture:', uploadError);
                alert('Profile saved but image upload failed. Please try again.');
            }
        }

        // Save to Firestore
        await updateDoc(doc(db, 'users', user.uid), profileData);

        // Update topbar name
        $('#associateName').text(name);

        // Reset selected image
        selectedProfilePic = null;

        // Close modal
        $('#profileModal').modal('hide');

        // Show success message
        alert('Profile updated successfully!');

    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile: ' + error.message);
    } finally {
        // Re-enable save button
        const saveBtn = $('#saveProfileBtn');
        saveBtn.prop('disabled', false);
        saveBtn.html('<i class="fa fa-save"></i> Save Changes');
    }
}

// Export for use in other modules if needed
export { loadProfileData };
