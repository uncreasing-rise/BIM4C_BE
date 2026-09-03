import { ContentStatus, PrismaClient, ProjectStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const now = new Date('2026-08-19T00:00:00.000Z');
type ContentDomain = 'service' | 'project' | 'course' | 'article';
const sections = (subject: string, domain: ContentDomain) => {
  if (domain === 'project')
    return [
      {
        title: 'Bối cảnh dự án',
        body: `${subject} được triển khai trong điều kiện nhiều bộ môn cùng phát triển hồ sơ, tiến độ thiết kế thay đổi liên tục và các quyết định kỹ thuật có ảnh hưởng trực tiếp đến thi công. Thách thức không chỉ nằm ở việc tạo mô hình, mà ở khả năng duy trì một nguồn thông tin đáng tin cậy để chủ đầu tư, tư vấn và nhà thầu cùng sử dụng.\n\nNgay từ giai đoạn khởi động, BIM4C cùng ban dự án xác định mục tiêu ứng dụng BIM, ma trận trách nhiệm, mốc trao đổi dữ liệu và tiêu chí chấp nhận cho từng đầu ra. Cách tiếp cận này giúp công nghệ phục vụ đúng nhu cầu điều hành thay vì trở thành một lớp công việc tách rời.`,
      },
      {
        title: 'Phạm vi BIM4C thực hiện',
        body: 'Phạm vi được tổ chức theo các gói công việc có đầu vào, người phê duyệt và thời hạn rõ ràng. Mô hình liên kết được cập nhật theo chu kỳ thống nhất, đi kèm báo cáo chất lượng và danh mục vấn đề để các bên có thể theo dõi toàn bộ lịch sử xử lý.',
        unorderedList: [
          'Rà soát BEP, tiêu chuẩn mô hình và cấu trúc Common Data Environment',
          'Tổng hợp mô hình kiến trúc, kết cấu và MEP theo đúng hệ tọa độ dự án',
          'Kiểm tra xung đột, không gian lắp đặt, tiếp cận bảo trì và tính khả thi thi công',
          'Quản lý issue, biên bản phối hợp và dashboard trạng thái theo từng mốc',
          'Hỗ trợ hồ sơ thi công, nghiệm thu mô hình và dữ liệu bàn giao',
        ],
      },
      {
        title: 'Quy trình phối hợp và kiểm soát',
        body: 'Mỗi chu kỳ phối hợp bắt đầu bằng việc kiểm tra tính hợp lệ của dữ liệu đầu vào trước khi chạy các bộ quy tắc chuyên môn. Vấn đề được phân loại theo mức độ ảnh hưởng, vị trí, bộ môn chịu trách nhiệm và thời hạn phản hồi; các xung đột trùng lặp hoặc không có giá trị thi công được loại bỏ để đội ngũ tập trung vào nội dung thực sự quan trọng.\n\nCác phiên coordination không dừng ở việc trình chiếu clash. BIM4C chuẩn bị phương án, dữ liệu liên quan và tác động tiến độ để cuộc họp đi đến quyết định có thể thực thi. Sau cuộc họp, trạng thái được cập nhật trong CDE và kiểm tra lại ở phiên bản kế tiếp.',
        orderedList: [
          'Kiểm tra và tiếp nhận mô hình',
          'Phân tích xung đột theo ma trận ưu tiên',
          'Tổ chức phiên phối hợp liên ngành',
          'Theo dõi hành động khắc phục',
          'Xác nhận đóng và phát hành báo cáo',
        ],
      },
      {
        title: 'Đầu ra bàn giao',
        body: 'Hồ sơ bàn giao được cấu trúc để đội ngũ dự án có thể tiếp tục sử dụng sau khi kết thúc một giai đoạn phối hợp. Ngoài mô hình đã kiểm tra, BIM4C cung cấp báo cáo issue, danh mục thay đổi, tài liệu phương pháp và dữ liệu phục vụ nghiệm thu theo phạm vi được phê duyệt.',
        unorderedList: [
          'Mô hình liên kết theo mốc phát hành',
          'Báo cáo QA/QC và clash report có thể truy vết',
          'Dashboard tiến độ đóng vấn đề',
          'Biên bản quyết định và danh mục thay đổi',
          'Bộ dữ liệu bàn giao theo yêu cầu của chủ đầu tư',
        ],
      },
      {
        title: 'Giá trị đối với dự án',
        body: 'Giá trị lớn nhất đến từ việc vấn đề được nhìn thấy sớm hơn và quyết định được đưa ra trên cùng một nguồn dữ liệu. Điều này giảm nguy cơ sửa đổi tại công trường, hạn chế thời gian chờ giữa các bộ môn và giúp ban điều hành nhận biết khu vực rủi ro trước khi ảnh hưởng đến đường găng.\n\nHiệu quả được đánh giá thông qua các chỉ số như tỷ lệ issue đóng đúng hạn, số xung đột nghiêm trọng còn tồn tại theo từng mốc, thời gian phản hồi và mức độ đầy đủ của dữ liệu bàn giao.',
        quote:
          'Mô hình chỉ tạo ra giá trị khi nó giúp đội ngũ dự án đưa ra quyết định sớm hơn, rõ ràng hơn và có thể kiểm chứng.',
      },
    ];
  if (domain === 'course')
    return [
      {
        title: 'Mục tiêu chương trình',
        body: `${subject} được thiết kế để người học không chỉ biết thao tác công cụ mà hiểu cách sử dụng công cụ trong một quy trình dự án thực tế. Mỗi chủ đề đều gắn với đầu ra công việc, tiêu chí kiểm tra và tình huống phối hợp thường gặp trong doanh nghiệp.\n\nSau chương trình, học viên có thể tự tổ chức công việc, kiểm tra chất lượng sản phẩm và trao đổi chuyên môn với các bộ môn liên quan thay vì phụ thuộc hoàn toàn vào hướng dẫn từng bước.`,
      },
      {
        title: 'Đối tượng và yêu cầu đầu vào',
        body: 'Chương trình phù hợp với kỹ sư, kiến trúc sư, BIM Modeler, BIM Coordinator hoặc nhân sự quản lý đang cần chuẩn hóa năng lực. Trước khi bắt đầu, BIM4C đánh giá kinh nghiệm, công cụ đang sử dụng và mục tiêu nghề nghiệp để đề xuất lộ trình phù hợp.',
        unorderedList: [
          'Nhân sự dự án cần áp dụng BIM vào công việc hằng ngày',
          'Đội ngũ doanh nghiệp cần thống nhất quy trình và tiêu chuẩn đầu ra',
          'Sinh viên năm cuối đã có kiến thức chuyên ngành cơ bản',
          'Quản lý cần hiểu cách tổ chức và đánh giá hoạt động BIM',
        ],
      },
      {
        title: 'Cấu trúc học tập',
        body: 'Nội dung được triển khai theo mô hình học ngắn – thực hành sâu – nhận phản hồi. Giảng viên giới thiệu nguyên tắc cốt lõi, phân tích một tình huống dự án, sau đó học viên thực hiện trên bộ dữ liệu có yêu cầu và tiêu chí nghiệm thu cụ thể.\n\nBài tập sau mỗi module liên kết với nhau để hình thành sản phẩm cuối khóa hoàn chỉnh. Học viên được yêu cầu giải thích quyết định kỹ thuật, ghi nhận vấn đề và trình bày phương án, tương tự cách làm việc trong một phiên phối hợp thực tế.',
        orderedList: [
          'Nắm nguyên tắc và tiêu chuẩn',
          'Thực hành có hướng dẫn',
          'Xử lý tình huống dự án',
          'Nhận review trực tiếp',
          'Hoàn thiện sản phẩm cuối khóa',
        ],
      },
      {
        title: 'Nội dung và sản phẩm đầu ra',
        body: 'Tùy theo chương trình, đầu ra có thể là mô hình chuyên ngành, bộ hồ sơ, báo cáo clash, BEP, workflow CDE hoặc dashboard quản lý thông tin. Mỗi sản phẩm được đánh giá trên độ chính xác, tính nhất quán, khả năng sử dụng và cách học viên kiểm soát chất lượng.',
        unorderedList: [
          'Tài liệu hướng dẫn và bộ dữ liệu thực hành',
          'Checklist tự kiểm tra theo từng module',
          'Bài tập cá nhân hoặc bài tập nhóm có phản biện',
          'Sản phẩm cuối khóa có thể đưa vào portfolio',
          'Đánh giá năng lực và khuyến nghị lộ trình tiếp theo',
        ],
      },
      {
        title: 'Phương pháp đánh giá',
        body: 'BIM4C không đánh giá dựa trên thời lượng tham gia đơn thuần. Kết quả được xác định bằng chất lượng sản phẩm, khả năng phát hiện lỗi, cách tổ chức dữ liệu và mức độ chủ động khi giải quyết tình huống. Phản hồi cuối khóa chỉ rõ năng lực đã đạt, khoảng trống cần cải thiện và những bước tiếp theo để ứng dụng vào công việc.',
        quote:
          'Mục tiêu của đào tạo không phải hoàn thành nhiều thao tác hơn, mà là tạo ra một đầu ra đúng, có thể kiểm tra và sử dụng được trong dự án.',
      },
    ];
  if (domain === 'service')
    return [
      {
        title: 'Bài toán chúng tôi giải quyết',
        body: `${subject} được xây dựng cho các tổ chức đang gặp khoảng cách giữa mục tiêu chuyển đổi số và khả năng triển khai thực tế. Quy trình thiếu thống nhất, dữ liệu phân tán, vai trò chưa rõ hoặc mô hình không được sử dụng để ra quyết định là những nguyên nhân phổ biến khiến đầu tư BIM chưa tạo ra hiệu quả tương xứng.\n\nBIM4C bắt đầu bằng việc đánh giá hiện trạng và xác định vấn đề ưu tiên. Giải pháp chỉ được đề xuất khi có người sử dụng rõ ràng, đầu ra cụ thể và chỉ số để đánh giá sau triển khai.`,
      },
      {
        title: 'Phạm vi dịch vụ',
        body: 'Phạm vi được tùy chỉnh theo giai đoạn dự án, năng lực nội bộ và hệ thống công nghệ hiện có. BIM4C có thể đảm nhiệm vai trò tư vấn độc lập, đơn vị triển khai hoặc nhóm hỗ trợ trực tiếp cho ban quản lý dự án.',
        unorderedList: [
          'Khảo sát hiện trạng, mục tiêu và mức độ sẵn sàng',
          'Xây dựng tiêu chuẩn, quy trình và ma trận trách nhiệm',
          'Thiết lập môi trường dữ liệu và biểu mẫu kiểm soát',
          'Triển khai thí điểm trên phạm vi có thể đo lường',
          'Chuyển giao, đào tạo và hỗ trợ vận hành',
        ],
      },
      {
        title: 'Cách thức triển khai',
        body: 'Dịch vụ được chia thành các giai đoạn ngắn với đầu ra và điểm phê duyệt cụ thể. BIM4C làm việc cùng nhóm nòng cốt của khách hàng để giải pháp phù hợp với cách tổ chức hiện tại, đồng thời tạo đủ thay đổi để giải quyết nguyên nhân gốc.\n\nTrong quá trình triển khai, các chỉ số về chất lượng dữ liệu, thời gian phản hồi, tỷ lệ hoàn thành và mức độ sử dụng được theo dõi định kỳ. Những điều chỉnh được ghi nhận vào quy trình thay vì xử lý như ngoại lệ không có hệ thống.',
        orderedList: [
          'Đánh giá và thống nhất mục tiêu',
          'Thiết kế giải pháp cùng tiêu chuẩn',
          'Thử nghiệm trên phạm vi kiểm soát',
          'Đo lường và hiệu chỉnh',
          'Chuyển giao để vận hành ổn định',
        ],
      },
      {
        title: 'Sản phẩm bàn giao',
        body: 'Khách hàng nhận được bộ đầu ra có thể tiếp tục sử dụng và cập nhật sau khi kết thúc dịch vụ. Tài liệu không chỉ mô tả nguyên tắc mà bao gồm cấu trúc dữ liệu, biểu mẫu, checklist và hướng dẫn trách nhiệm cho từng vai trò.',
        unorderedList: [
          'Báo cáo đánh giá hiện trạng và lộ trình ưu tiên',
          'BEP, EIR hoặc bộ tiêu chuẩn áp dụng theo phạm vi',
          'Workflow, checklist QA/QC và dashboard theo dõi',
          'Mô hình hoặc bộ dữ liệu mẫu đã được kiểm chứng',
          'Tài liệu chuyển giao và kế hoạch nâng cao năng lực',
        ],
      },
      {
        title: 'Hiệu quả kỳ vọng',
        body: 'Hiệu quả được xem xét trên cả chất lượng đầu ra và khả năng duy trì của tổ chức. Các mục tiêu thường bao gồm giảm thời gian tìm kiếm thông tin, giảm vòng lặp phối hợp, phát hiện vấn đề sớm hơn, nâng cao tính nhất quán của hồ sơ và cải thiện khả năng truy vết quyết định.\n\nBIM4C ưu tiên những thay đổi có thể áp dụng trong công việc hằng ngày, sau đó mới mở rộng sang các lớp công nghệ phức tạp hơn.',
        quote:
          'Một giải pháp tốt không làm quy trình phức tạp hơn; nó làm cho trách nhiệm, dữ liệu và quyết định trở nên rõ ràng hơn.',
      },
    ];
  return [
    {
      title: 'Bối cảnh',
      body: `${subject} được phân tích từ góc nhìn triển khai thực tế, tập trung vào mối liên hệ giữa con người, quy trình và dữ liệu trong dự án xây dựng.`,
    },
    {
      title: 'Phân tích chuyên môn',
      body: 'Nội dung làm rõ nguyên nhân, tác động và những điều kiện cần thiết để giải pháp có thể được áp dụng hiệu quả trong tổ chức.',
    },
    {
      title: 'Khuyến nghị áp dụng',
      body: 'BIM4C đề xuất cách tiếp cận theo từng bước, có tiêu chí đánh giá và cơ chế phản hồi để cải tiến sau mỗi giai đoạn.',
    },
  ];
};

const services = [
  [
    'tu-van-bim',
    'Tư vấn BIM',
    '/images/service-bim.jpg',
    [
      'BIM Execution Plan',
      'Common Data Environment',
      'Kiểm soát chất lượng mô hình',
    ],
  ],
  [
    'dao-tao',
    'Đào tạo',
    '/images/service-training.jpg',
    ['Lộ trình theo năng lực', 'Bài tập dự án thực tế', 'Đánh giá đầu ra'],
  ],
  [
    'thiet-ke',
    'Thiết kế',
    '/images/service-design.jpg',
    ['Thiết kế đa bộ môn', 'Clash Detection', 'Hồ sơ đồng bộ'],
  ],
  [
    'tu-van-giam-sat',
    'Tư vấn giám sát',
    '/images/service-consulting.jpg',
    ['Giám sát hiện trường', 'Kiểm soát tiến độ', 'Báo cáo minh bạch'],
  ],
  [
    'bim-coordination',
    'BIM Coordination',
    '/images/news-project-coordination.webp',
    ['Federated Model', 'Clash Management', 'Issue Tracking'],
  ],
  [
    'digital-twin-va-du-lieu-tai-san',
    'Digital Twin & Dữ liệu tài sản',
    '/images/news-digital-twin.webp',
    ['Asset Information', 'Digital Handover', 'Operational Insights'],
  ],
] as const;

const courses = [
  [
    'bim-foundation',
    'BIM Foundation',
    '/images/service-training.jpg',
    'NỀN TẢNG · 8 TUẦN',
  ],
  [
    'bim-coordination',
    'BIM Coordination',
    '/images/service-bim.jpg',
    'CHUYÊN SÂU · 10 TUẦN',
  ],
  [
    'bim-management',
    'BIM Management',
    '/images/service-consulting.jpg',
    'QUẢN LÝ · 6 TUẦN',
  ],
  [
    'revit-structure-professional',
    'Revit Structure Professional',
    '/images/service-design.jpg',
    'CHUYÊN NGÀNH · 8 TUẦN',
  ],
  [
    'navisworks-clash-detection',
    'Navisworks & Clash Detection',
    '/images/news-project-coordination.webp',
    'THỰC CHIẾN · 5 TUẦN',
  ],
  [
    'cde-iso-19650',
    'CDE & ISO 19650',
    '/images/news-digital-twin.webp',
    'QUẢN TRỊ THÔNG TIN · 6 TUẦN',
  ],
] as const;

const posts = [
  {
    slug: 'phoi-hop-bim-du-an-cao-tang',
    title:
      'Phối hợp BIM tại dự án cao tầng: Từ mô hình đến quyết định hiện trường',
    image: '/images/news-project-coordination.webp',
    category: 'du-an',
    eyebrow: 'DỰ ÁN',
    description:
      'Đội ngũ BIM4C kết nối mô hình, bản vẽ và dữ liệu hiện trường để phát hiện sớm xung đột và hỗ trợ quyết định thi công chính xác.',
    highlights: [
      'Phối hợp đa bộ môn',
      'Kiểm soát xung đột',
      'Dữ liệu hiện trường',
    ],
  },
  {
    slug: 'digital-twin-trong-quan-ly-cong-trinh',
    title:
      'Digital Twin mở ra cách tiếp cận mới trong quản lý vòng đời công trình',
    image: '/images/news-digital-twin.webp',
    category: 'cong-nghe',
    eyebrow: 'CÔNG NGHỆ',
    description:
      'Mô hình số đồng bộ dữ liệu thiết kế, thi công và vận hành, tạo nền tảng trực quan cho quản trị tài sản và dự báo rủi ro.',
    highlights: ['Digital Twin', 'Dữ liệu thời gian thực', 'Quản trị vòng đời'],
  },
  {
    slug: 'dao-tao-bim-thuc-chien-cho-ky-su',
    title:
      'Đào tạo BIM thực chiến: Nâng cao năng lực phối hợp cho đội ngũ kỹ sư',
    image: '/images/news-bim-training.webp',
    category: 'dao-tao',
    eyebrow: 'ĐÀO TẠO',
    description:
      'Chương trình học dựa trên tình huống dự án giúp kỹ sư hình thành tư duy phối hợp, kiểm soát thông tin và xử lý vấn đề có hệ thống.',
    highlights: ['Học từ dự án', 'Thực hành mô hình', 'Phát triển năng lực'],
  },
  {
    slug: 'du-lieu-so-nang-cao-an-toan-cong-truong',
    title: 'Ứng dụng dữ liệu số để chủ động kiểm soát an toàn công trường',
    image: '/images/news-site-safety.webp',
    category: 'an-toan',
    eyebrow: 'AN TOÀN',
    description:
      'Quy trình kiểm tra số hóa giúp đội ngũ nhận diện rủi ro, theo dõi hành động khắc phục và duy trì tiêu chuẩn an toàn nhất quán.',
    highlights: ['Nhận diện rủi ro', 'Kiểm tra số hóa', 'An toàn chủ động'],
  },
] as const;

async function seed(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true'
  ) {
    throw new Error(
      'ADMIN_BOOTSTRAP_RESET_PASSWORD must not be enabled in production',
    );
  }
  const bootstrapEmail =
    process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (bootstrapEmail && bootstrapPassword) {
    const existing = await prisma.adminUser.findUnique({
      where: { email: bootstrapEmail },
    });
    if (!existing)
      await prisma.adminUser.create({
        data: {
          email: bootstrapEmail,
          name: 'BIM4C Super Admin',
          passwordHash: await hash(bootstrapPassword, 12),
          roles: { create: [{ role: 'SUPER_ADMIN' }] },
        },
      });
    else if (process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true')
      await prisma.$transaction([
        prisma.adminUser.update({
          where: { id: existing.id },
          data: { passwordHash: await hash(bootstrapPassword, 12) },
        }),
        prisma.adminSession.deleteMany({ where: { userId: existing.id } }),
      ]);
  }
  const highRise = await prisma.projectCategory.upsert({
    where: { slug: 'nha-cao-tang' },
    update: { name: 'Nhà cao tầng' },
    create: { slug: 'nha-cao-tang', name: 'Nhà cao tầng' },
  });
  const infrastructure = await prisma.projectCategory.upsert({
    where: { slug: 'ha-tang' },
    update: { name: 'Hạ tầng' },
    create: { slug: 'ha-tang', name: 'Hạ tầng' },
  });
  const industrial = await prisma.projectCategory.upsert({
    where: { slug: 'cong-nghiep' },
    update: { name: 'Công nghiệp' },
    create: { slug: 'cong-nghiep', name: 'Công nghiệp' },
  });

  for (const [index, [slug, title, image, highlights]] of services.entries()) {
    const data = {
      title,
      image,
      highlights: [...highlights],
      sections: sections(title, 'service'),
      eyebrow: 'DỊCH VỤ BIM4C',
      description: `Giải pháp ${title.toLowerCase()} được thiết kế theo mục tiêu, quy mô và mức độ sẵn sàng của từng tổ chức hoặc dự án.`,
      status: ContentStatus.PUBLISHED,
      publishedAt: now,
      sortOrder: index,
    };
    await prisma.service.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }

  const projects = [
    [
      'lumi-hanoi',
      'Lumi Hanoi',
      '/images/project-lumi.jpg',
      'Hà Nội',
      2025,
      ProjectStatus.IN_PROGRESS,
      highRise.id,
    ],
    [
      'the-matrix-one-giai-doan-2',
      'The Matrix One - Giai đoạn 2',
      '/images/project-matrix.jpg',
      'Hà Nội',
      2026,
      ProjectStatus.IN_PROGRESS,
      highRise.id,
    ],
    [
      'elysian',
      'Elysian',
      '/images/project-elysian.jpg',
      'TP. Hồ Chí Minh',
      2025,
      ProjectStatus.COMPLETED,
      highRise.id,
    ],
    [
      'tt-avio',
      'TT Avio',
      '/images/hero.jpg',
      'Bình Dương',
      2026,
      ProjectStatus.IN_PROGRESS,
      highRise.id,
    ],
    [
      'central-park-residences',
      'Central Park Residences',
      '/images/about.jpg',
      'Nghệ An',
      2025,
      ProjectStatus.COMPLETED,
      infrastructure.id,
    ],
    [
      'northgate-logistics-hub',
      'Northgate Logistics Hub',
      '/images/news-site-safety.webp',
      'Bắc Ninh',
      2026,
      ProjectStatus.IN_PROGRESS,
      industrial.id,
    ],
    [
      'greenfield-smart-factory',
      'Greenfield Smart Factory',
      '/images/service-design.jpg',
      'Hải Phòng',
      2025,
      ProjectStatus.COMPLETED,
      industrial.id,
    ],
    [
      'metro-depot-digital-coordination',
      'Metro Depot Digital Coordination',
      '/images/news-digital-twin.webp',
      'TP. Hồ Chí Minh',
      2026,
      ProjectStatus.IN_PROGRESS,
      infrastructure.id,
    ],
  ] as const;
  for (const [
    index,
    [slug, title, image, location, year, status, categoryId],
  ] of projects.entries()) {
    const data = {
      title,
      image,
      location,
      year,
      status,
      categoryId,
      eyebrow: 'DỰ ÁN BIM4C',
      description: `${title} ứng dụng quy trình phối hợp số để kiểm soát thiết kế, thi công, chất lượng và dữ liệu bàn giao xuyên suốt.`,
      highlights: ['Phối hợp BIM', 'Quản lý thi công', 'Kiểm soát chất lượng'],
      sections: sections(title, 'project'),
      publishedAt: now,
      sortOrder: index,
      isFeatured: index < 3,
    };
    await prisma.project.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }
  await prisma.project.update({
    where: { slug: 'tt-avio' },
    data: {
      investor:
        'Đơn vị Đầu Tư & Phát Triển liên doanh Nhật Bản Cosmos Initia - TT Capital – Koterasu Partner',
      expectedCompletion: 'N/a',
      scale:
        'Diện tích khu đất: 1,6 ha gồm 2 tháp với 2 hầm chung, Tháp A: 30 tầng, Tháp B: 37 tầng',
      location: 'Đường DT743A, P. Tân Đông Hiệp, TP. Dĩ An, tỉnh Bình Dương',
      contractPackage: 'Tổng thầu thi công',
    },
  });

  for (const [index, [slug, title, image, eyebrow]] of courses.entries()) {
    const data = {
      title,
      image,
      eyebrow,
      description: `Chương trình ${title} kết hợp nền tảng chuyên môn, bài tập dự án và đánh giá năng lực đầu ra cho đội ngũ ngành xây dựng.`,
      highlights: ['Bài tập thực hành', 'Dữ liệu dự án', 'Đánh giá đầu ra'],
      sections: sections(title, 'course'),
      status: ContentStatus.PUBLISHED,
      publishedAt: now,
      sortOrder: index,
    };
    await prisma.course.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }
  const postCategoryNames = {
    'du-an': 'Dự án',
    'cong-nghe': 'Công nghệ',
    'dao-tao': 'Đào tạo',
    'an-toan': 'An toàn',
  } as const;
  const postCategories = new Map<string, string>();
  for (const [slug, name] of Object.entries(postCategoryNames)) {
    const category = await prisma.postCategory.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });
    postCategories.set(slug, category.id);
  }
  for (const [index, post] of posts.entries()) {
    const data = {
      title: post.title,
      image: post.image,
      eyebrow: post.eyebrow,
      categoryId: postCategories.get(post.category)!,
      description: post.description,
      highlights: [...post.highlights],
      sections: sections(post.title, 'article'),
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(now.getTime() - index * 86400000),
      sortOrder: index,
      meta: `${15 - index}.08.2026`,
    };
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: data,
      create: { slug: post.slug, ...data },
    });
  }
  if ((await prisma.heroSlide.count()) === 0)
    await prisma.heroSlide.createMany({
      data: [
        {
          eyebrow: 'BIM4C CONSTRUCTION',
          title: 'KIẾN TẠO GIÁ TRỊ BỀN VỮNG',
          image: '/images/hero.jpg',
          alt: 'Công trình BIM4C',
          sortOrder: 0,
        },
        {
          eyebrow: 'DỰ ÁN TIÊU BIỂU',
          title: 'CHẤT LƯỢNG TẠO NÊN UY TÍN',
          image: '/images/project-lumi.jpg',
          alt: 'Dự án Lumi Hanoi',
          sortOrder: 1,
        },
        {
          eyebrow: 'CÔNG NGHỆ BIM',
          title: 'CHUYỂN ĐỔI SỐ NGÀNH XÂY DỰNG',
          image: '/images/project-matrix.jpg',
          alt: 'Ứng dụng BIM',
          sortOrder: 2,
        },
      ],
    });
  if ((await prisma.strategicPartner.count()) === 0)
    await prisma.strategicPartner.createMany({
      data: [
        ['Masterise Homes', 'masterise.png'],
        ['Gamuda Land', 'gamuda.png'],
        ['Ecopark', 'ecopark.png'],
        ['Nam Long', 'namlong.png'],
        ['MIK Group', 'mik.png'],
        ['Bitexco', 'bitexco.png'],
      ].map(([name, file], sortOrder) => ({
        name,
        logo: `/images/partners/${file}`,
        sortOrder,
      })),
    });
}

void seed()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
