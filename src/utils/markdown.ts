import type { MarkdownParser } from '@ronradtke/react-native-markdown-display';
import MarkdownIt from 'markdown-it';
import markdownItIns from 'markdown-it-ins';

/**
 * Markdown parser used for attendee-facing Ganap descriptions.
 *
 * Markdown-it's default preset enables the GFM-compatible table and
 * strikethrough rules. HTML is intentionally disabled, while linkify and
 * soft-break rendering keep organizer-authored descriptions readable.
 */
export const EVENT_DESCRIPTION_MARKDOWN_PARSER: MarkdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
}).use(markdownItIns);

/**
 * Checks whether a markdown link is an absolute HTTP(S) URL.
 *
 * @param url - URL emitted by the markdown parser
 * @returns `true` only for URLs safe to hand to the native browser
 */
export function isSafeAbsoluteMarkdownUrl(url: string): boolean {
  if (!/^https?:\/\/[^/\s?#]+(?:[/?#][^\s]*)?$/i.test(url)) return false;

  try {
    const parsedUrl = new URL(url);
    return (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') && parsedUrl.hostname.length > 0;
  } catch {
    return false;
  }
}
