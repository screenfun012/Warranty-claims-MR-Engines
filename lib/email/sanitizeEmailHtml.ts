/**
 * Sanitize HTML for email: strip backgrounds so pasted content doesn't bring
 * black/colored backgrounds; ensure list items and blocks display vertically.
 */

/**
 * Remove background-related styles from style attribute, and ensure block display for list/paragraphs.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html || !html.trim()) return html;

  let out = html;

  // Strip style attributes that contain background (removes black/colored pasted backgrounds)
  out = out.replace(/\s*style="[^"]*"/gi, (match) => {
    const style = match.replace(/^\s*style="/i, "").replace(/"\s*$/, "");
    const withoutBackground = style
      .split(";")
      .filter((part) => {
        const prop = part.split(":")[0].trim().toLowerCase();
        return prop && !prop.includes("background");
      })
      .join("; ")
      .trim();
    if (!withoutBackground) return "";
    return ` style="${withoutBackground}"`;
  });

  // Ensure list and block elements display as block (fixes items showing side-by-side)
  const blockTags = ["li", "ul", "ol", "p", "div"];
  for (const tag of blockTags) {
    const openTagRegex = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
    out = out.replace(openTagRegex, (match) => {
      const inner = match.slice(tag.length + 1, -1).trim(); // content between tag name and >
      const styleMatch = inner.match(/style="([^"]*)"/i);
      if (styleMatch) {
        const style = styleMatch[1].replace(/\s*;\s*$/, "");
        const newStyle = style ? `${style}; display: block` : "display: block";
        return `<${tag} ${inner.replace(/style="[^"]*"/i, `style="${newStyle}"`)}>`;
      }
      return inner ? `<${tag} style="display: block;" ${inner}>` : `<${tag} style="display: block;">`;
    });
  }

  return out;
}
