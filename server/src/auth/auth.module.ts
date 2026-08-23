import { Module } from '@nestjs/common'
import { JwtModule, JwtSignOptions } from '@nestjs/jwt'
import { APP_GUARD } from '@nestjs/core'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './jwt-auth.guard'
import { getJwtSecret, JWT_EXPIRES_IN } from './auth-config'

@Module({
  imports: [
    JwtModule.register({
      global: true,
      // getJwtSecret() 在生产环境未配置 JWT_SECRET 时抛错，服务拒绝启动（fail-closed）
      secret: getJwtSecret(),
      signOptions: { expiresIn: JWT_EXPIRES_IN as JwtSignOptions['expiresIn'] },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
