import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const inr = (n) => "Rs. " + Number(n).toLocaleString("en-IN");

function threshold(r) {
  if (r.threshold_value == null) return null;
  if (r.threshold_unit === "INR") return inr(r.threshold_value);
  if (r.threshold_unit === "PERCENT") return r.threshold_value + "%";
  return r.threshold_value + " " + (r.threshold_unit || "");
}

const BADGE = {
  FINANCIAL_TURNOVER: "bg-amber-500/15 text-amber-300",
  REGISTRATION: "bg-sky-500/15 text-sky-300",
  CERTIFICATE: "bg-violet-500/15 text-violet-300",
  EXPERIENCE: "bg-emerald-500/15 text-emerald-300",
  EMD: "bg-rose-500/15 text-rose-300",
  TENDER_FEE: "bg-orange-500/15 text-orange-300",
  PERFORMANCE_SECURITY: "bg-teal-500/15 text-teal-300",
};

export default function App() {
  const [online, setOnline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    fetch(API + "/health")
      .then((r) => setOnline(r.ok))
      .catch(() => setOnline(false));
  }, []);

  async function upload(file) {
    if (!file) return;
    setFileName(file.name);
    setError("");
    setData(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(API + "/api/extract", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Extraction failed");
      setData(json);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const mandatory = data ? data.requirements.filter((r) => r.is_mandatory).length : 0;
  const withExemptions = data ? data.requirements.filter((r) => r.exemptions.length > 0).length : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BidReady AI</h1>
          <p className="text-sm text-slate-400">Upload a tender. Know what you need before you bid.</p>
        </div>
        <span className={"text-sm px-3 py-1 rounded-full " + (online ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
          Backend: {online === null ? "checking..." : online ? "connected" : "offline"}
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
          className={"block cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition " + (drag ? "border-sky-400 bg-sky-500/10" : "border-slate-700 hover:border-slate-500")}
        >
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files[0])} />
          <p className="text-lg font-medium">{fileName || "Drop a tender PDF here, or click to choose"}</p>
          <p className="text-sm text-slate-400 mt-1">Requirements are extracted with the page and quote for each one</p>
        </label>

        {loading && (
          <div className="mt-8 text-center text-slate-300">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent mb-3"></div>
            <p>Reading the tender and extracting requirements...</p>
          </div>
        )}

        {error && <div className="mt-8 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300">{error}</div>}

        {data && (
          <section className="mt-8">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
              <p className="text-sm text-slate-400">Tender {data.tender_number}</p>
              <h2 className="text-xl font-semibold mt-1">{data.title}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                <Stat label="Estimated cost" value={data.estimated_cost ? inr(data.estimated_cost) : "N/A"} />
                <Stat label="Bid deadline" value={data.bid_deadline ? data.bid_deadline.replace("T", " ").slice(0, 16) : "N/A"} />
                <Stat label="Mandatory requirements" value={mandatory + " of " + data.requirements.length} />
                <Stat label="With exemptions" value={withExemptions} />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {data.requirements.map((r) => (
                <div key={r.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"text-xs px-2 py-1 rounded-full " + (BADGE[r.category] || "bg-slate-500/15 text-slate-300")}>
                      {r.category.replaceAll("_", " ")}
                    </span>
                    <span className={"text-xs px-2 py-1 rounded-full " + (r.is_mandatory ? "bg-rose-500/15 text-rose-300" : "bg-slate-500/15 text-slate-300")}>
                      {r.is_mandatory ? "Mandatory" : "Optional"}
                    </span>
                    {threshold(r) && <span className="ml-auto font-semibold text-sky-300">{threshold(r)}</span>}
                  </div>
                  <p className="mt-3">{r.description}</p>
                  {r.document_type_needed && <p className="mt-2 text-sm text-slate-400">Document needed: {r.document_type_needed}</p>}

                  {r.exemptions.map((x, i) => (
                    <div key={i} className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-200">
                      <b>{x.applies_to} {x.effect.toLowerCase()}</b>
                      {x.proof_document_type ? " - proof: " + x.proof_document_type : ""}
                    </div>
                  ))}

                  <p className="mt-3 text-xs text-slate-500 border-l-2 border-slate-700 pl-3">
                    Page {r.source_page}: "{r.source_quote}"
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold mt-1">{value}</p>
    </div>
  );
}
