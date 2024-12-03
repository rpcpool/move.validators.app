function updateLogo() {
    const logo = document.getElementById('logo');
    if (logo) {
        const isDarkMode = document.documentElement.classList.contains('dark');
        logo.src = isDarkMode ? logo.dataset.dark : logo.dataset.light;
    }
}

function setTheme(theme) {
    const lightIcon = document.getElementById('lightIcon');
    const darkIcon = document.getElementById('darkIcon');

    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (lightIcon) lightIcon.classList.remove('hidden');
        if (darkIcon) darkIcon.classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (lightIcon) lightIcon.classList.add('hidden');
        if (darkIcon) darkIcon.classList.remove('hidden');
    }
    updateLogo();
}

function initializeThemeToggle() {
    if (document.body.dataset.themeToggleInitialized === 'true') return;

    const themeToggle = document.getElementById('themeToggle');

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Add event listener to toggle button
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    // Toggle search bar visibility
    const searchToggle = document.getElementById('searchToggle');
    if (searchToggle) {
        searchToggle.addEventListener('click', function () {
            const searchBar = document.getElementById('searchBar');
            if (searchBar) searchBar.classList.toggle('hidden');
        });
    }

    // Initial logo update
    updateLogo();
    document.body.dataset.themeToggleInitialized = 'true';
}

document.addEventListener('turbo:load', initializeThemeToggle);
document.addEventListener('DOMContentLoaded', initializeThemeToggle);
