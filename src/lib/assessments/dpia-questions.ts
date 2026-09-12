// Generic DPIA/PIA question template (PRD §5.5), authored 2026-09-12 per
// Ariel's explicit call: a standard GDPR Art. 35-style methodology
// (description of processing / necessity & proportionality / risk to
// rights and freedoms / mitigations), NOT sourced from any specific
// customer's legal counsel or a licensed framework. Same unverified-content
// caveat as regulation_sets/controls_library elsewhere in this app (PRD §9
// item 3) — this is a reasonable starting template, not legally reviewed,
// and the UI says so wherever it's rendered. Structured as { [id]: text }
// answers on dpia_assessments rather than rigid columns so this list can
// evolve without a migration.

export interface DpiaQuestion {
  id: string;
  section: string;
  question: string;
  helpText?: string;
}

export const DPIA_QUESTIONS: DpiaQuestion[] = [
  // Section 1 — Description of processing
  {
    id: "description_nature",
    section: "1. Description of processing",
    question: "What is the nature of the processing? Describe how data is collected, used, stored, and (if applicable) shared or deleted.",
  },
  {
    id: "description_scope",
    section: "1. Description of processing",
    question: "What is the scope of the processing? How much data, how many data subjects, over what geographic area, for how long?",
  },
  {
    id: "description_context",
    section: "1. Description of processing",
    question: "What is the context of the processing? What is the relationship with data subjects, and would they reasonably expect this use of their data?",
  },
  {
    id: "description_purpose",
    section: "1. Description of processing",
    question: "What are the specific purposes of the processing, and what is the intended outcome for data subjects or the organization?",
  },
  // Section 2 — Necessity & proportionality
  {
    id: "necessity_lawful_basis",
    section: "2. Necessity & proportionality",
    question: "What is the lawful basis for the processing, and why is it the appropriate one?",
  },
  {
    id: "necessity_minimization",
    section: "2. Necessity & proportionality",
    question: "Does the processing collect only the data necessary for the stated purpose? Identify any data collected that isn't strictly necessary.",
  },
  {
    id: "necessity_alternatives",
    section: "2. Necessity & proportionality",
    question: "Were less privacy-invasive alternatives considered? Why was this approach chosen instead?",
  },
  {
    id: "necessity_retention",
    section: "2. Necessity & proportionality",
    question: "How long will the data be retained, and how was that period determined?",
  },
  // Section 3 — Risk to rights and freedoms
  {
    id: "risk_identification",
    section: "3. Risk to rights and freedoms",
    question: "What risks does this processing pose to data subjects (e.g. discrimination, loss of control, financial loss, reputational damage, physical harm)?",
  },
  {
    id: "risk_likelihood_severity",
    section: "3. Risk to rights and freedoms",
    question: "For each identified risk, what is the likelihood and severity? Consider the sensitivity of the data and the size of the affected population.",
  },
  {
    id: "risk_special_category",
    section: "3. Risk to rights and freedoms",
    question: "If special-category or otherwise sensitive data is involved, what specific risks does that create beyond ordinary personal data?",
  },
  {
    id: "risk_automated_decisions",
    section: "3. Risk to rights and freedoms",
    question: "If automated decision-making is involved, what is the impact of an incorrect or biased decision on a data subject, and is there a human-review path?",
  },
  // Section 4 — Mitigation measures
  {
    id: "mitigation_technical",
    section: "4. Mitigation measures",
    question: "What technical measures reduce the identified risks (e.g. encryption, pseudonymization, access controls)?",
  },
  {
    id: "mitigation_organizational",
    section: "4. Mitigation measures",
    question: "What organizational measures reduce the identified risks (e.g. training, policies, vendor contracts, DPA agreements)?",
  },
  {
    id: "mitigation_residual_risk",
    section: "4. Mitigation measures",
    question: "After mitigations, what residual risk remains? Is it acceptable, or does it require further action (or consultation with a supervisory authority)?",
  },
  // Section 5 — Sign-off
  {
    id: "signoff_consultation",
    section: "5. Sign-off",
    question: "Who was consulted in this assessment (DPO, legal, security, affected business units)?",
  },
];

export const DPIA_SECTIONS: string[] = Array.from(new Set(DPIA_QUESTIONS.map((q) => q.section)));
