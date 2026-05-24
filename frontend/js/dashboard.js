/* ════════════════════════════
   Dashboard Data Loading
   ════════════════════════════ */

let refreshInterval = null;

async function loadDashboard() {
  try {
    const [summary, categories] = await Promise.all([
      api.summary(),
      api.byCategory(),
    ]);

    // KPI cards
    animateCount('kpiTotal', summary.total_transactions);
    animateCount('kpiFraud', summary.total_fraud);
    setText('kpiPrevented', '$' + formatNum(summary.fraud_prevented));
    animateCount('kpiAlerts', summary.active_alerts);

    // Fraud rate color
    const rate = summary.fraud_rate.toFixed(2);
    const rateEl = document.getElementById('kpiFraudRate');
    if (rateEl) {
      rateEl.textContent = rate + '% fraud rate';
      rateEl.className = 'kpi-change ' + (summary.fraud_rate > 10 ? 'negative' : '');
    }

    // Alert badge
    const badge = document.getElementById('alertBadge');
    if (badge) {
      badge.textContent = summary.active_alerts;
      badge.style.display = summary.active_alerts > 0 ? '' : 'none';
    }

    // Notification dot
    const notifDot = document.getElementById('notifDot');
    if (notifDot) notifDot.hidden = summary.active_alerts === 0;

    // Update donut if category data is available
    if (categories && categories.length) {
      updateCategoryChart(categories);
    }
  } catch (e) {
    console.warn('Dashboard load error:', e.message);
  }
}

function updateCategoryChart(categories) {
  if (!charts.category) return;
  charts.category.data.labels = categories.map(c => capitalize(c.category));
  charts.category.data.datasets[0].data = categories.map(c => +c.fraud_rate.toFixed(1));
  charts.category.update();
}

async function loadTransactions() {
  const filter = document.getElementById('txnFilter')?.value || '';
  const search = document.getElementById('txnSearch')?.value || '';
  const tbody = document.getElementById('txnTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr class="table-loading"><td colspan="8"><div class="loader-row"><div class="spinner"></div><span>Loading...</span></div></td></tr>';

  try {
    let txns = await api.transactions(100, filter);

    if (search) {
      const q = search.toLowerCase();
      txns = txns.filter(t =>
        t.transaction_id.toLowerCase().includes(q) ||
        t.merchant.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    if (!txns.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-3)">No transactions found</td></tr>';
      return;
    }

    tbody.innerHTML = txns.map(t => {
      const scoreClass = t.fraud_score > 0.75 ? 'critical' : t.fraud_score > 0.5 ? 'high' : t.fraud_score > 0.3 ? 'medium' : 'low';
      return `
        <tr class="${t.is_fraud ? 'fraud-row' : ''}">
          <td><span class="txn-id">${t.transaction_id.slice(0, 12)}…</span></td>
          <td style="font-weight:600;color:var(--color-text)">${escapeHtml(t.merchant)}</td>
          <td>${capitalize(t.category)}</td>
          <td class="amount-cell">$${formatNum(t.amount)}</td>
          <td class="score-cell ${scoreClass}">${(t.fraud_score * 100).toFixed(1)}%</td>
          <td>${riskBadge(t.fraud_score)}</td>
          <td>${statusPill(t.status)}</td>
          <td style="color:var(--color-text-3);font-size:0.78rem">${timeAgo(t.created_at)}</td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-red)">Failed to load transactions</td></tr>';
  }
}

async function loadAlerts() {
  const container = document.getElementById('alertsList');
  if (!container) return;

  try {
    const alerts = await api.alerts(false);

    if (!alerts.length) {
      container.innerHTML = `
        <div class="alerts-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p style="font-size:1rem;font-weight:600;margin-bottom:6px">All Clear</p>
          <p>No active alerts — system is operating normally</p>
        </div>`;
      return;
    }

    container.innerHTML = alerts.map(a => `
      <div class="alert-card ${a.severity}" id="alert-${a.id}">
        <div class="alert-icon ${a.severity}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="alert-body">
          <div class="alert-title">${escapeHtml(a.message)}</div>
          <div class="alert-meta">
            <span>${a.alert_type}</span>
            <span>TXN: ${a.transaction_id.slice(0, 10)}…</span>
            <span>${timeAgo(a.created_at)}</span>
          </div>
        </div>
        <span class="alert-severity ${a.severity}">${a.severity}</span>
        <button class="alert-resolve-btn" onclick="resolveAlert(${a.id})">Resolve</button>
      </div>`
    ).join('');
  } catch (e) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--color-red)">Failed to load alerts</div>';
  }
}

async function resolveAlert(id) {
  try {
    await api.resolveAlert(id);
    const el = document.getElementById(`alert-${id}`);
    if (el) {
      el.style.opacity = '0.4';
      el.style.pointerEvents = 'none';
      setTimeout(() => el.remove(), 400);
    }
    showToast('Alert resolved', 'success');
    loadDashboard();
  } catch (e) {
    showToast('Failed to resolve alert', 'fraud');
  }
}

async function loadAnalytics() {
  try {
    const [hourData, scoreData, categoryData] = await Promise.all([
      api.byHour(),
      api.scoreDistribution(),
      api.byCategory(),
    ]);

    initHourChart(hourData);
    initScoreHistChart(scoreData);
    initCategoryRiskChart(categoryData);
  } catch (e) {
    console.warn('Analytics load error:', e.message);
  }
}

async function loadModelMetrics() {
  try {
    const metrics = await api.modelMetrics();
    if (metrics.error) return;

    const pct = v => (v * 100).toFixed(1) + '%';

    setText('gaugePrecisionVal', pct(metrics.precision));
    setText('gaugeRecallVal', pct(metrics.recall));
    setText('gaugeF1Val', pct(metrics.f1_score));
    setText('gaugeAUCVal', pct(metrics.roc_auc));
    setText('thresholdVal', metrics.threshold.toFixed(4));
    setText('modelVersion', metrics.model_version || '1.0.0');

    // Animate SVG gauge rings
    const pairs = [
      ['gaugePrecision', metrics.precision, '#6366f1'],
      ['gaugeRecall', metrics.recall, '#10b981'],
      ['gaugeF1', metrics.f1_score, '#f59e0b'],
      ['gaugeAUC', metrics.roc_auc, '#ef4444'],
    ];

    setTimeout(() => {
      pairs.forEach(([id, val, color]) => {
        const el = document.getElementById(id);
        if (el) animateSVGGauge(el, val, color);
      });
    }, 100);
  } catch (e) {
    console.warn('Model metrics load error:', e.message);
  }
}

/* ─── Live Feed ─── */
let feedCount = 0;

function addFeedItem(txn) {
  const feed = document.getElementById('liveFeed');
  if (!feed) return;

  const empty = feed.querySelector('.feed-empty');
  if (empty) empty.remove();

  const riskLower = (txn.risk_level || 'LOW').toLowerCase();
  const isFraud = txn.is_fraud;
  const item = document.createElement('div');
  item.className = `feed-item${isFraud ? (txn.fraud_score > 0.8 ? ' fraud-critical' : ' fraud') : ''}`;
  item.innerHTML = `
    <span class="feed-merchant">${escapeHtml(txn.merchant || 'Unknown')}</span>
    <span class="feed-amount">$${formatNum(txn.amount || 0)}</span>
    <span class="feed-score">${((txn.fraud_score || 0) * 100).toFixed(1)}%</span>
    <span class="feed-badge ${riskLower}">${txn.risk_level || 'LOW'}</span>`;

  feed.prepend(item);
  feedCount++;

  // Keep max 20 items
  while (feed.children.length > 20) {
    feed.removeChild(feed.lastChild);
  }

  // Push to volume chart
  pushVolumePoint(feedCount, isFraud ? 1 : 0);

  // Toast for fraud
  if (isFraud && txn.fraud_score > 0.75) {
    showToast(`Fraud detected: $${formatNum(txn.amount)} at ${txn.merchant}`, 'fraud');
  }
}

/* ─── WebSocket Feed ─── */
function connectWebSocket() {
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/feed`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'transaction') {
        addFeedItem(msg.data);
        loadDashboard();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

/* ─── Utilities ─── */
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  const duration = 600;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatNum(n) {
  return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function riskBadge(score) {
  if (score > 0.75) return '<span class="feed-badge critical">CRITICAL</span>';
  if (score > 0.5) return '<span class="feed-badge high">HIGH</span>';
  if (score > 0.3) return '<span class="feed-badge medium">MEDIUM</span>';
  return '<span class="feed-badge low">LOW</span>';
}

function statusPill(status) {
  return `<span class="status-pill ${status || 'pending'}">${capitalize(status || 'pending')}</span>`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

/* ─── Toast ─── */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    fraud: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
