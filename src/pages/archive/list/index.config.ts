export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '档案管理' })
  : { navigationBarTitleText: '档案管理' }
