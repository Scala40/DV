export function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const toggleVisibility = () => {
        if (window.scrollY > 300) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    // Initial check in case page loads scrolled
    toggleVisibility();

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        btn.blur();
    });
}
