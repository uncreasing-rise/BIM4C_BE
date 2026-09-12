require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.service.count(), prisma.project.count(), prisma.course.count(), prisma.post.count(),
  prisma.service.findMany({ select: { id: true, title: true, title_vi: true, description: true, description_vi: true }, take: 5 }),
  prisma.project.findMany({ select: { id: true, title: true, title_vi: true, description: true, description_vi: true }, take: 5 }),
  prisma.course.findMany({ select: { id: true, title: true, title_vi: true, description: true, description_vi: true }, take: 5 }),
  prisma.post.findMany({ select: { id: true, title: true, title_vi: true, description: true, description_vi: true }, take: 5 }),
]).then((x) => console.log(JSON.stringify({ counts: { services: x[0], projects: x[1], courses: x[2], posts: x[3] }, samples: { services: x[4], projects: x[5], courses: x[6], posts: x[7] } }, null, 2))).finally(() => prisma.$disconnect());
