
// Mobile Sidebar Logic: Click outside to close
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    
    // If sidebar logic not present, ignore
    if (!sidebar) return;

    // Check if sidebar is active
    if (!sidebar.classList.contains('active')) return;

    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnToggle = Array.from(toggleBtns).some(btn => btn.contains(event.target));

    if (!isClickInsideSidebar && !isClickOnToggle) {
        sidebar.classList.remove('active');
    }
});
