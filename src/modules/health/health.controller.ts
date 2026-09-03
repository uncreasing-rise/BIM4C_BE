import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('health') @ApiOkResponse() health() {
    return { status: 'ok' };
  }
  @Get('ready') @ApiOkResponse() async ready() {
    try {
      await this.prisma
        .$queryRaw`SELECT investor, expected_completion, scale, contract_package FROM projects LIMIT 0`;
      return { status: 'ready', database: 'ok', schema: 'compatible' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'unavailable_or_incompatible',
      });
    }
  }
}
