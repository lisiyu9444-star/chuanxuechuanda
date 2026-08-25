export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: 'AI 毒舌时尚官',
      // Taro 不会默认注册页面 onShareAppMessage，必须显式开启，
      // 否则 useShareAppMessage 回调不执行，微信走默认分享（当前页路径、无参数）
      enableShareAppMessage: true,
    })
  : {
      navigationBarTitleText: 'AI 毒舌时尚官',
      enableShareAppMessage: true,
    }
