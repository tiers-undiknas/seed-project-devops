import renderNavbar from './components/navbar.js';
import renderDashboard from './pages/dashboard.js';
import renderOrders from './pages/orders.js';
import renderDiagnostics from './pages/diagnostics.js';

const routes = {
  '#/': renderDashboard,
  '#/orders': renderOrders,
  '#/diagnostics': renderDiagnostics
};

function router() {
  const hash = window.location.hash || '#/';
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  renderNavbar(hash);

  const view = routes[hash] || routes['#/'];
  if (view) {
    view(mainContent);
  } else {
    mainContent.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h2>Page Not Found</h2>
        <p style="color: var(--text-secondary); margin: 1rem 0;">The requested view does not exist.</p>
        <a href="#/" class="btn btn-primary">Return to Dashboard</a>
      </div>
    `;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
