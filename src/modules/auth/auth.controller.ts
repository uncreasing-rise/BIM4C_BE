import { Body,Controller,Get,HttpCode,Patch,Post,Req,Res,UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request,Response } from 'express';
import { ChangePasswordDto,LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { SessionAuthGuard } from './session-auth.guard';
@ApiTags('Auth') @Controller('auth')
export class AuthController {
  constructor(private readonly service:AuthService,private readonly config:ConfigService){}
  @Post('login') @HttpCode(200) @Throttle({default:{limit:5,ttl:60000}})
  async login(@Body()dto:LoginDto,@Req()req:Request,@Res({passthrough:true})res:Response){const result=await this.service.login(dto,req.requestId);res.cookie(this.cookieName(),result.token,this.cookieOptions(result.maxAge));return{data:result.user}}
  @Post('logout') @HttpCode(204) @UseGuards(SessionAuthGuard,CsrfGuard)
  async logout(@Req()req:Request,@Res({passthrough:true})res:Response){await this.service.logout(req.admin!.sessionId,req.admin!.id,req.requestId);res.clearCookie(this.cookieName(),this.cookieOptions(0))}
  @Get('me') @UseGuards(SessionAuthGuard) me(@Req()req:Request){return{data:req.admin}}
  @Patch('change-password') @HttpCode(204) @UseGuards(SessionAuthGuard,CsrfGuard)
  changePassword(@Body()dto:ChangePasswordDto,@Req()req:Request){return this.service.changePassword(req.admin!.id,req.admin!.sessionId,dto.currentPassword,dto.newPassword,req.requestId)}
  private cookieName(){return this.config.get<string>('AUTH_COOKIE_NAME')??'bim4c_admin_session'}
  private cookieOptions(maxAge:number){return{httpOnly:true,secure:this.config.get<string>('NODE_ENV')==='production',sameSite:'strict' as const,path:'/',maxAge:maxAge*1000}}
}
