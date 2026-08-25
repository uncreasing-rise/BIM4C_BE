import { Transform } from 'class-transformer'; import { IsEmail,IsString,MaxLength,MinLength } from 'class-validator';
export class LoginDto{@Transform(({value}:{value:unknown})=>typeof value==='string'?value.trim().toLowerCase():value)@IsEmail()@MaxLength(320)email!:string;@IsString()@MinLength(8)@MaxLength(200)password!:string}
export class ChangePasswordDto{@IsString()@MinLength(8)@MaxLength(200)currentPassword!:string;@IsString()@MinLength(12)@MaxLength(200)newPassword!:string}
