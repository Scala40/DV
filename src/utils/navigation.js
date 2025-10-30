export function initNavigation() {
    const btn = document.getElementById('nav-toggle');
    const mobile = document.getElementById('nav-mobile');

    if (!btn || !mobile) return;

    function toggleMenu() {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        mobile.classList.toggle('hidden');
    }

    btn.addEventListener('click', toggleMenu);

    mobile.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', toggleMenu);
    });
}
