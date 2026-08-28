import { describe, expect, it } from '@jest/globals';
import type { MarkdownToken } from 'markdown-it';
import { EVENT_DESCRIPTION_MARKDOWN_PARSER, isSafeAbsoluteMarkdownUrl } from './markdown';

function collectTokenTypes(tokens: MarkdownToken[]): string[] {
  return tokens.flatMap((token: MarkdownToken): string[] => [
    token.type,
    ...(token.children ? collectTokenTypes(token.children) : []),
  ]);
}

describe('event description markdown', (): void => {
  it('supports underline syntax and GFM tables/strikethrough', (): void => {
    const tokens = EVENT_DESCRIPTION_MARKDOWN_PARSER.parse(
      '++underlined++ and ~~removed~~\n\n| Name | Value |\n| --- | --- |\n| One | Two |',
      {},
    );
    const tokenTypes: string[] = collectTokenTypes(tokens);

    expect(tokenTypes).toContain('ins_open');
    expect(tokenTypes).toContain('s_open');
    expect(tokenTypes).toContain('table_open');
  });

  it('keeps raw HTML disabled in the parser', (): void => {
    const tokens = EVENT_DESCRIPTION_MARKDOWN_PARSER.parse('<strong>visible text</strong>', {});

    expect(tokens.some((token): boolean => token.type === 'html_inline' || token.type === 'html_block')).toBe(false);
    expect(tokens.some((token): boolean => token.content.includes('<strong>'))).toBe(true);
  });

  it('accepts only absolute HTTP(S) links', (): void => {
    expect(isSafeAbsoluteMarkdownUrl('https://example.com/path')).toBe(true);
    expect(isSafeAbsoluteMarkdownUrl('http://example.com/path')).toBe(true);
    expect(isSafeAbsoluteMarkdownUrl('/relative/path')).toBe(false);
    expect(isSafeAbsoluteMarkdownUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeAbsoluteMarkdownUrl('https:///missing-host')).toBe(false);
  });
});
