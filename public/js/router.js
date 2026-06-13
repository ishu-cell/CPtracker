// js/router.js — Hash-based SPA router
// Shows/hides page sections and highlights the active nav item.

(function () {
  const pages = [
    'dashboard',
    'profile',
    'analytics',
    'weaknesses',
    'recommend',
    'training',
    'contest',
  ];

  const defaultPage = 'dashboard';

  function getPageFromHash() {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    return pages.includes(hash) ? hash : defaultPage;
  }

  function navigate() {
    const page = getPageFromHash();

    // Hide all page sections, show the active one
    pages.forEach(p => {
      const section = document.getElementById(`page-${p}`);
      if (section) {
        section.classList.toggle('active', p === page);
      }
    });

    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemPage = item.getAttribute('data-page');
      item.classList.toggle('active', itemPage === page);
    });

    // Update page title
    document.title = `Σcp.track — ${page.charAt(0).toUpperCase() + page.slice(1)}`;

    // Fire a custom event so pages can react to navigation
    window.dispatchEvent(new CustomEvent('page:change', { detail: { page } }));
  }

  // Listen for hash changes
  window.addEventListener('hashchange', navigate);

  // Initial navigation on load (deferred to let Clerk init first)
  window.initRouter = function () {
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    }
    navigate();
  };

  // Expose for programmatic navigation
  window.navigateTo = function (page) {
    window.location.hash = `#/${page}`;
  };
})();
