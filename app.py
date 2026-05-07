from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

LIPINSKI_THRESHOLDS = {
    'weight': {'max': 500, 'ideal_max': 400, 'unit': 'Da'},
    'logp': {'max': 5, 'ideal_max': 3, 'unit': ''},
    'h_donors': {'max': 5, 'ideal_max': 3, 'unit': ''},
    'h_acceptors': {'max': 10, 'ideal_max': 7, 'unit': ''},
    'rotatable_bonds': {'max': 10, 'ideal_max': 7, 'unit': ''},
    'psa': {'max': 140, 'ideal_max': 90, 'unit': 'Å²'},
}

def get_score_for_property(value, threshold_max, ideal_max=None):
    """Returns a 0-100 score (higher = better) for a given numeric property."""
    if ideal_max is None:
        ideal_max = threshold_max
    if value <= ideal_max:
        return 100
    elif value <= threshold_max:
        # linearly degrade from 100 to 60 in the 'acceptable' zone
        ratio = (value - ideal_max) / (threshold_max - ideal_max)
        return round(100 - ratio * 40)
    else:
        # fail zone: degrade from 60 toward 0
        overshoot = value - threshold_max
        penalty = min(overshoot * 5, 60)
        return max(0, round(60 - penalty))

def evaluate_properties(data):
    """
    Evaluates chemical properties based on ADMET rules.
    Returns a detailed dictionary with status, message, score, detail, and tips.
    """
    try:
        weight          = float(data.get('weight', 0))
        logp            = float(data.get('logp', 0))
        solubility      = data.get('solubility', '').lower()
        enzyme          = data.get('enzyme', '').lower()
        h_donors        = int(data.get('h_donors', 0))
        h_acceptors     = int(data.get('h_acceptors', 0))
        rotatable_bonds = int(data.get('rotatable_bonds', 0))
        psa             = float(data.get('psa', 0))
        drug_name       = data.get('drug_name', 'Compound').strip() or 'Compound'
    except (ValueError, TypeError):
        return {'error': 'Invalid numerical input. Please check your values.'}

    results = {}

    # ── Absorption (A) ────────────────────────────────────────────────────────
    abs_issues = []
    abs_status = 'Pass'
    abs_score  = 100

    if weight > 500:
        abs_issues.append(f'Molecular weight ({weight} Da) exceeds 500 Da Lipinski limit.')
        abs_status = 'Fail'
        abs_score  = get_score_for_property(weight, 500, 400)
    elif weight > 400:
        abs_issues.append(f'Molecular weight ({weight} Da) is in the acceptable but non-ideal range (>400 Da).')
        abs_status = 'Warning' if abs_status == 'Pass' else abs_status
        abs_score  = get_score_for_property(weight, 500, 400)

    if solubility == 'poor':
        abs_issues.append('Poor aqueous solubility dramatically limits gastrointestinal absorption.')
        abs_status = 'Fail'
        abs_score  = min(abs_score, 20)
    elif solubility == 'moderate':
        abs_issues.append('Moderate solubility may reduce bioavailability.')
        abs_status = 'Warning' if abs_status == 'Pass' else abs_status
        abs_score  = min(abs_score, 60)

    if psa > 140:
        abs_issues.append(f'PSA ({psa} Å²) is too high; oral absorption decreases significantly above 140 Å².')
        abs_status = 'Fail'
        abs_score  = min(abs_score, get_score_for_property(psa, 140, 90))

    if rotatable_bonds > 10:
        abs_issues.append(f'High rotatable bond count ({rotatable_bonds}) indicates poor oral bioavailability.')
        abs_status = 'Warning' if abs_status == 'Pass' else abs_status
        abs_score  = min(abs_score, 55)

    results['Absorption'] = {
        'status':  abs_status,
        'score':   abs_score if abs_status != 'Pass' else 100,
        'message': '; '.join(abs_issues) if abs_issues else 'Excellent oral absorption predicted.',
        'detail':  'Absorption governs how much of the drug reaches systemic circulation. Lipinski\'s Rule of Five (MW ≤ 500, LogP ≤ 5, HBD ≤ 5, HBA ≤ 10) is the gold standard for oral bioavailability.',
        'tips':    'Consider prodrug strategies or nanoformulations if MW or solubility are limiting.' if abs_status != 'Pass' else 'Compound shows good oral bioavailability potential.',
        'rule':    'Lipinski Rule of Five'
    }

    # ── Distribution (D) ──────────────────────────────────────────────────────
    dist_issues = []
    dist_status = 'Pass'
    dist_score  = 100

    if logp > 5:
        dist_issues.append(f'LogP ({logp}) exceeds 5; compound is too lipophilic for efficient tissue distribution.')
        dist_status = 'Fail'
        dist_score  = get_score_for_property(logp, 5, 3)
    elif logp > 3:
        dist_issues.append(f'LogP ({logp}) is borderline high. Moderate lipophilicity may cause CNS off-target effects.')
        dist_status = 'Warning'
        dist_score  = get_score_for_property(logp, 5, 3)
    elif logp < 0:
        dist_issues.append(f'LogP ({logp}) is very low (too hydrophilic); may struggle to cross lipid membranes.')
        dist_status = 'Warning'
        dist_score  = 65

    if psa > 90:
        dist_issues.append(f'PSA ({psa} Å²) > 90 Å² may prevent CNS penetration if that is a target.')
        dist_status = 'Warning' if dist_status == 'Pass' else dist_status
        dist_score  = min(dist_score, 65)

    results['Distribution'] = {
        'status':  dist_status,
        'score':   dist_score if dist_status != 'Pass' else 100,
        'message': '; '.join(dist_issues) if dist_issues else 'Good lipophilicity profile for tissue distribution.',
        'detail':  'Distribution describes how a drug spreads into body compartments. LogP measures partition between octanol/water; ideal range is 1–3. High PSA (>90 Å²) limits CNS penetration.',
        'tips':    'Reduce lipophilicity via introduction of polar groups or salt forms.' if dist_status != 'Pass' else 'LogP is within ideal range for systemic distribution.',
        'rule':    'LogP ≤ 5, PSA ≤ 90 Å² (CNS)'
    }

    # ── Metabolism (M) ────────────────────────────────────────────────────────
    met_issues = []
    met_status = 'Pass'
    met_score  = 100

    if enzyme == 'high':
        met_issues.append('High CYP450 enzyme interference: rapid first-pass metabolism expected, reducing bioavailability.')
        met_status = 'Warning'
        met_score  = 40
    elif enzyme == 'moderate':
        met_issues.append('Moderate enzyme interference: monitor for drug-drug interactions.')
        met_status = 'Warning'
        met_score  = 70

    if rotatable_bonds > 7:
        met_issues.append(f'High rotatable bonds ({rotatable_bonds}) often correlates with increased metabolic instability.')
        met_status = 'Warning' if met_status == 'Pass' else met_status
        met_score  = min(met_score, 65)

    results['Metabolism'] = {
        'status':  met_status,
        'score':   met_score if met_status != 'Pass' else 100,
        'message': '; '.join(met_issues) if met_issues else 'Low metabolic interference expected.',
        'detail':  'Metabolism primarily occurs in the liver via CYP450 enzymes (CYP3A4, CYP2D6, etc.). Inhibition or induction of these enzymes can cause dangerous drug-drug interactions.',
        'tips':    'Consider structural modifications to reduce CYP liability or evaluate prodrug approaches.' if met_status != 'Pass' else 'Compound appears metabolically stable.',
        'rule':    'CYP450 Enzyme Interference & Metabolic Stability'
    }

    # ── Excretion (E) ─────────────────────────────────────────────────────────
    exc_issues = []
    exc_status = 'Pass'
    exc_score  = 100

    if solubility == 'poor':
        exc_issues.append('Poor solubility hinders renal filtration; risk of tubular crystallization and nephrotoxicity.')
        exc_status = 'Warning'
        exc_score  = 45
    elif solubility == 'moderate':
        exc_issues.append('Moderate solubility may slow renal clearance and prolong half-life.')
        exc_status = 'Warning'
        exc_score  = 72

    if logp > 4:
        exc_issues.append(f'High LogP ({logp}) promotes biliary excretion over renal, which can cause enterohepatic recycling.')
        exc_status = 'Warning' if exc_status == 'Pass' else exc_status
        exc_score  = min(exc_score, 55)

    results['Excretion'] = {
        'status':  exc_status,
        'score':   exc_score if exc_status != 'Pass' else 100,
        'message': '; '.join(exc_issues) if exc_issues else 'Adequate renal clearance expected.',
        'detail':  'Excretion is primarily renal (via glomerular filtration) or biliary/fecal. Water solubility is essential for renal clearance. Half-life determines dosing frequency.',
        'tips':    'Increasing hydrophilicity (e.g., adding -OH, -NH₂ groups) can improve renal clearance.' if exc_status != 'Pass' else 'Compound is predicted to clear efficiently.',
        'rule':    'Solubility & LogP-driven clearance pathways'
    }

    # ── Toxicity (T) ──────────────────────────────────────────────────────────
    tox_issues = []
    tox_status = 'Pass'
    tox_score  = 100

    if h_acceptors > 10:
        tox_issues.append(f'H-bond acceptors ({h_acceptors}) exceeds Lipinski limit of 10; may cause off-target binding.')
        tox_status = 'Fail'
        tox_score  = get_score_for_property(h_acceptors, 10, 7)
    elif h_acceptors > 7:
        tox_issues.append(f'H-bond acceptors ({h_acceptors}) approaching upper limit (10).')
        tox_status = 'Warning' if tox_status == 'Pass' else tox_status
        tox_score  = min(tox_score, 65)

    if h_donors > 5:
        tox_issues.append(f'H-bond donors ({h_donors}) exceeds Lipinski limit of 5; increases permeability issues and potential toxicity.')
        tox_status = 'Fail'
        tox_score  = min(tox_score, get_score_for_property(h_donors, 5, 3))
    elif h_donors > 3:
        tox_issues.append(f'H-bond donors ({h_donors}) approaching upper limit (5).')
        tox_status = 'Warning' if tox_status == 'Pass' else tox_status
        tox_score  = min(tox_score, 68)

    if logp > 4:
        tox_issues.append(f'LogP ({logp}) > 4 increases risk of hERG channel binding and cardiotoxicity.')
        tox_status = 'Warning' if tox_status == 'Pass' else tox_status
        tox_score  = min(tox_score, 60)

    if weight > 600:
        tox_issues.append(f'Very high MW ({weight} Da) increases risk of immune-mediated reactions.')
        tox_status = 'Fail' if tox_status == 'Pass' else tox_status
        tox_score  = min(tox_score, 25)

    results['Toxicity'] = {
        'status':  tox_status,
        'score':   tox_score if tox_status != 'Pass' else 100,
        'message': '; '.join(tox_issues) if tox_issues else 'No major toxicity flags from Lipinski analysis.',
        'detail':  'Toxicity predictions are based on structural flags including H-bond counts, hERG cardiotoxicity risk (LogP > 4), and immune reaction risk (MW > 600). Lipinski violations compound risk.',
        'tips':    'Flag compound for in-vitro hERG and Ames mutagenicity assays.' if tox_status != 'Pass' else 'Low structural toxicity flags detected.',
        'rule':    'Lipinski HBD ≤ 5, HBA ≤ 10, hERG / immune risk screens'
    }

    # ── Overall Drug-Likeness Score ───────────────────────────────────────────
    scores = [v['score'] for v in results.values()]
    overall_score = round(sum(scores) / len(scores))

    lipinski_violations = sum([
        1 if weight > 500 else 0,
        1 if logp > 5 else 0,
        1 if h_donors > 5 else 0,
        1 if h_acceptors > 10 else 0,
    ])

    if overall_score >= 80:
        overall_verdict = 'Promising'
        overall_color   = 'pass'
    elif overall_score >= 55:
        overall_verdict = 'Borderline'
        overall_color   = 'warning'
    else:
        overall_verdict = 'High Risk'
        overall_color   = 'fail'

    results['_summary'] = {
        'drug_name':           drug_name,
        'overall_score':       overall_score,
        'overall_verdict':     overall_verdict,
        'overall_color':       overall_color,
        'lipinski_violations': lipinski_violations,
        'scores':              {k: v['score'] for k, v in results.items()}
    }

    return results


@app.route('/api/evaluate_admet', methods=['POST'])
def api_evaluate():
    data = request.json
    if not data:
        return jsonify({'error': 'No input data provided.'}), 400

    evaluation = evaluate_properties(data)
    if 'error' in evaluation:
        return jsonify(evaluation), 400

    return jsonify(evaluation)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
