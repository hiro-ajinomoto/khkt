export function formatMoney(n, { blankZero = true } = {}) {
  if (!Number.isFinite(n)) return "";
  if (n === 0 && blankZero) return "";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

export function formatViDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const dow = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][
    date.getDay()
  ];
  return `${dow}, ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

/** Theo múi giờ Việt Nam (đối chiếu lưu MongoDB ↔ khách). */
export function formatViDateTime(isoOrDate) {
  if (isoOrDate == null || isoOrDate === "") return "";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "";
  }
}
