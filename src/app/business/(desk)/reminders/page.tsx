"use client";
import { useState, useSyncExternalStore } from "react";
import { fmtBatch, fmtDateTime } from "@/lib/dates";
import type { Reminder } from "@/lib/types";
import { reminderText, waLink } from "@/lib/whatsapp";
import { StatusBadge } from "@/components/brand";
import { DeskQueryStatus, PageTitle, useAdmin } from "@/components/admin";
import { api } from "@/components/client";
import { WhatsAppLink } from "@/components/whatsapp-button";

type R = Reminder & { customerName: string; customerPhone: string; optedIn: boolean };

export default function RemindersPage() {
  const { data, error, loading, reload } = useAdmin<{ reminders: R[] }>("/api/admin/reminders");
  const [busy, setBusy] = useState<string | null>(null);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (r: R, action: "approve" | "dismiss" | "open") => {
    setBusy(r.id);
    try {
      await api(`/api/admin/reminders/${r.id}`, { body: { action } });
      setMsg(action === "approve" ? `Approved reminder for ${r.customerName}. Now open it in WhatsApp to send it yourself.` : action === "open" ? `Opened in WhatsApp for ${r.customerName} — press Send in WhatsApp.` : `Dismissed reminder for ${r.customerName}.`);
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const list = data?.reminders ?? [];
  const queue = list.filter((r) => r.status === "pending" || r.status === "approved");
  const history = list.filter((r) => r.status !== "pending" && r.status !== "approved");

  return (
    <>
      <PageTitle title="Reminder queue" sub="Opt-in customers only. Nothing is sent by this app: approve, then open WhatsApp and press Send yourself." />
      <div className="mb-4 rounded-xl border border-dashed border-amber/50 bg-amber/5 p-3 text-[13px] text-amber">
        <b>Approval gate:</b> 1) Approve → 2) “Open in WhatsApp” becomes available → 3) you send manually. Sample phone numbers are fake placeholders. Automated sending (WhatsApp Business Platform) needs GoodCane&apos;s approval — see the write-up.
      </div>
      {msg && <p className="mb-3 rounded-xl border border-black/10 bg-white p-3 text-sm" role="status">{msg}</p>}
      <DeskQueryStatus loading={loading} error={error} hasData={!!data} emptyMessage="No reminders drafted yet." />

      {data && (
      <>
      <h2 className="mb-2 text-sm font-bold">Waiting ({queue.length})</h2>
      <div className="space-y-2">
        {queue.length === 0 && <p className="card p-5 text-center text-sm text-black/50">No reminders waiting. They are drafted automatically for opted-in customers who ordered recently but haven&apos;t ordered for the next batch.</p>}
        {queue.map((r) => {
          const text = reminderText(r.message, origin || "https://<your-deployment>");
          return (
            <div key={r.id} className="card grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b>{r.customerName}</b>
                  <span className="text-[13px] text-black/50">{r.customerPhone}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-[12px] text-black/45">for {fmtBatch(r.batchDate)}</span>
                </div>
                <p className="mt-2 rounded-xl bg-[#e7f8ee] p-3 text-[13px] leading-relaxed whitespace-pre-line text-[#073b1c]">{text}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:flex-col">
                {r.status === "pending" && (
                  <>
                    <button className="btn-green" disabled={busy === r.id || !r.optedIn} onClick={() => act(r, "approve")}>Approve</button>
                    <button className="btn-ghost" disabled={busy === r.id} onClick={() => act(r, "dismiss")}>Dismiss</button>
                  </>
                )}
                <WhatsAppLink disabled={r.status !== "approved" || !r.optedIn} href={waLink(r.customerPhone, text)} onOpen={() => act(r, "open")}>
                  Open in WhatsApp
                </WhatsAppLink>
                {r.status === "pending" && <span className="text-[11px] text-black/45">Approve first to enable</span>}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 mb-2 text-sm font-bold">History</h2>
      <div className="card divide-y divide-black/5">
        {history.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <span>
              {r.customerName} <span className="text-black/45">· {fmtBatch(r.batchDate)}</span>
            </span>
            <span className="flex items-center gap-2 text-[12px] text-black/50">
              {r.status === "opened_whatsapp" ? "Opened in WhatsApp (business sends manually)" : "Dismissed"}
              {r.openedAt || r.decidedAt ? ` · ${fmtDateTime((r.openedAt || r.decidedAt)!)}` : ""}
              <StatusBadge status={r.status} />
            </span>
          </div>
        ))}
      </div>
      </>
      )}
    </>
  );
}
