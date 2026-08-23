import { PropsWithChildren, useState } from 'react';
import Taro, { useDidHide, useDidShow, useLaunch } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { PrivacyDialog } from '@/components/privacy-dialog';
import { agreePrivacy, hasAgreedPrivacy, isWeappEnv, setupAuthHooks, silentLogin } from '@/utils/auth';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  useLaunch(() => {
    // 注册全局鉴权钩子（所有请求自动携带 token，401 自动后台重登）
    setupAuthHooks();

    // 仅微信小程序启用登录与隐私协议流程
    if (!isWeappEnv()) return;

    if (hasAgreedPrivacy()) {
      // 已同意过当前版本：后台静默登录，不阻塞启动
      void silentLogin();
    } else {
      setShowPrivacyDialog(true);
    }
  });

  // 监听应用级别的 onHide，并转发到 eventCenter
  useDidHide(() => {
    Taro.eventCenter.trigger('onHide')
  })

  // 每次回到前台复查隐私协议状态：版本过期/从未同意时重新弹出（弹窗遮罩阻断使用，不同意不可使用）
  useDidShow(() => {
    if (isWeappEnv() && !hasAgreedPrivacy()) {
      setShowPrivacyDialog(true);
    }
  })

  const handleAgreePrivacy = async () => {
    const ok = await agreePrivacy();
    setShowPrivacyDialog(false);
    if (!ok) {
      Taro.showToast({ title: '登录失败，部分功能暂不可用', icon: 'none', duration: 2000 });
    }
  };

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
      <PrivacyDialog open={showPrivacyDialog} onAgree={handleAgreePrivacy} />
    </LucideTaroProvider>
  );
};

export default App;
