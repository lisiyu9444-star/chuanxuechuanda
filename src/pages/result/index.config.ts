export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '今日穿搭',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  })
  : {
    navigationBarTitleText: '今日穿搭',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  }
