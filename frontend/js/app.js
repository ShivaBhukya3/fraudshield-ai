/* ════════════════════════════
   FraudShield AI — Main App
   ════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initSidebar();
  initCharts();
  loadDashboard();
  connectWebSocket();
  bindGenerateBtn();
  bindScorerForm();
});

/* ─── Theme ─── */
function initTheme() {
  const saved = localStorage.getItem('fs-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fs-theme', next);
  });
}

/* ─── Sidebar ─── */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const toggle = document.getElementById('sidebarToggle');

  const collapsed = localStorage.getItem('fs-sidebar') === 'collapsed';
  if (collapsed) {
    sidebar.classList.add('collapsed');
    main.classList.add('collapsed');
  }

  toggle?.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    main.classList.toggle('collapsed', isCollapsed);
    localStorage.setItem('fs-sidebar', isCollapsed ? 'collapsed' : 'open');
  });
}

/* ─── Navigation ─── */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('pageTitle');

  const titles = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    alerts: 'Alerts',
    analytics: 'Analytics',
    scorer: 'Score Transaction',
    model: 'Model Performance',
  };

  function navigate(pageId) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
    pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
    if (pageTitle) pageTitle.textContent = titles[pageId] || pageId;

    // Lazy load page data
    switch (pageId) {
      case 'transactions': loadTransactions(); break;
      case 'alerts': loadAlerts(); break;
      case 'analytics': loadAnalytics(); break;
      case 'model': initFeatureChart(); loadModelMetrics(); break;
    }

    window.location.hash = pageId;
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });

  // Handle hash on load
  const hash = window.location.hash.slice(1);
  if (hash && titles[hash]) navigate(hash);

  // Search & filter for transactions
  document.getElementById('txnSearch')?.addEventListener('input', debounce(loadTransactions, 300));
  document.getElementById('txnFilter')?.addEventListener('change', loadTransactions);
}

/* ─── Init Charts ─── */
function initCharts() {
  // Dashboard charts init on load
  setTimeout(() => {
    initVolumeChart();
    initRiskDonut();
    initCategoryChart();
  }, 0);
}

/* ─── Generate Demo Data ─── */
function bindGenerateBtn() {
  document.getElementById('generateBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    try {
      const result = await api.generateDemo(20);
      showToast(`Generated ${result.generated} demo transactions`, 'success');
      loadDashboard();
      // If on transactions page, reload
      if (document.getElementById('page-transactions')?.classList.contains('active')) {
        loadTransactions();
      }
    } catch (e) {
      showToast('Failed to generate data: ' + e.message, 'fraud');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Generate Demo Data`;
    }
  });
}

/* ─── Scorer Form ─── */
function bindScorerForm() {
  const form = document.getElementById('scorerForm');
  const resultCard = document.getElementById('scorerResult');
  const gaugeCanvas = document.getElementById('gaugeChart');

  document.getElementById('fillDemo')?.addEventListener('click', () => {
    const demo = {
      amount: 4850.00,
      merchant: 'Suspicious Electronics',
      category: 'shopping',
      card_type: 'prepaid',
      hour_of_day: 2,
      day_of_week: 6,
      distance_from_home: 340.0,
      location: 'Unknown City',
      is_online: true,
    };
    document.getElementById('f_amount').value = demo.amount;
    document.getElementById('f_merchant').value = demo.merchant;
    document.getElementById('f_category').value = demo.category;
    document.getElementById('f_card_type').value = demo.card_type;
    document.getElementById('f_hour').value = demo.hour_of_day;
    document.getElementById('f_dow').value = demo.day_of_week;
    document.getElementById('f_distance').value = demo.distance_from_home;
    document.getElementById('f_location').value = demo.location;
    document.getElementById('f_online').checked = demo.is_online;
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('scoreBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing...';

    const payload = {
      amount: parseFloat(document.getElementById('f_amount').value),
      merchant: document.getElementById('f_merchant').value,
      category: document.getElementById('f_category').value,
      card_type: document.getElementById('f_card_type').value,
      hour_of_day: parseInt(document.getElementById('f_hour').value),
      day_of_week: parseInt(document.getElementById('f_dow').value),
      distance_from_home: parseFloat(document.getElementById('f_distance').value) || 0,
      location: document.getElementById('f_location').value || 'Unknown',
      is_online: document.getElementById('f_online').checked,
    };

    try {
      const result = await api.scoreTransaction(payload);
      displayScorerResult(result, gaugeCanvas, resultCard);
    } catch (e) {
      showToast('Scoring failed: ' + e.message, 'fraud');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Analyze Transaction';
    }
  });
}

function displayScorerResult(result, gaugeCanvas, resultCard) {
  resultCard.hidden = false;
  resultCard.style.animation = 'none';
  requestAnimationFrame(() => {
    resultCard.style.animation = 'fadeUp 0.4s ease';
  });

  const score = result.fraud_score;
  const isFraud = result.is_fraud;
  const riskLevel = result.risk_level;

  // Header
  const icons = { LOW: '✅', MEDIUM: '⚠️', HIGH: '🔴', CRITICAL: '🚨' };
  const colors = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#ef4444' };

  document.getElementById('resultIcon').style.background = colors[riskLevel] + '22';
  document.getElementById('resultIcon').textContent = icons[riskLevel] || '⚠️';
  document.getElementById('resultTitle').textContent = isFraud ? 'Fraud Detected' : 'Transaction Clear';
  document.getElementById('resultSubtitle').textContent = `Risk level: ${riskLevel}`;

  // Draw gauge
  if (gaugeCanvas) {
    drawGauge(gaugeCanvas, score);
  }
  document.getElementById('gaugeValue').textContent = (score * 100).toFixed(2) + '%';

  // Metrics
  document.getElementById('riskBadge').textContent = riskLevel;
  document.getElementById('riskBadge').className = `metric-badge ${riskLevel}`;
  document.getElementById('confValue').textContent = (result.confidence * 100).toFixed(1) + '%';
  document.getElementById('procTime').textContent = result.processing_time_ms.toFixed(2) + ' ms';
  document.getElementById('decision').textContent = isFraud ? 'Block / Flag' : 'Approve';

  // Risk factors
  const factorsList = document.getElementById('factorsList');
  factorsList.innerHTML = result.risk_factors.map(f =>
    `<li>${escapeHtml(f)}</li>`
  ).join('');

  // Recommendation
  document.getElementById('recommendationText').textContent = result.recommendation;
  const recBox = document.getElementById('recommendationBox');
  recBox.style.borderColor = isFraud ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)';
}

/* ─── Utilities ─── */
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
