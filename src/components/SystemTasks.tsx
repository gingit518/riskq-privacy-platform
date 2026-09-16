"use client";

// Same shape/reasoning as DsarChecklist.tsx — each row auto-submits its own
// form on checkbox change, so this needs to be a client component even
// though the parent page is an async server component.

interface SystemTask {
  id: string;
  systemName: string;
  ownerName: string;
  ownerEmail: string;
  done: boolean;
  doneAt: Date | string | null;
}

export default function SystemTasks({
  requestId,
  tasks,
  toggleAction,
}: {
  requestId: string;
  tasks: SystemTask[];
  toggleAction: (formData: FormData) => void | Promise<void>;
}) {
  if (tasks.length === 0) {
    return (
      <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, margin: 0 }}>
        No systems registered yet — add them in{" "}
        <a href="/dsar/systems">Systems Register</a> so future requests
        auto-generate per-system tasks here.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {tasks.map((task) => (
        <li key={task.id} style={{ padding: "6px 0", borderTop: "1px solid var(--pq-line)" }}>
          <form action={toggleAction} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="requestId" value={requestId} />
            <input
              type="checkbox"
              name="done"
              defaultChecked={task.done}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            <span style={{ textDecoration: task.done ? "line-through" : undefined }}>
              {task.systemName}
            </span>
            <span style={{ color: "var(--pq-ink-muted)", fontSize: 12 }}>
              — {task.ownerName || "no owner set"}
              {task.ownerEmail && ` (${task.ownerEmail})`}
            </span>
            {task.done && task.doneAt && (
              <span style={{ color: "var(--pq-ink-muted)", fontSize: 12 }}>
                — {new Date(task.doneAt).toLocaleString()}
              </span>
            )}
          </form>
        </li>
      ))}
    </ul>
  );
}
