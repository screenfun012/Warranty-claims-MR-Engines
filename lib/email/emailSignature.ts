/**
 * Email signature appended to generic sent mails (Mail tab).
 * Contains addresses and optional banner image (MR Engines / Tiki Vent / slogan).
 */

const SIGNATURE_ADDRESSES = [
  "Malo Crniće 12311, Bajlonijeva 24",
  "Prešernova 15, Beograd 11000",
];

const SIGNATURE_WEBSITE_URL = "https://www.enginesmr.com/";
const SIGNATURE_BANNER_IMAGE_PATH = "/images/signature-banner.png";

/**
 * Returns HTML for the email signature (addresses, website link, banner image).
 * @param baseUrl - App base URL (e.g. https://app.example.com) for the banner image src
 */
export function getEmailSignatureHtml(baseUrl: string): string {
  const imageSrc = baseUrl ? `${baseUrl.replace(/\/$/, "")}${SIGNATURE_BANNER_IMAGE_PATH}` : "";
  const addressesHtml = SIGNATURE_ADDRESSES.map((line) => `<div style="margin:0;font-size:12px;line-height:1.4;color:#374151;">${escapeHtml(line)}</div>`).join("");
  const linkHtml = `<div style="margin:4px 0 0 0;font-size:12px;"><a href="${escapeHtml(SIGNATURE_WEBSITE_URL)}" style="color:#2563eb;">${escapeHtml(SIGNATURE_WEBSITE_URL)}</a></div>`;
  const bannerHtml = imageSrc
    ? `<div style="margin-top:16px;"><img src="${escapeHtml(imageSrc)}" alt="MR Engines" style="max-width:100%;height:auto;display:block;" width="600" /></div>`
    : "";
  return `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
  ${addressesHtml}
  ${linkHtml}
  ${bannerHtml}
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Plain text version of the signature (addresses + link; no image).
 */
export function getEmailSignatureText(): string {
  return "\n\n--\n" + SIGNATURE_ADDRESSES.join("\n") + "\n" + SIGNATURE_WEBSITE_URL;
}
