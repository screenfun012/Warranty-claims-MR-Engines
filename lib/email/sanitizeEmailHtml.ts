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

  // Ensure block/list display: li = list-item (keeps bullets/numbers), ul/ol/p/div = block
  const listItemDisplay = "list-item";
  const blockDisplay = "block";
  const blockTags: Array<{ tag: string; display: string; extraStyle?: string }> = [
    { tag: "li", display: listItemDisplay },
    { tag: "ul", display: blockDisplay, extraStyle: "list-style-type: disc; margin: 0.5em 0; padding-left: 1.5em;" },
    { tag: "ol", display: blockDisplay, extraStyle: "list-style-type: decimal; margin: 0.5em 0; padding-left: 1.5em;" },
    { tag: "p", display: blockDisplay },
    { tag: "div", display: blockDisplay },
  ];
  for (const { tag, display, extraStyle } of blockTags) {
    const styleValue = extraStyle ? `display: ${display}; ${extraStyle}` : `display: ${display}`;
    const openTagRegex = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
    out = out.replace(openTagRegex, (match) => {
      const inner = match.slice(tag.length + 1, -1).trim();
      const styleMatch = inner.match(/style="([^"]*)"/i);
      if (styleMatch) {
        const style = styleMatch[1].replace(/\s*;\s*$/, "");
        const newStyle = style ? `${style}; ${styleValue}` : styleValue;
        return `<${tag} ${inner.replace(/style="[^"]*"/i, `style="${newStyle}"`)}>`;
      }
      return inner ? `<${tag} style="${styleValue};" ${inner}>` : `<${tag} style="${styleValue};">`;
    });
  }

  return out;
}
