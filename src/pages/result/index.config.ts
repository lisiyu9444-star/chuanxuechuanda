export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '幸运穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    })
  : {
      navigationBarTitleText: '幸运穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    }
