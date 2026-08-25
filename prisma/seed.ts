import { ContentStatus, PrismaClient, ProjectStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const now = new Date('2026-08-19T00:00:00.000Z');
const sections = (subject: string) => [{ title: 'Tổng quan', body: `${subject} được BIM4C triển khai theo quy trình phối hợp rõ ràng, kiểm soát chất lượng và dữ liệu xuyên suốt.` }, { title: 'Giá trị mang lại', body: 'Giải pháp giúp giảm sai sót, tăng tính minh bạch và hỗ trợ đội ngũ dự án ra quyết định hiệu quả.' }];

const services = [
  ['tu-van-bim', 'Tư vấn BIM', '/images/service-bim.jpg', ['BIM Execution Plan', 'Common Data Environment', 'Kiểm soát chất lượng mô hình']],
  ['dao-tao', 'Đào tạo', '/images/service-training.jpg', ['Lộ trình theo năng lực', 'Bài tập dự án thực tế', 'Đánh giá đầu ra']],
  ['thiet-ke', 'Thiết kế', '/images/service-design.jpg', ['Thiết kế đa bộ môn', 'Clash Detection', 'Hồ sơ đồng bộ']],
  ['tu-van-giam-sat', 'Tư vấn giám sát', '/images/service-consulting.jpg', ['Giám sát hiện trường', 'Kiểm soát tiến độ', 'Báo cáo minh bạch']],
] as const;

const courses = [
  ['bim-foundation', 'BIM Foundation', '/images/service-training.jpg', 'NỀN TẢNG · 8 TUẦN'],
  ['bim-coordination', 'BIM Coordination', '/images/service-bim.jpg', 'CHUYÊN SÂU · 10 TUẦN'],
  ['bim-management', 'BIM Management', '/images/service-consulting.jpg', 'QUẢN LÝ · 6 TUẦN'],
] as const;

const posts = [
  ['trien-khai-du-an-trong-diem-2026', 'BIM4C triển khai dự án trọng điểm trong năm 2026', '/images/project-matrix.jpg', 'DỰ ÁN'],
  ['dao-tao-thuc-chien-ky-su', 'Đẩy mạnh đào tạo thực chiến cho đội ngũ kỹ sư', '/images/service-training.jpg', 'CON NGƯỜI'],
  ['ung-dung-bim-nang-cao-chat-luong', 'Ứng dụng BIM nâng cao chất lượng thi công', '/images/service-bim.jpg', 'CÔNG NGHỆ'],
  ['quan-tri-du-lieu-xuyen-suot-du-an', 'Quản trị dữ liệu xuyên suốt vòng đời dự án', '/images/service-design.jpg', 'CHUYÊN MÔN'],
] as const;

async function seed(): Promise<void> {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (bootstrapEmail && bootstrapPassword) {
    const existing = await prisma.adminUser.findUnique({ where: { email: bootstrapEmail } });
    if (!existing) await prisma.adminUser.create({ data: { email: bootstrapEmail, name: 'BIM4C Super Admin', passwordHash: await hash(bootstrapPassword, 12), roles: { create: [{ role: 'SUPER_ADMIN' }] } } });
    else if (process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true') await prisma.$transaction([
      prisma.adminUser.update({ where: { id: existing.id }, data: { passwordHash: await hash(bootstrapPassword, 12) } }),
      prisma.adminSession.deleteMany({ where: { userId: existing.id } }),
    ]);
  }
  const highRise = await prisma.projectCategory.upsert({ where: { slug: 'nha-cao-tang' }, update: { name: 'Nhà cao tầng' }, create: { slug: 'nha-cao-tang', name: 'Nhà cao tầng' } });
  const infrastructure = await prisma.projectCategory.upsert({ where: { slug: 'ha-tang' }, update: { name: 'Hạ tầng' }, create: { slug: 'ha-tang', name: 'Hạ tầng' } });

  for (const [index, [slug, title, image, highlights]] of services.entries()) await prisma.service.upsert({ where: { slug }, update: {}, create: { slug, title, image, highlights: [...highlights], sections: sections(title), eyebrow: 'DỊCH VỤ BIM4C', description: `Giải pháp ${title.toLowerCase()} thực chiến, phù hợp với mục tiêu của tổ chức và dự án.`, status: ContentStatus.PUBLISHED, publishedAt: now, sortOrder: index } });

  const projects = [
    ['lumi-hanoi', 'Lumi Hanoi', '/images/project-lumi.jpg', 'Hà Nội', 2025, ProjectStatus.IN_PROGRESS, highRise.id],
    ['the-matrix-one-giai-doan-2', 'The Matrix One - Giai đoạn 2', '/images/project-matrix.jpg', 'Hà Nội', 2026, ProjectStatus.IN_PROGRESS, highRise.id],
    ['elysian', 'Elysian', '/images/project-elysian.jpg', 'TP. Hồ Chí Minh', 2025, ProjectStatus.COMPLETED, highRise.id],
    ['tt-avio', 'TT Avio', '/images/hero.jpg', 'Bình Dương', 2026, ProjectStatus.IN_PROGRESS, highRise.id],
    ['central-park-residences', 'Central Park Residences', '/images/about.jpg', 'Nghệ An', 2025, ProjectStatus.COMPLETED, infrastructure.id],
  ] as const;
  for (const [index, [slug, title, image, location, year, status, categoryId]] of projects.entries()) await prisma.project.upsert({ where: { slug }, update: {}, create: { slug, title, image, location, year, status, categoryId, eyebrow: 'DỰ ÁN BIM4C', description: `${title} được triển khai với tiêu chuẩn cao về chất lượng, an toàn và tiến độ.`, highlights: ['Phối hợp BIM', 'Quản lý thi công', 'Kiểm soát chất lượng'], sections: sections(title), publishedAt: now, sortOrder: index, isFeatured: index < 3 } });

  for (const [index, [slug, title, image, eyebrow]] of courses.entries()) await prisma.course.upsert({ where: { slug }, update: {}, create: { slug, title, image, eyebrow, description: `Chương trình ${title} thực chiến dành cho đội ngũ ngành xây dựng.`, highlights: ['Bài tập thực hành', 'Dự án thực tế', 'Chứng nhận BIM4C'], sections: sections(title), status: ContentStatus.PUBLISHED, publishedAt: now, sortOrder: index } });
  const category = await prisma.postCategory.upsert({ where: { slug: 'tin-tuc' }, update: {}, create: { slug: 'tin-tuc', name: 'Tin tức' } });
  for (const [index, [slug, title, image, eyebrow]] of posts.entries()) await prisma.post.upsert({ where: { slug }, update: {}, create: { slug, title, image, eyebrow, categoryId: category.id, description: `Cập nhật mới nhất từ BIM4C về ${title.toLowerCase()}.`, highlights: ['BIM4C', 'Chất lượng', 'Phát triển'], sections: sections(title), status: ContentStatus.PUBLISHED, publishedAt: new Date(now.getTime() - index * 86400000), sortOrder: index, meta: `${15 - index}.08.2026` } });
  if(await prisma.heroSlide.count()===0) await prisma.heroSlide.createMany({data:[
    {eyebrow:'BIM4C CONSTRUCTION',title:'KIẾN TẠO GIÁ TRỊ BỀN VỮNG',image:'/images/hero.jpg',alt:'Công trình BIM4C',sortOrder:0},
    {eyebrow:'DỰ ÁN TIÊU BIỂU',title:'CHẤT LƯỢNG TẠO NÊN UY TÍN',image:'/images/project-lumi.jpg',alt:'Dự án Lumi Hanoi',sortOrder:1},
    {eyebrow:'CÔNG NGHỆ BIM',title:'CHUYỂN ĐỔI SỐ NGÀNH XÂY DỰNG',image:'/images/project-matrix.jpg',alt:'Ứng dụng BIM',sortOrder:2},
  ]});
  if(await prisma.strategicPartner.count()===0) await prisma.strategicPartner.createMany({data:[
    ['Masterise Homes','masterise.png'],['Gamuda Land','gamuda.png'],['Ecopark','ecopark.png'],['Nam Long','namlong.png'],['MIK Group','mik.png'],['Bitexco','bitexco.png']
  ].map(([name,file],sortOrder)=>({name,logo:`/images/partners/${file}`,sortOrder}))});
}

void seed()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
