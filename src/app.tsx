import { PropsWithChildren } from 'react';
import Taro, { useDidHide, useDidShow, useLaunch } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { hasAgreedPrivacy, isWeappEnv, setupAuthHooks, silentLogin } from '@/utils/auth';
import { Preset } from './presets';

// 注意：小程序端 App 组件不渲染任何 UI（app.tsx 仅为逻辑入口），
// 全局浮层（如登录弹层 LoginSheet）必须挂载在各页面的组件树内，此处不挂载。
const App = ({ children }: PropsWithChildren) => {
  useLaunch(() => {
    // 注册全局鉴权钩子（所有请求自动携带 token，401 自动后台重登）
    setupAuthHooks();

    // 仅微信小程序启用登录体系：已同意过隐私协议的老用户后台静默登录，不阻塞启动。
    // 未登录/未同意的新用户不强制弹窗，可正常浏览示例内容；
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

  // 分享参数兜底：微信通过分享卡片打开 tabBar 页面时，页面 onLoad 的 query 会被丢弃，
  // 但 App 级 onShow 的 options.query 完整保留启动参数，这里捕获 shareId 存 storage，
  // 由测评页 useDidShow 消费（同时兼容旧版本生成的指向 tabBar 页的分享卡片）。
  useDidShow((options) => {
    const query = (options?.query || {}) as { shareId?: string };
    const path = options?.path || '';
    console.log('[App] onShow options:', { path, shareId: query.shareId, scene: options?.scene });
    if (query.shareId && path.includes('fashion-rating')) {
      Taro.setStorageSync('fashion_pending_share_id', query.shareId);
      console.log('[App] captured pending shareId from App.onShow:', query.shareId);
    }
  })

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      {/* Toaster 仅供 H5 端错误边界使用（小程序端 App 不渲染 UI，无副作用） */}
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
