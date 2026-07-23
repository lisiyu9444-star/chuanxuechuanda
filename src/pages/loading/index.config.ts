export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '推演中',
    navigationBarBackgroundColor: '#0d1117',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0d1117'
  })
  : {
    navigationBarTitleText: '推演中',
    navigationBarBackgroundColor: '#0d1117',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0d1117'
  }
