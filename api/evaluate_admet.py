from http.server import BaseHTTPRequestHandler
import json


def get_score_for_property(value, threshold_max, ideal_max=None):
    if ideal_max is None:
        ideal_max = threshold_max
    if value <= ideal_max:
        return 100
    elif value <= threshold_max:
        ratio = (value - ideal_max) / (threshold_max - ideal_max)
        return round(100 - ratio * 40)
    else:
        overshoot = value - threshold_max
        penalty = min(overshoot * 5, 60)
        return max(0, round(60 - penalty))


def evaluate_properties(data):
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
        return {'error': 'Invalid numerical input.'}

    results = {}

    # Absorption
    abs_issues, abs_status, abs_score = [], 'Pass', 100
    if weight > 500:
        abs_issues.append(f'Molecular weight ({weight} Da) exceeds 500 Da Lipinski limit.')
        abs_status = 'Fail'; abs_score = get_score_for_property(weight, 500, 400)
    elif weight > 400:
        abs_issues.append(f'Molecular weight ({weight} Da) is in the acceptable but non-ideal range.')
        abs_status = 'Warning'; abs_score = get_score_for_property(weight, 500, 400)
    if solubility == 'poor':
        abs_issues.append('Poor aqueous solubility limits gastrointestinal absorption.')
        abs_status = 'Fail'; abs_score = min(abs_score, 20)
    elif solubility == 'moderate':
        abs_issues.append('Moderate solubility may reduce bioavailability.')
        abs_status = 'Warning' if abs_status == 'Pass' else abs_status; abs_score = min(abs_score, 60)
    if psa > 140:
        abs_issues.append(f'PSA ({psa} Å²) too high; oral absorption drops above 140 Å².')
        abs_status = 'Fail'; abs_score = min(abs_score, get_score_for_property(psa, 140, 90))
    if rotatable_bonds > 10:
        abs_issues.append(f'High rotatable bonds ({rotatable_bonds}) indicates poor oral bioavailability.')
        abs_status = 'Warning' if abs_status == 'Pass' else abs_status; abs_score = min(abs_score, 55)
    results['Absorption'] = {
        'status': abs_status, 'score': abs_score if abs_status != 'Pass' else 100,
        'message': '; '.join(abs_issues) if abs_issues else 'Excellent oral absorption predicted.',
        'detail': "Absorption governs how much drug reaches systemic circulation. Lipinski's Rule of Five (MW ≤ 500, LogP ≤ 5, HBD ≤ 5, HBA ≤ 10) is the gold standard for oral bioavailability.",
        'tips': 'Consider prodrug strategies or nanoformulations if MW or solubility are limiting.' if abs_status != 'Pass' else 'Compound shows good oral bioavailability potential.',
        'rule': 'Lipinski Rule of Five'
    }

    # Distribution
    dist_issues, dist_status, dist_score = [], 'Pass', 100
    if logp > 5:
        dist_issues.append(f'LogP ({logp}) exceeds 5; too lipophilic for efficient distribution.')
        dist_status = 'Fail'; dist_score = get_score_for_property(logp, 5, 3)
    elif logp > 3:
        dist_issues.append(f'LogP ({logp}) is borderline high; may cause CNS off-target effects.')
        dist_status = 'Warning'; dist_score = get_score_for_property(logp, 5, 3)
    elif logp < 0:
        dist_issues.append(f'LogP ({logp}) very low; may struggle to cross lipid membranes.')
        dist_status = 'Warning'; dist_score = 65
    if psa > 90:
        dist_issues.append(f'PSA ({psa} Å²) > 90 Å² may prevent CNS penetration.')
        dist_status = 'Warning' if dist_status == 'Pass' else dist_status; dist_score = min(dist_score, 65)
    results['Distribution'] = {
        'status': dist_status, 'score': dist_score if dist_status != 'Pass' else 100,
        'message': '; '.join(dist_issues) if dist_issues else 'Good lipophilicity profile for tissue distribution.',
        'detail': 'Distribution describes how a drug spreads into body compartments. LogP measures partition between octanol/water; ideal range is 1–3.',
        'tips': 'Reduce lipophilicity via polar groups or salt forms.' if dist_status != 'Pass' else 'LogP is within ideal range for systemic distribution.',
        'rule': 'LogP ≤ 5, PSA ≤ 90 Å² (CNS)'
    }

    # Metabolism
    met_issues, met_status, met_score = [], 'Pass', 100
    if enzyme == 'high':
        met_issues.append('High CYP450 interference: rapid first-pass metabolism expected.')
        met_status = 'Warning'; met_score = 40
    elif enzyme == 'moderate':
        met_issues.append('Moderate enzyme interference: monitor for drug-drug interactions.')
        met_status = 'Warning'; met_score = 70
    if rotatable_bonds > 7:
        met_issues.append(f'High rotatable bonds ({rotatable_bonds}) often correlates with metabolic instability.')
        met_status = 'Warning' if met_status == 'Pass' else met_status; met_score = min(met_score, 65)
    results['Metabolism'] = {
        'status': met_status, 'score': met_score if met_status != 'Pass' else 100,
        'message': '; '.join(met_issues) if met_issues else 'Low metabolic interference expected.',
        'detail': 'Metabolism primarily occurs via CYP450 enzymes. Inhibition or induction can cause dangerous drug-drug interactions.',
        'tips': 'Consider structural modifications to reduce CYP liability.' if met_status != 'Pass' else 'Compound appears metabolically stable.',
        'rule': 'CYP450 Enzyme Interference & Metabolic Stability'
    }

    # Excretion
    exc_issues, exc_status, exc_score = [], 'Pass', 100
    if solubility == 'poor':
        exc_issues.append('Poor solubility hinders renal filtration; risk of tubular crystallization.')
        exc_status = 'Warning'; exc_score = 45
    elif solubility == 'moderate':
        exc_issues.append('Moderate solubility may slow renal clearance and prolong half-life.')
        exc_status = 'Warning'; exc_score = 72
    if logp > 4:
        exc_issues.append(f'High LogP ({logp}) promotes biliary excretion and enterohepatic recycling.')
        exc_status = 'Warning' if exc_status == 'Pass' else exc_status; exc_score = min(exc_score, 55)
    results['Excretion'] = {
        'status': exc_status, 'score': exc_score if exc_status != 'Pass' else 100,
        'message': '; '.join(exc_issues) if exc_issues else 'Adequate renal clearance expected.',
        'detail': 'Excretion is primarily renal or biliary. Water solubility is essential for renal clearance.',
        'tips': 'Increasing hydrophilicity can improve renal clearance.' if exc_status != 'Pass' else 'Compound is predicted to clear efficiently.',
        'rule': 'Solubility & LogP-driven clearance pathways'
    }

    # Toxicity
    tox_issues, tox_status, tox_score = [], 'Pass', 100
    if h_acceptors > 10:
        tox_issues.append(f'H-bond acceptors ({h_acceptors}) exceeds Lipinski limit of 10.')
        tox_status = 'Fail'; tox_score = get_score_for_property(h_acceptors, 10, 7)
    elif h_acceptors > 7:
        tox_issues.append(f'H-bond acceptors ({h_acceptors}) approaching upper limit (10).')
        tox_status = 'Warning' if tox_status == 'Pass' else tox_status; tox_score = min(tox_score, 65)
    if h_donors > 5:
        tox_issues.append(f'H-bond donors ({h_donors}) exceeds Lipinski limit of 5.')
        tox_status = 'Fail'; tox_score = min(tox_score, get_score_for_property(h_donors, 5, 3))
    elif h_donors > 3:
        tox_issues.append(f'H-bond donors ({h_donors}) approaching upper limit (5).')
        tox_status = 'Warning' if tox_status == 'Pass' else tox_status; tox_score = min(tox_score, 68)
    if logp > 4:
        tox_issues.append(f'LogP ({logp}) > 4 increases risk of hERG channel binding and cardiotoxicity.')
        tox_status = 'Warning' if tox_status == 'Pass' else tox_status; tox_score = min(tox_score, 60)
    if weight > 600:
        tox_issues.append(f'Very high MW ({weight} Da) increases risk of immune-mediated reactions.')
        tox_status = 'Fail' if tox_status != 'Fail' else tox_status; tox_score = min(tox_score, 25)
    results['Toxicity'] = {
        'status': tox_status, 'score': tox_score if tox_status != 'Pass' else 100,
        'message': '; '.join(tox_issues) if tox_issues else 'No major toxicity flags from Lipinski analysis.',
        'detail': 'Toxicity predictions based on H-bond counts, hERG cardiotoxicity risk (LogP > 4), and immune reaction risk (MW > 600).',
        'tips': 'Flag compound for in-vitro hERG and Ames mutagenicity assays.' if tox_status != 'Pass' else 'Low structural toxicity flags detected.',
        'rule': 'Lipinski HBD ≤ 5, HBA ≤ 10, hERG / immune risk screens'
    }

    scores = [v['score'] for v in results.values()]
    overall_score = round(sum(scores) / len(scores))
    lipinski_violations = sum([weight > 500, logp > 5, h_donors > 5, h_acceptors > 10])
    overall_verdict = 'Promising' if overall_score >= 80 else ('Borderline' if overall_score >= 55 else 'High Risk')
    overall_color   = 'pass'     if overall_score >= 80 else ('warning'   if overall_score >= 55 else 'fail')

    results['_summary'] = {
        'drug_name': drug_name, 'overall_score': overall_score,
        'overall_verdict': overall_verdict, 'overall_color': overall_color,
        'lipinski_violations': lipinski_violations,
        'scores': {k: v['score'] for k, v in results.items()}
    }
    return results


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)
        try:
            data   = json.loads(body)
            result = evaluate_properties(data)
            code   = 400 if 'error' in result else 200
        except Exception as e:
            result = {'error': str(e)}
            code   = 400

        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def log_message(self, format, *args):
        pass
