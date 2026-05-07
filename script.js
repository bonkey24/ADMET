/* ──────────────────────────────────────────────────────────────
   ADMET Risk Profiler — Advanced Frontend Logic
────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ─────────────────────────────────────────────
    const form         = document.getElementById('admet-form');
    const runBtn       = document.getElementById('run-btn');
    const clearBtn     = document.getElementById('clear-btn');
    const toast        = document.getElementById('toast');
    const tooltipPopup = document.getElementById('tooltip-popup');

    // Range bar inputs
    const rangeInputs = {
        weight:      { barId: 'bar-weight',  max: 500 },
        logp:        { barId: 'bar-logp',    max: 5,  offset: 5 },   // logp can be negative
        h_donors:    { barId: 'bar-hbd',     max: 5 },
        h_acceptors: { barId: 'bar-hba',     max: 10 },
    };

    let radarChart   = null;
    let analysisHistory = [];

    // ── Live range bars ─────────────────────────────────────
    Object.entries(rangeInputs).forEach(([id, cfg]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => {
            const bar   = document.getElementById(cfg.barId);
            if (!bar) return;
            let val     = parseFloat(input.value) || 0;
            // For logp, shift to 0-based (logp range -5 to 5 → 0 to 10)
            if (id === 'logp') val = val + 5;
            const effectiveMax = id === 'logp' ? 10 : cfg.max;
            const pct   = Math.min(100, Math.max(0, (val / effectiveMax) * 100));
            const limit = id === 'logp' ? 50 : 80; // danger threshold %
            bar.style.width = pct + '%';
            bar.style.background = pct <= limit ? 'var(--pass)' : pct <= 100 ? 'var(--warning)' : 'var(--fail)';
            if (pct > 100) bar.style.background = 'var(--fail)';
        });
    });

    // ── Tooltips ─────────────────────────────────────────────
    document.querySelectorAll('.tooltip-icon').forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            tooltipPopup.textContent = icon.dataset.tip;
            tooltipPopup.classList.add('visible');
            positionTooltip(e);
        });
        icon.addEventListener('mousemove', positionTooltip);
        icon.addEventListener('mouseleave', () => tooltipPopup.classList.remove('visible'));
    });

    function positionTooltip(e) {
        const x = e.clientX + 12;
        const y = e.clientY + 12;
        tooltipPopup.style.left = Math.min(x, window.innerWidth - 260) + 'px';
        tooltipPopup.style.top  = Math.min(y, window.innerHeight - 100) + 'px';
    }

    // ── Clear Button ─────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        form.reset();
        // Reset range bars
        Object.values(rangeInputs).forEach(cfg => {
            const bar = document.getElementById(cfg.barId);
            if (bar) { bar.style.width = '0%'; bar.style.background = 'var(--pass)'; }
        });
    });

    // ── Form submit ───────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Loading state
        runBtn.disabled = true;
        runBtn.innerHTML = `<span class="spinning"></span> Analyzing...`;

        const formData = new FormData(form);
        const data     = Object.fromEntries(formData.entries());

        try {
            // Auto-detect environment: use local Flask in dev, Vercel serverless in production
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const API_URL = isLocal
            ? 'http://localhost:5000/api/evaluate_admet'
            : '/api/evaluate_admet';

        const response = await fetch(API_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || 'Evaluation failed');

            updateDashboard(result);
            updateOverallScore(result._summary);
            updateRadarChart(result);
            addToHistory(result._summary, result);
            showToast('Analysis complete!', 'success');

        } catch (err) {
            console.error(err);
            if (err.message.includes('fetch')) {
                showToast('Cannot reach Flask server. Is it running on port 5000?', 'error');
            } else {
                showToast(`Error: ${err.message}`, 'error');
            }
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = `<span class="btn-icon">⚗</span> Run ADMET Analysis`;
        }
    });

    // ── Update individual ADMET cards ─────────────────────────
    function updateDashboard(results) {
        const categories = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity'];

        categories.forEach((cat, i) => {
            const data = results[cat];
            if (!data) return;

            const card   = document.getElementById(`card-${cat.toLowerCase()}`);
            const badge  = card.querySelector('.status-badge');
            const msg    = card.querySelector('.message');
            const sbar   = document.getElementById(`sbar-${cat.toLowerCase()}`);
            const snum   = document.getElementById(`snum-${cat.toLowerCase()}`);
            const detail = document.getElementById(`detail-${cat.toLowerCase()}`);
            const tip    = document.getElementById(`tip-${cat.toLowerCase()}`);
            const rule   = document.getElementById(`rule-${cat.toLowerCase()}`);

            // Stagger animation
            card.style.animationDelay = `${i * 0.08}s`;

            // Status class
            card.className = `card ${data.status.toLowerCase()}`;
            badge.textContent = data.status;
            msg.textContent   = data.message;

            // Score bar animation (slight delay)
            setTimeout(() => {
                sbar.style.width = `${data.score}%`;
                snum.textContent = `${data.score}/100`;
            }, 200 + i * 80);

            // Details
            if (detail) detail.textContent = data.detail || '';
            if (tip)    tip.textContent    = data.tips   ? `💡 ${data.tips}` : '';
            if (rule)   rule.textContent   = data.rule   ? `Rule: ${data.rule}` : '';
        });
    }

    // ── Overall score panel ───────────────────────────────────
    function updateOverallScore(summary) {
        if (!summary) return;
        const scoreEl   = document.getElementById('overall-score');
        const verdictEl = document.getElementById('overall-verdict');
        const violEl    = document.getElementById('violations-row');

        // Animate count-up
        animateNumber(scoreEl, 0, summary.overall_score, 800);

        verdictEl.textContent = summary.overall_verdict;
        verdictEl.className   = `score-verdict ${summary.overall_color}`;

        const v = summary.lipinski_violations;
        violEl.innerHTML = v === 0
            ? `<span style="color:var(--pass)">✓ Zero Lipinski violations</span>`
            : `<strong>${v} Lipinski violation${v > 1 ? 's' : ''}</strong> — ${v >= 2 ? 'High risk of poor oral bioavailability.' : 'Borderline drug-likeness.'}`;
    }

    function animateNumber(el, from, to, duration) {
        const start = performance.now();
        const update = (time) => {
            const t = Math.min((time - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(from + (to - from) * ease);
            if (t < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    // ── Radar Chart ──────────────────────────────────────────
    function updateRadarChart(results) {
        const labels  = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity'];
        const scores  = labels.map(l => results[l]?.score ?? 0);
        const colors  = labels.map(l => {
            const s = results[l]?.status;
            if (s === 'Pass')    return '#10b981';
            if (s === 'Warning') return '#f59e0b';
            return '#ef4444';
        });

        const ctx = document.getElementById('radar-chart').getContext('2d');

        if (radarChart) radarChart.destroy();

        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'ADMET Score',
                    data:  scores,
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    borderColor:     '#818cf8',
                    borderWidth:     2,
                    pointBackgroundColor: colors,
                    pointBorderColor:     colors,
                    pointRadius:          5,
                    pointHoverRadius:     8,
                }]
            },
            options: {
                responsive: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                scales: {
                    r: {
                        min: 0, max: 100,
                        ticks:    { display: false, stepSize: 25 },
                        grid:     { color: 'rgba(255,255,255,0.06)' },
                        angleLines:{ color: 'rgba(255,255,255,0.06)' },
                        pointLabels: {
                            color: '#94a3b8',
                            font:  { family: 'Inter', size: 11 }
                        }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ── History ──────────────────────────────────────────────
    function addToHistory(summary, results) {
        if (!summary) return;

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        analysisHistory.unshift({ summary, results, time });
        if (analysisHistory.length > 6) analysisHistory.pop();

        const historySection = document.getElementById('history-section');
        const historyList    = document.getElementById('history-list');
        historySection.style.display = 'block';
        historyList.innerHTML = '';

        analysisHistory.forEach(entry => {
            const s = entry.summary;
            const cats = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity'];

            const badges = cats.map(cat => {
                const status = (entry.results[cat]?.status || 'pending').toLowerCase();
                const abbrev = { Absorption: 'A', Distribution: 'D', Metabolism: 'M', Excretion: 'E', Toxicity: 'T' }[cat];
                return `<span class="h-badge ${status}">${abbrev}</span>`;
            }).join('');

            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="history-name">${escapeHTML(s.drug_name)}</span>
                <span class="history-score ${s.overall_color}">${s.overall_score}</span>
                <div class="history-badges">${badges}</div>
                <span class="history-time">${entry.time}</span>
            `;
            historyList.appendChild(item);
        });
    }

    // ── Toast ─────────────────────────────────────────────────
    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className   = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // ── Utility ───────────────────────────────────────────────
    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
});
