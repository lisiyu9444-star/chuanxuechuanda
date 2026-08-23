import { PropsWithChildren, useEffect, useState } from 'react';
import Taro, { useDidHide, useLaunch } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { LoginSheet } from '@/components/login-sheet';
import { AUTH_EVENTS, hasAgreedPrivacy, isWeappEnv, setupAuthHooks, silentLogin } from '@/utils/auth';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  useLaunch(() => {
    // 注册全局鉴权钩子（所有请求自动携带 token，401 自动后台重登）
    setupAuthHooks();

    // 仅微信小程序启用登录体系：已同意过隐私协议的老用户后台静默登录，不阻塞启动。
    // 未登录/未同意的新用户不再强制弹窗，可正常浏览示例内容；
    // 在「添加档案 / AI 生成 / 历史记录」等入口由 requireLogin 唤起登录弹层。
    if (!isWeappEnv()) return;
    if (hasAgreedPrivacy()) {
      void silentLogin();
    }
  });

  // 监听应用级别的 onHide，并转发到 eventCenter
  useDidHide(() => {
    Taro.eventCenter.trigger('onHide')
  })

  // 全局登录弹层：业务页面在登录门禁入口触发 SHOW_LOGIN_DIALOG，此处统一唤起
  useEffect(() => {
    const handleShowLogin = () => {
      if (isWeappEnv()) {
        setShowLoginSheet(true);
      }
    };
    Taro.eventCenter.on(AUTH_EVENTS.SHOW_LOGIN_DIALOG, handleShowLogin);
    return () => {
      Taro.eventCenter.off(AUTH_EVENTS.SHOW_LOGIN_DIALOG, handleShowLogin);
    };
  }, []);

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
      <LoginSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
    </LucideTaroProvider>
  );
};

export default App;
