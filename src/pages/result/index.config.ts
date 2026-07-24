export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '幸运穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      navigationStyle: 'custom',
    })
  : {
      navigationBarTitleText: '幸运穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      navigationStyle: 'custom',
    }
