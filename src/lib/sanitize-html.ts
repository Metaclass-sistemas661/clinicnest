import DOMPurify from "dompurify";

/**
 * Sanitiza HTML para prevenir XSS antes de renderizar com dangerouslySetInnerHTML.
 * Permite tags seguras de formatação (p, b, i, u, br, table, ul, ol, li, h1-h6, etc.)
 * mas remove scripts, event handlers, e injeções maliciosas.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "em", "strong", "s", "strike", "sub", "sup",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "blockquote", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
      "a", "img", "hr", "span", "div", "section", "article",
      "dl", "dt", "dd", "figure", "figcaption",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "width", "height",
      "class", "style", "id", "colspan", "rowspan", "align", "valign",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
}
