import { useSettings } from "../../features/settings/useSettings";
import "./BrandMark.css";

/** Logo da empresa (definido em Configurações) ou, sem logo, o símbolo do ClickHELP. */
function BrandMark({ size = 48 }) {
  const { branding } = useSettings();

  if (branding.logoDataUrl) {
    return (
      <img
        className="brand-logo"
        style={{ "--mark-size": `${size}px` }}
        src={branding.logoDataUrl}
        alt={`Logo ${branding.companyName || branding.appName}`}
      />
    );
  }

  return (
    <div className="brand-mark" style={{ "--mark-size": `${size}px` }} aria-hidden="true">
      <span className="brand-mark-core"></span>
    </div>
  );
}

export default BrandMark;
