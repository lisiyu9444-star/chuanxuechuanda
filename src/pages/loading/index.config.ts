export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '推演中',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  })
  : {
    navigationBarTitleText: '推演中',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  }
