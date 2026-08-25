export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: 'AI 毒舌时尚官',
      navigationBarBackgroundColor: '#000000',
      navigationBarTextStyle: 'white',
      backgroundColor: '#000000',
      // 分享落地页自身也要支持继续裂变分享，必须显式开启 onShareAppMessage 注册
      enableShareAppMessage: true,
    })
  : {
      navigationBarTitleText: 'AI 毒舌时尚官',
      navigationBarBackgroundColor: '#000000',
      navigationBarTextStyle: 'white',
      backgroundColor: '#000000',
      enableShareAppMessage: true,
    }
