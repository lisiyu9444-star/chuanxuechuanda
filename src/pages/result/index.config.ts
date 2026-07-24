export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: 'AI五行穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      navigationStyle: 'custom',
    })
  : {
      navigationBarTitleText: 'AI五行穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      navigationStyle: 'custom',
    }
