# 🧪 ADMET Risk Profiler

> An advanced drug-likeness evaluation tool based on **Lipinski's Rule of Five** and multi-parameter pharmacological analysis.

---

## 📋 What It Does

The ADMET Risk Profiler evaluates chemical compounds against standard pharmacological safety rules and scores them across five dimensions:

| Letter | Property | What It Measures |
|--------|-----------|-----------------|
| **A** | Absorption | How well the drug is absorbed (oral bioavailability) |
| **D** | Distribution | How the drug spreads through body compartments |
| **M** | Metabolism | How the liver processes the drug (CYP450 enzymes) |
| **E** | Excretion | How the kidneys clear the drug |
| **T** | Toxicity | Structural flags for potential toxic effects |

Each property is graded **Pass ✅**, **Warning ⚠️**, or **Fail ❌** and given a score out of 100.

---

## 🗂️ Project Structure

```
ADMET/
├── app.py              # Flask backend — evaluation engine & API
├── index.html          # Frontend UI — form & dashboard
├── styles.css          # Styling — dark theme, animations, colors
├── script.js           # Frontend logic — fetch, chart, history
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

---

## ⚙️ Requirements

- **Python 3.7+**
- **pip** (Python package manager)
- A modern web browser (Chrome, Firefox, Edge)

---

## 🚀 How to Run

### Step 1 — Install Dependencies

Open a terminal in the `ADMET` folder and run:

```bash
pip install -r requirements.txt
```

This installs **Flask** and **flask-cors**.

---

### Step 2 — Start the Backend (Flask API)

In **Terminal 1**, run:

```bash
python app.py
```

You should see:
```
* Running on http://127.0.0.1:5000
```

> Keep this terminal open. The backend listens on **port 5000**.

---

### Step 3 — Start the Frontend Server

Open a **second terminal** in the same `ADMET` folder and run:

```bash
python -m http.server 8000
```

> Keep this terminal open too. The frontend is served on **port 8000**.

---

### Step 4 — Open the App

Open your browser and navigate to:

```
http://localhost:8000/index.html
```

> ⚠️ **Do NOT open `index.html` by double-clicking it.** The browser will block the API calls when opened as a `file://` path. Always use the `http://localhost:8000` URL.

---

## 🧬 Input Parameters

| Parameter | Unit | Lipinski Limit | Description |
|-----------|------|----------------|-------------|
| Molecular Weight | Da | ≤ 500 | Sum of atomic masses |
| LogP | — | ≤ 5 | Lipophilicity (octanol/water partition) |
| H-Bond Donors | count | ≤ 5 | Number of –OH and –NH groups |
| H-Bond Acceptors | count | ≤ 10 | Number of N and O atoms |
| Rotatable Bonds | count | ≤ 10 | Veber rule for oral bioavailability |
| Polar Surface Area | Å² | ≤ 140 | Veber rule; CNS penetration needs ≤ 90 |
| Aqueous Solubility | — | High | GI absorption & renal clearance |
| CYP450 Interference | — | Low | First-pass metabolism risk |

---

## 🧪 Test Cases

### ✅ Perfect Drug (all Pass)
```
Name:             Aspirin
Molecular Weight: 180
LogP:             1.2
H-Bond Donors:    1
H-Bond Acceptors: 4
Rotatable Bonds:  3
Polar Surface Area: 63.6
Solubility:       High
Enzyme:           Low
```

### ❌ High-Risk Compound (multiple Fail/Warning)
```
Name:             BadDrug-X
Molecular Weight: 750
LogP:             6.5
H-Bond Donors:    8
H-Bond Acceptors: 14
Rotatable Bonds:  12
Polar Surface Area: 180
Solubility:       Poor
Enzyme:           High
```

---

## 🛑 Stopping the Servers

Press `Ctrl + C` in each terminal to stop the servers.

---

## 📌 Notes

- This tool is for **educational purposes only** and does not replace professional pharmacological analysis.
- Rules are based on **Lipinski's Rule of Five** and the **Veber rules** for oral bioavailability.
- The analysis history is stored in-memory and resets on page refresh.
