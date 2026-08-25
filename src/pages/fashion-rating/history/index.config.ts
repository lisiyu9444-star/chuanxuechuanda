export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '测评记录',
      // Taro 不会默认注册页面 onShareAppMessage，必须显式开启
      enableShareAppMessage: true,
    })
  : {
      navigationBarTitleText: '测评记录',
      enableShareAppMessage: true,
    }
