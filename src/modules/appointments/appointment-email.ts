import type { Appointment } from '@prisma/client';
import type { EmailContent, EmailDetails } from '../email/email-template';

export type AppointmentEmailKind =
  'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export function appointmentEmail(
  a: Appointment,
  kind: AppointmentEmailKind,
  admin: boolean,
  siteUrl: string,
): EmailContent {
  const vi = admin || a.locale !== 'en';
  const locale = vi ? 'vi' : 'en';
  const date = new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: a.timezone,
  }).format(a.startAt);
  const end = new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: a.timezone,
  }).format(a.endAt);
  const titles: Record<AppointmentEmailKind, [string, string]> = {
    requested: [
      'Đã nhận thời gian tư vấn bạn đề xuất',
      'We have received your preferred consultation time',
    ],
    confirmed: [
      'Lịch tư vấn của bạn đã được xác nhận',
      'Your consultation is confirmed',
    ],
    cancelled: [
      'Lịch tư vấn đã được hủy',
      'Your consultation has been cancelled',
    ],
    completed: [
      'Cảm ơn bạn đã dành thời gian cho BIM4C',
      'Thank you for meeting with BIM4C',
    ],
    no_show: [
      'Cùng sắp xếp lại buổi tư vấn',
      'Let’s find another time to connect',
    ],
  };
  const steps: Record<AppointmentEmailKind, [string, string]> = {
    requested: [
      'Đây là thời gian bạn đề xuất, chưa phải lịch đã xác nhận. BIM4C sẽ kiểm tra và gửi email xác nhận cùng thông tin tham gia. Bạn có thể trả lời email này nếu cần điều chỉnh.',
      'Your preferred time is pending review. We will email you once the appointment is confirmed, with joining details. Reply to this email if you need to make a change.',
    ],
    confirmed: [
      a.meetingUrl
        ? 'Tham gia qua Google Meet vào thời gian bên trên. Bạn có thể chuẩn bị trước câu hỏi hoặc tài liệu dự án. Cần đổi lịch? Hãy trả lời email này.'
        : 'BIM4C sẽ liên hệ trực tiếp theo thông tin bạn cung cấp. Hãy trả lời email này nếu cần làm rõ hình thức tư vấn hoặc thay đổi thời gian.',
      a.meetingUrl
        ? 'Join using the Google Meet link at the time shown above. Feel free to prepare questions or project documents. To reschedule, reply to this email.'
        : 'BIM4C will contact you using the details you provided. Reply to this email to clarify the meeting format or request a different time.',
    ],
    cancelled: [
      'Lịch hẹn này không còn hiệu lực. Bạn có thể chọn thời gian mới trên website hoặc trả lời email để được hỗ trợ.',
      'This appointment is no longer scheduled. Choose another time on our website or reply to this email for help.',
    ],
    completed: [
      'Nếu còn câu hỏi, tài liệu hoặc yêu cầu cần trao đổi tiếp, bạn có thể trả lời trực tiếp email này. BIM4C sẵn sàng cùng bạn xác định bước tiếp theo.',
      'If you have further questions, documents or requirements to discuss, simply reply to this email. We look forward to helping you with the next steps.',
    ],
    no_show: [
      'BIM4C chưa thể kết nối với bạn trong buổi hẹn vừa qua. Nếu bạn vẫn cần tư vấn, vui lòng chọn thời gian mới hoặc trả lời email này.',
      'We were unable to connect at the scheduled time. If you would still like a consultation, choose a new time or reply to this email.',
    ],
  };
  const details: EmailDetails = [
    [vi ? 'Chủ đề' : 'Topic', a.topic],
    [vi ? 'Thời gian' : 'When', `${date} – ${end}`],
    [vi ? 'Múi giờ' : 'Time zone', a.timezone],
    [
      vi ? 'Thời lượng' : 'Duration',
      `${Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000)} ${vi ? 'phút' : 'minutes'}`,
    ],
  ];
  if (admin)
    details.push(
      ['Khách hàng', a.name],
      ['Email', a.email],
      ['Điện thoại', a.phone],
      ['Công ty', a.company],
    );
  if (a.message) details.push([vi ? 'Ghi chú' : 'Notes', a.message]);
  const title = titles[kind][vi ? 0 : 1];
  const action = admin
    ? {
        label: 'Quản lý lịch hẹn',
        url: new URL('/admin/lich-tu-van', siteUrl).href,
      }
    : kind === 'confirmed' && a.meetingUrl
      ? {
          label: vi ? 'Tham gia Google Meet' : 'Join Google Meet',
          url: a.meetingUrl,
        }
      : ['cancelled', 'no_show'].includes(kind)
        ? {
            label: vi ? 'Chọn thời gian mới' : 'Choose a new time',
            url: new URL(`/${locale}/lien-he#dat-lich`, siteUrl).href,
          }
        : undefined;
  return {
    locale,
    eyebrow: vi ? 'LỊCH TƯ VẤN · BIM4C' : 'YOUR CONSULTATION · BIM4C',
    title: admin ? `Cập nhật lịch hẹn: ${a.name}` : title,
    intro: admin
      ? `${title}. Ngôn ngữ email của khách: ${a.locale === 'en' ? 'English' : 'Tiếng Việt'}.`
      : vi
        ? `Xin chào ${a.name}, ${kind === 'requested' ? 'cảm ơn bạn đã chia sẻ nhu cầu với BIM4C. Dưới đây là thông tin yêu cầu của bạn.' : 'dưới đây là thông tin cập nhật về buổi tư vấn của bạn.'}`
        : `Hi ${a.name}, ${kind === 'requested' ? 'thank you for reaching out to BIM4C. Here is a summary of your request.' : 'here is an update on your consultation.'}`,
    details,
    next: admin
      ? 'Xem lịch hẹn và cập nhật trạng thái trong trang quản trị. Trả lời email này để liên hệ trực tiếp với khách.'
      : steps[kind][vi ? 0 : 1],
    action,
    reference: a.id,
  };
}
