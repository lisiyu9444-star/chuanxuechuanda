export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '幸运穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
    })
  : {
      navigationBarTitleText: '幸运穿搭',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
    }
