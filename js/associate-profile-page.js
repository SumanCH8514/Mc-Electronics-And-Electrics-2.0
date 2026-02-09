import { auth, db, initAssociateAuth } from './associate-auth.js';
import { doc, getDoc, updateDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let selectedProfilePic = null;

// Initialize authentication and load profile when ready
initAssociateAuth(function (user) {
    loadProfileData();
    setupHandlers();
});

function setupHandlers() {
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

        // Try to get data from associates collection first
        let associateDoc = await getDoc(doc(db, 'associates', user.uid));
        let data = null;

        if (associateDoc.exists()) {
            // Associate data exists
            data = associateDoc.data();
        } else {
            // Migration: Check users collection and copy to associates
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();

                // Create associate document from user data
                data = {
                    uid: user.uid,
                    name: userData.name || '',
                    email: user.email || '',
                    profilePicture: userData.profilePicture || null,
                    mobile: userData.mobile || '',
                    dateOfBirth: userData.dateOfBirth || null,
                    gender: userData.gender || '',
                    employmentType: userData.employmentType || '',
                    availability: userData.availability || '',
                    preferredShift: userData.preferredShift || '',
                    vehicleType: userData.vehicleType || '',
                    joiningDate: userData.joiningDate || Timestamp.now(),
                    address: userData.address || { street: '', city: '', state: '', pinCode: '' },
                    emergencyContact: userData.emergencyContact || { name: '', phone: '', relationship: '' },
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                // Save to associates collection
                await setDoc(doc(db, 'associates', user.uid), data);
            } else {
                // No data found, create empty associate profile
                data = {
                    uid: user.uid,
                    name: '',
                    email: user.email || '',
                    profilePicture: null,
                    mobile: '',
                    dateOfBirth: null,
                    gender: '',
                    employmentType: '',
                    availability: '',
                    preferredShift: '',
                    vehicleType: '',
                    joiningDate: Timestamp.now(),
                    address: { street: '', city: '', state: '', pinCode: '' },
                    emergencyContact: { name: '', phone: '', relationship: '' },
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                await setDoc(doc(db, 'associates', user.uid), data);
            }
        }

        // Update topbar
        $('#associateName').text(data.name || user.email);
        if (data.profilePicture) {
            $('#associateImg').attr('src', data.profilePicture);
            $('#profilePicPreview').attr('src', data.profilePicture);
        }

        // Personal Info
        $('#profileName').val(data.name || '');
        $('#profileEmail').val(user.email || '');
        $('#profileMobile').val(data.mobile || '');

        if (data.dateOfBirth) {
            const dob = data.dateOfBirth.toDate ? data.dateOfBirth.toDate() : new Date(data.dateOfBirth);
            $('#profileDOB').val(dob.toISOString().split('T')[0]);
        }

        $('#profileGender').val(data.gender || '');

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

        // Loader is hidden by initAssociateAuth

    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error loading profile data: ' + error.message);
    }
}

function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
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
            $('#profileName').focus();
            return;
        }

        if (!mobile || mobile.length !== 10) {
            alert('Please enter a valid 10-digit mobile number');
            $('#profileMobile').focus();
            return;
        }

        if (!employmentType) {
            alert('Please select employment type');
            return;
        }

        // Validate PIN code if provided
        const pinCode = $('#profilePinCode').val().trim();
        if (pinCode && pinCode.length !== 6) {
            alert('PIN code must be 6 digits');
            $('#profilePinCode').focus();
            return;
        }

        // Validate emergency phone if provided
        const emergencyPhone = $('#emergencyPhone').val().trim();
        if (emergencyPhone && emergencyPhone.length !== 10) {
            alert('Emergency contact number must be 10 digits');
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
        const associateDoc = await getDoc(doc(db, 'associates', user.uid));
        if (associateDoc.exists() && !associateDoc.data().joiningDate) {
            profileData.joiningDate = Timestamp.now();
        }

        // Process profile picture if selected (using base64/url64 logic)
        if (selectedProfilePic) {
            try {
                // Compress and convert to base64
                const base64Image = await compressImage(selectedProfilePic);
                profileData.profilePicture = base64Image;

                // Update topbar image immediately
                $('#associateImg').attr('src', base64Image);
            } catch (error) {
                console.error('Error processing image:', error);
                alert('Error processing image. Please try another one.');

                // Re-enable save button
                const saveBtn = $('#saveProfileBtn');
                saveBtn.prop('disabled', false);
                saveBtn.html('<i class="fa fa-save"></i> Save Changes');
                return;
            }
        }

        // Add metadata
        profileData.uid = user.uid;
        profileData.email = user.email;
        profileData.updatedAt = Timestamp.now();

        // Save to associates collection
        await updateDoc(doc(db, 'associates', user.uid), profileData).catch(async () => {
            // Document doesn't exist, create it with createdAt
            profileData.createdAt = Timestamp.now();
            await setDoc(doc(db, 'associates', user.uid), profileData);
        });

        // Also update basic info in users collection for consistency
        const userBasicData = {
            name: name
        };
        if (profileData.profilePicture) {
            userBasicData.profilePicture = profileData.profilePicture;
        }
        await updateDoc(doc(db, 'users', user.uid), userBasicData);

        // Update topbar name
        $('#associateName').text(name);

        // Reset selected image
        selectedProfilePic = null;

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

// Make logout function global
window.logout = function () {
    auth.signOut().then(() => {
        window.location.href = '../auth/associate-login.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        alert('Error logging out');
    });
}

// Helper function to compress image (max 800x800, 0.7 quality)
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG with 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}
