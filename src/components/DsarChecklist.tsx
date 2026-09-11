"use client";

// Client component because each checkbox needs to auto-submit its own form
// on change (a server component can't attach event handlers) — the server
// action itself is passed in as a prop, which Next.js supports directly.

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  doneAt: Date | string | null;
}

export default function DsarChecklist({
  requestId,
  items,
  toggleAction,
}: {
  requestId: string;
  items: ChecklistItem[];
  toggleAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <ul style={{ listStyle: "none", padding: 0, marginBottom: 24 }}>
      {items.map((item) => (
        <li key={item.id}>
          <form
            action={toggleAction}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="requestId" value={requestId} />
            <input
              type="checkbox"
              name="done"
              defaultChecked={item.done}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            <span style={{ textDecoration: item.done ? "line-through" : undefined }}>
              {item.label}
            </span>
            {item.done && item.doneAt && (
              <span style={{ color: "#666", fontSize: 12 }}>
                — {new Date(item.doneAt).toLocaleString()}
              </span>
            )}
          </form>
        </li>
      ))}
    </ul>
  );
}
