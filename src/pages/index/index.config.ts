export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '幸运穿搭',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff',
    enableShareAppMessage: true,
    enableShareTimeline: true
  })
  : {
    navigationBarTitleText: '幸运穿搭',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff',
    enableShareAppMessage: true,
    enableShareTimeline: true
  }
