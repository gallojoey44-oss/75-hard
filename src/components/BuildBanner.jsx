export const BUILD_VERSION   = 'v2.4.0';
export const BUILD_LABEL     = 'LIVE BUILD TEST';
export const BUILD_DATE      = '2026-06-27';
export const PRODUCTION_URL  = 'https://75-hard-v2.vercel.app';

export default function BuildBanner() {
  return (
    <div className="build-banner">
      {BUILD_LABEL} — {BUILD_VERSION}
    </div>
  );
}
