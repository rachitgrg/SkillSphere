import { sendEmail } from '../utils/sendEmail';
import { env } from '../config/env';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

class EmailService {
  /** Generic notification email: title, message and a button to `link` (a client path). User text is escaped. */
  async sendNotificationEmail(to: { email: string; firstName: string }, title: string, message: string, link?: string): Promise<void> {
    try {
      const url = link ? `${env.CLIENT_URL}${link}` : env.CLIENT_URL;
      await sendEmail({
        to: to.email,
        subject: `${title} · SkillSphere`,
        text: `Hi ${to.firstName},\n\n${message}\n\n${url}\n\nYou can change email notifications in Settings.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Hi ${escapeHtml(to.firstName)},</p>
            <h2 style="color: #4f46e5;">${escapeHtml(title)}</h2>
            <p>${escapeHtml(message)}</p>
            <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Open SkillSphere</a>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">You can change email notifications in Settings.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send notification email:', error);
    }
  }
}

export default new EmailService();
