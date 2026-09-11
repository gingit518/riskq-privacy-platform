// Seed content for the Cyber Controls library (PRD §5.4, Phase 2).
//
// This is NIST CSF 2.0's public Function/Category taxonomy (6 Functions, 22
// Categories) — a stable, widely-published reference structure, reproduced
// here in summary form (short original descriptions, not verbatim NIST text).
// See types.ts for the important caveat on `regulationGroupsTag`: it's a
// rough, indicative tag, not a verified legal mapping.
//
// Deliberately NOT seeded yet: ISO/IEC 27001:2022 Annex A, CIS Controls,
// NIST SP 800-53 — §5.4 names all of these as target frameworks, but adding
// them means either verbatim-reproducing copyrighted/licensed control text
// (ISO, CIS have usage restrictions) or authoring detailed control language
// from memory, which is exactly the kind of unverified content risk this PRD
// flags repeatedly for the regulation library (§9 item 3). Confirm sourcing
// (licensed copy, official free NIST 800-53 text, etc.) before adding those.

import type { ControlDefinition } from "./types";

export const CONTROLS: ControlDefinition[] = [
  // --- GOVERN ---
  {
    code: "GV.OC",
    framework: "NIST CSF 2.0",
    function: "Govern",
    category: "Organizational Context",
    description: "The organization's mission, stakeholder expectations, and legal/regulatory/contractual requirements relevant to cybersecurity risk are understood and inform risk decisions.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "GV.RM",
    framework: "NIST CSF 2.0",
    function: "Govern",
    category: "Risk Management Strategy",
    description: "Priorities, constraints, risk tolerance, and assumptions are established and used to support operational risk decisions.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "GV.RR",
    framework: "NIST CSF 2.0",
    function: "Govern",
    category: "Roles, Responsibilities, and Authorities",
    description: "Cybersecurity roles, responsibilities, and authorities (including a designated privacy/security lead, e.g. a DPO where required) are established and communicated.",
    regulationGroupsTag: ["International"],
  },
  {
    code: "GV.PO",
    framework: "NIST CSF 2.0",
    function: "Govern",
    category: "Policy",
    description: "Organizational cybersecurity policy is established, communicated, and enforced.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "GV.OV",
    framework: "NIST CSF 2.0",
    function: "Govern",
    category: "Oversight",
    description: "Results of cybersecurity risk management activities are used to inform, improve, and adjust the risk management strategy.",
    regulationGroupsTag: ["US Federal", "International"],
  },
  {
    code: "GV.SC",
    framework: "NIST CSF 2.0",
    function: "Govern",
    category: "Cybersecurity Supply Chain Risk Management",
    description: "Cyber supply chain risk management processes are established and agreed to by stakeholders, including vendors and third-party service providers.",
    regulationGroupsTag: ["International"],
  },

  // --- IDENTIFY ---
  {
    code: "ID.AM",
    framework: "NIST CSF 2.0",
    function: "Identify",
    category: "Asset Management",
    description: "Data, personnel, devices, systems, and facilities that enable the organization to achieve business purposes are identified and managed.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "ID.RA",
    framework: "NIST CSF 2.0",
    function: "Identify",
    category: "Risk Assessment",
    description: "The cybersecurity risk to the organization, assets, and individuals is understood, including risk from processing personal data.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "ID.IM",
    framework: "NIST CSF 2.0",
    function: "Identify",
    category: "Improvement",
    description: "Improvements to organizational cybersecurity risk management processes, procedures, and activities are identified across all Functions.",
    regulationGroupsTag: ["US Federal", "International"],
  },

  // --- PROTECT ---
  {
    code: "PR.AA",
    framework: "NIST CSF 2.0",
    function: "Protect",
    category: "Identity Management, Authentication, and Access Control",
    description: "Access to physical and logical assets is limited to authorized users, services, and devices, and is managed commensurate with risk.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "PR.AT",
    framework: "NIST CSF 2.0",
    function: "Protect",
    category: "Awareness and Training",
    description: "Personnel are provided cybersecurity awareness education and are trained to perform their cybersecurity-related duties consistent with policy.",
    regulationGroupsTag: ["US State", "International"],
  },
  {
    code: "PR.DS",
    framework: "NIST CSF 2.0",
    function: "Protect",
    category: "Data Security",
    description: "Data is managed consistently with the organization's risk strategy to protect confidentiality, integrity, and availability — the category most directly invoked by \"reasonable security\" and encryption-related requirements across privacy laws.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "PR.PS",
    framework: "NIST CSF 2.0",
    function: "Protect",
    category: "Platform Security",
    description: "The hardware, software, and services of physical and virtual platforms are managed consistently with the organization's risk strategy.",
    regulationGroupsTag: ["US Federal", "International"],
  },
  {
    code: "PR.IR",
    framework: "NIST CSF 2.0",
    function: "Protect",
    category: "Technology Infrastructure Resilience",
    description: "Security architectures are managed to protect asset confidentiality, integrity, availability, and organizational resilience.",
    regulationGroupsTag: ["US Federal", "International"],
  },

  // --- DETECT ---
  {
    code: "DE.CM",
    framework: "NIST CSF 2.0",
    function: "Detect",
    category: "Continuous Monitoring",
    description: "Assets are monitored to find anomalies, indicators of compromise, and other potentially adverse events — foundational to meeting breach-notification timelines, which start running from discovery.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "DE.AE",
    framework: "NIST CSF 2.0",
    function: "Detect",
    category: "Adverse Event Analysis",
    description: "Anomalies, indicators of compromise, and other potentially adverse events are analyzed to characterize the events and detect cybersecurity incidents.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },

  // --- RESPOND ---
  {
    code: "RS.MA",
    framework: "NIST CSF 2.0",
    function: "Respond",
    category: "Incident Management",
    description: "Responses to detected cybersecurity incidents are managed, including a documented incident response plan — the operational backbone behind every regulation's breach-notification clock.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "RS.AN",
    framework: "NIST CSF 2.0",
    function: "Respond",
    category: "Incident Analysis",
    description: "Investigations are conducted to ensure effective response and support forensic and recovery activities, including determining scope and root cause.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "RS.CO",
    framework: "NIST CSF 2.0",
    function: "Respond",
    category: "Incident Response Reporting and Communication",
    description: "Response activities are coordinated with internal and external stakeholders as required by applicable laws, regulations, or policies — directly implicated by every regulation's breach-notification-to-authority/consumer requirement.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },
  {
    code: "RS.MI",
    framework: "NIST CSF 2.0",
    function: "Respond",
    category: "Incident Mitigation",
    description: "Activities are performed to prevent expansion of an event and mitigate its effects.",
    regulationGroupsTag: ["US Federal", "US State", "International"],
  },

  // --- RECOVER ---
  {
    code: "RC.RP",
    framework: "NIST CSF 2.0",
    function: "Recover",
    category: "Incident Recovery Plan Execution",
    description: "Restoration activities are performed to ensure operational availability of systems and services affected by cybersecurity incidents.",
    regulationGroupsTag: ["US Federal", "International"],
  },
  {
    code: "RC.CO",
    framework: "NIST CSF 2.0",
    function: "Recover",
    category: "Incident Recovery Communication",
    description: "Restoration activities are coordinated with internal and external parties.",
    regulationGroupsTag: ["US Federal", "International"],
  },
];
