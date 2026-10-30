import * as mailer from '../src/utils/sendEmail';
import emailService from '../src/services/emailService';

describe('notification emails escape user text (P3-4)', () => {
  it('HTML in names, titles and messages is rendered as text', async () => {
    const send = jest.spyOn(mailer, 'sendEmail').mockResolvedValue();
    await emailService.sendNotificationEmail(
      { email: 'a@test.dev', firstName: '<img src=x onerror=alert(1)>' },
      'New proposal on "<b>Gig</b>"',
      'Message with <script>alert(1)</script> & more',
      '/gigs/1'
    );
    const { html } = send.mock.calls[0][0] as { html: string };
    expect(html).not.toMatch(/<img|<script|<b>/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more');
    send.mockRestore();
  });
});
