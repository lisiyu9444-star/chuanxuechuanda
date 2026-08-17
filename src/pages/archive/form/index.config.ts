export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '编辑档案' })
  : { navigationBarTitleText: '编辑档案' }
