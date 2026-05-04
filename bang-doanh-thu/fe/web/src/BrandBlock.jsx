/**
 * Logo + tên Phan Dat Badminton (màu / viền chữ gần với logo).
 * @param {{
 *   subtitle?: import("react").ReactNode;
 *   extraBrandClass?: string;
 *   subtitleClassName?: string;
 * }} props
 */
export default function BrandBlock({ subtitle, extraBrandClass = "", subtitleClassName = "" }) {
  return (
    <div className={`sheet-header-brand sheet-header-brand--phan-dat ${extraBrandClass}`.trim()}>
      <img
        className="sheet-header-brand-logo"
        src="/branding/phan-dat-badminton-logo.png"
        alt=""
        aria-hidden="true"
        width={72}
        height={72}
        decoding="async"
      />
      <div className="sheet-header-brand-text">
        <h1 className="sheet-title sheet-title--phan-dat">Phan Dat Badminton</h1>
        {subtitle != null && subtitle !== "" ? (
          <p className={`sheet-header-brand-subtitle ${subtitleClassName}`.trim()}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
