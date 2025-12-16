/**
 * Email templates for warranty claims
 */

export function getClaimProcessingEmailTemplate(): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: "Your WARRANTY claim is being processed",
    text: "Your WARRANTY claim is being processed. We will get back to you soon.",
    html: `
      <p>Your WARRANTY claim is being processed. We will get back to you soon.</p>
    `,
  };
}

