import { isMobile } from './device.js';

export function initNavigation() {
    if (isMobile()) {
        initMobileMenu();
    }

    initScrollSpy();
}

function initMobileMenu() {
    const btn = document.getElementById('nav-toggle');
    const mobile = document.getElementById('nav-mobile');

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

function initScrollSpy() {
    const sections = document.querySelectorAll('section[id^="section-"]');
    const navLinks = document.querySelectorAll('a[href^="#section-"]');
    const currentSectionLabel = document.getElementById('current-section');

    if (!sections.length || !navLinks.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');

                navLinks.forEach(link => {
                    link.classList.remove('bg-blue-50');
                });

                const activeLinks = document.querySelectorAll(`a[href="#${id}"]`);
                activeLinks.forEach(link => {
                    link.classList.add('bg-blue-50');
                });

                if (currentSectionLabel && activeLinks.length > 0) {
                    currentSectionLabel.textContent = activeLinks[0].textContent.trim();
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}
