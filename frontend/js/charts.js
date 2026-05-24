/* ════════════════════════════
   FraudShield Chart Configs
   ════════════════════════════ */

const COLORS = {
  purple: '#6366f1',
  purpleLight: '#818cf8',
  purpleGlow: 'rgba(99,102,241,0.15)',
  green: '#10b981',
  greenGlow: 'rgba(16,185,129,0.15)',
  red: '#ef4444',
  redGlow: 'rgba(239,68,68,0.15)',
  orange: '#f59e0b',
  orangeGlow: 'rgba(245,158,11,0.15)',
  blue: '#3b82f6',
  text: '#9494a8',
  border: 'rgba(255,255,255,0.06)',
};

function isDark() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

function chartDefaults() {
  const dark = isDark();
  return {
    color: dark ? '#9494a8' : '#555570',
    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
  };
}

Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;

const charts = {};

/* ── Volume Line Chart ── */
function initVolumeChart() {
  const ctx = document.getElementById('volumeChart');
  if (!ctx || charts.volume) return;

  const labels = Array.from({ length: 20 }, (_, i) => `T-${20 - i}`);
  const totals = labels.map(() => Math.floor(Math.random() * 50 + 20));
  const frauds = totals.map(t => Math.floor(t * (0.03 + Math.random() * 0.08)));

  charts.volume = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total',
          data: totals,
          borderColor: COLORS.purple,
          backgroundColor: 'rgba(99,102,241,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: COLORS.purple,
        },
        {
          label: 'Fraud',
          data: frauds,
          borderColor: COLORS.red,
          backgroundColor: 'rgba(239,68,68,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: COLORS.red,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: scaleStyle(),
        y: { ...scaleStyle(), beginAtZero: true },
      },
      animation: { duration: 600, easing: 'easeInOutQuart' },
    },
  });
}

/* ── Risk Donut ── */
function initRiskDonut() {
  const ctx = document.getElementById('riskDonut');
  if (!ctx || charts.donut) return;

  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical'],
      datasets: [{
        data: [70, 18, 8, 4],
        backgroundColor: [
          'rgba(16,185,129,0.8)',
          'rgba(245,158,11,0.8)',
          'rgba(239,68,68,0.7)',
          'rgba(239,68,68,1)',
        ],
        borderColor: isDark() ? '#111118' : '#ffffff',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDark() ? '#9494a8' : '#555570',
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 8,
            font: { size: 12 },
          },
        },
        tooltip: tooltipStyle(),
      },
    },
  });
}

/* ── Category Bar Chart ── */
function initCategoryChart() {
  const ctx = document.getElementById('categoryChart');
  if (!ctx || charts.category) return;

  charts.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Shopping', 'Travel', 'Groceries', 'Dining', 'Gas', 'Entertainment'],
      datasets: [{
        label: 'Fraud Rate %',
        data: [12, 18, 3, 5, 2, 8],
        backgroundColor: [
          'rgba(239,68,68,0.75)',
          'rgba(245,158,11,0.75)',
          'rgba(16,185,129,0.75)',
          'rgba(59,130,246,0.75)',
          'rgba(16,185,129,0.6)',
          'rgba(99,102,241,0.75)',
        ],
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: scaleStyle(),
        y: { ...scaleStyle(), beginAtZero: true, ticks: { ...scaleStyle().ticks, callback: v => v + '%' } },
      },
    },
  });
}

/* ── Hour Chart ── */
function initHourChart(data) {
  const ctx = document.getElementById('hourChart');
  if (!ctx) return;
  if (charts.hour) charts.hour.destroy();

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const totals = hours.map(h => {
    const found = data.find(d => d.hour === h);
    return found ? found.total : 0;
  });
  const frauds = hours.map(h => {
    const found = data.find(d => d.hour === h);
    return found ? found.fraud_count : 0;
  });

  charts.hour = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.map(h => `${h}:00`),
      datasets: [
        {
          label: 'Total',
          data: totals,
          backgroundColor: 'rgba(99,102,241,0.5)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Fraud',
          data: frauds,
          backgroundColor: 'rgba(239,68,68,0.8)',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { ...scaleStyle(), stacked: false },
        y: { ...scaleStyle(), beginAtZero: true },
      },
    },
  });
}

/* ── Score Distribution Histogram ── */
function initScoreHistChart(data) {
  const ctx = document.getElementById('scoreHistChart');
  if (!ctx) return;
  if (charts.scoreHist) charts.scoreHist.destroy();

  const labels = data.map(d => d.range);
  const counts = data.map(d => d.count);
  const colors = data.map(d => {
    if (d.high <= 0.3) return 'rgba(16,185,129,0.75)';
    if (d.high <= 0.6) return 'rgba(245,158,11,0.75)';
    return 'rgba(239,68,68,0.8)';
  });

  charts.scoreHist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Transactions',
        data: counts,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: scaleStyle(),
        y: { ...scaleStyle(), beginAtZero: true },
      },
    },
  });
}

/* ── Category Risk Chart ── */
function initCategoryRiskChart(data) {
  const ctx = document.getElementById('categoryRiskChart');
  if (!ctx) return;
  if (charts.catRisk) charts.catRisk.destroy();

  charts.catRisk = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [
        {
          label: 'Total Transactions',
          data: data.map(d => d.total),
          backgroundColor: 'rgba(99,102,241,0.5)',
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'Fraud Count',
          data: data.map(d => d.fraud_count),
          backgroundColor: 'rgba(239,68,68,0.75)',
          borderRadius: 4,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' },
      plugins: { legend: { labels: { color: isDark() ? '#9494a8' : '#555570', usePointStyle: true } }, tooltip: tooltipStyle() },
      scales: {
        x: scaleStyle(),
        y: { ...scaleStyle(), beginAtZero: true },
      },
    },
  });
}

/* ── Feature Importance ── */
function initFeatureChart() {
  const ctx = document.getElementById('featureChart');
  if (!ctx || charts.feature) return;

  const features = ['Amount', 'Distance from Home', 'Hour of Day', 'Is Online', 'Category', 'Day of Week', 'Card Type'];
  const importance = [0.38, 0.28, 0.14, 0.10, 0.05, 0.03, 0.02];

  charts.feature = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: features,
      datasets: [{
        label: 'Importance',
        data: importance,
        backgroundColor: importance.map((v, i) => {
          const alpha = 0.4 + v * 1.5;
          if (i === 0) return `rgba(99,102,241,${alpha})`;
          if (i === 1) return `rgba(239,68,68,${alpha})`;
          if (i === 2) return `rgba(245,158,11,${alpha})`;
          return `rgba(59,130,246,${alpha})`;
        }),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { ...scaleStyle(), beginAtZero: true, max: 0.45 },
        y: scaleStyle(),
      },
    },
  });
}

/* ── Gauge Semicircle for scorer ── */
function drawGauge(canvas, score) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h - 20;
  const r = Math.min(w, h) * 0.55;

  ctx.clearRect(0, 0, w, h);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.strokeStyle = isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Color gradient arc
  const angle = Math.PI + score * Math.PI;
  const gradient = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  gradient.addColorStop(0, '#10b981');
  gradient.addColorStop(0.45, '#f59e0b');
  gradient.addColorStop(1, '#ef4444');

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, angle);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Needle dot
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy + r * Math.sin(angle);
  ctx.beginPath();
  ctx.arc(needleX, needleY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = score > 0.5 ? COLORS.red : COLORS.green;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ── SVG Gauge Ring ── */
function animateSVGGauge(circleEl, value, color) {
  const circumference = 2 * Math.PI * 50;
  const offset = circumference * (1 - value);
  circleEl.style.stroke = color;
  circleEl.style.strokeDashoffset = offset;
}

/* ── Helpers ── */
function tooltipStyle() {
  return {
    backgroundColor: isDark() ? '#1c1c28' : '#ffffff',
    titleColor: isDark() ? '#f0f0f5' : '#1a1a2e',
    bodyColor: isDark() ? '#9494a8' : '#555570',
    borderColor: isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    titleFont: { weight: '600' },
  };
}

function scaleStyle() {
  const dark = isDark();
  return {
    grid: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' },
    ticks: { color: dark ? '#5a5a70' : '#9898b0', font: { size: 11 } },
    border: { display: false },
  };
}

/* ── Push real data to volume chart ── */
function pushVolumePoint(total, fraud) {
  if (!charts.volume) return;
  const d = charts.volume.data;
  d.labels.push('Now');
  d.datasets[0].data.push(total);
  d.datasets[1].data.push(fraud);
  if (d.labels.length > 25) {
    d.labels.shift();
    d.datasets.forEach(ds => ds.data.shift());
  }
  charts.volume.update('none');
}

/* ── Update donut ── */
function updateDonut(low, medium, high, critical) {
  if (!charts.donut) return;
  charts.donut.data.datasets[0].data = [low, medium, high, critical];
  charts.donut.update();
}
