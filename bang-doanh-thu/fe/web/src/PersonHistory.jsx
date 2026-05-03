import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMoney, formatViDate, formatViDateTime } from "./formatMoney.js";
import "./App.css";

export default function PersonHistory() {
  const { stt } = useParams();
  return <PersonHistoryBody key={stt} stt={stt} />;
}

function PersonHistoryBody({ stt }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/revenue/history/${encodeURIComponent(stt)}`)
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) {
            throw new Error(
              "Không tìm thấy API lịch sử (404). Backend đang chạy có thể là bản cũ — hãy restart Node (nodemon/PM2) hoặc deploy lại BE để có GET /api/revenue/history/:stt.",
            );
          }
          throw new Error(`Không tải được lịch sử (HTTP ${r.status}).`);
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setData(j);
        setErr(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setData(null);
        if (e instanceof TypeError) {
          setErr(
            "Không kết nối được API. Kiểm tra backend đã bật và Vite proxy trùng cổng PORT trong be/.env (hoặc đặt VITE_API_PROXY_TARGET).",
          );
          return;
        }
        setErr(e.message || "Không tải được lịch sử.");
      });
    return () => {
      cancelled = true;
    };
  }, [stt]);

  return (
    <div className="app app--history">
      <header className="history-header">
        <Link to="/" className="history-back">
          ← Bảng doanh thu
        </Link>
        <h1 className="sheet-title history-title">
          Lịch sử mua hàng · STT {stt}
          {data?.ten ? (
            <>
              {" "}
              · <span className="history-ten">{data.ten}</span>
            </>
          ) : null}
        </h1>
        <p className="history-note">
          Theo <strong>dòng {stt}</strong> trên mọi phiếu đã lưu. <strong>Mỗi lần bấm +</strong> trên các ô có
          bước (Sân, Cầu, …) tạo <strong>một dòng lịch sử riêng</strong>, kể cả cùng mặt hàng — không gộp
          thành một tổng duy nhất. <strong>−</strong> trừ theo các lần cộng gần nhất.{" "}
          <strong>Gõ trực tiếp số vào ô</strong> là ghi một lần toàn bộ số ô đó (gộp mốc) — để chia nhiều
          mốc, dùng +/−. Xếp theo giờ ghi nhận (giờ VN).
        </p>
      </header>

      {err && <p className="mongo-warn history-msg">{err}</p>}
      {!data && !err && <p className="history-note history-msg">Đang tải…</p>}

      {data && (
        <div className="table-wrap">
          <table className="revenue-table history-table">
            <thead>
              <tr>
                <th className="history-col-time">Thời gian</th>
                <th>Mặt hàng</th>
                <th className="history-col-amount">Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="history-empty">
                    Chưa có giao dịch ghi nhận (các mục tiền trên các phiếu đều trống hoặc 0).
                  </td>
                </tr>
              ) : (
                data.items.map((row, idx) => (
                  <tr key={`${row.reportDate}-${row.item}-${row.recordedAt ?? "x"}-${idx}`}>
                    <td className="history-col-time">
                      <span className="history-time-primary">
                        {row.recordedAt ? formatViDateTime(row.recordedAt) : "—"}
                      </span>
                      <span className="history-date-primary">{row.reportDate}</span>
                      <span className="history-date-sub">{formatViDate(row.reportDate)} · ngày phiếu</span>
                    </td>
                    <td>{row.item}</td>
                    <td className="history-col-amount">
                      {formatMoney(row.amount, { blankZero: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.items.length > 0 && (
              <tfoot>
                <tr className="row-total">
                  <td colSpan={2}>
                    <strong>Tổng các dòng mặt hàng</strong>
                    <span className="history-foot-hint"> (cộng từng dòng riêng, không gộp mốc)</span>
                  </td>
                  <td className="history-col-amount">
                    <strong>{formatMoney(data.grandTotal, { blankZero: false })}</strong>
                  </td>
                </tr>
                {data.totalPaid > 0 ? (
                  <tr className="history-foot-paid">
                    <td colSpan={2}>Tổng đã trả (cột Hôm nay trả, gộp các ngày)</td>
                    <td className="history-col-amount">
                      {formatMoney(data.totalPaid, { blankZero: false })}
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
