export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '测评记录' })
  : { navigationBarTitleText: '测评记录' }
