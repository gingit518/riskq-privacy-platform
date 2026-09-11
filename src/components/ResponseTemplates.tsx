"use client";

// Client component so "Copy" can use the clipboard API — the actual send
// still happens in the staff member's own email client (see
// lib/dsar/templates.ts for why there's no send-email capability here).

import { useState } from "react";

interface Templates {
  acknowledgment: string;
  completion: string;
  denial: string;
}

function TemplateBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (non-HTTPS, older browser) — the
      // textarea below is still selectable/copyable manually, so this isn't
      // a dead end, just a missed shortcut.
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{title}</strong>
        <button type="button" onClick={onCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <textarea readOnly value={text} rows={6} style={{ width: "100%", fontFamily: "inherit" }} />
    </div>
  );
}

export default function ResponseTemplates({ templates }: { templates: Templates }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2>Response templates</h2>
      <p style={{ color: "#666", fontSize: 13 }}>
        Copy into your own email client — this app doesn&apos;t send email yet.
      </p>
      <TemplateBlock title="Acknowledgment" text={templates.acknowledgment} />
      <TemplateBlock title="Completion" text={templates.completion} />
      <TemplateBlock title="Denial" text={templates.denial} />
    </div>
  );
}
