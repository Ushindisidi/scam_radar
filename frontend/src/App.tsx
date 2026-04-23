import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

type Verdict = "SCAM" | "SUSPICIOUS" | "LIKELY LEGIT" | "LEGIT" | "INSUFFICIENT DATA" | "UNKNOWN" | "ERROR";
type Tab = "text" | "url" | "offer";
type NavPage = "home" | "analyze" | "history" | "saved" | "about";

interface Analysis {
  verdict: Verdict;
  scam_score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  red_flags: string[];
  positive_signals: string[];
  missing_information: string[];
  summary: string;
  recommendation: string;
}

interface ApiResponse {
  input: string;
  type: string;
  analysis: Analysis;
}

interface HistoryItem {
  id: string;
  input: string;
  result: ApiResponse;
  timestamp: Date;
}

const VC: Record<Verdict, { dark: string; light: string; darkBg: string; lightBg: string; darkBorder: string; lightBorder: string; icon: string; label: string; riskLabel: string }> = {
  SCAM: { dark: "#f87171", light: "#dc2626", darkBg: "rgba(239,68,68,0.1)", lightBg: "#fef2f2", darkBorder: "rgba(239,68,68,0.25)", lightBorder: "#fecaca", icon: "⚠", label: "SCAM DETECTED", riskLabel: "Very High Risk" },
  SUSPICIOUS: { dark: "#fbbf24", light: "#d97706", darkBg: "rgba(251,191,36,0.1)", lightBg: "#fffbeb", darkBorder: "rgba(251,191,36,0.25)", lightBorder: "#fde68a", icon: "◈", label: "SUSPICIOUS", riskLabel: "Medium Risk" },
  "LIKELY LEGIT": { dark: "#34d399", light: "#059669", darkBg: "rgba(52,211,153,0.1)", lightBg: "#ecfdf5", darkBorder: "rgba(52,211,153,0.25)", lightBorder: "#a7f3d0", icon: "◎", label: "LIKELY LEGIT", riskLabel: "Low Risk" },
  LEGIT: { dark: "#00d4aa", light: "#0284c7", darkBg: "rgba(0,212,170,0.1)", lightBg: "#f0f9ff", darkBorder: "rgba(0,212,170,0.25)", lightBorder: "#bae6fd", icon: "✓", label: "VERIFIED LEGIT", riskLabel: "Safe" },
  "INSUFFICIENT DATA": { dark: "#9ca3af", light: "#6b7280", darkBg: "rgba(156,163,175,0.08)", lightBg: "#f9fafb", darkBorder: "rgba(156,163,175,0.2)", lightBorder: "#e5e7eb", icon: "?", label: "INSUFFICIENT DATA", riskLabel: "Unknown" },
  UNKNOWN: { dark: "#9ca3af", light: "#6b7280", darkBg: "rgba(156,163,175,0.08)", lightBg: "#f9fafb", darkBorder: "rgba(156,163,175,0.2)", lightBorder: "#e5e7eb", icon: "?", label: "UNKNOWN", riskLabel: "Unknown" },
  ERROR: { dark: "#9ca3af", light: "#6b7280", darkBg: "rgba(156,163,175,0.08)", lightBg: "#f9fafb", darkBorder: "rgba(156,163,175,0.2)", lightBorder: "#e5e7eb", icon: "!", label: "ERROR", riskLabel: "Error" },
};

const STEPS = [
  { label: "Input parsed", sub: "Extracted key entities" },
  { label: "Detecting category", sub: "Classifying scam type" },
  { label: "Web search", sub: "Gathering sources" },
  { label: "LinkedIn scan", sub: "Company profiles & mentions" },
  { label: "Reddit scan", sub: "Scam reports & discussions" },
  { label: "Reviews & reports", sub: "Trustpilot, Glassdoor" },
  { label: "Pattern analysis", sub: "AI scam detection" },
  { label: "Generating verdict", sub: "Compiling evidence" },
];

const SOURCES = [
  { name: "Google", icon: "G", color: "#4285f4" },
  { name: "LinkedIn", icon: "in", color: "#0077b5" },
  { name: "Reddit", icon: "R", color: "#ff4500" },
  { name: "Trustpilot", icon: "★", color: "#00b67a" },
  { name: "News", icon: "N", color: "#6b7280" },
  { name: "WHOIS", icon: "W", color: "#7c3aed" },
  { name: "Social", icon: "S", color: "#ec4899" },
];

const NAV: { icon: string; label: string; id: NavPage }[] = [
  { icon: "⌂", label: "Home", id: "home" },
  { icon: "◎", label: "Analyze", id: "analyze" },
  { icon: "⊞", label: "History", id: "history" },
  { icon: "⊟", label: "Saved", id: "saved" },
  { icon: "○", label: "About", id: "about" },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function ScamRadar() {
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState<Tab>("text");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(-1);
  const [page, setPage] = useState<NavPage>("home");
  const [mounted, setMounted] = useState(false);
  const [radarAngle, setRadarAngle] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedItems, setSavedItems] = useState<HistoryItem[]>([]);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setRadarAngle(a => (a + 2) % 360), 16);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (loading) {
      setStepIndex(0);
      stepTimers.current.forEach(clearTimeout);
      stepTimers.current = STEPS.map((_, i) => setTimeout(() => setStepIndex(i), i * 1100));
    }
    return () => stepTimers.current.forEach(clearTimeout);
  }, [loading]);

  const analyze = async () => {
    if (!inputVal.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    setPage("analyze");
    try {
      const endpoint = tab === "url" ? "/analyze/url" : "/analyze/text";
      const payload = tab === "url" ? { url: inputVal } : { input_text: inputVal };
      const res = await axios.post<ApiResponse>(`${API_BASE}${endpoint}`, payload);
      setResult(res.data);
      const item: HistoryItem = { id: Date.now().toString(), input: inputVal, result: res.data, timestamp: new Date() };
      setHistory(h => [item, ...h.slice(0, 19)]);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Analysis failed. Check your backend is running.");
    } finally {
      setLoading(false);
      setStepIndex(STEPS.length);
    }
  };

  const saveResult = (item: HistoryItem) => {
    if (!savedItems.find(s => s.id === item.id)) {
      setSavedItems(s => [item, ...s]);
    }
  };

  const verdict = result?.analysis?.verdict;
  const vc = verdict ? VC[verdict] : null;
  const vColor = vc ? (dark ? vc.dark : vc.light) : "#6b7280";
  const vBg = vc ? (dark ? vc.darkBg : vc.lightBg) : "transparent";
  const vBorder = vc ? (dark ? vc.darkBorder : vc.lightBorder) : "transparent";

  // Theme tokens
  const T = {
    bg: dark ? "#080b0f" : "#f1f5f9",
    sidebar: dark ? "#0d1117" : "#1e2a4a",
    card: dark ? "#111318" : "#ffffff",
    cardBorder: dark ? "rgba(255,255,255,0.07)" : "#e2e8f0",
    text: dark ? "#e2e8f0" : "#1e293b",
    textMuted: dark ? "#4a5568" : "#64748b",
    textSec: dark ? "#94a3b8" : "#475569",
    inputBg: dark ? "#080b0f" : "#f8fafc",
    inputBorder: dark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
    divider: dark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
    accent: "#00d4aa",
    accentBlue: "#3b82f6",
    gridLine: dark ? "rgba(0,212,170,0.03)" : "rgba(30,42,74,0.04)",
    scoreBg: dark ? "rgba(255,255,255,0.04)" : "#e2e8f0",
    bottomNav: dark ? "#0d1117" : "#ffffff",
  };

  const sidebarW = isMobile ? 0 : 200;

  // ─── Pages ──────────────────────────────────────────────────────────────────

  const renderHome = () => (
    <div style={{ padding: isMobile ? "24px 16px" : "40px 32px", maxWidth: 700 }}>
      {/* Radar hero */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="34" fill="none" stroke={dark ? "rgba(0,212,170,0.12)" : "rgba(30,42,74,0.1)"} strokeWidth="1" />
            <circle cx="36" cy="36" r="22" fill="none" stroke={dark ? "rgba(0,212,170,0.08)" : "rgba(30,42,74,0.07)"} strokeWidth="1" />
            <circle cx="36" cy="36" r="10" fill="none" stroke={dark ? "rgba(0,212,170,0.12)" : "rgba(30,42,74,0.1)"} strokeWidth="1" />
            <line x1="36" y1="36"
              x2={36 + 30 * Math.cos((radarAngle - 90) * Math.PI / 180)}
              y2={36 + 30 * Math.sin((radarAngle - 90) * Math.PI / 180)}
              stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="36" cy="36" r="3" fill={T.accent} />
          </svg>
        </div>
        <div>
          <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, margin: 0, letterSpacing: "-0.03em", color: T.text }}>
            SCAM<span style={{ color: T.accent }}>RADAR</span>
          </h1>
          <p style={{ fontSize: 13, color: T.textMuted, margin: "6px 0 0", letterSpacing: "0.05em" }}>
            AI-POWERED THREAT DETECTION
          </p>
        </div>
      </div>

      <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.text, marginBottom: 12 }}>
        Detect scams before they get you
      </h2>
      <p style={{ fontSize: 15, color: T.textSec, lineHeight: 1.8, marginBottom: 32 }}>
        ScamRadar uses AI to analyze suspicious emails, job offers, websites, and investment pitches.
        Paste anything and get a verdict in seconds , with red flags, sources checked, and a clear recommendation.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {[
          { icon: "◎", title: "Multi-source search", desc: "Searches Google, Reddit, Trustpilot, Glassdoor simultaneously" },
          { icon: "⬡", title: "Kenya-aware AI", desc: "Detects M-Pesa scams, facilitation fees, WhatsApp recruitment" },
          { icon: "◈", title: "Smart summarization", desc: "Handles long emails by extracting key facts before analysis" },
          { icon: "✓", title: "Structured verdict", desc: "Score, confidence, red flags, and clear recommendation" },
        ].map(f => (
          <div key={f.title} style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 12, padding: "18px 20px",
          }}>
            <div style={{ fontSize: 22, color: T.accent, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setPage("analyze")}
        style={{
          padding: "14px 32px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${T.accent}, #00b894)`,
          color: "#080b0f", fontSize: 15, fontFamily: "inherit",
          fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em",
          boxShadow: `0 4px 20px ${T.accent}40`,
        }}
      >
        ▶ Start Analyzing
      </button>
    </div>
  );

  const renderAnalyze = () => (
    <div style={{ padding: isMobile ? "16px" : "28px 32px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 400px", gap: 20, alignItems: "start" }}>

        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Input card */}
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: isMobile ? 16 : 24 }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${T.divider}`, marginBottom: 18, gap: 0, overflowX: "auto" }}>
              {([
                { id: "text" as Tab, label: "Message / Text", icon: "✉" },
                { id: "url" as Tab, label: "Website / URL", icon: "⬡" },
                { id: "offer" as Tab, label: "Offer / Proposal", icon: "⊟" },
              ]).map(t2 => (
                <button key={t2.id}
                  onClick={() => { setTab(t2.id); setInputVal(""); setResult(null); setError(""); }}
                  style={{
                    padding: "9px 14px", border: "none", background: "transparent",
                    color: tab === t2.id ? T.accent : T.textMuted,
                    fontSize: isMobile ? 12 : 13, fontFamily: "inherit", cursor: "pointer",
                    borderBottom: tab === t2.id ? `2px solid ${T.accent}` : "2px solid transparent",
                    marginBottom: -1, fontWeight: tab === t2.id ? 700 : 400,
                    display: "flex", alignItems: "center", gap: 5,
                    whiteSpace: "nowrap", transition: "all 0.15s",
                  }}
                >
                  <span>{t2.icon}</span>{t2.label}
                </button>
              ))}
            </div>

            {tab === "url" ? (
              <input value={inputVal} onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && analyze()}
                placeholder="https://suspicious-site.com"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                  borderRadius: 10, padding: "13px 15px",
                  color: T.text, fontSize: 14, fontFamily: "inherit", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
            ) : (
              <textarea value={inputVal} onChange={e => setInputVal(e.target.value)}
                placeholder={tab === "offer"
                  ? "Paste the job offer, investment proposal, or business opportunity..."
                  : "Paste anything suspicious — emails, messages, company names, pitches..."}
                rows={isMobile ? 5 : 7}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                  borderRadius: 10, padding: "13px 15px",
                  color: T.text, fontSize: 14, fontFamily: "inherit",
                  resize: "vertical", outline: "none", lineHeight: 1.6,
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>{inputVal.length} / 3000</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setInputVal(""); setResult(null); setError(""); }}
                  style={{
                    padding: "9px 16px", borderRadius: 8,
                    border: `1px solid ${T.cardBorder}`,
                    background: "transparent", color: T.textMuted,
                    fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  }}>Clear</button>
                <button onClick={analyze} disabled={loading || !inputVal.trim()}
                  style={{
                    padding: "9px 20px", borderRadius: 8, border: "none",
                    background: loading || !inputVal.trim()
                      ? (dark ? "rgba(0,212,170,0.15)" : "#cbd5e1")
                      : `linear-gradient(135deg, ${T.accent}, #00b894)`,
                    color: loading || !inputVal.trim() ? T.textMuted : "#080b0f",
                    fontSize: 13, fontFamily: "inherit",
                    cursor: loading || !inputVal.trim() ? "not-allowed" : "pointer",
                    fontWeight: 700, boxShadow: loading || !inputVal.trim() ? "none" : `0 4px 14px ${T.accent}40`,
                  }}>
                  {loading ? "Scanning..." : "▶ Analyze Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: dark ? "rgba(239,68,68,0.1)" : "#fef2f2",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "12px 16px",
              color: dark ? "#f87171" : "#dc2626", fontSize: 13,
            }}>⚠ {error}</div>
          )}

          {/* Steps */}
          {(loading || (result && stepIndex >= 0)) && (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: isMobile ? 16 : 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Investigation in Progress</span>
                {loading && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
                    background: dark ? "rgba(34,197,94,0.15)" : "#dcfce7",
                    color: "#16a34a", padding: "3px 8px", borderRadius: 20,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse 1s infinite" }} />
                    Live
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {STEPS.map((step, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex && loading;
                  return (
                    <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i < STEPS.length - 1 ? 14 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          background: done ? "#22c55e" : active ? "white" : dark ? "#1a1d27" : "#f1f5f9",
                          border: done ? "none" : active ? `2px solid ${T.accentBlue}` : `1px solid ${T.divider}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: active ? `0 0 0 3px rgba(59,130,246,0.2)` : "none",
                          transition: "all 0.3s",
                        }}>
                          {done && <span style={{ color: "white", fontSize: 10 }}>✓</span>}
                          {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accentBlue, animation: "pulse 1s infinite" }} />}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div style={{ width: 1, flex: 1, minHeight: 10, background: done ? "#22c55e" : T.divider, margin: "3px 0", transition: "background 0.3s" }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: done || active ? 600 : 400, color: done ? "#16a34a" : active ? T.text : T.textMuted }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{step.sub}</div>
                        {(done || active) && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: done ? "#16a34a" : T.accentBlue, marginTop: 2 }}>
                            {done ? "Completed" : "In progress..."}
                          </div>
                        )}
                        {!done && !active && <div style={{ fontSize: 11, color: T.textMuted }}>Pending</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sources */}
          {result && (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: isMobile ? 16 : 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>Sources Checked</h3>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`, gap: 10 }}>
                {SOURCES.map((src, i) => (
                  <div key={src.name} style={{
                    background: dark ? "rgba(255,255,255,0.02)" : "#f8fafc",
                    border: `1px solid ${T.cardBorder}`,
                    borderRadius: 10, padding: "12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 5, background: src.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                        {src.icon}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{src.name}</span>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: i < 4 ? "#16a34a" : T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: i < 4 ? "#16a34a" : T.textMuted, display: "inline-block" }} />
                      {i < 4 ? "Completed" : "Pending"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Results */}
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 16, padding: isMobile ? 16 : 24,
          position: isMobile ? "relative" : "sticky", top: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>Analysis Result</h3>
            {result && history[0] && (
              <button onClick={() => saveResult(history[0])}
                style={{
                  padding: "5px 11px", borderRadius: 6,
                  border: `1px solid ${T.cardBorder}`,
                  background: "transparent", color: T.textMuted,
                  fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                }}>⊟ Save</button>
            )}
          </div>

          {!result && !loading && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 12, color: T.accent, opacity: 0.4 }}>◎</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No analysis yet</div>
              <div style={{ fontSize: 12 }}>Paste content and click Analyze Now.</div>
            </div>
          )}

          {loading && !result && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted }}>
              <div style={{ fontSize: 30, marginBottom: 12, color: T.accent, animation: "spin 2s linear infinite", display: "inline-block" }}>◎</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Analyzing...</div>
            </div>
          )}

          {result && vc && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              {/* Verdict */}
              <div style={{ background: vBg, border: `1px solid ${vBorder}`, borderRadius: 12, padding: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: vColor + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: vColor }}>
                  {vc.icon}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 3 }}>VERDICT</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: vColor }}>{vc.label}</div>
                </div>
              </div>

              {/* Score */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec }}>Scam Score</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: vColor }}>
                    {result.analysis.scam_score}<span style={{ fontSize: 12, color: T.textMuted, fontWeight: 400 }}>/100</span>
                  </span>
                </div>
                <div style={{ height: 7, background: T.scoreBg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${result.analysis.scam_score}%`,
                    background: result.analysis.scam_score > 60 ? "linear-gradient(90deg,#f59e0b,#dc2626)" : result.analysis.scam_score > 30 ? "linear-gradient(90deg,#22c55e,#f59e0b)" : "#22c55e",
                    borderRadius: 4, transition: "width 1s ease",
                  }} />
                </div>
              </div>

              {/* Confidence + Risk */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, background: dark ? "rgba(255,255,255,0.03)" : "#f8fafc", border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Confidence</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vColor }}>{result.analysis.confidence}</div>
                </div>
                <div style={{ flex: 1, background: dark ? "rgba(255,255,255,0.03)" : "#f8fafc", border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Risk Level</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vColor }}>{vc.riskLabel}</div>
                </div>
              </div>

              {/* Red flags */}
              <div style={{ background: dark ? "rgba(239,68,68,0.06)" : "#fef2f2", border: `1px solid ${dark ? "rgba(239,68,68,0.2)" : "#fecaca"}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#f87171" : "#dc2626", marginBottom: 8 }}>🚩 Red Flags</div>
                {result.analysis.red_flags.length > 0 ? result.analysis.red_flags.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <span style={{ color: dark ? "#f87171" : "#dc2626", fontSize: 8, marginTop: 4, flexShrink: 0 }}>●</span>
                    <span style={{ fontSize: 12, color: T.textSec, lineHeight: 1.5 }}>{f}</span>
                  </div>
                )) : <span style={{ fontSize: 12, color: T.textMuted }}>None detected</span>}
              </div>

              {/* Positive signals */}
              <div style={{ background: dark ? "rgba(34,197,94,0.06)" : "#f0fdf4", border: `1px solid ${dark ? "rgba(34,197,94,0.2)" : "#bbf7d0"}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#34d399" : "#16a34a", marginBottom: 8 }}>✅ Positive Signals</div>
                {result.analysis.positive_signals.length > 0 ? result.analysis.positive_signals.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <span style={{ color: dark ? "#34d399" : "#16a34a", fontSize: 8, marginTop: 4, flexShrink: 0 }}>●</span>
                    <span style={{ fontSize: 12, color: T.textSec, lineHeight: 1.5 }}>{s}</span>
                  </div>
                )) : <span style={{ fontSize: 12, color: T.textMuted }}>None found</span>}
              </div>

              {/* Summary */}
              <div style={{ background: dark ? "rgba(59,130,246,0.06)" : "#f0f9ff", border: `1px solid ${dark ? "rgba(59,130,246,0.2)" : "#bae6fd"}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#60a5fa" : "#0284c7", marginBottom: 8 }}>≡ Summary</div>
                <p style={{ fontSize: 12, color: T.textSec, lineHeight: 1.7, margin: 0 }}>{result.analysis.summary}</p>
              </div>

              {/* Recommendation */}
              <div style={{ background: vBg, border: `1px solid ${vBorder}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: vColor, marginBottom: 8 }}>⚡ Recommendation</div>
                <p style={{ fontSize: 12, color: T.textSec, lineHeight: 1.7, margin: 0 }}>{result.analysis.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth: 700 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 20 }}>Analysis History</h2>
      {history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>⊞</div>
          <div style={{ fontSize: 14 }}>No analyses yet. Start by analyzing something suspicious.</div>
        </div>
      ) : history.map(item => {
        const v = item.result.analysis.verdict;
        const c = VC[v];
        const col = dark ? c.dark : c.light;
        return (
          <div key={item.id} style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 12, padding: "16px 18px", marginBottom: 12,
            cursor: "pointer",
          }} onClick={() => { setResult(item.result); setInputVal(item.input); setPage("analyze"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600, flex: 1, marginRight: 10 }}>
                {item.input.slice(0, 80)}{item.input.length > 80 ? "..." : ""}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: col, flexShrink: 0 }}>{c.label}</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 11, color: T.textMuted }}>Score: <span style={{ color: col, fontWeight: 600 }}>{item.result.analysis.scam_score}/100</span></span>
              <span style={{ fontSize: 11, color: T.textMuted }}>{item.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSaved = () => (
    <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth: 700 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 20 }}>Saved Reports</h2>
      {savedItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>⊟</div>
          <div style={{ fontSize: 14 }}>No saved reports yet. Save analyses from the results panel.</div>
        </div>
      ) : savedItems.map(item => {
        const v = item.result.analysis.verdict;
        const c = VC[v];
        const col = dark ? c.dark : c.light;
        return (
          <div key={item.id} style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 12, padding: "16px 18px", marginBottom: 12,
            cursor: "pointer",
          }} onClick={() => { setResult(item.result); setInputVal(item.input); setPage("analyze"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600, flex: 1, marginRight: 10 }}>
                {item.input.slice(0, 80)}{item.input.length > 80 ? "..." : ""}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{c.label}</div>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Score: <span style={{ color: col, fontWeight: 600 }}>{item.result.analysis.scam_score}/100</span></div>
          </div>
        );
      })}
    </div>
  );

  const renderAbout = () => (
    <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth: 640 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>About ScamRadar</h2>
      <p style={{ fontSize: 14, color: T.textSec, lineHeight: 1.8, marginBottom: 24 }}>
        ScamRadar was built after encountering too many scams while job hunting ,fake internships, dodgy investment pitches, and "job offers" that ended with documentation fee requests. This tool exists to help anyone quickly verify whether something is legitimate.
      </p>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Tech Stack</div>
        {[
          ["Backend", "FastAPI (Python 3.11)"],
          ["LLM", "Groq API — Llama 3.3 70B"],
          ["Web Search", "Serper API"],
          ["Frontend", "React + TypeScript (Vite)"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.divider}` }}>
            <span style={{ fontSize: 13, color: T.textMuted }}>{k}</span>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Built By</div>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 600, marginBottom: 4 }}>Ushindi Sidi Kombe</div>
        <div style={{ fontSize: 13, color: T.textSec, marginBottom: 12 }}>Generative AI Engineer & Full-Stack Developer — Nairobi, Kenya</div>
        <a href="https://github.com/Ushindisidi/scam_radar" target="_blank" rel="noreferrer"
          style={{ fontSize: 13, color: T.accent, textDecoration: "none" }}>
          ↗ github.com/Ushindisidi/scam_radar
        </a>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case "home": return renderHome();
      case "analyze": return renderAnalyze();
      case "history": return renderHistory();
      case "saved": return renderSaved();
      case "about": return renderAbout();
      default: return renderHome();
    }
  };

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      background: T.bg,
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: T.text,
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.4s ease, background 0.3s ease",
      position: "relative", overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{
          width: sidebarW, flexShrink: 0, background: T.sidebar,
          display: "flex", flexDirection: "column", padding: "24px 0",
          position: "sticky", top: 0, height: "100vh", zIndex: 10,
          transition: "background 0.3s ease",
        }}>
          {/* Logo */}
          <div style={{ padding: "0 16px 28px", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(0,212,170,0.3)" strokeWidth="1" />
                <circle cx="16" cy="16" r="9" fill="none" stroke="rgba(0,212,170,0.2)" strokeWidth="1" />
                <line x1="16" y1="16"
                  x2={16 + 13 * Math.cos((radarAngle - 90) * Math.PI / 180)}
                  y2={16 + 13 * Math.sin((radarAngle - 90) * Math.PI / 180)}
                  stroke="#00d4aa" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="16" cy="16" r="2" fill="#00d4aa" />
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
                  SCAM<span style={{ color: T.accent }}>RADAR</span>
                </div>
                <div style={{ fontSize: 9, color: "#4a5568", letterSpacing: "0.08em" }}>THREAT DETECTION</div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8, border: "none",
                  background: page === item.id ? "rgba(0,212,170,0.1)" : "transparent",
                  color: page === item.id ? T.accent : "#64748b",
                  fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  fontWeight: page === item.id ? 600 : 400,
                  transition: "all 0.15s", textAlign: "left", width: "100%",
                  outline: page === item.id ? `1px solid rgba(0,212,170,0.2)` : "none",
                }}>
                <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Privacy */}
          <div style={{ margin: "0 10px 10px", padding: "12px", borderRadius: 10, background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.12)" }}>
            <div style={{ fontSize: 11, color: "#4a5568", lineHeight: 1.6 }}>
              <div style={{ color: "#22c55e", marginBottom: 4 }}>🔒 No data stored</div>
              <div>Your privacy matters.</div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", position: "relative", zIndex: 1, paddingBottom: isMobile ? 70 : 0 }}>
        {/* Top bar */}
        <div style={{
          padding: isMobile ? "12px 16px" : "14px 24px",
          borderBottom: `1px solid ${T.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: dark ? "rgba(13,17,23,0.8)" : "rgba(255,255,255,0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 10,
          transition: "background 0.3s ease",
        }}>
          {isMobile && (
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>
              SCAM<span style={{ color: T.accent }}>RADAR</span>
            </div>
          )}
          {!isMobile && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em" }}>
              {NAV.find(n => n.id === page)?.label.toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            <span style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.1em" }}>ONLINE</span>
            <button onClick={() => setDark(!dark)}
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: `1px solid ${T.cardBorder}`,
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: T.textSec, marginLeft: 8,
              }}
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? "☀" : "☽"}
            </button>
          </div>
        </div>

        {/* Page content */}
        {renderPage()}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
          background: T.bottomNav,
          borderTop: `1px solid ${T.divider}`,
          display: "flex", padding: "8px 0 12px",
          backdropFilter: "blur(12px)",
        }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                border: "none", background: "transparent", cursor: "pointer",
                color: page === item.id ? T.accent : T.textMuted,
                fontFamily: "inherit", padding: "4px 0",
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: page === item.id ? 700 : 400 }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow-x: hidden; }
        button:hover:not(:disabled) { opacity: 0.88; }
        textarea, input { outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
}