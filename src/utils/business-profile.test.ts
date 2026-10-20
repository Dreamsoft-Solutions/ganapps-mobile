import { businessEmailUrl, businessWebsiteUrl } from './business-profile';

describe('published organization links', (): void => {
  it('opens only absolute HTTPS websites without credentials', (): void => {
    expect(businessWebsiteUrl('https://example.com/events')).toBe('https://example.com/events');
    for (const value of [null, undefined, '', 'http://example.com', 'javascript:alert(1)', 'https://u:p@example.com']) {
      expect(businessWebsiteUrl(value)).toBeNull();
    }
  });
  it('builds a mail intent only from explicitly supplied contact data', (): void => {
    expect(businessEmailUrl('hello@example.com')).toBe('mailto:hello%40example.com');
    expect(businessEmailUrl(null)).toBeNull();
    expect(businessEmailUrl('a@example.com?bcc=private@example.com')).toBeNull();
    expect(businessEmailUrl('a@example.com\r\nBcc:x@y.com')).toBeNull();
  });
});
