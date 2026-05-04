import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "./apiClient.js";
import MainNavBar from "./MainNavBar.jsx";
import BrandBlock from "./BrandBlock.jsx";
import { formatMoney, formatViDateTime, parseMoney } from "./formatMoney.js";
import { NameSuggestInput } from "./NameSuggestInput.jsx";
import ConNoLedgerHoverCell, { emptyClientConNoLedger, normalizeApiConNoLedger } from "./ConNoLedgerHoverCell.jsx";
import { ROW_COUNT_DEFAULT, ROW_COUNT_MAX, sheetRowCountFromLength } from "./sheetConstants.js";
import "./App.css";
const SAN_STEP = 15;
const CUON_CAN_STEP = 10;
const SUOI_STEP = 5;
const NUOC_NGOT_STEP = 10;
const CAU_STEPS = [6, 7, 7.5, 8];
const DO_AN_STEPS = [5, 6, 7, 8, 9, 10];

/** Ô có sổ dòng chi tiết (đối chứng khách — mỗi lần +/− / nhập tạo dòng riêng). */
const HISTORY_FIELD_LIST = ["san", "cuonCan", "cau", "suoi5k", "nuocNgot10k", "doAn"];
const HISTORY_KEYS = new Set(HISTORY_FIELD_LIST);

function emptyClientLedger(rowCount = ROW_COUNT_DEFAULT) {
  const n = sheetRowCountFromLength(rowCount);
  return Array.from({ length: n }, () => ({}));
}

function cloneLedger(ledger) {
  const len =
    Array.isArray(ledger) && ledger.length > 0
      ? sheetRowCountFromLength(ledger.length)
      : ROW_COUNT_DEFAULT;
  return structuredClone(ledger && typeof ledger === "object" ? ledger : emptyClientLedger(len));
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
  for (let i = 0; i < nr.length; i++) {
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

function normalizeApiLedger(raw, rowCount) {
  const n =
    rowCount != null && Number.isFinite(rowCount)
      ? sheetRowCountFromLength(rowCount)
      : sheetRowCountFromLength(Array.isArray(raw) ? raw.length : 0);
  const out = emptyClientLedger(n);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < n; i++) {
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
  for (let i = 0; i < rows.length; i++) {
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
  homNayTra: "",
  ghiChu: "",
});

/** Chuẩn hoá SĐT (VN) như backend — được phép có +84 hoặc khoảng trắng. */
function normalizeQuickPhone(raw) {
  let s = String(raw ?? "").replace(/[\s().-]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && /^84\d+$/.test(s) && s.length >= 10) s = "0" + s.slice(2);
  return s.replace(/\D/g, "").slice(0, 15);
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initialReportDateFromSearch() {
  if (typeof window === "undefined") return todayISODate();
  try {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch {
    /* ignore */
  }
  return todayISODate();
}

function computeRow(r) {
  const doanhThu =
    parseMoney(r.san) +
    parseMoney(r.cuonCan) +
    parseMoney(r.cau) +
    parseMoney(r.suoi5k) +
    parseMoney(r.nuocNgot10k) +
    parseMoney(r.doAn);
  const conNo = doanhThu - parseMoney(r.homNayTra);
  return { doanhThu, conNo };
}

function normalizeRowsFromApi(raw) {
  const allowed = new Set(Object.keys(emptyRow()));
  const n = sheetRowCountFromLength(Array.isArray(raw) ? raw.length : 0);
  return Array.from({ length: n }, (_, i) => {
    const o = emptyRow();
    const r = Array.isArray(raw) ? raw[i] : undefined;
    if (!r || typeof r !== "object") return o;
    for (const k of allowed) {
      if (typeof r[k] === "string") o[k] = r[k];
    }
    return o;
  });
}

/** Ô tiền: bấm / focus ô nhập mở panel cộng/trừ neo dưới ô (giao diện như hover cũ). `step` hoặc `steps`. */
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
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const blurTimerRef = useRef(null);
  const hasName = Boolean(ten.trim());
  const multi = Array.isArray(steps) && steps.length > 0;
  const stepsList = multi ? steps : [step];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, minW: 184 });

  const ariaSteps =
    multi && steps.length > 0 ? steps.map((s) => `±${String(s).replace(".", ",")}`).join(", ") : `mỗi lần ${String(step).replace(".", ",")}`;
  const panelMany = multi && stepsList.length >= 6;

  const reposition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const minW = Math.max(r.width, 184);
    let left = r.left;
    const vw = window.innerWidth;
    if (left + minW > vw - 8) left = Math.max(8, vw - 8 - minW);
    setPos({ top: r.bottom + 4, left, minW });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t)) return;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const clearBlurTimer = () => {
    if (blurTimerRef.current != null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  useEffect(() => () => clearBlurTimer(), []);

  const onInputFocus = () => {
    clearBlurTimer();
    setOpen(true);
    requestAnimationFrame(() => reposition());
  };

  const onInputBlur = () => {
    clearBlurTimer();
    blurTimerRef.current = window.setTimeout(() => setOpen(false), 160);
  };

  return (
    <td className={tdClassName}>
      <div ref={wrapRef} className={`cell-stepper${open ? " cell-stepper--open" : ""}`}>
        <input
          className="cell-input cell-num cell-stepper-input"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChangeField(rowIndex, field, e.target.value)}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => reposition());
          }}
        />
      </div>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={`cell-stepper-panel cell-stepper-panel--floating${multi ? " cell-stepper-panel--multi" : ""}${
              panelMany ? " cell-stepper-panel--many-steps" : ""
            }`}
            style={{ top: pos.top, left: pos.left, minWidth: pos.minW }}
            role="group"
            aria-label={`${columnTitle}, ${groupLabel}: ${ariaSteps}`}
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
              aria-label={`${columnTitle}: ${ariaSteps}`}
            >
              {stepsList.map((s) => (
                <div key={`${field}-${String(s)}`} className="cell-stepper-pair" role="group" aria-label={`Bước ${String(s).replace(".", ",")}`}>
                  <button
                    type="button"
                    className="cell-stepper-btn cell-stepper-btn--plus"
                    onMouseDown={(e) => e.preventDefault()}
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
                    onMouseDown={(e) => e.preventDefault()}
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
          </div>,
          document.body,
        )}
    </td>
  );
}

export default function App() {
  const now = useMemo(() => new Date(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportDate, setReportDate] = useState(initialReportDateFromSearch);
  const [rows, setRows] = useState(() => Array.from({ length: ROW_COUNT_DEFAULT }, () => emptyRow()));
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [mongoOk, setMongoOk] = useState(null);

  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [sheetList, setSheetList] = useState([]);
  /** Chi tiết từng lần bán (ghi Mongo `cellLedger`) */
  const [cellLedger, setCellLedger] = useState(() => emptyClientLedger(ROW_COUNT_DEFAULT));
  const [conNoLedger, setConNoLedger] = useState(() => emptyClientConNoLedger(ROW_COUNT_DEFAULT));

  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickNick, setQuickNick] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickMsg, setQuickMsg] = useState(
    /** @type {{ type: "ok" | "err"; text: string } | null} */ (null),
  );
  const quickRegisterNameRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const quickRegisterCloseTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const saveTimerRef = useRef(null);

  useEffect(() => {
    const d = searchParams.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setReportDate((prev) => (prev === d ? prev : d));
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("quickRegister") !== "1") return;
    setQuickMsg(null);
    setQuickRegisterOpen(true);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("quickRegister");
        return p;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const bumpReportDate = useCallback(
    (next) => {
      setReportDate(next);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("date", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const addSheetRow = useCallback(() => {
    setRows((prev) => {
      if (prev.length >= ROW_COUNT_MAX) return prev;
      return [...prev, emptyRow()];
    });
    setCellLedger((prev) => {
      if (prev.length >= ROW_COUNT_MAX) return prev;
      return [...prev, {}];
    });
    setConNoLedger((prev) => {
      if (prev.length >= ROW_COUNT_MAX) return prev;
      return [...prev, []];
    });
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await apiFetch(`/api/revenue/sheets/${reportDate}`, { signal: ac.signal });
        if (!r.ok) throw new Error("load_failed");
        const data = await r.json();
        const rowsNorm = normalizeRowsFromApi(data.rows);
        let led = normalizeApiLedger(data.cellLedger, rowsNorm.length);
        led = fillLedgerGaps(rowsNorm, led, data.updatedAt);
        const merged = mergeLedgerIntoRows(rowsNorm, led);
        setRows(merged);
        setCellLedger(led);
        setConNoLedger(normalizeApiConNoLedger(data.conNoLedger, rowsNorm.length));
        setHydrated(true);
        setLoadError(null);
      } catch (e) {
        if (e.name === "AbortError") return;
        setLoadError("Không tải được phiếu từ server.");
        setCellLedger(emptyClientLedger(ROW_COUNT_DEFAULT));
        setConNoLedger(emptyClientConNoLedger(ROW_COUNT_DEFAULT));
        setRows(Array.from({ length: ROW_COUNT_DEFAULT }, () => emptyRow()));
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

  useEffect(() => {
    if (!quickRegisterOpen && quickRegisterCloseTimerRef.current) {
      clearTimeout(quickRegisterCloseTimerRef.current);
      quickRegisterCloseTimerRef.current = null;
    }
  }, [quickRegisterOpen]);

  useEffect(() => {
    if (!quickRegisterOpen) return;
    const id = requestAnimationFrame(() => quickRegisterNameRef.current?.focus());
    const onKey = (e) => {
      if (e.key === "Escape") setQuickRegisterOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [quickRegisterOpen]);

  const persist = useCallback(async (date, bodyRows, bodyLedger, bodyConNoLedger) => {
    try {
      const r = await apiFetch(`/api/revenue/sheets/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: bodyRows, cellLedger: bodyLedger, conNoLedger: bodyConNoLedger }),
      });
      if (!r.ok) throw new Error("save_failed");
      const saved = await r.json();
      const nextTs = {
        createdAt: saved.createdAt ?? null,
        updatedAt: saved.updatedAt ?? null,
      };
      setSheetList((prev) =>
        prev.some((s) => s.reportDate === date)
          ? prev.map((s) => (s.reportDate === date ? { ...s, ...nextTs } : s))
          : prev,
      );
    } catch {
      /* im lặng — có thể bổ sung toast sau */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persist(reportDate, rows, cellLedger, conNoLedger);
    }, 1400);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [rows, cellLedger, conNoLedger, reportDate, hydrated, persist]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("year", String(filterYear));
    params.set("month", String(filterMonth));
    apiFetch(`/api/revenue/sheets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSheetList(data.sheets || []);
      })
      .catch(() => {
        if (!cancelled) {
          setSheetList([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterYear, filterMonth]);

  const derived = useMemo(() => {
    return rows.map((r, i) => {
      const b = computeRow(r);
      const lines = conNoLedger[i] || [];
      let adj = 0;
      for (const e of lines) {
        if (e.kind === "tru") adj -= e.amount;
        else if (e.kind === "cong") adj += e.amount;
      }
      const conNo = Math.round((b.conNo + adj) * 100) / 100;
      return { ...b, conNo };
    });
  }, [rows, conNoLedger]);

  const totals = useMemo(() => {
    let san = 0;
    let cuonCan = 0;
    let cau = 0;
    let suoi5k = 0;
    let nuocNgot10k = 0;
    let doAn = 0;
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
      doanhThu += derived[i].doanhThu;
      homNayTra += parseMoney(r.homNayTra);
      conNo += derived[i].conNo;
    }
    return { san, cuonCan, cau, suoi5k, nuocNgot10k, doAn, doanhThu, homNayTra, conNo };
  }, [rows, derived]);

  /** Một dòng dữ liệu phiếu (STT + ô nhập). */
  function renderSheetDataRow(r, i) {
    const { doanhThu, conNo } = derived[i];
    return (
      <tr key={`row-${i}`}>
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
          <NameSuggestInput rowIndex={i} value={r.ten} onChange={(v) => updateRow(i, "ten", v)} />
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
        <td className="cell-computed">{formatMoney(doanhThu, { blankZero: true })}</td>
        <td className="col-computed col-hom-nay-tra">
          <input
            className="cell-input cell-num"
            inputMode="decimal"
            value={r.homNayTra}
            onChange={(e) => updateRow(i, "homNayTra", e.target.value)}
          />
        </td>
        <ConNoLedgerHoverCell
          rowIndex={i}
          ten={r.ten}
          doanhThu={doanhThu}
          effectiveConNo={conNo}
          onGhiNo={(amount) => appendGhiNoLine(i, amount)}
        />
        <td className="col-note">
          <input
            className="cell-input cell-text"
            value={r.ghiChu}
            onChange={(e) => updateRow(i, "ghiChu", e.target.value)}
          />
        </td>
      </tr>
    );
  }

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

  function appendGhiNoLine(rowIdx, amountNum) {
    setConNoLedger((prev) => {
      const next = prev.map((row) => [...row]);
      const line = {
        kind: "ghi",
        amount: Math.round(Math.abs(amountNum) * 100) / 100,
        at: new Date().toISOString(),
        note: "",
      };
      next[rowIdx] = [...(next[rowIdx] || []), line];
      return next;
    });
  }

  function clearAll() {
    if (!window.confirm("Xóa toàn bộ dữ liệu trong bảng (và lưu lên server)?")) return;
    const blank = Array.from({ length: ROW_COUNT_DEFAULT }, () => emptyRow());
    const blankLed = emptyClientLedger(ROW_COUNT_DEFAULT);
    const blankConNo = emptyClientConNoLedger(ROW_COUNT_DEFAULT);
    setRows(blank);
    setCellLedger(blankLed);
    setConNoLedger(blankConNo);
    persist(reportDate, blank, blankLed, blankConNo);
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
    if (phone.length > 0 && (phone.length < 9 || phone.length > 12)) {
      setQuickMsg({
        type: "err",
        text: "Số điện thoại để trống hoặc nhập đủ 9–12 chữ số (vd. 0912345678).",
      });
      return;
    }
    setQuickBusy(true);
    try {
      const r = await apiFetch("/api/revenue/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname, phone }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) {
        setQuickMsg({ type: "err", text: "Tên này đã có trong Trả nợ." });
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
        text: `Đã lưu «${j.name ?? name}». Gõ ô Tên trên bảng để gợi ý.`,
      });
      setQuickName("");
      setQuickNick("");
      setQuickPhone("");
      if (quickRegisterCloseTimerRef.current) clearTimeout(quickRegisterCloseTimerRef.current);
      quickRegisterCloseTimerRef.current = window.setTimeout(() => {
        quickRegisterCloseTimerRef.current = null;
        setQuickRegisterOpen(false);
      }, 1000);
    } catch {
      setQuickMsg({ type: "err", text: "Mất kết nối API." });
    } finally {
      setQuickBusy(false);
    }
  }

  return (
    <div className="app app--revenue-sheet">
      <header className="sheet-header">
        <div className="sheet-header-top">
          <BrandBlock subtitle="Phiếu doanh thu theo ngày" />
          <MainNavBar
            onQuickRegisterClick={() => {
              setQuickMsg(null);
              setQuickRegisterOpen(true);
            }}
          />
        </div>
        <label className="sheet-date">
          <span className="visually-hidden">Ngày</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => bumpReportDate(e.target.value)}
            className="date-input"
          />
        </label>

        {(mongoOk === false || loadError) && (
          <div className="status-bar">
            {mongoOk === false && <span className="mongo-warn">API / Mongo không kết nối</span>}
            {loadError && <span className="mongo-warn">{loadError}</span>}
          </div>
        )}

        <div className="browse-panel">
          <span className="browse-label">Danh sách phiếu trong tháng</span>
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
        </div>

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
                onClick={() => bumpReportDate(s.reportDate)}
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
              <th className="col-computed">Doanh thu</th>
              <th className="col-computed col-hom-nay-tra th-compact">Hôm nay trả</th>
              <th title="Theo ngày phiếu đang mở (mỗi dòng): Doanh thu − Hôm nay trả + chỉnh cộng/trừ. Không phải tổng nợ cả tháng trong ô này.">
                Còn nợ
              </th>
              <th className="col-note">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 && (
              <>
                {rows.map((r, i) => renderSheetDataRow(r, i))}
                {rows.length < ROW_COUNT_MAX && (
                  <tr key="sheet-add-slot" className="sheet-add-row-slot">
                    <td className="cell-stt sheet-add-row-cell sheet-add-row-cell--lead">
                      <button
                        type="button"
                        className="sheet-add-row-btn"
                        onClick={addSheetRow}
                        title="Thêm hàng"
                        aria-label="Thêm hàng"
                      >
                        +
                      </button>
                    </td>
                    <td colSpan={11} className="sheet-add-row-filler" aria-hidden="true" />
                  </tr>
                )}
              </>
            )}
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

      {quickRegisterOpen &&
        createPortal(
          <div
            className="name-modal-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setQuickRegisterOpen(false);
            }}
          >
            <div
              className="name-modal quick-register-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-register-dialog-title"
            >
              <div className="quick-register-dialog-head">
                <h2 id="quick-register-dialog-title" className="quick-register-dialog-title">
                  Đăng ký Trả nợ
                </h2>
                <button
                  type="button"
                  className="quick-register-dialog-close"
                  aria-label="Đóng"
                  disabled={quickBusy}
                  onClick={() => setQuickRegisterOpen(false)}
                >
                  ×
                </button>
              </div>
              <p className="quick-register-lead">
                Tên bắt buộc; biệt danh và số điện thoại tuỳ chọn. Sau khi lưu, gõ ô <strong>Tên</strong> trên bảng để
                gợi ý (có SĐT thì có thể tìm theo số).
              </p>
              <form className="quick-register-form quick-register-form--modal" onSubmit={handleQuickRegister}>
                <label className="quick-register-field">
                  <span>Tên</span>
                  <input
                    ref={quickRegisterNameRef}
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
                  <span>Số điện thoại (tuỳ chọn)</span>
                  <input
                    type="tel"
                    name="quick-phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="Để trống hoặc 0912 345 678"
                    maxLength={22}
                    disabled={quickBusy}
                  />
                </label>
                {quickMsg ? (
                  <p
                    className={
                      quickMsg.type === "ok"
                        ? "quick-register-msg quick-register-msg--ok"
                        : "quick-register-msg quick-register-msg--err"
                    }
                    role="status"
                  >
                    {quickMsg.text}
                  </p>
                ) : null}
                <div className="quick-register-dialog-actions">
                  <button type="button" className="quick-register-dialog-cancel" disabled={quickBusy} onClick={() => setQuickRegisterOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="quick-register-submit" disabled={quickBusy}>
                    {quickBusy ? "Đang lưu…" : "Đăng ký"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
