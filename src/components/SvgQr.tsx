import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
  className?: string;
}

// Renders an inline SVG QR code (no external image dependency).
export function SvgQr({ value, size = 200, className }: Props) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 1,
      width: size,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((s) => { if (active) setSvg(s); });
    return () => { active = false; };
  }, [value, size]);

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label={`QR ${value}`}
    />
  );
}
