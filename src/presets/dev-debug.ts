import Taro from '@tarojs/taro';

/**
 * 已自动开启过调试模式的本地标记
 * wx.setEnableDebug 是微信客户端持久化的全局开关：
 * 每次启动都强制开启会导致用户在菜单「关闭调试模式」后，重启又被代码重新打开，永远无法关闭。
 * 因此只在首次启动时自动开启一次，之后不再干预，尊重用户的手动选择。
 */
const DEBUG_AUTO_ENABLED_KEY = '__dev_debug_auto_enabled__';

/**
 * 小程序调试工具
 * 在开发版/体验版首次启动时自动开启调试模式
 * 支持微信小程序
 */
export function devDebug() {
  const env = Taro.getEnv();
  if (env === Taro.ENV_TYPE.WEAPP) {
    try {
      const accountInfo = Taro.getAccountInfoSync();
      const envVersion = accountInfo.miniProgram.envVersion;
      console.log('[Debug] envVersion:', envVersion);

      if (envVersion === 'release') return;

      // 已自动开启过则跳过，避免覆盖用户手动关闭调试模式的选择
      const hasAutoEnabled = Taro.getStorageSync(DEBUG_AUTO_ENABLED_KEY);
      if (hasAutoEnabled) return;

      Taro.setStorageSync(DEBUG_AUTO_ENABLED_KEY, true);
      Taro.setEnableDebug({ enableDebug: true });
    } catch (error) {
      console.error('[Debug] 开启调试模式失败:', error);
    }
  }
}
