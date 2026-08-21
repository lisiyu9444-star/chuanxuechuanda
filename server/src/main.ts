import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';

function parsePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 3000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 白名单（无需手动配置）：
  // 1. 平台部署/预览域名由环境变量自动注入（COZE_PROJECT_DOMAIN_ALL / COZE_PROJECT_DOMAIN_DEFAULT）
  // 2. 开发环境放行本地预览端口（localhost:5000）
  // 3. 额外域名可通过 ALLOWED_ORIGINS 追加（逗号分隔），一般不设置也没有问题
  // 4. 无 origin 的请求（微信/抖音小程序、服务端调用、curl）直接放行，不受白名单限制
  const allowedOrigins = new Set<string>();
  const defaultDomain = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
  if (defaultDomain) allowedOrigins.add(defaultDomain.trim());
  try {
    const allDomains = JSON.parse(process.env.COZE_PROJECT_DOMAIN_ALL || '[]');
    if (Array.isArray(allDomains)) {
      allDomains.forEach((d) => typeof d === 'string' && d.trim() && allowedOrigins.add(d.trim()));
    }
  } catch {
    // COZE_PROJECT_DOMAIN_ALL 非合法 JSON 时忽略
  }
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((d) => allowedOrigins.add(d));
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:5000');
    allowedOrigins.add('http://127.0.0.1:5000');
  }
  // 平台域名（*.coze.site）后缀放行：预览/部署子域会随平台与部署变化，后缀匹配避免手动维护
  const isAllowedOrigin = (origin: string): boolean => {
    if (allowedOrigins.has(origin)) return true;
    try {
      const host = new URL(origin).hostname;
      return host === 'coze.site' || host.endsWith('.coze.site');
    } catch {
      return false;
    }
  };
  app.enableCors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如小程序、服务端调用）
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        // 打印被拒绝的 origin，便于排查新出现的访问来源
        console.warn(`[CORS] rejected origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${port} 被占用! 请运行 'npx kill-port ${port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();
