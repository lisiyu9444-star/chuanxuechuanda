export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '绘画中',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  })
  : {
    navigationBarTitleText: '绘画中',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  }
