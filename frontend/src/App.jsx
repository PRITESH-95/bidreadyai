import { useEffect, useMemo, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const inr = (n) => "Rs. " + Number(n).toLocaleString("en-IN");

const CAT = {
  FINANCIAL_TURNOVER: ["Turnover", "text-[#d29922] border-[#d29922]/40 bg-[#d29922]/10"],
  REGISTRATION: ["Registration", "text-[#58a6ff] border-[#58a6ff]/40 bg-[#58a6ff]/10"],
  CERTIFICATE: ["Certificate", "text-[#a371f7] border-[#a371f7]/40 bg-[#a371f7]/10"],
  EXPERIENCE: ["Experience", "text-[#3fb950] border-[#3fb950]/40 bg-[#3fb950]/10"],
  EMD: ["EMD", "text-[#f85149] border-[#f85149]/40 bg-[#f85149]/10"],
  TENDER_FEE: ["Tender fee", "text-[#db6d28] border-[#db6d28]/40 bg-[#db6d28]/10"],
  PERFORMANCE_SECURITY: ["Performance security", "text-[#39c5cf] border-[#39c5cf]/40 bg-[#39c5cf]/10"],
  OTHER: ["Other", "text-[#8b949e] border-[#8b949e]/40 bg-[#8b949e]/10"],
};
const cat = (c) => CAT[c] || [String(c).replaceAll("_", " "), CAT.OTHER[1]];

function threshold(r) {
  if (r.threshold_value == null) return "";
  if (r.threshold_unit === "INR") return inr(r.threshold_value);
  if (r.threshold_unit === "PERCENT") return r.threshold_value + "%";
  return r.threshold_value + " " + (r.threshold_unit || "");
}

const STEPS = [
  "Reading the tender...",
  "Finding eligibility requirements...",
  "Checking exemptions...",
  "Linking each requirement to its page...",
  "Almost there...",
];

const btnGreen = "px-3 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium border border-[#f0f6fc]/10";
const btnGrey = "px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] text-sm font-medium border border-[#30363d]";
const inputCls = "w-full rounded-md bg-[#0d1117] border border-[#30363d] px-3 py-1.5 text-sm outline-none focus:border-[#58a6ff] placeholder:text-[#8b949e]";

/* ---------- eligibility logic (runs in the browser on the extracted data) ---------- */
function isMsme(x) {
  const a = String(x.applies_to || "").toUpperCase();
  return a.includes("MSME") || a.includes("MICRO") || a.includes("SMALL") || a.includes("UDYAM");
}

function evaluate(r, p, held) {
  const msmeEx = p.msme ? (r.exemptions || []).find(isMsme) : null;
  const waived = !!msmeEx && String(msmeEx.effect || "").toUpperCase().includes("WAIV");
  const need = r.threshold_unit === "INR" && r.threshold_value != null ? Number(r.threshold_value) : null;

  if ((r.category === "FINANCIAL_TURNOVER" || r.category === "EXPERIENCE") && need != null) {
    const raw = r.category === "FINANCIAL_TURNOVER" ? p.turnover : p.order;
    const unit = r.category === "FINANCIAL_TURNOVER" ? 1e7 : 1e5;
    const label = r.category === "FINANCIAL_TURNOVER" ? "turnover" : "largest similar order";
    if (raw === "" || isNaN(Number(raw))) return { s: "unknown", n: "Enter your " + label + " to check this" };
    const have = Number(raw) * unit;
    if (have >= need) return { s: "pass", n: "Your " + label + " " + inr(have) + " meets " + inr(need) };
    if (waived) return { s: "pass", n: "Waived for MSME - proof: " + (msmeEx.proof_document_type || "see tender") };
    if (msmeEx && msmeEx.relaxed_value != null && have >= Number(msmeEx.relaxed_value)) {
      return { s: "pass", n: "Meets the relaxed MSME limit of " + inr(msmeEx.relaxed_value) };
    }
    return { s: "fail", n: "Your " + label + " " + inr(have) + " is below " + inr(need) };
  }

  if (r.category === "EMD" || r.category === "TENDER_FEE" || r.category === "PERFORMANCE_SECURITY") {
    if (r.category === "EMD" && waived) return { s: "pass", n: "EMD waived for MSME - proof: " + (msmeEx.proof_document_type || "see tender") };
    return { s: "info", n: "Payment - see the Cash needed tab" };
  }

  if (r.document_type_needed) {
    if (held[r.document_type_needed]) return { s: "pass", n: "You have: " + r.document_type_needed };
    if (waived) return { s: "pass", n: "Waived for MSME" };
    return { s: "gap", n: "Missing: " + r.document_type_needed };
  }

  return { s: "review", n: "Check this one manually" };
}

const PILL = {
  pass: ["Meets", "text-[#3fb950] border-[#3fb950]/40 bg-[#3fb950]/10"],
  fail: ["Not met", "text-[#f85149] border-[#f85149]/40 bg-[#f85149]/10"],
  gap: ["Missing", "text-[#d29922] border-[#d29922]/40 bg-[#d29922]/10"],
  unknown: ["Need input", "text-[#8b949e] border-[#8b949e]/40 bg-[#8b949e]/10"],
  info: ["Payment", "text-[#58a6ff] border-[#58a6ff]/40 bg-[#58a6ff]/10"],
  review: ["Check", "text-[#8b949e] border-[#8b949e]/40 bg-[#8b949e]/10"],
};

function loadProfile() {
  try {
    const raw = localStorage.getItem("bidready_profile");
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { turnover: "", order: "", msme: false };
}

const mk = (id, category, description, extra) =>
  Object.assign({
    id, category, description, is_mandatory: true, is_ambiguous: false,
    threshold_value: null, threshold_unit: null, document_type_needed: null,
    exemptions: [], source_quote: description, source_page: 1,
  }, extra || {});

const MSME_EX = (page) => ({
  applies_to: "MSME", effect: "WAIVED", relaxed_value: null,
  proof_document_type: "Udyam registration certificate",
  condition_text: "Micro and Small Enterprises registered under Udyam are exempted from the turnover requirement and from payment of EMD, on submission of a valid Udyam registration certificate.",
  source_quote: "Micro and Small Enterprises registered under Udyam are exempted from the turnover requirement and from payment of EMD.",
  source_page: page,
});

const SAMPLE = {
  tender_number: "SYN/2026/001",
  title: "Supply of Office Furniture to District Office (built-in sample data)",
  estimated_cost: 4000000,
  bid_deadline: "2026-11-30T15:00:00",
  requirements: [
    mk("req-turnover", "FINANCIAL_TURNOVER", "The bidder must have an average annual turnover of not less than Rs. 5 Crore during the last three financial years.", { threshold_value: 50000000, threshold_unit: "INR", source_page: 2, exemptions: [MSME_EX(3)] }),
    mk("req-gst", "REGISTRATION", "The bidder must have a valid GST registration.", { document_type_needed: "GST registration", source_page: 2 }),
    mk("req-iso", "CERTIFICATE", "The bidder must hold a valid ISO 9001 certification.", { document_type_needed: "ISO 9001 Certificate", source_page: 2 }),
    mk("req-experience", "EXPERIENCE", "The bidder must have successfully completed at least one similar supply order of value not less than Rs. 20 lakh in the last five years.", { threshold_value: 2000000, threshold_unit: "INR", source_page: 3 }),
    mk("req-emd", "EMD", "Earnest Money Deposit (EMD) of Rs. 2,00,000/-", { threshold_value: 200000, threshold_unit: "INR", source_page: 1, source_quote: "Earnest Money Deposit (EMD): Rs. 2,00,000/-", exemptions: [MSME_EX(3)] }),
    mk("req-tender-fee", "TENDER_FEE", "Tender document fee of Rs. 1,000/-", { threshold_value: 1000, threshold_unit: "INR", source_page: 1, source_quote: "Tender document fee: Rs. 1,000/-" }),
    mk("req-performance-security", "PERFORMANCE_SECURITY", "The successful bidder shall furnish a performance security of 5% of the contract value.", { threshold_value: 5, threshold_unit: "PERCENT", source_page: 4 }),
    mk("req-submission-format", "OTHER", "Bids must be submitted online as a single PDF file.", { source_page: 4 }),
  ],
};

function loadRecent() {
  try {
    const raw = localStorage.getItem("bidready_recent");
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) return a;
    }
  } catch (e) { /* ignore */ }
  return [];
}

export default function App() {
  const [online, setOnline] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [step, setStep] = useState(0);
  const [secs, setSecs] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [done, setDone] = useState({});
  const [open, setOpen] = useState({});
  const [tab, setTab] = useState("reqs");
  const [profile, setProfile] = useState(loadProfile);
  const [viewer, setViewer] = useState(null);
  const [copied, setCopied] = useState("");
  const [recent, setRecent] = useState(loadRecent);
  const input = useRef(null);

  useEffect(() => {
    fetch(API + "/health").then((r) => setOnline(r.ok)).catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    try { localStorage.setItem("bidready_profile", JSON.stringify(profile)); } catch (e) { /* ignore */ }
  }, [profile]);

  useEffect(() => {
    if (phase !== "loading") return;
    setStep(0);
    setSecs(0);
    const a = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    const b = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [phase]);

  async function upload(f) {
    if (!f) return;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(f));
    setFile(f);
    setError("");
    setData(null);
    setFilter("ALL");
    setQuery("");
    setDone({});
    setOpen({});
    setTab("reqs");
    setViewer(null);
    setPhase("loading");
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(API + "/api/extract", { method: "POST", body: form });
      let json = null;
      try { json = await res.json(); } catch (e) { json = null; }
      if (!res.ok) throw new Error((json && json.detail) || "Extraction failed (status " + res.status + ")");
      setData(json);
      saveRecent(f, json);
      setPhase("done");
    } catch (e) {
      setError(String(e.message || e));
      setPhase("error");
    }
  }

  function saveRecent(f, json) {
    const entry = { id: String(Date.now()), name: f.name, savedAt: new Date().toISOString(), data: json };
    setRecent((prev) => {
      const next = [entry, ...prev.filter((x) => x.name !== f.name)].slice(0, 6);
      try { localStorage.setItem("bidready_recent", JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }

  function openSaved(entry) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setFile({ name: entry.name });
    setData(entry.data);
    setError("");
    setFilter("ALL");
    setQuery("");
    setDone({});
    setOpen({});
    setTab("reqs");
    setViewer(null);
    setPhase("done");
  }

  function removeSaved(id) {
    setRecent((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try { localStorage.setItem("bidready_recent", JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }

  function loadSample() {
    openSaved({ name: "Sample tender (built-in)", data: SAMPLE });
  }

  function reset() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setPhase("idle");
    setData(null);
    setFile(null);
    setError("");
    setViewer(null);
    if (input.current) input.current.value = "";
  }

  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (data.tender_number || "tender").replaceAll("/", "-") + "-requirements.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function showSource(r) {
    setViewer({ page: r.source_page || 1, quote: r.source_quote || "", key: Date.now() });
  }

  const reqs = data ? data.requirements || [] : [];
  const categories = useMemo(() => Array.from(new Set(reqs.map((r) => r.category))), [reqs]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reqs.filter((r) => {
      if (filter !== "ALL" && r.category !== filter) return false;
      if (!q) return true;
      return (r.description + " " + (r.source_quote || "") + " " + (r.document_type_needed || "")).toLowerCase().includes(q);
    });
  }, [reqs, filter, query]);

  const docs = useMemo(() => {
    const out = [];
    const seen = new Set();
    reqs.forEach((r) => {
      if (r.document_type_needed && !seen.has(r.document_type_needed)) {
        seen.add(r.document_type_needed);
        out.push({ name: r.document_type_needed, note: "Required" });
      }
      (r.exemptions || []).forEach((x) => {
        if (x.proof_document_type && !seen.has(x.proof_document_type)) {
          seen.add(x.proof_document_type);
          out.push({ name: x.proof_document_type, note: "Proof for " + x.applies_to + " exemption" });
        }
      });
    });
    return out;
  }, [reqs]);

  const results = useMemo(() => reqs.map((r) => ({ r, e: evaluate(r, profile, done) })), [reqs, profile, done]);
  const hardFails = results.filter((x) => x.e.s === "fail" && x.r.is_mandatory);
  const gaps = results.filter((x) => x.e.s === "gap" || x.e.s === "unknown" || (x.e.s === "fail" && !x.r.is_mandatory));
  const verdict = hardFails.length > 0 ? "Avoid" : gaps.length > 0 ? "Investigate" : "Proceed";
  const VCOL = {
    Proceed: "border-[#3fb950]/40 bg-[#3fb950]/10 text-[#3fb950]",
    Investigate: "border-[#d29922]/40 bg-[#d29922]/10 text-[#d29922]",
    Avoid: "border-[#f85149]/40 bg-[#f85149]/10 text-[#f85149]",
  };

  const emdReq = reqs.find((r) => r.category === "EMD");
  const feeReq = reqs.find((r) => r.category === "TENDER_FEE");
  const psReq = reqs.find((r) => r.category === "PERFORMANCE_SECURITY");
  const emdAmt = emdReq && emdReq.threshold_unit === "INR" ? Number(emdReq.threshold_value) : 0;
  const feeAmt = feeReq && feeReq.threshold_unit === "INR" ? Number(feeReq.threshold_value) : 0;
  const emdWaivable = !!(emdReq && (emdReq.exemptions || []).find((x) => isMsme(x) && String(x.effect || "").toUpperCase().includes("WAIV")));
  const upfrontFull = emdAmt + feeAmt;
  const upfrontYou = (profile.msme && emdWaivable ? 0 : emdAmt) + feeAmt;
  const psPct = psReq && psReq.threshold_unit === "PERCENT" ? Number(psReq.threshold_value) : null;
  const psAmt = psPct != null && data && data.estimated_cost ? (Number(data.estimated_cost) * psPct) / 100 : null;

  const deadlineMs = data && data.bid_deadline ? new Date(data.bid_deadline).getTime() : NaN;
  const daysLeft = isNaN(deadlineMs) ? null : Math.ceil((deadlineMs - Date.now()) / 86400000);
  const urgency = daysLeft == null ? null : daysLeft < 0 ? "closed" : daysLeft <= 3 ? "urgent" : daysLeft <= 7 ? "soon" : "ok";
  const leftLabel = daysLeft == null ? "N/A" : daysLeft < 0 ? "Closed " + Math.abs(daysLeft) + " day(s) ago" : daysLeft === 0 ? "Closes today" : daysLeft + " day(s) left";
  const URG = {
    closed: "border-[#f85149]/40 bg-[#f85149]/10 text-[#f85149]",
    urgent: "border-[#f85149]/40 bg-[#f85149]/10 text-[#f85149]",
    soon: "border-[#d29922]/40 bg-[#d29922]/10 text-[#d29922]",
    ok: "border-[#3fb950]/40 bg-[#3fb950]/10 text-[#3fb950]",
  };

  const queries = reqs
    .filter((r) => r.is_ambiguous || (r.exemptions && r.exemptions.length > 0))
    .map((r) => {
      const amb = r.is_ambiguous;
      const ask = amb
        ? "the exact meaning of this clause and which documents are accepted as proof"
        : "that the exemption for " + r.exemptions[0].applies_to + " bidders applies to this tender, and which proof document is accepted";
      return {
        id: r.id,
        kind: amb ? "Clarification" : "Exemption confirmation",
        page: r.source_page,
        text: "To,\nThe Tender Inviting Authority\n\nSubject: Pre-bid query - Tender " + (data.tender_number || "") + "\n\nReference: page " + r.source_page + ", \"" + (r.source_quote || r.description) + "\"\n\nKindly clarify " + ask + ".\n\nRegards,\n[Company name]",
      };
    });

  const copyText = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch (e) { /* ignore */ }
  };

  const mandatory = reqs.filter((r) => r.is_mandatory).length;
  const withEx = reqs.filter((r) => r.exemptions && r.exemptions.length > 0).length;
  const ambiguous = reqs.filter((r) => r.is_ambiguous).length;
  const ready = Object.values(done).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] print:bg-white print:text-black">
      <header className="print:hidden bg-[#161b22] border-b border-[#30363d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#e6edf3] text-[#0d1117] grid place-items-center font-bold">B</div>
          <div className="text-sm">
            <span className="text-[#8b949e]">bidready</span> <span className="text-[#8b949e]">/</span> <b className="text-[#e6edf3]">tender-analysis</b>
            <span className="ml-2 text-xs border border-[#30363d] rounded-full px-2 py-0.5 text-[#8b949e]">Public</span>
          </div>
        </div>
        <span className={"text-xs px-2.5 py-1 rounded-full border " + (online ? "text-[#3fb950] border-[#3fb950]/40 bg-[#3fb950]/10" : "text-[#f85149] border-[#f85149]/40 bg-[#f85149]/10")}>
          {online === null ? "checking..." : online ? "Backend connected" : "Backend offline"}
        </span>
      </header>

      <main className="print:hidden max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">BidReady AI</h1>
            <p className="text-sm text-[#8b949e]">Upload a tender. Know what you need before you bid.</p>
          </div>
          {phase === "done" && (
            <div className="flex gap-2">
              <button onClick={() => window.print()} className={btnGrey}>Print bid brief</button>
              <button onClick={download} className={btnGrey}>Download JSON</button>
              <button onClick={reset} className={btnGreen}>Upload another tender</button>
            </div>
          )}
        </div>

        {(phase === "idle" || phase === "error") && (
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
            className={"block cursor-pointer rounded-md border border-dashed p-14 text-center transition " + (drag ? "border-[#58a6ff] bg-[#58a6ff]/10" : "border-[#30363d] bg-[#161b22] hover:border-[#58a6ff]/60")}
          >
            <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files[0])} />
            <p className="text-lg font-medium">{file ? file.name : "Drop a tender PDF here, or click to choose"}</p>
            <p className="text-sm text-[#8b949e] mt-1">Every requirement comes with the page and the quote it was taken from</p>
            <span className={"inline-block mt-5 " + btnGreen}>Choose PDF</span>
          </label>
        )}

        {(phase === "idle" || phase === "error") && (
          <div className="mt-6 rounded-md border border-[#30363d] overflow-hidden">
            <div className="bg-[#161b22] px-4 py-2 text-sm flex items-center justify-between gap-3 border-b border-[#30363d]">
              <span className="text-[#8b949e]">Recent tenders (saved in this browser)</span>
              <button onClick={loadSample} className={btnGrey}>Load sample tender</button>
            </div>
            {recent.length === 0 && (
              <div className="px-4 py-4 text-sm text-[#8b949e]">Nothing saved yet. Every tender you analyse appears here and reopens instantly.</div>
            )}
            {recent.map((x) => (
              <div key={x.id} className="px-4 py-3 border-b border-[#30363d] last:border-b-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{x.name}</p>
                  <p className="text-xs text-[#8b949e]">{(x.data.requirements || []).length} requirements - saved {new Date(x.savedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openSaved(x)} className={btnGreen}>Open</button>
                  <button onClick={() => removeSaved(x.id)} className={btnGrey}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === "loading" && (
          <div className="rounded-md border border-[#30363d] bg-[#161b22] p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#58a6ff] border-t-transparent mb-4"></div>
            <p className="font-medium">{STEPS[step]}</p>
            <p className="text-sm text-[#8b949e] mt-1">{file ? file.name : ""} - {secs}s</p>
            <p className="text-xs text-[#8b949e] mt-3">Large tenders can take up to a minute. Keep this tab open.</p>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-6 rounded-md border border-[#f85149]/40 bg-[#f85149]/10 p-4">
            <p className="font-semibold text-[#f85149]">Something went wrong</p>
            <p className="text-sm mt-1 break-words text-[#e6edf3]">{error}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => upload(file)} className={btnGreen}>Retry</button>
              <button onClick={reset} className={btnGrey}>Choose another file</button>
            </div>
          </div>
        )}

        {phase === "done" && data && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <section>
              <div className="rounded-md border border-[#30363d] bg-[#161b22] px-4 py-3 mb-4">
                <p className="text-xs text-[#8b949e]">Tender {data.tender_number || "-"}</p>
                <h2 className="text-lg font-semibold">{data.title || "Untitled tender"}</h2>
              </div>

              {!pdfUrl && (
                <div className="rounded-md border border-[#30363d] bg-[#161b22] px-4 py-2 mb-4 text-xs text-[#8b949e]">
                  Showing a saved result. The original PDF is not stored, so View in PDF shows the quote only. Re-upload the file to see the page.
                </div>
              )}
              {daysLeft != null && (
                <div className={"rounded-md border px-4 py-2 mb-4 text-sm flex items-center justify-between " + URG[urgency]}>
                  <span>Bid deadline: {data.bid_deadline.replace("T", " ").slice(0, 16)}</span>
                  <b>{leftLabel}</b>
                </div>
              )}

              <div className="flex gap-1 border-b border-[#30363d] mb-4">
                <TabBtn active={tab === "reqs"} onClick={() => setTab("reqs")}>Requirements</TabBtn>
                <TabBtn active={tab === "fit"} onClick={() => setTab("fit")}>Can I bid?</TabBtn>
                <TabBtn active={tab === "cash"} onClick={() => setTab("cash")}>Cash needed</TabBtn>
                <TabBtn active={tab === "queries"} onClick={() => setTab("queries")}>Pre-bid queries ({queries.length})</TabBtn>
              </div>

              {tab === "reqs" && (
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Tab active={filter === "ALL"} onClick={() => setFilter("ALL")}>All <Count n={reqs.length} /></Tab>
                    {categories.map((c) => (
                      <Tab key={c} active={filter === c} onClick={() => setFilter(c)}>{cat(c)[0]}</Tab>
                    ))}
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Go to requirement..."
                    className={"mb-4 " + inputCls}
                  />
                  <div className="rounded-md border border-[#30363d] overflow-hidden">
                    <div className="bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] border-b border-[#30363d]">
                      {shown.length} requirement{shown.length === 1 ? "" : "s"}
                    </div>
                    {shown.length === 0 && <div className="px-4 py-6 text-sm text-[#8b949e]">No requirements match.</div>}
                    {shown.map((r) => (
                      <div key={r.id} className="border-b border-[#30363d] last:border-b-0">
                        <button
                          onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}
                          className="w-full text-left px-4 py-3 hover:bg-[#161b22] flex items-start gap-3"
                        >
                          <span className={"shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full border " + cat(r.category)[1]}>{cat(r.category)[0]}</span>
                          <span className="flex-1 text-sm">
                            {r.description}
                            <span className="block mt-1">
                              {r.is_mandatory && <Tag color="text-[#f85149] border-[#f85149]/40">Mandatory</Tag>}
                              {r.is_ambiguous && <Tag color="text-[#d29922] border-[#d29922]/40">Needs review</Tag>}
                              {r.exemptions && r.exemptions.length > 0 && <Tag color="text-[#3fb950] border-[#3fb950]/40">Exemption available</Tag>}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs text-[#8b949e]">
                            <span className="block text-sm font-semibold text-[#58a6ff]">{threshold(r)}</span>
                            Page {r.source_page}
                          </span>
                        </button>
                        {open[r.id] && (
                          <div className="px-4 pb-4 pl-6 text-sm bg-[#0d1117]">
                            {r.document_type_needed && (
                              <p className="text-[#8b949e] mt-1">Document needed: <span className="text-[#e6edf3]">{r.document_type_needed}</span></p>
                            )}
                            {(r.exemptions || []).map((x, i) => (
                              <div key={i} className="mt-2 rounded-md border border-[#3fb950]/30 bg-[#3fb950]/10 p-3 text-[#3fb950]">
                                <b>{x.applies_to} - {String(x.effect || "").toLowerCase()}</b>
                                {x.proof_document_type ? " - proof: " + x.proof_document_type : ""}
                                {x.condition_text && <p className="mt-1 text-xs text-[#e6edf3]/80">{x.condition_text}</p>}
                              </div>
                            ))}
                            <p className="mt-3 text-xs text-[#8b949e] border-l-2 border-[#30363d] pl-3">
                              Page {r.source_page}: "{r.source_quote}"
                            </p>
                            <button onClick={() => showSource(r)} className={"mt-3 " + btnGrey}>View in PDF (page {r.source_page})</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "fit" && (
                <div>
                  <div className={"rounded-md border p-5 " + VCOL[verdict]}>
                    <p className="text-xs uppercase tracking-wide opacity-80">Indicative verdict</p>
                    <p className="text-3xl font-bold mt-1">{verdict}</p>
                    <p className="text-sm mt-2 text-[#e6edf3]">
                      {verdict === "Avoid" && hardFails.length + " mandatory requirement" + (hardFails.length === 1 ? "" : "s") + " not met based on the figures you entered."}
                      {verdict === "Investigate" && gaps.length + " item" + (gaps.length === 1 ? "" : "s") + " still need a document or a figure before you can decide."}
                      {verdict === "Proceed" && "Everything checked is met. Verify the quotes before you submit."}
                    </p>
                  </div>

                  <div className="rounded-md border border-[#30363d] p-4 mt-4">
                    <h3 className="font-semibold mb-3">Your company</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Average annual turnover (Rs crore)">
                        <input
                          type="number" min="0" step="0.01" placeholder="e.g. 2.5"
                          value={profile.turnover}
                          onChange={(e) => setProfile({ ...profile, turnover: e.target.value })}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Largest similar order completed (Rs lakh)">
                        <input
                          type="number" min="0" step="0.1" placeholder="e.g. 25"
                          value={profile.order}
                          onChange={(e) => setProfile({ ...profile, order: e.target.value })}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-3 mt-4 cursor-pointer">
                      <input
                        type="checkbox" checked={profile.msme}
                        onChange={(e) => setProfile({ ...profile, msme: e.target.checked })}
                        className="h-4 w-4 accent-[#238636]"
                      />
                      <span className="text-sm">We are a registered MSME (Udyam)</span>
                    </label>
                    <p className="text-xs text-[#8b949e] mt-3">Tick the documents you hold in the checklist on the right. Your inputs stay in this browser only.</p>
                  </div>

                  <div className="rounded-md border border-[#30363d] overflow-hidden mt-4">
                    <div className="bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] border-b border-[#30363d]">Requirement by requirement</div>
                    {results.map(({ r, e }) => (
                      <div key={r.id} className="px-4 py-3 border-b border-[#30363d] last:border-b-0 flex items-start gap-3">
                        <span className={"shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full border " + PILL[e.s][1]}>{PILL[e.s][0]}</span>
                        <div className="flex-1 text-sm">
                          <p>{r.description}</p>
                          <p className="text-xs text-[#8b949e] mt-1">{e.n}</p>
                        </div>
                        <button onClick={() => showSource(r)} className="shrink-0 text-xs text-[#58a6ff] hover:underline">Page {r.source_page}</button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#8b949e] mt-3">This is an indicative check based on the figures you enter. Always confirm against the tender document.</p>
                </div>
              )}

              {tab === "queries" && (
                <div>
                  <p className="text-sm text-[#8b949e] mb-3">Draft questions to send to the tender authority before the pre-bid deadline. Replace [Company name] before sending.</p>
                  {queries.length === 0 && (
                    <div className="rounded-md border border-[#30363d] bg-[#161b22] p-4 text-sm text-[#8b949e]">Nothing unclear was flagged in this tender.</div>
                  )}
                  {queries.length > 0 && (
                    <div className="mb-3">
                      <button onClick={() => copyText("all", queries.map((q) => q.text).join("\n\n----------\n\n"))} className={btnGreen}>
                        {copied === "all" ? "Copied" : "Copy all queries"}
                      </button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {queries.map((q) => (
                      <div key={q.id} className="rounded-md border border-[#30363d] p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Tag color={q.kind === "Clarification" ? "text-[#d29922] border-[#d29922]/40" : "text-[#3fb950] border-[#3fb950]/40"}>{q.kind}</Tag>
                          <span className="text-xs text-[#8b949e]">Page {q.page}</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-xs bg-[#0d1117] border border-[#30363d] rounded-md p-3 text-[#e6edf3]">{q.text}</pre>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => copyText(q.id, q.text)} className={btnGrey}>{copied === q.id ? "Copied" : "Copy"}</button>
                          <button onClick={() => showSource(reqs.find((x) => x.id === q.id))} className={btnGrey}>View in PDF</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "cash" && (
                <div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-md border border-[#30363d] bg-[#161b22] p-5">
                      <p className="text-xs text-[#8b949e]">To submit the bid (EMD + tender fee)</p>
                      <p className="text-3xl font-bold mt-1">{inr(profile.msme && emdWaivable ? upfrontYou : upfrontFull)}</p>
                      <p className="text-xs text-[#8b949e] mt-2">
                        {profile.msme && emdWaivable ? "Your MSME status waives the EMD." : "Without any exemption."}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#30363d] bg-[#161b22] p-5">
                      <p className="text-xs text-[#8b949e]">If you win (performance security)</p>
                      <p className="text-3xl font-bold mt-1">{psAmt != null ? inr(psAmt) : psPct != null ? psPct + "%" : "N/A"}</p>
                      <p className="text-xs text-[#8b949e] mt-2">
                        {psAmt != null ? psPct + "% of the estimated cost " + inr(data.estimated_cost) : psPct != null ? "of the contract value (no estimated cost in the tender)" : "Not stated in the tender"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#30363d] overflow-hidden mt-4">
                    <div className="bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] border-b border-[#30363d]">Breakdown</div>
                    <Row2 k="Earnest money deposit (EMD)" v={emdReq ? (emdAmt ? inr(emdAmt) : threshold(emdReq) || "See tender") : "Not found"} note={emdWaivable ? "Waived for MSME with Udyam proof" : ""} />
                    <Row2 k="Tender document fee" v={feeReq ? (feeAmt ? inr(feeAmt) : threshold(feeReq) || "See tender") : "Not found"} note="" />
                    <Row2 k="Performance security" v={psReq ? (psAmt != null ? inr(psAmt) : threshold(psReq) || "See tender") : "Not found"} note="Only payable if you win" />
                  </div>
                  {(emdReq || feeReq || psReq) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {emdReq && <button onClick={() => showSource(emdReq)} className={btnGrey}>EMD source (page {emdReq.source_page})</button>}
                      {feeReq && <button onClick={() => showSource(feeReq)} className={btnGrey}>Fee source (page {feeReq.source_page})</button>}
                      {psReq && <button onClick={() => showSource(psReq)} className={btnGrey}>Security source (page {psReq.source_page})</button>}
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-md border border-[#30363d] p-4">
                <h3 className="font-semibold mb-3">About</h3>
                <Row k="Estimated cost" v={data.estimated_cost ? inr(data.estimated_cost) : "N/A"} />
                <Row k="Bid deadline" v={data.bid_deadline ? data.bid_deadline.replace("T", " ").slice(0, 16) : "N/A"} />
                <Row k="Time left" v={leftLabel} />
                <Row k="Requirements" v={reqs.length} />
                <Row k="Mandatory" v={mandatory} />
                <Row k="With exemptions" v={withEx} />
                <Row k="Needs review" v={ambiguous} />
              </div>

              <div className="rounded-md border border-[#30363d] p-4">
                <h3 className="font-semibold">Documents you hold</h3>
                <p className="text-xs text-[#8b949e] mt-1">{ready} of {docs.length} ready - this feeds the Can I bid? check</p>
                {docs.length === 0 && <p className="text-sm text-[#8b949e] mt-3">No specific documents were listed.</p>}
                <ul className="mt-3 space-y-3">
                  {docs.map((d) => (
                    <li key={d.name}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!done[d.name]}
                          onChange={() => setDone({ ...done, [d.name]: !done[d.name] })}
                          className="mt-1 h-4 w-4 accent-[#238636]"
                        />
                        <span className={done[d.name] ? "line-through text-[#8b949e]" : ""}>
                          <span className="block text-sm">{d.name}</span>
                          <span className="block text-xs text-[#8b949e]">{d.note}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        )}
      </main>

      {phase === "done" && data && (
        <div className="hidden print:block bg-white text-black p-8 text-sm">
          <h1 className="text-2xl font-bold">Bid brief</h1>
          <p className="mt-1">{data.title || "Untitled tender"}</p>
          <p>Tender {data.tender_number || "-"} | Deadline: {data.bid_deadline ? data.bid_deadline.replace("T", " ").slice(0, 16) : "N/A"} ({leftLabel})</p>
          <p>Estimated cost: {data.estimated_cost ? inr(data.estimated_cost) : "N/A"}</p>

          <h2 className="text-lg font-bold mt-5">Verdict: {verdict} (indicative)</h2>
          <p>Company inputs - turnover: {profile.turnover !== "" ? "Rs " + profile.turnover + " crore" : "not entered"}, largest similar order: {profile.order !== "" ? "Rs " + profile.order + " lakh" : "not entered"}, MSME: {profile.msme ? "yes" : "no"}.</p>
          {hardFails.length > 0 && (
            <div className="mt-2">
              <b>Not met:</b>
              <ul className="list-disc pl-5">
                {hardFails.map(({ r, e }) => (<li key={r.id}>{r.description} - {e.n} (page {r.source_page})</li>))}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div className="mt-2">
              <b>Still to confirm:</b>
              <ul className="list-disc pl-5">
                {gaps.map(({ r, e }) => (<li key={r.id}>{r.description} - {e.n} (page {r.source_page})</li>))}
              </ul>
            </div>
          )}

          <h2 className="text-lg font-bold mt-5">Cash needed</h2>
          <p>To submit (EMD + tender fee): {inr(profile.msme && emdWaivable ? upfrontYou : upfrontFull)}</p>
          <p>If you win (performance security): {psAmt != null ? inr(psAmt) : psPct != null ? psPct + "%" : "N/A"}</p>

          <h2 className="text-lg font-bold mt-5">All requirements</h2>
          <ol className="list-decimal pl-5">
            {reqs.map((r) => (
              <li key={r.id} className="mt-1">[{cat(r.category)[0]}] {r.description}{threshold(r) ? " - " + threshold(r) : ""} (page {r.source_page})</li>
            ))}
          </ol>
          <p className="mt-6 text-xs">Generated by BidReady AI. Indicative only - verify every figure against the original tender document.</p>
        </div>
      )}

      {viewer && (
        <div className="print:hidden fixed top-0 right-0 h-full w-full md:w-[560px] z-30 bg-[#0d1117] border-l border-[#30363d] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
            <div>
              <p className="text-sm font-semibold">Source document</p>
              <p className="text-xs text-[#8b949e]">Page {viewer.page}</p>
            </div>
            <button onClick={() => setViewer(null)} className={btnGrey}>Close</button>
          </div>
          {viewer.quote && (
            <p className="text-xs text-[#8b949e] border-b border-[#30363d] px-4 py-3">Quote: "{viewer.quote}"</p>
          )}
          {pdfUrl ? (
            <iframe key={viewer.key} title="Tender PDF" src={pdfUrl + "#page=" + viewer.page} className="flex-1 w-full bg-white" />
          ) : (
            <div className="flex-1 p-6 text-sm text-[#8b949e]">The original PDF is not stored for saved results. Re-upload the tender to view page {viewer.page}.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-[#30363d] last:border-b-0">
      <span className="text-[#8b949e]">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Row2({ k, v, note }) {
  return (
    <div className="px-4 py-3 border-b border-[#30363d] last:border-b-0 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm">{k}</p>
        {note && <p className="text-xs text-[#3fb950] mt-0.5">{note}</p>}
      </div>
      <p className="text-sm font-semibold text-[#58a6ff] text-right">{v}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-[#8b949e] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Count({ n }) {
  return <span className="ml-1 text-xs bg-[#30363d] rounded-full px-1.5 py-0.5">{n}</span>;
}

function Tag({ color, children }) {
  return <span className={"inline-block mr-2 text-xs border rounded-full px-2 py-0.5 " + color}>{children}</span>;
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={"text-sm px-3 py-1 rounded-md border transition " + (active ? "bg-[#1f6feb] border-[#1f6feb] text-white font-medium" : "bg-[#21262d] border-[#30363d] text-[#e6edf3] hover:bg-[#30363d]")}
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={"px-4 py-2 text-sm border-b-2 -mb-px transition " + (active ? "border-[#f78166] text-[#e6edf3] font-semibold" : "border-transparent text-[#8b949e] hover:text-[#e6edf3]")}
    >
      {children}
    </button>
  );
}
