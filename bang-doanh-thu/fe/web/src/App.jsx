import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { formatMoney, formatViDate, formatViDateTime } from "./formatMoney.js";
import { NameSuggestInput } from "./NameSuggestInput.jsx";
import "./App.css";

const ROW_COUNT = 40;
const SAN_STEP = 15;
const CUON_CAN_STEP = 10;
const SUOI_STEP = 5;
const NUOC_NGOT_STEP = 10;
const CAU_STEPS = [6, 7, 7.5, 8];
const DO_AN_STEPS = [5, 6, 7, 8, 9, 10];
/** Giữ panel mở thêm sau khi chuột rời (ms), để kịp bấm +/−. */
const HOVER_HOLD_MS = 500;

/** Ô có sổ dòng chi tiết (đối chứng khách — mỗi lần +/− / nhập tạo dòng riêng). */
const HISTORY_FIELD_LIST = ["san", "cuonCan", "cau", "suoi5k", "nuocNgot10k", "doAn", "noCu"];
const HISTORY_KEYS = new Set(HISTORY_FIELD_LIST);

function emptyClientLedger() {
  return Array.from({ length: ROW_COUNT }, () => ({}));
}

function cloneLedger(ledger) {
  return structuredClone(
    ledger && typeof ledger === "object" ? ledger : emptyClientLedger(),
  );
}

/** Một dòng ledger: tối đa 2 chữ thập phân (vd. cầu 7,5). */
function roundLedgerAmt(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100) / 100;
}

const LEDGER_EPS = 1e-4;

function sumLines(lines) {
  if (!Array.isArray(lines)) return 0;
  let s = 0;
  for (const e of lines) {
    const a =
      typeof e?.amount === "number" && Number.isFinite(e.amount)
        ? roundLedgerAmt(e.amount)
        : roundLedgerAmt(parseMoney(String(e?.amount ?? "")));
    if (a > LEDGER_EPS) s += a;
  }
  return roundLedgerAmt(s);
}

/** Đồng bộ tổng ô tiền từ các dòng ledger (logic giống BE). */
function mergeLedgerIntoRows(baseRows, ledger) {
  const nr = baseRows.map((r) => ({ ...r }));
  for (let i = 0; i < ROW_COUNT; i++) {
    for (const key of HISTORY_FIELD_LIST) {
      const ln = ledger[i]?.[key];
      const count = Array.isArray(ln) ? ln.length : 0;
      if (count === 0) {
        nr[i][key] = "";
        continue;
      }
      const sumv = sumLines(ln);
      nr[i][key] = sumv <= LEDGER_EPS ? "" : String(sumv);
    }
  }
  return nr;
}

function normalizeApiLedger(raw) {
  const out = emptyClientLedger();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < ROW_COUNT; i++) {
    const blob = raw[i];
    if (!blob || typeof blob !== "object" || Array.isArray(blob)) continue;
    for (const key of HISTORY_FIELD_LIST) {
      const rawLines = blob[key];
      if (!Array.isArray(rawLines)) continue;
      /** @type {Array<{ amount: number; at: string }>} */
      const cleaned = [];
      for (const e of rawLines) {
        if (!e || typeof e !== "object") continue;
        let amt =
          typeof e.amount === "number" && Number.isFinite(e.amount)
            ? roundLedgerAmt(e.amount)
            : roundLedgerAmt(parseMoney(String(e.amount ?? "")));
        if (!Number.isFinite(amt) || amt <= LEDGER_EPS) continue;
        let atStr = "";
        const ar = "at" in e ? e.at : null;
        if (typeof ar === "string" && ar.trim() !== "") atStr = ar;
        else {
          try {
            atStr =
              ar != null ? new Date(/** @type {string | number} */ (ar)).toISOString() : new Date().toISOString();
          } catch {
            atStr = new Date().toISOString();
          }
        }
        cleaned.push({ amount: amt, at: atStr });
      }
      if (cleaned.length > 0) out[i][key] = cleaned;
    }
  }
  return out;
}

function fillLedgerGaps(rows, ledger, updatedAtIso) {
  const fb =
    updatedAtIso != null && updatedAtIso !== ""
      ? (() => {
          try {
            return new Date(updatedAtIso).toISOString();
          } catch {
            return new Date().toISOString();
          }
        })()
      : new Date().toISOString();

  const lb = cloneLedger(ledger);
  for (let i = 0; i < ROW_COUNT; i++) {
    for (const key of HISTORY_FIELD_LIST) {
      const cur = lb[i][key];
      if (Array.isArray(cur) && cur.length > 0) continue;
      const n = parseMoney(rows[i][key]);
      if (n <= 0) continue;
      lb[i][key] = [{ amount: roundLedgerAmt(n), at: fb }];
    }
  }
  return lb;
}

/** LIFO: trừ bớt các dòng gần nhất. */
function bumpHistoryLedger(rowsPrev, ledgerPrev, rowIndex, field, delta) {
  const ledgerNext = cloneLedger(ledgerPrev);
  const linesWas = ledgerNext[rowIndex][field];
  let lines =
    Array.isArray(linesWas) && linesWas.length > 0
      ? linesWas.map((e) => ({
          amount:
            typeof e.amount === "number" && Number.isFinite(e.amount)
              ? roundLedgerAmt(e.amount)
              : roundLedgerAmt(parseMoney(String(e.amount ?? ""))),
          at: typeof e.at === "string" ? e.at : new Date().toISOString(),
        }))
      : [];

  const d = roundLedgerAmt(delta);
  if (d > LEDGER_EPS) {
    lines.push({ amount: d, at: new Date().toISOString() });
  } else if (d < -LEDGER_EPS) {
    if (lines.length === 0) {
      const fallback = roundLedgerAmt(parseMoney(rowsPrev[rowIndex][field]));
      if (fallback > LEDGER_EPS) {
        lines = [{ amount: fallback, at: new Date().toISOString() }];
      }
    }
    let rem = roundLedgerAmt(Math.abs(delta));
    while (rem > LEDGER_EPS && lines.length > 0) {
      const last = lines[lines.length - 1];
      const amt =
        typeof last.amount === "number" && Number.isFinite(last.amount)
          ? roundLedgerAmt(last.amount)
          : roundLedgerAmt(parseMoney(String(last.amount)));
      if (!(amt > LEDGER_EPS)) {
        lines.pop();
        continue;
      }
      if (amt <= rem + LEDGER_EPS) {
        rem = roundLedgerAmt(rem - amt);
        lines.pop();
      } else {
        lines[lines.length - 1] = { ...last, amount: roundLedgerAmt(amt - rem) };
        rem = 0;
      }
    }
  }

  if (lines.length === 0) {
    delete ledgerNext[rowIndex][field];
  } else {
    ledgerNext[rowIndex][field] = lines;
  }

  const rowsOut = mergeLedgerIntoRows(rowsPrev, ledgerNext);
  return { rows: rowsOut, ledger: ledgerNext };
}

function manualHistoryLedger(rowsPrev, ledgerPrev, rowIndex, field, rawStr) {
  const ledgerNext = cloneLedger(ledgerPrev);
  const n = roundLedgerAmt(parseMoney(rawStr));
  if (n <= LEDGER_EPS) {
    delete ledgerNext[rowIndex][field];
  } else {
    ledgerNext[rowIndex][field] = [{ amount: n, at: new Date().toISOString() }];
  }
  const rowsOut = mergeLedgerIntoRows(rowsPrev, ledgerNext);
  return { rows: rowsOut, ledger: ledgerNext };
}

const emptyRow = () => ({
  ten: "",
  san: "",
  cuonCan: "",
  cau: "",
  suoi5k: "",
  nuocNgot10k: "",
  doAn: "",
  noCu: "",
  homNayTra: "",
  ghiChu: "",
});

function parseMoney(v) {
  if (v === "" || v == null) return 0;
  let s = String(v).replace(/\s/g, "").trim();
  if (!s) return 0;
  if (/^(\d{1,3})(\.\d{3})+$/.test(s)) {
    return Number(s.replace(/\./g, "")) || 0;
  }
  if (/^\d+,\d+$/.test(s)) {
    return Number(s.replace(",", ".")) || 0;
  }
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Chuẩn hoá SĐT (VN) như backend — được phép có +84 hoặc khoảng trắng. */
function normalizeQuickPhone(raw) {
  let s = String(raw ?? "").replace(/[\s().-]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && /^84\d+$/.test(s) && s.length >= 10) s = "0" + s.slice(2);
  return s.replace(/\D/g, "").slice(0, 15);
}

function formatConNo(conNo, doanhThu) {
  if (doanhThu === 0 && conNo === 0) return "";
  return formatMoney(conNo, { blankZero: false });
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeRow(r) {
  const doanhThu =
    parseMoney(r.san) +
    parseMoney(r.cuonCan) +
    parseMoney(r.cau) +
    parseMoney(r.suoi5k) +
    parseMoney(r.nuocNgot10k) +
    parseMoney(r.doAn) +
    parseMoney(r.noCu);
  const conNo = doanhThu - parseMoney(r.homNayTra);
  return { doanhThu, conNo };
}

function normalizeRowsFromApi(raw) {
  const allowed = new Set(Object.keys(emptyRow()));
  return Array.from({ length: ROW_COUNT }, (_, i) => {
    const o = emptyRow();
    const r = Array.isArray(raw) ? raw[i] : undefined;
    if (!r || typeof r !== "object") return o;
    for (const k of allowed) {
      if (typeof r[k] === "string") o[k] = r[k];
    }
    return o;
  });
}

/** Ô tiền: thanh +/− nổi bên trái ô (tên trái trong thanh; + trên, − dưới). `step` hoặc `steps`. */
function HoverStepperCell({
  rowIndex,
  field,
  value,
  step,
  steps,
  ten,
  tdClassName,
  columnTitle,
  groupLabel,
  onBump,
  onChangeField,
}) {
  const hasName = Boolean(ten.trim());
  const multi = Array.isArray(steps) && steps.length > 0;
  const stepsList = multi ? steps : [step];
  const [holdOpen, setHoldOpen] = useState(false);
  const holdTimerRef = useRef(null);

  const cancelHoldTimer = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => () => cancelHoldTimer(), []);

  const handleStepperEnter = () => {
    cancelHoldTimer();
    setHoldOpen(true);
  };

  const handleStepperLeave = () => {
    cancelHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      setHoldOpen(false);
      holdTimerRef.current = null;
    }, HOVER_HOLD_MS);
  };

  const ariaSteps =
    multi && steps.length > 0 ? steps.map((s) => `±${String(s).replace(".", ",")}`).join(", ") : `mỗi lần ${String(step).replace(".", ",")}`;
  const panelMany = multi && stepsList.length >= 6;

  return (
    <td className={tdClassName}>
      <div
        className={`cell-stepper${holdOpen ? " cell-stepper--hold" : ""}`}
        onMouseEnter={handleStepperEnter}
        onMouseLeave={handleStepperLeave}
      >
        <input
          className="cell-input cell-num cell-stepper-input"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChangeField(rowIndex, field, e.target.value)}
        />
        <div
          className={`cell-stepper-panel${multi ? " cell-stepper-panel--multi" : ""}${
            panelMany ? " cell-stepper-panel--many-steps cell-stepper-panel--anchored-below" : ""
          }`}
        >
          <div className="cell-stepper-headline">
            <div className="cell-stepper-column-title">{columnTitle}</div>
            <div
              className={`cell-stepper-name${hasName ? "" : " cell-stepper-name--empty"}`}
              title={hasName ? ten.trim() : undefined}
            >
              {hasName ? ten.trim() : "Chưa nhập tên"}
            </div>
          </div>
          <div
            className={`cell-stepper-actions${multi ? " cell-stepper-actions--multi" : ""}`}
            role="group"
            aria-label={`${columnTitle}, ${groupLabel}: ${ariaSteps}`}
          >
            {stepsList.map((s) => (
              <div key={`${field}-${String(s)}`} className="cell-stepper-pair" role="group" aria-label={`Bước ${String(s).replace(".", ",")}`}>
                <button
                  type="button"
                  className="cell-stepper-btn cell-stepper-btn--plus"
                  onClick={() => onBump(rowIndex, field, s)}
                  aria-label={`Cộng ${String(s).replace(".", ",")}`}
                >
                  <span className="cell-stepper-glyph" aria-hidden>
                    +
                  </span>
                  <span className="cell-stepper-num">{String(s).replace(".", ",")}</span>
                </button>
                <button
                  type="button"
                  className="cell-stepper-btn cell-stepper-btn--minus"
                  onClick={() => onBump(rowIndex, field, -s)}
                  aria-label={`Trừ ${String(s).replace(".", ",")}`}
                >
                  <span className="cell-stepper-glyph" aria-hidden>
                    −
                  </span>
                  <span className="cell-stepper-num">{String(s).replace(".", ",")}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </td>
  );
}

export default function App() {
  const now = useMemo(() => new Date(), []);
  const [reportDate, setReportDate] = useState(todayISODate);
  const [rows, setRows] = useState(() => Array.from({ length: ROW_COUNT }, () => emptyRow()));
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [mongoOk, setMongoOk] = useState(null);

  const [listMode, setListMode] = useState("month");
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterIsoYear, setFilterIsoYear] = useState(() => getISOWeekYear(now));
  const [filterIsoWeek, setFilterIsoWeek] = useState(() => getISOWeek(now));
  const [sheetList, setSheetList] = useState([]);
  const [listSummary, setListSummary] = useState(null);
  /** Mốc từ MongoDB (ISO), hiển thị theo giờ VN */
  const [mongoTimestamps, setMongoTimestamps] = useState({ createdAt: null, updatedAt: null });
  /** Chi tiết từng lần bán (ghi Mongo `cellLedger`) */
  const [cellLedger, setCellLedger] = useState(emptyClientLedger);

  const [quickName, setQuickName] = useState("");
  const [quickNick, setQuickNick] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickMsg, setQuickMsg] = useState(
    /** @type {{ type: "ok" | "err"; text: string } | null} */ (null),
  );

  const saveTimerRef = useRef(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/revenue/sheets/${reportDate}`, { signal: ac.signal });
        if (!r.ok) throw new Error("load_failed");
        const data = await r.json();
        const rowsNorm = normalizeRowsFromApi(data.rows);
        let led = normalizeApiLedger(data.cellLedger);
        led = fillLedgerGaps(rowsNorm, led, data.updatedAt);
        const merged = mergeLedgerIntoRows(rowsNorm, led);
        setRows(merged);
        setCellLedger(led);
        setMongoTimestamps({
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        });
        setHydrated(true);
        setLoadError(null);
      } catch (e) {
        if (e.name === "AbortError") return;
        setLoadError("Không tải được phiếu từ server.");
        setMongoTimestamps({ createdAt: null, updatedAt: null });
        setCellLedger(emptyClientLedger());
        setRows(Array.from({ length: ROW_COUNT }, () => emptyRow()));
        setHydrated(true);
      }
    })();
    return () => ac.abort();
  }, [reportDate]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setMongoOk(!!j.mongo))
      .catch(() => setMongoOk(false));
  }, []);

  const persist = useCallback(async (date, bodyRows, bodyLedger) => {
    setSaveState("saving");
    try {
      const r = await fetch(`/api/revenue/sheets/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: bodyRows, cellLedger: bodyLedger }),
      });
      if (!r.ok) throw new Error("save_failed");
      const saved = await r.json();
      const nextTs = {
        createdAt: saved.createdAt ?? null,
        updatedAt: saved.updatedAt ?? null,
      };
      setMongoTimestamps(nextTs);
      setSheetList((prev) =>
        prev.some((s) => s.reportDate === date)
          ? prev.map((s) => (s.reportDate === date ? { ...s, ...nextTs } : s))
          : prev,
      );
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persist(reportDate, rows, cellLedger);
    }, 1400);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [rows, cellLedger, reportDate, hydrated, persist]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (listMode === "year") {
      params.set("year", String(filterYear));
    } else if (listMode === "month") {
      params.set("year", String(filterYear));
      params.set("month", String(filterMonth));
    } else {
      params.set("year", String(filterIsoYear));
      params.set("week", String(filterIsoWeek));
    }
    fetch(`/api/revenue/sheets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSheetList(data.sheets || []);
        setListSummary(data.summary || null);
      })
      .catch(() => {
        if (!cancelled) {
          setSheetList([]);
          setListSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listMode, filterYear, filterMonth, filterIsoYear, filterIsoWeek]);

  const derived = useMemo(() => rows.map((r) => computeRow(r)), [rows]);

  const totals = useMemo(() => {
    let san = 0;
    let cuonCan = 0;
    let cau = 0;
    let suoi5k = 0;
    let nuocNgot10k = 0;
    let doAn = 0;
    let noCu = 0;
    let doanhThu = 0;
    let homNayTra = 0;
    let conNo = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      san += parseMoney(r.san);
      cuonCan += parseMoney(r.cuonCan);
      cau += parseMoney(r.cau);
      suoi5k += parseMoney(r.suoi5k);
      nuocNgot10k += parseMoney(r.nuocNgot10k);
      doAn += parseMoney(r.doAn);
      noCu += parseMoney(r.noCu);
      doanhThu += derived[i].doanhThu;
      homNayTra += parseMoney(r.homNayTra);
      conNo += derived[i].conNo;
    }
    return { san, cuonCan, cau, suoi5k, nuocNgot10k, doAn, noCu, doanhThu, homNayTra, conNo };
  }, [rows, derived]);

  function updateRow(i, field, value) {
    if (HISTORY_KEYS.has(field)) {
      const { rows: nr, ledger: nl } = manualHistoryLedger(rows, cellLedger, i, field, value);
      setRows(nr);
      setCellLedger(nl);
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function bumpMoneyField(i, field, delta) {
    if (HISTORY_KEYS.has(field)) {
      const { rows: nr, ledger: nl } = bumpHistoryLedger(rows, cellLedger, i, field, delta);
      setRows(nr);
      setCellLedger(nl);
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      const cur = parseMoney(prev[i][field]);
      let v = Math.round(cur + delta);
      if (v < 0) v = 0;
      next[i] = { ...next[i], [field]: v === 0 ? "" : String(v) };
      return next;
    });
  }

  function clearAll() {
    if (!window.confirm("Xóa toàn bộ dữ liệu trong bảng (và lưu lên server)?")) return;
    const blank = Array.from({ length: ROW_COUNT }, () => emptyRow());
    const blankLed = emptyClientLedger();
    setRows(blank);
    setCellLedger(blankLed);
    persist(reportDate, blank, blankLed);
  }

  async function handleQuickRegister(e) {
    e.preventDefault();
    setQuickMsg(null);
    const name = quickName.trim().replace(/\s+/g, " ");
    const nickname = quickNick.trim();
    const phone = normalizeQuickPhone(quickPhone);
    if (!name) {
      setQuickMsg({ type: "err", text: "Nhập họ tên." });
      return;
    }
    if (phone.length < 9 || phone.length > 12) {
      setQuickMsg({ type: "err", text: "Số điện thoại cần 9–12 chữ số (vd. 0912345678)." });
      return;
    }
    setQuickBusy(true);
    try {
      const r = await fetch("/api/revenue/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname, phone }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) {
        setQuickMsg({ type: "err", text: "Tên này đã có trong danh bạ." });
        return;
      }
      if (r.status === 400 && j.error === "invalid_phone") {
        setQuickMsg({ type: "err", text: "Số điện thoại không hợp lệ." });
        return;
      }
      if (!r.ok) {
        setQuickMsg({ type: "err", text: "Không lưu được." });
        return;
      }
      setQuickMsg({
        type: "ok",
        text: `Đã lưu «${j.name ?? name}». Gõ ô Tên trên bảng để gợi ý — có biệt danh và SĐT.`,
      });
      setQuickName("");
      setQuickNick("");
      setQuickPhone("");
    } catch {
      setQuickMsg({ type: "err", text: "Mất kết nối API." });
    } finally {
      setQuickBusy(false);
    }
  }

  function onListModeChange(mode) {
    setListMode(mode);
    if (mode === "week") {
      const t = new Date();
      setFilterIsoYear(getISOWeekYear(t));
      setFilterIsoWeek(getISOWeek(t));
    }
  }

  const weekOptions = useMemo(() => Array.from({ length: 53 }, (_, i) => i + 1), []);

  return (
    <div className="app">
      <header className="sheet-header">
        <h1 className="sheet-title">DOANH THU</h1>
        <label className="sheet-date">
          <span className="visually-hidden">Ngày</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="date-input"
          />
        </label>
        <p className="sheet-date-label">{formatViDate(reportDate)}</p>
        {mongoTimestamps.updatedAt && (
          <p className="sheet-server-time">
            <span className="sheet-server-time-label">Đối chiếu (giờ VN)</span>:{" "}
            {mongoTimestamps.createdAt &&
            mongoTimestamps.updatedAt &&
            formatViDateTime(mongoTimestamps.createdAt) !== formatViDateTime(mongoTimestamps.updatedAt) ? (
              <>
                Tạo <time dateTime={String(mongoTimestamps.createdAt)}>{formatViDateTime(mongoTimestamps.createdAt)}</time>
                {" · "}
              </>
            ) : null}
            Sửa lần cuối{" "}
            <time dateTime={String(mongoTimestamps.updatedAt)}>
              {formatViDateTime(mongoTimestamps.updatedAt)}
            </time>
          </p>
        )}

        <div className="status-bar">
          <span className={`save-badge save-badge--${saveState}`}>
            {saveState === "saving" && "Đang lưu…"}
            {saveState === "saved" && "Đã lưu MongoDB"}
            {saveState === "error" && "Lỗi lưu — thử lại sau"}
            {saveState === "idle" && "Tự lưu sau khi sửa"}
          </span>
          {mongoOk === false && <span className="mongo-warn">API / Mongo không kết nối</span>}
          {loadError && <span className="mongo-warn">{loadError}</span>}
        </div>

        <div className="browse-panel">
          <span className="browse-label">Theo dõi theo</span>
          <select
            className="select-input"
            value={listMode}
            onChange={(e) => onListModeChange(e.target.value)}
            aria-label="Chế độ lọc danh sách"
          >
            <option value="year">Năm (dương lịch)</option>
            <option value="month">Tháng</option>
            <option value="week">Tuần (ISO)</option>
          </select>
          {listMode === "year" && (
            <input
              type="number"
              className="num-input"
              min={2020}
              max={2040}
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value) || filterYear)}
              aria-label="Năm"
            />
          )}
          {listMode === "month" && (
            <>
              <input
                type="number"
                className="num-input"
                min={2020}
                max={2040}
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value) || filterYear)}
                aria-label="Năm"
              />
              <select
                className="select-input"
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                aria-label="Tháng"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tháng {i + 1}
                  </option>
                ))}
              </select>
            </>
          )}
          {listMode === "week" && (
            <>
              <span className="browse-hint">Năm ISO</span>
              <input
                type="number"
                className="num-input"
                min={2020}
                max={2040}
                value={filterIsoYear}
                onChange={(e) => setFilterIsoYear(Number(e.target.value) || filterIsoYear)}
                aria-label="Năm ISO tuần"
              />
              <select
                className="select-input"
                value={filterIsoWeek}
                onChange={(e) => setFilterIsoWeek(Number(e.target.value))}
                aria-label="Số tuần ISO"
              >
                {weekOptions.map((w) => (
                  <option key={w} value={w}>
                    Tuần {w}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {listSummary && (
          <p className="list-summary">
            Gộp trong kỳ đang xem:{" "}
            <strong>{formatMoney(listSummary.totalDoanhThu, { blankZero: false })}</strong> doanh thu ·{" "}
            {listSummary.sheetCount} ngày có dữ liệu
          </p>
        )}

        {sheetList.length > 0 && (
          <div className="sheet-pills">
            {sheetList.map((s) => (
              <button
                key={s.reportDate}
                type="button"
                className={`sheet-pill ${s.reportDate === reportDate ? "sheet-pill--active" : ""}`}
                title={
                  s.updatedAt
                    ? `Cập nhật lần cuối (${formatViDateTime(s.updatedAt)} giờ VN)`
                    : s.reportDate
                }
                onClick={() => setReportDate(s.reportDate)}
              >
                <span className="sheet-pill-date">{s.reportDate}</span>
                {s.updatedAt ? (
                  <span className="sheet-pill-time">{formatViDateTime(s.updatedAt)}</span>
                ) : (
                  <span className="sheet-pill-time sheet-pill-time--muted">—</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="toolbar">
          <button type="button" className="btn-ghost" onClick={clearAll}>
            Làm mới bảng
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table className="revenue-table revenue-sheet">
          <colgroup>
            <col className="col-w-equal" />
            <col className="col-w-wide" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-equal" />
            <col className="col-w-wide" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-stt">STT</th>
              <th className="col-name-narrow th-compact">Tên</th>
              <th className="col-num-tight th-compact col-stepper-head-san">Sân</th>
              <th className="col-num-tight th-compact">Cuốn cán</th>
              <th className="col-num-medium">Cầu</th>
              <th className="col-num-medium">Suối</th>
              <th className="col-num-tight th-compact">Nước ngọt</th>
              <th>Đồ ăn</th>
              <th>Nợ cũ</th>
              <th className="col-computed">Doanh thu</th>
              <th className="col-computed col-hom-nay-tra th-compact">Hôm nay trả</th>
              <th>Còn nợ</th>
              <th className="col-note">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const { doanhThu, conNo } = derived[i];
              return (
                <tr key={i}>
                  <td className="cell-stt">
                    <a
                      className="cell-stt-link"
                      href={`/lich-su/${i + 1}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Mở lịch sử mua hàng (tab mới)"
                    >
                      {i + 1}
                    </a>
                  </td>
                  <td className="col-name-narrow">
                    <NameSuggestInput
                      rowIndex={i}
                      value={r.ten}
                      onChange={(v) => updateRow(i, "ten", v)}
                    />
                  </td>
                  <HoverStepperCell
                    rowIndex={i}
                    field="san"
                    value={r.san}
                    step={SAN_STEP}
                    ten={r.ten}
                    tdClassName="col-num-tight col-stepper-td col-stepper-td--san"
                    columnTitle="Sân"
                    groupLabel="Chỉnh sân"
                    onBump={bumpMoneyField}
                    onChangeField={updateRow}
                  />
                  <HoverStepperCell
                    rowIndex={i}
                    field="cuonCan"
                    value={r.cuonCan}
                    step={CUON_CAN_STEP}
                    ten={r.ten}
                    tdClassName="col-num-tight col-stepper-td"
                    columnTitle="Cuốn cán"
                    groupLabel="Chỉnh cuốn cán"
                    onBump={bumpMoneyField}
                    onChangeField={updateRow}
                  />
                  <HoverStepperCell
                    rowIndex={i}
                    field="cau"
                    value={r.cau}
                    steps={CAU_STEPS}
                    ten={r.ten}
                    tdClassName="col-num-medium col-stepper-td"
                    columnTitle="Cầu"
                    groupLabel="Chỉnh cầu"
                    onBump={bumpMoneyField}
                    onChangeField={updateRow}
                  />
                  <HoverStepperCell
                    rowIndex={i}
                    field="suoi5k"
                    value={r.suoi5k}
                    step={SUOI_STEP}
                    ten={r.ten}
                    tdClassName="col-num-medium col-stepper-td"
                    columnTitle="Suối"
                    groupLabel="Chỉnh suối"
                    onBump={bumpMoneyField}
                    onChangeField={updateRow}
                  />
                  <HoverStepperCell
                    rowIndex={i}
                    field="nuocNgot10k"
                    value={r.nuocNgot10k}
                    step={NUOC_NGOT_STEP}
                    ten={r.ten}
                    tdClassName="col-num-tight col-stepper-td"
                    columnTitle="Nước ngọt"
                    groupLabel="Chỉnh nước ngọt"
                    onBump={bumpMoneyField}
                    onChangeField={updateRow}
                  />
                  <HoverStepperCell
                    rowIndex={i}
                    field="doAn"
                    value={r.doAn}
                    steps={DO_AN_STEPS}
                    ten={r.ten}
                    tdClassName="col-num-medium col-stepper-td"
                    columnTitle="Đồ ăn"
                    groupLabel="Chỉnh đồ ăn"
                    onBump={bumpMoneyField}
                    onChangeField={updateRow}
                  />
                  <td>
                    <input
                      className="cell-input cell-num"
                      inputMode="decimal"
                      value={r.noCu}
                      onChange={(e) => updateRow(i, "noCu", e.target.value)}
                    />
                  </td>
                  <td className="cell-computed">{formatMoney(doanhThu, { blankZero: true })}</td>
                  <td className="col-computed col-hom-nay-tra">
                    <input
                      className="cell-input cell-num"
                      inputMode="decimal"
                      value={r.homNayTra}
                      onChange={(e) => updateRow(i, "homNayTra", e.target.value)}
                    />
                  </td>
                  <td className="cell-remaining">{formatConNo(conNo, doanhThu)}</td>
                  <td className="col-note">
                    <input
                      className="cell-input cell-text"
                      value={r.ghiChu}
                      onChange={(e) => updateRow(i, "ghiChu", e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="row-total">
              <td className="cell-stt" colSpan={2}>
                Tổng
              </td>
              <td className="col-num-tight col-stepper-td--san">{formatMoney(totals.san, { blankZero: false })}</td>
              <td className="col-num-tight">{formatMoney(totals.cuonCan, { blankZero: false })}</td>
              <td className="col-num-medium">{formatMoney(totals.cau, { blankZero: false })}</td>
              <td className="col-num-medium">{formatMoney(totals.suoi5k, { blankZero: false })}</td>
              <td className="col-num-tight">{formatMoney(totals.nuocNgot10k, { blankZero: false })}</td>
              <td className="col-num-medium">{formatMoney(totals.doAn, { blankZero: false })}</td>
              <td>{formatMoney(totals.noCu, { blankZero: false })}</td>
              <td className="cell-computed">{formatMoney(totals.doanhThu, { blankZero: false })}</td>
              <td className="col-computed col-hom-nay-tra">
                {formatMoney(totals.homNayTra, { blankZero: false })}
              </td>
              <td>{formatMoney(totals.conNo, { blankZero: false })}</td>
              <td className="col-note" />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="hint">
        Doanh thu = Sân + Cuốn cán + Cầu + Suối + Nước ngọt + Đồ ăn + Nợ cũ. Còn nợ = Doanh
        thu − Hôm nay trả. Lưu trữ: MongoDB (cùng biến <code>MONGODB_URI</code>, <code>MONGODB_DB</code>{" "}
        với backend KHKT), collection <code>bang_doanh_thu_sheets</code>. Tuần lọc theo chuẩn ISO (thứ
        Hai đầu tuần). Cột <strong>Sân</strong> / <strong>Cuốn cán</strong> / <strong>Cầu</strong> /{" "}
        <strong>Suối</strong> / <strong>Nước ngọt</strong> / <strong>Đồ ăn</strong>: hover — thanh{" "}
        <strong>bên trái ô</strong> (tên trong thanh; <strong>+</strong> trên, <strong>−</strong> dưới); rời chuột
        giữ ~<strong>
          {HOVER_HOLD_MS / 1000}s
        </strong>
        ; bước <strong>{SAN_STEP}</strong> / <strong>{CUON_CAN_STEP}</strong> /{" "}
        <strong>6·7·7,5·8</strong> (cầu) / <strong>{SUOI_STEP}</strong> / <strong>{NUOC_NGOT_STEP}</strong> /{" "}
        <strong>5·6·7·8·9·10</strong> (đồ ăn). Bấm <strong>STT</strong> để xem{" "}
        <strong>lịch sử mua hàng</strong> theo dòng đó (tab mới).
      </p>

      <section className="quick-register" aria-labelledby="quick-register-heading">
        <h2 id="quick-register-heading" className="quick-register-title">
          Đăng ký nhanh vào danh bạ
        </h2>
        <p className="quick-register-lead">
          Chỉ cần tên, biệt danh (tuỳ chọn) và số điện thoại. Sau đó gõ ô <strong>Tên</strong> trong bảng sẽ
          gợi ý; có thể gõ một phần số để tìm.
        </p>
        <form className="quick-register-form" onSubmit={handleQuickRegister}>
          <label className="quick-register-field">
            <span>Tên</span>
            <input
              type="text"
              name="quick-name"
              autoComplete="name"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Họ và tên"
              maxLength={200}
              disabled={quickBusy}
            />
          </label>
          <label className="quick-register-field">
            <span>Biệt danh</span>
            <input
              type="text"
              name="quick-nickname"
              autoComplete="nickname"
              value={quickNick}
              onChange={(e) => setQuickNick(e.target.value)}
              placeholder="Tuỳ chọn — vd. Béo"
              maxLength={200}
              disabled={quickBusy}
            />
          </label>
          <label className="quick-register-field">
            <span>Số điện thoại</span>
            <input
              type="tel"
              name="quick-phone"
              inputMode="tel"
              autoComplete="tel"
              value={quickPhone}
              onChange={(e) => setQuickPhone(e.target.value)}
              placeholder="0912 345 678 hoặc +84…"
              maxLength={22}
              disabled={quickBusy}
            />
          </label>
          <div className="quick-register-submit-wrap">
            <button type="submit" className="quick-register-submit" disabled={quickBusy}>
              {quickBusy ? "Đang lưu…" : "Đăng ký"}
            </button>
          </div>
        </form>
        {quickMsg ? (
          <p
            className={
              quickMsg.type === "ok" ? "quick-register-msg quick-register-msg--ok" : "quick-register-msg quick-register-msg--err"
            }
            role="status"
          >
            {quickMsg.text}
          </p>
        ) : null}
      </section>
    </div>
  );
}
