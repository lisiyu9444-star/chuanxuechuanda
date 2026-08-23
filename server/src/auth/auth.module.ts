import { Module } from '@nestjs/common'
import { JwtModule, JwtSignOptions } from '@nestjs/jwt'
import { APP_GUARD } from '@nestjs/core'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './jwt-auth.guard'
import { JWT_EXPIRES_IN } from './auth-config'
import { resolveJwtSecret } from './secrets'

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      // 密钥解析（fail-closed）：环境变量 JWT_SECRET 优先；
      // 未配置则数据库自举持久化（免平台配置权限，重启不失效）；
      // 两者均不可用时抛错，服务拒绝启动。
      useFactory: async () => ({
        secret: await resolveJwtSecret(),
        signOptions: { expiresIn: JWT_EXPIRES_IN as JwtSignOptions['expiresIn'] },
      }),
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
