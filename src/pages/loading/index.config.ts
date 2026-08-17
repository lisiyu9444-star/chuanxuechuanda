export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '绘画中' })
  : { navigationBarTitleText: '绘画中' }
