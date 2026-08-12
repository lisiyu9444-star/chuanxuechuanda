import { PropsWithChildren } from 'react';
import Taro, { useDidHide } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  // 监听应用级别的 onHide，并转发到 eventCenter
  useDidHide(() => {
    Taro.eventCenter.trigger('onHide')
  })

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
