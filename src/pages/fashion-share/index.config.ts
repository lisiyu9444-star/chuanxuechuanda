export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: 'AI 毒舌时尚官',
      navigationBarBackgroundColor: '#000000',
      navigationBarTextStyle: 'white',
      backgroundColor: '#000000',
    })
  : {
      navigationBarTitleText: 'AI 毒舌时尚官',
      navigationBarBackgroundColor: '#000000',
      navigationBarTextStyle: 'white',
      backgroundColor: '#000000',
    }
