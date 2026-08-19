export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '正在生成中',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  })
  : {
    navigationBarTitleText: '正在生成中',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  }
