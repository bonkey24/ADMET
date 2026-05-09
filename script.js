/* ──────────────────────────────────────────────────────────────
   ADMET Risk Profiler — Client-Side Engine (no server needed)
   All ADMET logic runs in the browser. Compatible with static
   hosting (InfinityFree, GitHub Pages, Netlify, etc.)
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
        logp:        { barId: 'bar-logp',    max: 5,  offset: 5 },
        h_donors:    { barId: 'bar-hbd',     max: 5 },
        h_acceptors: { barId: 'bar-hba',     max: 10 },
    };

    let radarChart      = null;
    let analysisHistory = [];

    // ── Live range bars ───────────────────────────────────────
    Object.entries(rangeInputs).forEach(([id, cfg]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => {
            const bar = document.getElementById(cfg.barId);
            if (!bar) return;
            let val = parseFloat(input.value) || 0;
            if (id === 'logp') val = val + 5;
            const effectiveMax = id === 'logp' ? 10 : cfg.max;
            const pct   = Math.min(100, Math.max(0, (val / effectiveMax) * 100));
            const limit = id === 'logp' ? 50 : 80;
            bar.style.width      = pct + '%';
            bar.style.background = pct <= limit ? 'var(--pass)' : 'var(--warning)';
            if (pct > 100) bar.style.background = 'var(--fail)';
        });
    });

    // ── Tooltips ──────────────────────────────────────────────
    document.querySelectorAll('.tooltip-icon').forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            tooltipPopup.textContent = icon.dataset.tip;
            tooltipPopup.classList.add('visible');
            positionTooltip(e);
        });
        icon.addEventListener('mousemove',  positionTooltip);
        icon.addEventListener('mouseleave', () => tooltipPopup.classList.remove('visible'));
    });

    function positionTooltip(e) {
        tooltipPopup.style.left = Math.min(e.clientX + 12, window.innerWidth  - 260) + 'px';
        tooltipPopup.style.top  = Math.min(e.clientY + 12, window.innerHeight - 100) + 'px';
    }

    // ── Clear Button ──────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        form.reset();
        Object.values(rangeInputs).forEach(cfg => {
            const bar = document.getElementById(cfg.barId);
            if (bar) { bar.style.width = '0%'; bar.style.background = 'var(--pass)'; }
        });
    });

    // ════════════════════════════════════════════════════════
    //  CLIENT-SIDE ADMET ENGINE  (ported from app.py)
    // ════════════════════════════════════════════════════════

    function getScoreForProperty(value, thresholdMax, idealMax) {
        if (idealMax === undefined) idealMax = thresholdMax;
        if (value <= idealMax) return 100;
        if (value <= thresholdMax) {
            const ratio = (value - idealMax) / (thresholdMax - idealMax);
            return Math.round(100 - ratio * 40);
        }
        const penalty = Math.min((value - thresholdMax) * 5, 60);
        return Math.max(0, Math.round(60 - penalty));
    }

    function evaluateProperties(data) {
        const weight           = parseFloat(data.weight)          || 0;
        const logp             = parseFloat(data.logp)            || 0;
        const solubility       = (data.solubility       || '').toLowerCase();
        const gi_absorption    = (data.gi_absorption    || '').toLowerCase();
        const bioavailability  = parseFloat(data.bioavailability) || 0.55;
        const bbb_permeability = (data.bbb_permeability || '').toLowerCase();
        const h_donors         = parseInt(data.h_donors)         || 0;
        const h_acceptors      = parseInt(data.h_acceptors)      || 0;
        const rotatable_bonds  = parseInt(data.rotatable_bonds)  || 0;
        const psa              = parseFloat(data.psa)            || 0;
        const drug_name        = (data.drug_name || 'Compound').trim() || 'Compound';

        const results = {};

        // ── Absorption ───────────────────────────────────────
        let abs_issues = [], abs_status = 'Pass', abs_score = 100;

        if (weight > 500) {
            abs_issues.push(`Molecular weight (${weight} Da) exceeds 500 Da Lipinski limit.`);
            abs_status = 'Fail';
            abs_score  = getScoreForProperty(weight, 500, 400);
        } else if (weight > 400) {
            abs_issues.push(`Molecular weight (${weight} Da) is in the acceptable but non-ideal range (>400 Da).`);
            if (abs_status === 'Pass') abs_status = 'Warning';
            abs_score  = getScoreForProperty(weight, 500, 400);
        }

        if (gi_absorption === 'low') {
            abs_issues.push('Low GI absorption predicted; drug is poorly absorbed from the gastrointestinal tract.');
            abs_status = 'Fail';
            abs_score  = Math.min(abs_score, 30);
        }

        if (solubility === 'poor') {
            abs_issues.push('Poor water solubility dramatically limits gastrointestinal absorption.');
            abs_status = 'Fail';
            abs_score  = Math.min(abs_score, 20);
        } else if (solubility === 'moderate') {
            abs_issues.push('Moderate water solubility may reduce bioavailability.');
            if (abs_status === 'Pass') abs_status = 'Warning';
            abs_score  = Math.min(abs_score, 60);
        }

        if (bioavailability < 0.55) {
            abs_issues.push(`Bioavailability score (${bioavailability.toFixed(2)}) is below the 0.55 threshold; poor oral bioavailability expected.`);
            if (abs_status === 'Pass' || abs_status === 'Warning') abs_status = 'Fail';
            abs_score  = Math.min(abs_score, Math.max(10, Math.round(bioavailability * 100)));
        } else if (bioavailability < 0.70) {
            abs_issues.push(`Bioavailability score (${bioavailability.toFixed(2)}) is borderline; moderate oral bioavailability.`);
            if (abs_status === 'Pass') abs_status = 'Warning';
            abs_score  = Math.min(abs_score, 65);
        }

        if (psa > 140) {
            abs_issues.push(`PSA (${psa} \u00c5\u00b2) is too high; oral absorption decreases significantly above 140 \u00c5\u00b2.`);
            abs_status = 'Fail';
            abs_score  = Math.min(abs_score, getScoreForProperty(psa, 140, 90));
        }

        if (rotatable_bonds > 10) {
            abs_issues.push(`High rotatable bond count (${rotatable_bonds}) indicates poor oral bioavailability.`);
            if (abs_status === 'Pass') abs_status = 'Warning';
            abs_score  = Math.min(abs_score, 55);
        }

        results['Absorption'] = {
            status:  abs_status,
            score:   abs_status !== 'Pass' ? abs_score : 100,
            message: abs_issues.length ? abs_issues.join('; ') : 'Excellent oral absorption predicted.',
            detail:  "Absorption governs how much of the drug reaches systemic circulation. Key factors: GI absorption, water solubility, bioavailability score, MW, and PSA. Lipinski's Rule of Five (MW \u2264 500, LogP \u2264 5, HBD \u2264 5, HBA \u2264 10) is the gold standard for oral bioavailability.",
            tips:    abs_status !== 'Pass'
                ? 'Consider prodrug strategies or nanoformulations if MW, solubility, or bioavailability score are limiting.'
                : 'Compound shows good oral bioavailability potential.',
            rule:    'Lipinski Rule of Five + GI Absorption + Bioavailability Score'
        };

        // ── Distribution ─────────────────────────────────────
        let dist_issues = [], dist_status = 'Pass', dist_score = 100;

        if (logp > 5) {
            dist_issues.push(`LogP (${logp}) exceeds 5; compound is too lipophilic for efficient tissue distribution.`);
            dist_status = 'Fail';
            dist_score  = getScoreForProperty(logp, 5, 3);
        } else if (logp > 3) {
            dist_issues.push(`LogP (${logp}) is borderline high. Moderate lipophilicity may cause CNS off-target effects.`);
            dist_status = 'Warning';
            dist_score  = getScoreForProperty(logp, 5, 3);
        } else if (logp < 0) {
            dist_issues.push(`LogP (${logp}) is very low (too hydrophilic); may struggle to cross lipid membranes.`);
            dist_status = 'Warning';
            dist_score  = 65;
        }

        if (psa > 90) {
            dist_issues.push(`PSA (${psa} \u00c5\u00b2) > 90 \u00c5\u00b2 may prevent CNS penetration if that is a target.`);
            if (dist_status === 'Pass') dist_status = 'Warning';
            dist_score  = Math.min(dist_score, 65);
        }

        if (bbb_permeability === 'yes') {
            if (psa > 90 || logp < 0) {
                dist_issues.push('BBB-permeable but high PSA or low LogP may limit actual CNS penetration \u2014 verify in vitro.');
                if (dist_status === 'Pass') dist_status = 'Warning';
                dist_score  = Math.min(dist_score, 70);
            } else {
                dist_issues.push('BBB permeable: drug is predicted to cross the blood-brain barrier \u2014 desirable for CNS targets.');
            }
        } else if (bbb_permeability === 'no') {
            dist_issues.push('Drug does not cross the BBB \u2014 suitable for peripheral targets with reduced CNS side-effect risk.');
        }

        results['Distribution'] = {
            status:  dist_status,
            score:   dist_status !== 'Pass' ? dist_score : 100,
            message: dist_issues.length ? dist_issues.join('; ') : 'Good lipophilicity and BBB profile for tissue distribution.',
            detail:  'Distribution describes how a drug spreads into body compartments. LogP measures partition between octanol/water; ideal range is 1\u20133. BBB permeability governs CNS access. High PSA (>90 \u00c5\u00b2) limits CNS penetration.',
            tips:    dist_status !== 'Pass'
                ? 'Reduce lipophilicity via introduction of polar groups or salt forms.'
                : 'LogP and BBB profile are within ideal range for systemic distribution.',
            rule:    'LogP \u2264 5, PSA \u2264 90 \u00c5\u00b2 (CNS), BBB Permeability'
        };

        // ── Metabolism ───────────────────────────────────────
        let met_issues = [], met_status = 'Pass', met_score = 100;

        if (rotatable_bonds > 7) {
            met_issues.push(`High rotatable bonds (${rotatable_bonds}) often correlates with increased metabolic instability.`);
            met_status = 'Warning';
            met_score  = Math.min(met_score, 65);
        }

        if (bioavailability < 0.55) {
            met_issues.push(`Low bioavailability score (${bioavailability.toFixed(2)}) suggests significant first-pass metabolic clearance.`);
            if (met_status === 'Pass') met_status = 'Warning';
            met_score  = Math.min(met_score, 50);
        }

        if (solubility === 'poor') {
            met_issues.push('Poor water solubility may cause erratic metabolic behaviour due to dissolution-limited absorption.');
            if (met_status === 'Pass') met_status = 'Warning';
            met_score  = Math.min(met_score, 60);
        }

        results['Metabolism'] = {
            status:  met_status,
            score:   met_status !== 'Pass' ? met_score : 100,
            message: met_issues.length ? met_issues.join('; ') : 'Metabolic stability appears adequate.',
            detail:  'Metabolism primarily occurs in the liver. Key predictors include rotatable bond count (molecular flexibility), bioavailability score (first-pass effect proxy), and water solubility. Low bioavailability often signals high first-pass metabolism.',
            tips:    met_status !== 'Pass'
                ? 'Consider rigidifying the scaffold (fewer rotatable bonds) or optimising solubility to improve metabolic stability.'
                : 'Compound appears metabolically stable based on structural parameters.',
            rule:    'Rotatable Bonds \u2264 7, Bioavailability Score \u2265 0.55'
        };

        // ── Excretion ────────────────────────────────────────
        let exc_issues = [], exc_status = 'Pass', exc_score = 100;

        if (solubility === 'poor') {
            exc_issues.push('Poor solubility hinders renal filtration; risk of tubular crystallization and nephrotoxicity.');
            exc_status = 'Warning';
            exc_score  = 45;
        } else if (solubility === 'moderate') {
            exc_issues.push('Moderate solubility may slow renal clearance and prolong half-life.');
            exc_status = 'Warning';
            exc_score  = 72;
        }

        if (logp > 4) {
            exc_issues.push(`High LogP (${logp}) promotes biliary excretion over renal, which can cause enterohepatic recycling.`);
            if (exc_status === 'Pass') exc_status = 'Warning';
            exc_score  = Math.min(exc_score, 55);
        }

        results['Excretion'] = {
            status:  exc_status,
            score:   exc_status !== 'Pass' ? exc_score : 100,
            message: exc_issues.length ? exc_issues.join('; ') : 'Adequate renal clearance expected.',
            detail:  'Excretion is primarily renal (via glomerular filtration) or biliary/fecal. Water solubility is essential for renal clearance. Half-life determines dosing frequency.',
            tips:    exc_status !== 'Pass'
                ? 'Increasing hydrophilicity (e.g., adding -OH, -NH\u2082 groups) can improve renal clearance.'
                : 'Compound is predicted to clear efficiently.',
            rule:    'Solubility & LogP-driven clearance pathways'
        };

        // ── Toxicity ─────────────────────────────────────────
        let tox_issues = [], tox_status = 'Pass', tox_score = 100;

        if (h_acceptors > 10) {
            tox_issues.push(`H-bond acceptors (${h_acceptors}) exceeds Lipinski limit of 10; may cause off-target binding.`);
            tox_status = 'Fail';
            tox_score  = getScoreForProperty(h_acceptors, 10, 7);
        } else if (h_acceptors > 7) {
            tox_issues.push(`H-bond acceptors (${h_acceptors}) approaching upper limit (10).`);
            if (tox_status === 'Pass') tox_status = 'Warning';
            tox_score  = Math.min(tox_score, 65);
        }

        if (h_donors > 5) {
            tox_issues.push(`H-bond donors (${h_donors}) exceeds Lipinski limit of 5; increases permeability issues and potential toxicity.`);
            tox_status = 'Fail';
            tox_score  = Math.min(tox_score, getScoreForProperty(h_donors, 5, 3));
        } else if (h_donors > 3) {
            tox_issues.push(`H-bond donors (${h_donors}) approaching upper limit (5).`);
            if (tox_status === 'Pass') tox_status = 'Warning';
            tox_score  = Math.min(tox_score, 68);
        }

        if (logp > 4) {
            tox_issues.push(`LogP (${logp}) > 4 increases risk of hERG channel binding and cardiotoxicity.`);
            if (tox_status === 'Pass') tox_status = 'Warning';
            tox_score  = Math.min(tox_score, 60);
        }

        if (weight > 600) {
            tox_issues.push(`Very high MW (${weight} Da) increases risk of immune-mediated reactions.`);
            if (tox_status === 'Pass') tox_status = 'Fail';
            tox_score  = Math.min(tox_score, 25);
        }

        results['Toxicity'] = {
            status:  tox_status,
            score:   tox_status !== 'Pass' ? tox_score : 100,
            message: tox_issues.length ? tox_issues.join('; ') : 'No major toxicity flags from Lipinski analysis.',
            detail:  'Toxicity predictions are based on structural flags including H-bond counts, hERG cardiotoxicity risk (LogP > 4), and immune reaction risk (MW > 600). Lipinski violations compound risk.',
            tips:    tox_status !== 'Pass'
                ? 'Flag compound for in-vitro hERG and Ames mutagenicity assays.'
                : 'Low structural toxicity flags detected.',
            rule:    'Lipinski HBD \u2264 5, HBA \u2264 10, hERG / immune risk screens'
        };

        // ── Overall Drug-Likeness Score ───────────────────────
        const categories = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity'];
        const scoreArr   = categories.map(c => results[c].score);
        const overall_score = Math.round(scoreArr.reduce((a, b) => a + b, 0) / scoreArr.length);

        const lipinski_violations = [
            weight      > 500 ? 1 : 0,
            logp        > 5   ? 1 : 0,
            h_donors    > 5   ? 1 : 0,
            h_acceptors > 10  ? 1 : 0,
        ].reduce((a, b) => a + b, 0);

        let overall_verdict, overall_color;
        if      (overall_score >= 80) { overall_verdict = 'Promising';  overall_color = 'pass';    }
        else if (overall_score >= 55) { overall_verdict = 'Borderline'; overall_color = 'warning'; }
        else                          { overall_verdict = 'High Risk';  overall_color = 'fail';    }

        results['_summary'] = {
            drug_name,
            overall_score,
            overall_verdict,
            overall_color,
            lipinski_violations,
            scores: Object.fromEntries(categories.map(c => [c, results[c].score]))
        };

        return results;
    }

    // ── Form submit (no fetch — runs entirely in browser) ─────
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        runBtn.disabled  = true;
        runBtn.innerHTML = `<span class="spinning"></span> Analyzing...`;

        const data = Object.fromEntries(new FormData(form).entries());

        // Short timeout lets the spinner render before heavy JS runs
        setTimeout(() => {
            try {
                const result = evaluateProperties(data);
                updateDashboard(result);
                updateOverallScore(result._summary);
                updateRadarChart(result);
                addToHistory(result._summary, result);
                showToast('Analysis complete!', 'success');
            } catch (err) {
                console.error(err);
                showToast(`Error: ${err.message}`, 'error');
            } finally {
                runBtn.disabled  = false;
                runBtn.innerHTML = `<span class="btn-icon">\u2697</span> Run ADMET Analysis`;
            }
        }, 300);
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

            card.style.animationDelay = `${i * 0.08}s`;
            card.className  = `card ${data.status.toLowerCase()}`;
            badge.textContent = data.status;
            msg.textContent   = data.message;

            setTimeout(() => {
                sbar.style.width = `${data.score}%`;
                snum.textContent = `${data.score}/100`;
            }, 200 + i * 80);

            if (detail) detail.textContent = data.detail || '';
            if (tip)    tip.textContent    = data.tips   ? `\uD83D\uDCA1 ${data.tips}` : '';
            if (rule)   rule.textContent   = data.rule   ? `Rule: ${data.rule}` : '';
        });
    }

    // ── Overall score panel ───────────────────────────────────
    function updateOverallScore(summary) {
        if (!summary) return;
        const scoreEl   = document.getElementById('overall-score');
        const verdictEl = document.getElementById('overall-verdict');
        const violEl    = document.getElementById('violations-row');

        animateNumber(scoreEl, 0, summary.overall_score, 800);
        verdictEl.textContent = summary.overall_verdict;
        verdictEl.className   = `score-verdict ${summary.overall_color}`;

        const v = summary.lipinski_violations;
        violEl.innerHTML = v === 0
            ? `<span style="color:var(--pass)">\u2713 Zero Lipinski violations</span>`
            : `<strong>${v} Lipinski violation${v > 1 ? 's' : ''}</strong> \u2014 ${v >= 2 ? 'High risk of poor oral bioavailability.' : 'Borderline drug-likeness.'}`;
    }

    function animateNumber(el, from, to, duration) {
        const start  = performance.now();
        const update = (time) => {
            const t    = Math.min((time - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(from + (to - from) * ease);
            if (t < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    // ── Radar Chart ───────────────────────────────────────────
    function updateRadarChart(results) {
        const labels = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity'];
        const scores = labels.map(l => results[l]?.score ?? 0);
        const colors = labels.map(l => {
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
                    backgroundColor:      'rgba(99,102,241,0.15)',
                    borderColor:          '#818cf8',
                    borderWidth:          2,
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
                        ticks:       { display: false, stepSize: 25 },
                        grid:        { color: 'rgba(255,255,255,0.06)' },
                        angleLines:  { color: 'rgba(255,255,255,0.06)' },
                        pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ── History ───────────────────────────────────────────────
    function addToHistory(summary, results) {
        if (!summary) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        analysisHistory.unshift({ summary, results, time });
        if (analysisHistory.length > 6) analysisHistory.pop();

        const historySection = document.getElementById('history-section');
        const historyList    = document.getElementById('history-list');
        historySection.style.display = 'block';
        historyList.innerHTML = '';

        analysisHistory.forEach(entry => {
            const cats = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity'];
            const abbr = { Absorption: 'A', Distribution: 'D', Metabolism: 'M', Excretion: 'E', Toxicity: 'T' };
            const badges = cats.map(cat => {
                const status = (entry.results[cat]?.status || 'pending').toLowerCase();
                return `<span class="h-badge ${status}">${abbr[cat]}</span>`;
            }).join('');

            const s    = entry.summary;
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
