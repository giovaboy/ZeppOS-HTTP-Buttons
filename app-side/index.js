import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_DATA } from '../utils/constants.js'

function getData() {
  console.log('getData')
  return settingsLib.getItem('data')
    ? settingsLib.getItem('data')
    : [DEFAULT_DATA]
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRequest(req, res) {
      if (req.method === 'GET_DATA') {
        res(null, {
          result: getData()
        })
      }
    },
    onSettingsChange({ key, newValue, oldValue }) {//can we push to the watch from here?
      console.log('settings changed:',key)
        //getData()
    },
    onRun() {},
    onDestroy() {}
  })
)