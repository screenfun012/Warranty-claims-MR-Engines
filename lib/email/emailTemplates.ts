/**
 * Email templates for warranty claims
 */

interface ClaimEmailData {
  claimCode?: string | null;
  customerName?: string | null;
  status?: string;
  claimAcceptanceStatus?: string | null;
  customMessage?: string;
  viewLink?: string; // Link za pregled slika/video
  baseUrl?: string; // Base URL za logo i linkove
}

export function getClaimProcessingEmailTemplate(data?: ClaimEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const claimCode = data?.claimCode || "N/A";
  const customerName = data?.customerName || "Kupac";
  
  return {
    subject: `Vaša reklamacija #${claimCode} se procesira`,
    text: `Vaša reklamacija #${claimCode} se procesira. Kontaktiraćemo Vas uskoro.`,
    html: generateClaimEmailHTML({
      claimCode,
      customerName,
      status: data?.status || "PROCESSING",
      message: "Vaša reklamacija se procesira. Kontaktiraćemo Vas uskoro sa dodatnim informacijama.",
      viewLink: data?.viewLink,
      baseUrl: data?.baseUrl || "http://localhost:3000",
    }),
  };
}

export function getClaimStatusEmailTemplate(
  claimAcceptanceStatus: "ACCEPTED" | "REJECTED",
  data?: ClaimEmailData
): {
  subject: string;
  text: string;
  html: string;
} {
  const claimCode = data?.claimCode || "N/A";
  const customerName = data?.customerName || "Kupac";
  const isAccepted = claimAcceptanceStatus === "ACCEPTED";
  
  const statusText = isAccepted 
    ? "prihvaćena" 
    : "odbijena";
  
  const statusMessage = isAccepted
    ? "Vaša reklamacija je uspešno procesirana i prihvaćena. Kontaktiraćemo Vas u vezi daljih koraka."
    : "Nažalost, vaša reklamacija je odbijena. Ako imate dodatna pitanja, molimo Vas da nas kontaktirate.";

  return {
    subject: `Reklamacija #${claimCode} - ${statusText.toUpperCase()}`,
    text: `Vaša reklamacija #${claimCode} je ${statusText}. ${statusMessage}`,
    html: generateClaimEmailHTML({
      claimCode,
      customerName,
      status: claimAcceptanceStatus,
      message: data?.customMessage || statusMessage,
      viewLink: data?.viewLink,
      isStatusUpdate: true,
      baseUrl: data?.baseUrl || "http://localhost:3000",
    }),
  };
}

function generateClaimEmailHTML(options: {
  claimCode: string;
  customerName: string;
  status: string;
  message: string;
  viewLink?: string;
  isStatusUpdate?: boolean;
  baseUrl: string;
}): string {
  const { claimCode, customerName, status, message, viewLink, isStatusUpdate, baseUrl } = options;
  
  // Boje - MR Engines boje (crvena/narandžasta)
  const primaryColor = "#DC2626"; // Red-600
  const accentColor = "#F97316"; // Orange-500
  const bgColor = "#1F2937"; // Gray-800
  const cardBgColor = "#374151"; // Gray-700
  const textColor = "#FFFFFF";
  const mutedTextColor = "#D1D5DB";
  
  // Logo URL - koristimo light logo za email (bolje se vidi na tamnoj pozadini)
  const logoUrl = `${baseUrl}/images/mr-engines-logo-light.png`;
  
  // Status badge boja
  let statusColor = "#6B7280"; // Gray
  let statusText = "U procesu";
  if (status === "ACCEPTED") {
    statusColor = "#10B981"; // Green
    statusText = "PRIHVAĆENA";
  } else if (status === "REJECTED") {
    statusColor = "#EF4444"; // Red
    statusText = "ODBIJENA";
  } else if (status === "CLOSED") {
    statusColor = "#6B7280";
    statusText = "ZATVORENA";
  }

  return `
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reklamacija #${claimCode}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${bgColor};">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${bgColor};">
    <tr>
      <td style="padding: 40px 20px;">
        <!-- Main Content Card -->
        <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: ${cardBgColor}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 30px; background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%); text-align: center;">
              <img src="${logoUrl}" alt="MR Engines" style="max-width: 200px; height: auto; margin-bottom: 10px;" />
              <p style="margin: 10px 0 0 0; color: ${textColor}; font-size: 14px; opacity: 0.9; font-weight: 500;">
                Reklamacije i Garancija
              </p>
            </td>
          </tr>
          
          <!-- Status Message Section -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <!-- Yellow accent bar -->
                  <td style="width: 4px; background-color: ${accentColor}; vertical-align: top;"></td>
                  <td style="padding-left: 20px; vertical-align: top;">
                    <h2 style="margin: 0 0 10px 0; color: ${textColor}; font-size: 20px; font-weight: 600; line-height: 1.4;">
                      Vaša reklamacija #${claimCode} ${isStatusUpdate ? `je ${statusText.toLowerCase()}` : 'se procesira'}
                    </h2>
                    ${isStatusUpdate ? `
                    <div style="display: inline-block; padding: 6px 12px; background-color: ${statusColor}; border-radius: 4px; margin-bottom: 15px;">
                      <span style="color: ${textColor}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${statusText}
                      </span>
                    </div>
                    ` : ''}
                    <p style="margin: 15px 0 0 0; color: ${mutedTextColor}; font-size: 16px; line-height: 1.6;">
                      ${message}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          ${viewLink ? `
          <!-- View Link Section -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${bgColor}; border-radius: 6px; padding: 20px;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: ${mutedTextColor}; font-size: 14px; line-height: 1.6;">
                      Možete pregledati sve fotografije i video zapise motora na sledećem linku:
                    </p>
                    <a href="${viewLink}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: ${textColor}; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; transition: background-color 0.2s;">
                      Pregledaj fotografije i video zapise
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Instructions Section -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0 0 15px 0; color: ${mutedTextColor}; font-size: 14px; line-height: 1.6;">
                <strong style="color: ${textColor};">Važne napomene:</strong>
              </p>
              <ul style="margin: 0; padding-left: 20px; color: ${mutedTextColor}; font-size: 14px; line-height: 1.8;">
                <li style="margin-bottom: 8px;">Molimo Vas da proverite da li su dostavljeni proizvodi bez fizičkih oštećenja i drugih nepravilnosti</li>
                <li style="margin-bottom: 8px;">Ukoliko primetite bilo šta od navedenog, potrebno je prijaviti u prvih 24h od prijema</li>
                <li style="margin-bottom: 8px;">Za dodatne informacije, možete nas kontaktirati putem email-a</li>
              </ul>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: ${bgColor}; border-top: 1px solid #4B5563; text-align: center;">
              <p style="margin: 0 0 10px 0; color: ${mutedTextColor}; font-size: 14px; line-height: 1.6;">
                Hvala vam na ukazanom poverenju.
              </p>
              <p style="margin: 0; color: ${mutedTextColor}; font-size: 14px; font-weight: 600;">
                Vaš MR Engines tim
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

