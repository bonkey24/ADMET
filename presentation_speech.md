# ADMET Risk Profiler — Presentation Speech

**General Tips for Presenting:**
- Speak clearly and at a moderate pace.
- Pause briefly when transitioning between slides to let the audience digest the information.
- Feel free to divide the slides among your group members (Ayan, Debopriya, and Debraj).

---

### Slide 1: Title & Group Details
**"Good morning/afternoon everyone. Welcome to our presentation. Today, our team — consisting of Ayan Mondal, Debopriya Saha, and myself, Debraj De — is excited to introduce you to our B.Pharm project: the ADMET Risk Profiler. This is an advanced pharmacological tool designed to evaluate the drug-likeness of chemical compounds based on Lipinski's Rule of Five and multi-parameter ADMET criteria."**

---

### Slide 2: What is ADMET?
**"To understand our tool, we first need to look at what ADMET stands for. In pharmacology, ADMET represents the five pillars of pharmacokinetic drug evaluation: Absorption, Distribution, Metabolism, Excretion, and Toxicity.

Before a chemical compound can become a successful drug, it must perform well across all these dimensions.

For Absorption, we now evaluate GI absorption level, water solubility, and bioavailability score — alongside molecular weight and PSA — because these factors together determine how much drug actually reaches the bloodstream.

For Distribution, we look at LogP, PSA, and importantly, BBB permeability — whether the drug can cross the blood-brain barrier — which determines both efficacy for CNS targets and potential CNS side-effects.

For Metabolism, we assess structural predictors like rotatable bonds and bioavailability score, which reflect first-pass clearance and metabolic stability.

Excretion and Toxicity are evaluated using solubility, LogP, and key Lipinski structural flags."**

---

### Slide 3: Lipinski's Rule of Five
**"The core foundation of our profiler is Lipinski's Rule of Five, which is the gold standard in the pharmaceutical industry for predicting oral bioavailability. The rule states that poor absorption is likely if a molecule violates more than one of the following criteria:
First, a Molecular Weight greater than 500 Daltons.
Second, a LogP, or lipophilicity, greater than 5.
Third, having more than 5 Hydrogen-Bond Donors.
And fourth, having more than 10 Hydrogen-Bond Acceptors.
Our profiler specifically tracks these limits and flags any violations, instantly alerting the user if a compound is at high risk of failing as an oral drug."**

---

### Slide 4: Technology Stack
**"To build this robust profiling tool, we utilized a modern, full-stack architecture.
On the Frontend, we used HTML5, CSS3, and JavaScript to build a highly responsive and interactive user interface. We incorporated glassmorphism design, dynamic micro-animations, and integrated Chart.js for real-time radar chart visualizations.
For the Backend, we developed a RESTful API using Python and the Flask framework. This backend houses our custom ADMET scoring engine.
Finally, for Deployment, we utilized Vercel to host our application on a Serverless architecture, allowing for seamless scaling and fast API routing without needing to maintain a traditional server."**

---

### Slide 5: How It Works
**"Here is how a user interacts with our application. The workflow is very straightforward.
Step 1: The user inputs the compound's properties — including molecular weight, LogP, hydrogen bonds, rotatable bonds, PSA, GI absorption level, water solubility, bioavailability score, and BBB permeability — into our intuitive left-hand panel.
Step 2: By clicking 'Run Analysis', the frontend sends this data to our Python Flask backend.
Step 3: The dashboard instantly updates, displaying Pass, Warning, or Fail statuses for each ADMET category, along with a visual radar chart and actionable tips.
Step 4: The user can continue analyzing different compounds, and the application will track the history so they can compare multiple drugs side-by-side."**

---

### Slide 6: Scoring System
**"Behind the scenes, we implemented a custom scoring system. Instead of a simple pass/fail, our algorithm scores each of the five ADMET dimensions on a scale from 0 to 100.
A score between 80 and 100 results in a 'PASS', meaning the compound meets safety thresholds.
A score between 55 and 79 triggers a 'WARNING', indicating borderline properties that might require structural modification.
A score below 55 results in a 'FAIL', marking the compound as high risk.
The tool then averages these 5 scores to give an 'Overall Drug-Likeness Score', providing a quick, comprehensive summary of the drug candidate."**

---

### Slide 7: Input Parameters
**"To make these predictions, our engine now requires ten specific molecular descriptors. We use the four core Lipinski parameters: Molecular Weight, LogP, H-Bond Donors, and H-Bond Acceptors. To enhance accuracy, we also use Veber's Rules parameters: Rotatable Bonds and Polar Surface Area, which are crucial for predicting molecular flexibility and CNS penetration.

We have now replaced the older CYP450 Enzyme Interference input with four more clinically meaningful parameters:

First — GI Absorption, with two options: High or Low, which directly predicts whether the drug will be adequately absorbed from the gut.

Second — Water Solubility, rated as High, Moderate, or Poor. Poor water solubility is a major limiting factor for both absorption and renal clearance.

Third — Bioavailability Score, which is a numeric value from 0 to 1. A score of 0.55 or above indicates good oral bioavailability based on the Egan egg model. This is a key determinant of how much drug reaches systemic circulation after oral administration.

And fourth — BBB Permeability, simply Yes or No, indicating whether the drug can cross the blood-brain barrier. This is critical — it's desirable for CNS drugs like antidepressants or anti-epileptics, but undesirable for peripherally-acting drugs where CNS side-effects are a concern."**

---

### Slide 8: Key Features
**"To summarize the key features of the ADMET Risk Profiler:
It provides real-time visual feedback with live range bars that change color as you type.
It features a dynamic radar chart for visualizing the drug's overall ADMET profile.
It gives detailed risk analysis, expanding on why a compound failed and offering specific chemical tips.
It maintains an analysis history for easy comparison of multiple compounds.
It boasts a premium, responsive dark UI with glassmorphism and micro-animations.
And it is fully deployed on a modern serverless infrastructure via Vercel."**

---

### Slide 9: Test Cases
**"To validate our tool, we ran several test cases.

For example, when we input the properties of Aspirin — a well-known, highly effective peripheral analgesic — the profiler accurately returns an overall score near 100 with a 'PASS' in every category. Aspirin has high GI absorption, high water solubility, a bioavailability score of 0.85, and importantly, it does not cross the BBB — which is exactly what we expect from a safe, peripheral drug.

Conversely, if we input a hypothetical 'BadDrug-X' with extremely high molecular weight, excessive lipophilicity, low GI absorption, poor water solubility, a bioavailability score of only 0.20, and CNS penetration despite poor physicochemical properties — the system correctly flags it with multiple Lipinski violations, a score around 15, and a definitive 'FAIL'. This proves the reliability and clinical relevance of our updated scoring engine."**

---

### Slide 10: Thank You
**"In conclusion, the ADMET Risk Profiler demonstrates how modern web technologies and Python-based algorithms can be combined to create powerful educational and analytical tools for pharmacology. Our updated parameter set — which now includes GI Absorption, Water Solubility, Bioavailability Score, and BBB Permeability — makes the tool more clinically meaningful and aligned with modern drug discovery workflows. Thank you for your time and attention. We would now be happy to answer any questions you might have."**
