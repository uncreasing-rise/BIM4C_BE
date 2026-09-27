import { Injectable } from '@nestjs/common';
import { EmailService } from './email.service';
import type { EmailDetails, EmailLocale } from './email-template';

@Injectable()
export class SubmissionNotificationsService {
  constructor(private readonly email: EmailService) {}

  async enquiry(
    kind: 'contact' | 'course',
    data: {
      id: string;
      name: string;
      email: string;
      phone?: string | null;
      company?: string | null;
      message?: string | null;
    },
    locale: EmailLocale = 'vi',
    courseTitle?: string,
  ) {
    const vi = locale === 'vi';
    const course = kind === 'course';
    const title = course
      ? vi
        ? 'Đã nhận yêu cầu tư vấn khóa học'
        : 'Your course enquiry is with us'
      : vi
        ? 'Cảm ơn bạn đã liên hệ BIM4C'
        : 'Thank you for contacting BIM4C';
    const details: EmailDetails = [
      [vi ? 'Họ và tên' : 'Name', data.name],
      ['Email', data.email],
      [vi ? 'Điện thoại' : 'Phone', data.phone],
      [vi ? 'Công ty' : 'Company', data.company],
      [vi ? 'Khóa học' : 'Course', courseTitle],
      [vi ? 'Nội dung của bạn' : 'Your message', data.message],
    ];
    const [customer, admin] = await Promise.all([
      this.email.send({
        to: data.email,
        key: `${kind}/${data.id}/customer`,
        subject: `${title} | BIM4C`,
        content: {
          locale,
          eyebrow: vi ? 'ĐÃ TIẾP NHẬN' : 'REQUEST RECEIVED',
          title,
          intro: vi
            ? `Xin chào ${data.name}, yêu cầu của bạn đã được lưu và chuyển đến đội ngũ BIM4C.`
            : `Hi ${data.name}, your enquiry has been saved and passed to the BIM4C team.`,
          details,
          reference: data.id,
          next: course
            ? vi
              ? 'Đội ngũ đào tạo sẽ liên hệ để trao đổi mục tiêu học tập, lịch học và học phí. Đây là yêu cầu tư vấn, chưa phải xác nhận ghi danh hay thanh toán.'
              : 'Our training team will discuss your learning goals, schedule and fees. This is an enquiry, not an enrolment or payment confirmation.'
            : vi
              ? 'Đội ngũ BIM4C sẽ xem xét nội dung và liên hệ qua email hoặc số điện thoại bạn cung cấp. Bạn có thể trả lời email này để bổ sung thông tin.'
              : 'Our team will review your request and reply by email or phone. You can reply to this email with any additional information.',
          action: {
            label: vi ? 'Khám phá BIM4C' : 'Explore BIM4C',
            url: this.email.url(`/${locale}`),
          },
        },
      }),
      this.email.send({
        to: this.email.adminEmail,
        replyTo: data.email,
        key: `${kind}/${data.id}/admin`,
        subject: `${course ? 'Tư vấn khóa học' : 'Liên hệ mới'}: ${data.name} | BIM4C`,
        content: {
          eyebrow: 'YÊU CẦU MỚI',
          title: course ? 'Có học viên cần tư vấn' : 'Có khách hàng cần hỗ trợ',
          intro:
            'Yêu cầu đã được lưu trên hệ thống. Trả lời email này để liên hệ trực tiếp với khách.',
          details: [
            ['Họ và tên', data.name],
            ['Email', data.email],
            ['Điện thoại', data.phone],
            ['Công ty', data.company],
            ['Khóa học', courseTitle],
            ['Nội dung', data.message],
            ['Ngôn ngữ của khách', vi ? 'Tiếng Việt' : 'English'],
          ],
          reference: data.id,
          next: 'Xem đầy đủ yêu cầu, phân công người phụ trách và cập nhật trạng thái xử lý trong trang quản trị.',
          action: {
            label: 'Mở yêu cầu trong quản trị',
            url: this.email.url(
              course ? '/admin/dang-ky-khoa-hoc' : '/admin/lien-he',
            ),
          },
        },
      }),
    ]);
    return { customer, admin };
  }

  newsletter(id: string, address: string, locale: EmailLocale = 'vi') {
    const vi = locale === 'vi';
    return this.email.send({
      to: address,
      key: `newsletter/${id}/welcome`,
      subject: vi
        ? 'Chào mừng bạn đến với BIM4C Insights'
        : 'Welcome to BIM4C Insights',
      content: {
        locale,
        eyebrow: 'BIM4C INSIGHTS',
        title: vi
          ? 'Kết nối kiến thức. Cùng phát triển.'
          : 'Fresh perspectives. Shared progress.',
        intro: vi
          ? 'Bạn đã đăng ký nhận cập nhật từ BIM4C. Cảm ơn bạn đã đồng hành cùng chúng tôi.'
          : 'You are subscribed to updates from BIM4C. Thank you for joining us.',
        details: [['Email', address]],
        next: vi
          ? 'Bạn sẽ nhận kiến thức BIM, tin dự án và thông tin đào tạo. Để ngừng nhận tin, trả lời email này với nội dung “Hủy đăng ký”; đội ngũ BIM4C sẽ xử lý yêu cầu.'
          : 'Expect BIM insights, project news and training updates. To stop receiving updates, reply with “Unsubscribe”; our team will process your request.',
        action: {
          label: vi ? 'Khám phá website' : 'Explore the website',
          url: this.email.url(`/${locale}`),
        },
      },
    });
  }
}
