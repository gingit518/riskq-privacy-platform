"use client";

// Client component so "Copy" can use the clipboard API — the actual send
// still happens in the staff member's own email client (see
// lib/dsar/templates.ts for why there's no send-email capability here).

import { useState } from "react";
import Button from "@/components/Button";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ fontSize: 13.5 }}>{title}</strong>
        <Button type="button" variant="secondary" onClick={onCopy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={6}
        style={{ width: "100%", fontFamily: "inherit", fontSize: 13, borderRadius: 8 }}
      />
    </div>
  );
}

export default function ResponseTemplates({ templates }: { templates: Templates }) {
  return (
    <div>
      <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, marginTop: 0 }}>
        Copy into your own email client — this app doesn&apos;t send email yet.
      </p>
      <TemplateBlock title="Acknowledgment" text={templates.acknowledgment} />
      <TemplateBlock title="Completion" text={templates.completion} />
      <TemplateBlock title="Denial" text={templates.denial} />
    </div>
  );
}
