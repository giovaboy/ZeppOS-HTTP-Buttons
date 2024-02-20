import { BaseSideService } from '@zeppos/zml/base-side'
import { settingsLib } from '@zeppos/zml/base-side'
import { data } from '../data/data.js'

const DEFAULT_DATA = { "pages": [{ "title": "page_1","text_size": 30,"back_color": 0x000000,"text_color": 0xffffff, "rows": [{ "buttons": [{ "text":"btn1_1", "w": 25, "spacer":false, "request":{"url":"","method":"","params": "",}}] }] }] };


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
    onSettingsChange({ key, newValue, oldValue }) {
      console.log('settings changed:',key)
      //this.call({
        //result: 
        getData()
      //})
    },
    onRun() {},
    onDestroy() {}
  })
)