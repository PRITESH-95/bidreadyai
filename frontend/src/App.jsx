import { useEffect, useMemo, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const inr = (n) => "Rs. " + Number(n).toLocaleString("en-IN");

const TONE = {
  blue: "text-[#0969da] bg-[#ddf4ff] border-[#54aeff66]",
  green: "text-[#1a7f37] bg-[#dafbe1] border-[#4ac26b66]",
  yellow: "text-[#9a6700] bg-[#fff8c5] border-[#d4a72c66]",
  red: "text-[#cf222e] bg-[#ffebe9] border-[#ff818266]",
  purple: "text-[#8250df] bg-[#fbefff] border-[#c297ff66]",
  orange: "text-[#bc4c00] bg-[#fff1e5] border-[#fb8f4466]",
  gray: "text-[#59636e] bg-[#f6f8fa] border-[#d0d7de]",
};

const FLASH = {
  red: "bg-[#ffebe9] border-[#ff818266] text-[#82071e]",
  yellow: "bg-[#fff8c5] border-[#d4a72c66] text-[#633c01]",
  green: "bg-[#dafbe1] border-[#4ac26b66] text-[#0f5323]",
  blue: "bg-[#ddf4ff] border-[#54aeff66] text-[#0550ae]",
  gray: "bg-[#f6f8fa] border-[#d0d7de] text-[#59636e]",
};

const nice = (c) => {
  const t = String(c).replaceAll("_", " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const CAT = {
  FINANCIAL_TURNOVER: ["Turnover", "yellow"],
  REGISTRATION: ["Registration", "blue"],
  CERTIFICATE: ["Certificate", "purple"],
  EXPERIENCE: ["Experience", "green"],
  EMD: ["EMD", "red"],
  TENDER_FEE: ["Tender fee", "orange"],
  PERFORMANCE_SECURITY: ["Performance security", "blue"],
  OTHER: ["Other", "gray"],
};
const cat = (c) => CAT[c] || [nice(c), "gray"];

function threshold(r) {
  if (r.threshold_value == null) return "";
  if (r.threshold_unit === "INR") return inr(r.threshold_value);
  if (r.threshold_unit === "PERCENT") return r.threshold_value + "%";
  return r.threshold_value + " " + (r.threshold_unit || "");
}

const STEPS = ["Read PDF pages", "Extract requirements", "Check exemptions", "Link source pages"];

const btn = "inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-[3px] border border-[#d0d7de] bg-[#f6f8fa] text-[#25292e] hover:bg-[#eaeef2] whitespace-nowrap";
const btnSm = "inline-flex items-center justify-center h-6 px-2 text-xs font-medium rounded-[3px] border border-[#d0d7de] bg-[#f6f8fa] text-[#25292e] hover:bg-[#eaeef2] whitespace-nowrap";
const btnPrimary = "inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-[3px] border border-[#1f232826] bg-[#1f883d] text-white hover:bg-[#1a7f37] whitespace-nowrap";
const inputCls = "w-full h-8 px-3 text-sm bg-white border border-[#d0d7de] rounded-[3px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] placeholder:text-[#59636e]";

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

const STATUS = {
  pass: ["Met", "green", "check", "text-[#1a7f37]"],
  fail: ["Not met", "red", "x", "text-[#cf222e]"],
  gap: ["Missing", "yellow", "alert", "text-[#9a6700]"],
  unknown: ["Needs input", "gray", "alert", "text-[#59636e]"],
  info: ["Payment", "blue", "dot", "text-[#0969da]"],
  review: ["Manual check", "gray", "dot", "text-[#59636e]"],
};

const VERDICT = {
  Proceed: { head: "All checks have passed", box: "border-[#4ac26b66]", bar: "bg-[#dafbe1]", ink: "text-[#1a7f37]", icon: "check" },
  Investigate: { head: "Some checks need attention", box: "border-[#d4a72c66]", bar: "bg-[#fff8c5]", ink: "text-[#9a6700]", icon: "alert" },
  Avoid: { head: "Some checks were not successful", box: "border-[#ff818266]", bar: "bg-[#ffebe9]", ink: "text-[#cf222e]", icon: "x" },
};

function loadProfile() {
  try {
    const raw = localStorage.getItem("bidready_profile");
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { turnover: "", order: "", msme: false };
}

/* ---------- built-in sample + saved results ---------- */
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

/* ---------- small building blocks ---------- */
function Label({ tone = "gray", children }) {
  return (
    <span className={"inline-block whitespace-nowrap text-xs leading-[18px] px-[7px] border rounded-[2px] font-medium " + TONE[tone]}>
      {children}
    </span>
  );
}

function Box({ title, right, children, className = "" }) {
  return (
    <div className={"border border-[#d0d7de] rounded-[3px] bg-white " + className}>
      {title !== undefined && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#f6f8fa] border-b border-[#d0d7de] rounded-t-[3px]">
          <h3 className="text-sm font-semibold text-[#1f2328]">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function Icon({ name, className = "" }) {
  const p = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "square", className: className };
  if (name === "check") return <svg {...p}><polyline points="3,8.5 6.5,12 13,4.5" /></svg>;
  if (name === "x") return <svg {...p}><path d="M4 4L12 12M12 4L4 12" /></svg>;
  if (name === "alert") return <svg {...p}><path d="M8 2.5L14 13H2L8 2.5Z" /><path d="M8 6.5V9.5M8 11.3V11.4" /></svg>;
  return <svg {...p}><circle cx="8" cy="8" r="2.2" /></svg>;
}

function NavTab({ active, onClick, count, children }) {
  return (
    <button
      onClick={onClick}
      className={"px-3 pt-1.5 pb-2 text-sm whitespace-nowrap border-b-2 hover:bg-[#eaeef2] rounded-t-[3px] " + (active ? "border-[#fd8c73] font-semibold" : "border-transparent")}
    >
      {children}
      {count != null && <span className="ml-1.5 px-1.5 text-xs bg-[#818b981f] rounded-[2px]">{count}</span>}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-[#59636e]">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function PayRow({ k, v, note }) {
  return (
    <div className="px-4 py-3 border-b border-[#d0d7de] last:border-b-0 flex items-start justify-between gap-3">
      <div>
        <p>{k}</p>
        {note && <p className="text-xs text-[#1a7f37] mt-0.5">{note}</p>}
      </div>
      <p className="font-semibold text-right">{v}</p>
    </div>
  );
}

export default function App() {
  const [online, setOnline] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [view, setView] = useState("home");
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

  function goHome() {
    setViewer(null);
    setView("home");
    if (phase === "error") {
      setError("");
      setPhase("idle");
    }
  }

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
    setView("home");
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
      setView("result");
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
    setView("result");
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

  const copyText = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch (e) { /* ignore */ }
  };

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
  const passN = results.filter((x) => x.e.s === "pass").length;
  const verdict = hardFails.length > 0 ? "Avoid" : gaps.length > 0 ? "Investigate" : "Proceed";
  const VV = VERDICT[verdict];

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
  const urgency = daysLeft == null ? null : daysLeft < 0 ? "red" : daysLeft <= 3 ? "red" : daysLeft <= 7 ? "yellow" : "green";
  const leftLabel = daysLeft == null ? "N/A" : daysLeft < 0 ? "Closed " + Math.abs(daysLeft) + " day(s) ago" : daysLeft === 0 ? "Closes today" : daysLeft + " day(s) left";

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

  const mandatory = reqs.filter((r) => r.is_mandatory).length;
  const withEx = reqs.filter((r) => r.exemptions && r.exemptions.length > 0).length;
  const ambiguous = reqs.filter((r) => r.is_ambiguous).length;
  const ready = Object.values(done).filter(Boolean).length;
  const hasResult = !!data && phase === "done";

  function openTab(t) {
    setTab(t);
    setView("result");
  }

  return (
    <div className="min-h-screen bg-white text-[#1f2328] text-sm leading-[1.5] print:bg-white print:text-black">
      <header className="print:hidden bg-[#f6f8fa] border-b border-[#d0d7de]">
        <div className="max-w-[1216px] mx-auto px-4 md:px-6">
          <div className="flex items-center gap-3 pt-4 pb-3">
            <button
              onClick={goHome}
              title="BidReady home"
              aria-label="BidReady home"
              className="h-8 w-8 grid place-items-center bg-[#1f2328] hover:bg-[#32383f] text-white text-base font-bold rounded-[3px]"
            >
              B
            </button>
            <nav className="min-w-0 flex items-center gap-1.5 text-base">
              <button onClick={goHome} className="text-[#0969da] hover:underline">BidReady</button>
              <span className="text-[#59636e]">/</span>
              <span className="font-semibold truncate max-w-[50vw]">{view === "result" && file ? file.name : "Tender analysis"}</span>
            </nav>
            <div className="ml-auto">
              <Label tone={online === null ? "gray" : online ? "green" : "red"}>
                {online === null ? "API: checking" : online ? "API: connected" : "API: offline"}
              </Label>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <NavTab active={view === "home"} onClick={goHome}>Analyze</NavTab>
            {hasResult && (
              <>
                <NavTab active={view === "result" && tab === "reqs"} onClick={() => openTab("reqs")} count={reqs.length}>Requirements</NavTab>
                <NavTab active={view === "result" && tab === "fit"} onClick={() => openTab("fit")}>Can I bid?</NavTab>
                <NavTab active={view === "result" && tab === "cash"} onClick={() => openTab("cash")}>Cash needed</NavTab>
                <NavTab active={view === "result" && tab === "queries"} onClick={() => openTab("queries")} count={queries.length}>Pre-bid queries</NavTab>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="print:hidden max-w-[1216px] mx-auto px-4 md:px-6 py-6">
        {view === "home" && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-8">
            <section className="min-w-0">
              <h1 className="text-2xl font-semibold">Analyze a tender</h1>
              <p className="mt-1 text-[#59636e] max-w-[620px]">
                Upload a tender PDF. BidReady lists the eligibility requirements, fees and deadlines, and links each one to the page it was taken from.
              </p>

              {hasResult && (
                <div className={"mt-5 border rounded-[3px] px-4 py-3 flex items-center justify-between gap-3 " + FLASH.blue}>
                  <span className="min-w-0 truncate"><b>{file ? file.name : "Analysis"}</b> is still open.</span>
                  <button onClick={() => setView("result")} className={btn}>Back to results</button>
                </div>
              )}

              {phase === "error" && (
                <div className={"mt-5 border rounded-[3px] px-4 py-3 " + FLASH.red}>
                  <p className="font-semibold">The tender could not be analyzed</p>
                  <p className="mt-1 break-words">{error}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => upload(file)} className={btnPrimary}>Retry</button>
                    <button onClick={() => { setError(""); setPhase("idle"); }} className={btn}>Dismiss</button>
                  </div>
                </div>
              )}

              {phase !== "loading" && (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
                  className={"mt-5 block cursor-pointer border border-dashed rounded-[3px] px-6 py-12 text-center " + (drag ? "border-[#0969da] bg-[#ddf4ff]" : "border-[#d0d7de] bg-[#f6f8fa] hover:bg-[#eff2f5]")}
                >
                  <input
                    ref={input}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; upload(f); }}
                  />
                  <p className="font-semibold">Drag a tender PDF here</p>
                  <p className="text-[#59636e] my-1">or</p>
                  <span className={btnPrimary}>Choose PDF</span>
                </label>
              )}

              {phase === "loading" && (
                <Box
                  className="mt-5"
                  title={"Analyzing " + (file ? file.name : "tender")}
                  right={<span className="text-xs text-[#59636e]">{secs}s</span>}
                >
                  {STEPS.map((label, i) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-[#d0d7de]">
                      <span className="flex items-center gap-2">
                        {i < step ? (
                          <Icon name="check" className="text-[#1a7f37]" />
                        ) : i === step ? (
                          <span className="inline-block h-4 w-4 border-2 border-[#0969da] border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <Icon name="dot" className="text-[#818b98]" />
                        )}
                        {label}
                      </span>
                      <span className="text-xs text-[#59636e]">{i < step ? "Done" : i === step ? "Running" : "Queued"}</span>
                    </div>
                  ))}
                  <div className="px-4 py-2 text-xs text-[#59636e] bg-[#f6f8fa] rounded-b-[3px]">
                    Large tenders can take up to a minute. Keep this tab open.
                  </div>
                </Box>
              )}
            </section>

            <aside className="min-w-0">
              <Box title="Recent analyses" right={<button onClick={loadSample} className={btnSm}>Load sample</button>}>
                {recent.length === 0 && (
                  <div className="px-4 py-4 text-[#59636e]">
                    No saved analyses yet. Results are kept in this browser only.
                  </div>
                )}
                {recent.map((x) => (
                  <div key={x.id} className="px-4 py-3 border-b border-[#d0d7de] last:border-b-0">
                    <p className="font-semibold truncate">{x.name}</p>
                    <p className="text-xs text-[#59636e]">
                      {(x.data.requirements || []).length} requirements - {new Date(x.savedAt).toLocaleString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => openSaved(x)} className={btnSm}>Open</button>
                      <button onClick={() => removeSaved(x.id)} className={btnSm}>Remove</button>
                    </div>
                  </div>
                ))}
              </Box>
            </aside>
          </div>
        )}

        {view === "result" && data && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold break-words">{data.title || "Untitled tender"}</h1>
                <p className="text-[#59636e] mt-0.5">Tender no. {data.tender_number || "-"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => window.print()} className={btn}>Print bid brief</button>
                <button onClick={download} className={btn}>Download JSON</button>
                <button onClick={goHome} className={btnPrimary}>New analysis</button>
              </div>
            </div>

            {!pdfUrl && (
              <div className={"border rounded-[3px] px-4 py-2 mb-3 text-xs " + FLASH.gray}>
                Showing a saved result. The original PDF is not stored, so View in PDF shows the quote only. Upload the file again to see the page.
              </div>
            )}

            {daysLeft != null && (
              <div className={"border rounded-[3px] px-4 py-2 mb-4 flex items-center justify-between gap-3 " + FLASH[urgency]}>
                <span>Bid deadline: {data.bid_deadline.replace("T", " ").slice(0, 16)}</span>
                <b>{leftLabel}</b>
              </div>
            )}

            <div className="grid lg:grid-cols-[1fr_296px] gap-6">
              <section className="min-w-0">
                {tab === "reqs" && (
                  <div>
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search requirements"
                        className={inputCls + " sm:flex-1"}
                      />
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="h-8 px-2 text-sm border border-[#d0d7de] rounded-[3px] bg-[#f6f8fa] text-[#25292e]"
                      >
                        <option value="ALL">All categories ({reqs.length})</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{cat(c)[0]} ({reqs.filter((r) => r.category === c).length})</option>
                        ))}
                      </select>
                    </div>

                    <Box title={shown.length + (shown.length === 1 ? " requirement" : " requirements")}>
                      {shown.length === 0 && <div className="px-4 py-8 text-center text-[#59636e]">No requirements match your search.</div>}
                      {shown.map((r) => (
                        <div key={r.id} className="border-b border-[#d0d7de] last:border-b-0">
                          <button
                            onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}
                            className="w-full text-left px-4 py-3 hover:bg-[#f6f8fa] flex items-start gap-3"
                          >
                            <span className={"mt-0.5 w-3 shrink-0 text-[#59636e] " + (open[r.id] ? "rotate-90" : "")}>&rsaquo;</span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-semibold">{r.description}</span>
                              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Label tone={cat(r.category)[1]}>{cat(r.category)[0]}</Label>
                                {r.is_mandatory && <Label tone="red">Mandatory</Label>}
                                {r.is_ambiguous && <Label tone="yellow">Needs review</Label>}
                                {r.exemptions && r.exemptions.length > 0 && <Label tone="green">Exemption</Label>}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-xs text-[#59636e]">
                              {threshold(r) && <span className="block text-sm font-semibold text-[#1f2328]">{threshold(r)}</span>}
                              Page {r.source_page}
                            </span>
                          </button>
                          {open[r.id] && (
                            <div className="px-4 pb-4 pl-10">
                              {r.document_type_needed && (
                                <p className="text-[#59636e]">Document needed: <span className="text-[#1f2328] font-medium">{r.document_type_needed}</span></p>
                              )}
                              {(r.exemptions || []).map((x, i) => (
                                <div key={i} className={"mt-2 border rounded-[3px] px-3 py-2 " + FLASH.green}>
                                  <b>{x.applies_to} - {String(x.effect || "").toLowerCase()}</b>
                                  {x.proof_document_type ? " - proof: " + x.proof_document_type : ""}
                                  {x.condition_text && <p className="mt-1 text-xs">{x.condition_text}</p>}
                                </div>
                              ))}
                              <blockquote className="mt-3 border-l-4 border-[#d0d7de] pl-3 text-[#59636e]">
                                {r.source_quote}
                                <span className="block text-xs mt-1">Page {r.source_page}</span>
                              </blockquote>
                              <button onClick={() => showSource(r)} className={"mt-3 " + btnSm}>View in PDF (page {r.source_page})</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </Box>
                  </div>
                )}

                {tab === "fit" && (
                  <div className="space-y-4">
                    <Box title="Company details">
                      <div className="p-4">
                        <div className="grid sm:grid-cols-2 gap-4">
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
                        <label className="flex items-center gap-2 mt-4 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profile.msme}
                            onChange={(e) => setProfile({ ...profile, msme: e.target.checked })}
                            className="h-4 w-4 accent-[#1f883d]"
                          />
                          <span>Registered MSME (Udyam)</span>
                        </label>
                        <p className="text-xs text-[#59636e] mt-3">Tick the documents you hold in the sidebar. These values stay in this browser.</p>
                      </div>
                    </Box>

                    <div className={"border rounded-[3px] " + VV.box}>
                      <div className={"px-4 py-3 flex items-center gap-3 rounded-t-[3px] " + VV.bar + " " + VV.ink}>
                        <Icon name={VV.icon} className="shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold">{VV.head}</p>
                          <p className="text-xs">{passN} met, {hardFails.length} not met, {gaps.length} to confirm</p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wide">{verdict}</span>
                      </div>
                      {results.map(({ r, e }) => {
                        const st = STATUS[e.s];
                        return (
                          <div key={r.id} className="px-4 py-3 border-t border-[#d0d7de] bg-white flex items-start gap-3">
                            <Icon name={st[2]} className={"mt-0.5 shrink-0 " + st[3]} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{r.description}</p>
                              <p className="text-xs text-[#59636e] mt-0.5">{e.n}</p>
                            </div>
                            <Label tone={st[1]}>{st[0]}</Label>
                            <button onClick={() => showSource(r)} className="shrink-0 text-xs text-[#0969da] hover:underline">Page {r.source_page}</button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#59636e]">
                      Indicative check based on the figures you enter. Always confirm against the tender document.
                    </p>
                  </div>
                )}

                {tab === "cash" && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Box title="To submit the bid">
                        <div className="p-4">
                          <p className="text-2xl font-semibold">{inr(profile.msme && emdWaivable ? upfrontYou : upfrontFull)}</p>
                          <p className="text-xs text-[#59636e] mt-1">
                            EMD plus tender fee. {profile.msme && emdWaivable ? "Your MSME status waives the EMD." : "Without any exemption."}
                          </p>
                        </div>
                      </Box>
                      <Box title="If you win">
                        <div className="p-4">
                          <p className="text-2xl font-semibold">{psAmt != null ? inr(psAmt) : psPct != null ? psPct + "%" : "N/A"}</p>
                          <p className="text-xs text-[#59636e] mt-1">
                            {psAmt != null ? "Performance security: " + psPct + "% of the estimated cost " + inr(data.estimated_cost) : psPct != null ? "Performance security, as a share of the contract value" : "Not stated in the tender"}
                          </p>
                        </div>
                      </Box>
                    </div>

                    <Box title="Breakdown">
                      <PayRow k="Earnest money deposit (EMD)" v={emdReq ? (emdAmt ? inr(emdAmt) : threshold(emdReq) || "See tender") : "Not found"} note={emdWaivable ? "Waived for MSME with Udyam proof" : ""} />
                      <PayRow k="Tender document fee" v={feeReq ? (feeAmt ? inr(feeAmt) : threshold(feeReq) || "See tender") : "Not found"} note="" />
                      <PayRow k="Performance security (only if you win)" v={psReq ? (psAmt != null ? inr(psAmt) : threshold(psReq) || "See tender") : "Not found"} note="" />
                    </Box>

                    {(emdReq || feeReq || psReq) && (
                      <div className="flex flex-wrap gap-2">
                        {emdReq && <button onClick={() => showSource(emdReq)} className={btn}>EMD source (page {emdReq.source_page})</button>}
                        {feeReq && <button onClick={() => showSource(feeReq)} className={btn}>Fee source (page {feeReq.source_page})</button>}
                        {psReq && <button onClick={() => showSource(psReq)} className={btn}>Security source (page {psReq.source_page})</button>}
                      </div>
                    )}
                  </div>
                )}

                {tab === "queries" && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[#59636e]">
                        Draft questions for the tender authority. Replace [Company name] before sending.
                      </p>
                      {queries.length > 0 && (
                        <button onClick={() => copyText("all", queries.map((q) => q.text).join("\n\n----------\n\n"))} className={btn}>
                          {copied === "all" ? "Copied" : "Copy all"}
                        </button>
                      )}
                    </div>
                    {queries.length === 0 && (
                      <Box><div className="px-4 py-8 text-center text-[#59636e]">Nothing unclear was flagged in this tender.</div></Box>
                    )}
                    <div className="space-y-3">
                      {queries.map((q) => (
                        <Box
                          key={q.id}
                          title={q.kind}
                          right={<span className="text-xs text-[#59636e]">Page {q.page}</span>}
                        >
                          <pre className="whitespace-pre-wrap text-xs font-mono p-4 text-[#1f2328]">{q.text}</pre>
                          <div className="flex gap-2 px-4 pb-4">
                            <button onClick={() => copyText(q.id, q.text)} className={btnSm}>{copied === q.id ? "Copied" : "Copy"}</button>
                            <button onClick={() => showSource(reqs.find((x) => x.id === q.id))} className={btnSm}>View in PDF</button>
                          </div>
                        </Box>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <aside className="min-w-0 space-y-5">
                <div>
                  <h2 className="text-base font-semibold mb-2">About</h2>
                  <Row k="Estimated cost" v={data.estimated_cost ? inr(data.estimated_cost) : "N/A"} />
                  <Row k="Bid deadline" v={data.bid_deadline ? data.bid_deadline.replace("T", " ").slice(0, 16) : "N/A"} />
                  <Row k="Time left" v={leftLabel} />
                  <Row k="Requirements" v={reqs.length} />
                  <Row k="Mandatory" v={mandatory} />
                  <Row k="With exemptions" v={withEx} />
                  <Row k="Needs review" v={ambiguous} />
                </div>

                <div className="border-t border-[#d0d7de] pt-4">
                  <h2 className="text-base font-semibold">Documents you hold</h2>
                  <p className="text-xs text-[#59636e] mt-0.5">{ready} of {docs.length} ready. Feeds the Can I bid? check.</p>
                  {docs.length === 0 && <p className="text-[#59636e] mt-3">No specific documents were listed.</p>}
                  <ul className="mt-3 space-y-2.5">
                    {docs.map((d) => (
                      <li key={d.name}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!done[d.name]}
                            onChange={() => setDone({ ...done, [d.name]: !done[d.name] })}
                            className="mt-1 h-4 w-4 accent-[#1f883d]"
                          />
                          <span className={done[d.name] ? "line-through text-[#59636e]" : ""}>
                            <span className="block">{d.name}</span>
                            <span className="block text-xs text-[#59636e]">{d.note}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      <footer className="print:hidden border-t border-[#d0d7de] mt-10">
        <div className="max-w-[1216px] mx-auto px-4 md:px-6 py-6 text-xs text-[#59636e] flex flex-wrap gap-x-6 gap-y-1">
          <span>BidReady</span>
          <span>Indicative analysis only. Verify every figure against the original tender document.</span>
        </div>
      </footer>

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
          <p className="mt-6 text-xs">Generated by BidReady. Indicative only - verify every figure against the original tender document.</p>
        </div>
      )}

      {viewer && (
        <div className="print:hidden fixed top-0 right-0 h-full w-full md:w-[560px] z-30 bg-white border-l border-[#d0d7de] flex flex-col shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 bg-[#f6f8fa] border-b border-[#d0d7de]">
            <div>
              <p className="font-semibold">Source document</p>
              <p className="text-xs text-[#59636e]">Page {viewer.page}</p>
            </div>
            <button onClick={() => setViewer(null)} className={btn}>Close</button>
          </div>
          {viewer.quote && (
            <p className="text-xs text-[#59636e] border-b border-[#d0d7de] px-4 py-3">Quote: "{viewer.quote}"</p>
          )}
          {pdfUrl ? (
            <iframe key={viewer.key} title="Tender PDF" src={pdfUrl + "#page=" + viewer.page} className="flex-1 w-full bg-white" />
          ) : (
            <div className="flex-1 p-6 text-[#59636e]">The original PDF is not stored for saved results. Upload the tender again to view page {viewer.page}.</div>
          )}
        </div>
      )}
    </div>
  );
}
