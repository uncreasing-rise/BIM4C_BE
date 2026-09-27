export type EmailLocale = 'vi' | 'en';
export type EmailDetails = Array<[string, string | null | undefined]>;
export interface EmailContent {
  locale?: EmailLocale;
  eyebrow: string;
  title: string;
  intro: string;
  details?: EmailDetails;
  next: string;
  action?: { label: string; url: string };
  reference?: string;
}

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[c]!,
  );

export function renderEmail(
  content: EmailContent,
  siteUrl: string,
  replyTo: string,
) {
  const vi = content.locale !== 'en';
  const e = escapeHtml;
  const details = (content.details ?? []).filter(
    ([, value]) => value != null && value !== '',
  );
  const action =
    content.action && /^https?:\/\//.test(content.action.url)
      ? content.action
      : undefined;
  const privacy = new URL(
    `/${vi ? 'vi' : 'en'}/phap-ly/chinh-sach-bao-mat`,
    siteUrl,
  ).href;
  const html = `<!doctype html><html lang="${vi ? 'vi' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(content.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${e(content.intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 28px;background:#0f172a;border-bottom:4px solid #2dd4bf"><a href="${e(siteUrl)}" style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:2px;text-decoration:none">BIM<span style="color:#2dd4bf">4C</span></a><p style="margin:8px 0 0;color:#cbd5e1;font-size:12px;letter-spacing:1px">BUILDING INFORMATION · CONNECTED PEOPLE</p></td></tr>
<tr><td style="padding:30px 28px"><p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;color:#0f766e">${e(content.eyebrow)}</p><h1 style="margin:0 0 18px;font-size:27px;line-height:1.3">${e(content.title)}</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#475569">${e(content.intro)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">${details.map(([label, value]) => `<tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0"><div style="font-size:11px;font-weight:700;letter-spacing:.6px;color:#64748b;margin-bottom:6px">${e(label)}</div><div style="font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;word-break:break-word">${e(value!)}</div></td></tr>`).join('')}</table>
<div style="margin:24px 0;padding:16px 18px;border-left:3px solid #14b8a6;background:#f0fdfa"><strong style="font-size:13px;color:#115e59">${vi ? 'BƯỚC TIẾP THEO' : 'WHAT HAPPENS NEXT'}</strong><p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#334155">${e(content.next)}</p></div>
${action ? `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#0f766e" style="border-radius:8px"><a href="${e(action.url)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">${e(action.label)} &rarr;</a></td></tr></table><p style="font-size:11px;line-height:1.6;color:#64748b;word-break:break-all">${vi ? 'Nếu nút không hoạt động, mở liên kết:' : 'If the button does not work, open:'}<br><a href="${e(action.url)}" style="color:#0f766e">${e(action.url)}</a></p>` : ''}
${content.reference ? `<p style="margin:22px 0 0;font-size:11px;color:#64748b">${vi ? 'Mã yêu cầu' : 'Reference'}: ${e(content.reference)}</p>` : ''}</td></tr>
<tr><td style="padding:22px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#64748b"><strong style="color:#334155">BIM4C · Digital Construction</strong><br>${vi ? 'Cần hỗ trợ? Trả lời email này hoặc liên hệ' : 'Need help? Reply to this email or contact'} <a href="mailto:${e(replyTo)}" style="color:#0f766e">${e(replyTo)}</a>.<br><a href="${e(privacy)}" style="color:#64748b">${vi ? 'Chính sách bảo mật' : 'Privacy policy'}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    'BIM4C',
    content.eyebrow,
    content.title,
    content.intro,
    ...details.map(([k, v]) => `${k}: ${v}`),
    content.next,
    action ? `${action.label}: ${action.url}` : '',
    content.reference ? `Reference: ${content.reference}` : '',
    `${vi ? 'Liên hệ' : 'Contact'}: ${replyTo}`,
    privacy,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { html, text };
}
