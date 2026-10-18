import React, { useState } from 'react';
import { Mail, Loader2, Send } from 'lucide-react';
import { buildReportData, getSavedReportEmail, queueReportEmail, renderReport } from '../utils/emailReport';

export default function EmailReportPanel() {
  const [email, setEmail] = useState(getSavedReportEmail());
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onPreview = () => {
    setPreview(renderReport(buildReportData(days)).text);
  };

  const onSend = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await queueReportEmail(email, days);
      setMsg({
        ok: true,
        text: `Queued: ${d.games.length} game(s), ${d.pops.length} pop(s), ${d.purchases.length} purchase(s). It sends once the Firebase "Trigger Email" extension picks it up (usually under a minute).`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not queue the email' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-black text-slate-900">Email report</h3>
      </div>
      <p className="text-[11px] text-slate-600 mb-3">
        Games played, training pops and purchases/sales from your last sync. Needs the Firebase
        "Trigger Email from Firestore" extension to be installed on your project.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5 flex-1 min-w-[200px]">
          Send to
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
          Period
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
        <button type="button" onClick={onPreview} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
          Preview
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSend}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send now
        </button>
      </div>
      {msg && (
        <div className={`mt-3 text-xs font-semibold rounded-lg px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
          {msg.text}
        </div>
      )}
      {preview && <pre className="mt-3 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">{preview}</pre>}
    </section>
  );
}
