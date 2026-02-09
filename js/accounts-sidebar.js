function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    
    // Manage overlay if we decide to add one for mobile
    const overlay = document.getElementById('sidebarOverlay');
    if(overlay) {
        overlay.classList.toggle('active');
    }
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.toggle-btn');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth <= 991) {
        if (!sidebar.contains(event.target) && !toggleBtn.contains(event.target) && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            if(overlay) overlay.classList.remove('active');
        }
    }
});

// Create overlay element dynamically
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';
    document.body.appendChild(overlay);
});
