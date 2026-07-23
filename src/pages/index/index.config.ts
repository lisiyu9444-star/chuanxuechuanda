export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: 'AI五行穿搭',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  })
  : {
    navigationBarTitleText: 'AI五行穿搭',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  }
