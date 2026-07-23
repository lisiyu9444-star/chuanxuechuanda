export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '今日穿搭',
    navigationBarBackgroundColor: '#0d1117',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0d1117'
  })
  : {
    navigationBarTitleText: '今日穿搭',
    navigationBarBackgroundColor: '#0d1117',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0d1117'
  }
