import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_DATA } from '../utils/constants.js'

function migrateDataIfNeeded() {
  console.log('Error migrateDataIfNeeded')
  let raw = settingsLib.getItem('data')

  if (!raw) {
    //settingsLib.setItem('data', JSON.stringify(DEFAULT_DATA))
    console.log('no data found')
    return
  }

  try {
    let parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      let migrated = parsed[0] || DEFAULT_DATA
      settingsLib.setItem('data', JSON.stringify(migrated))
      console.log('array → object completed')
      return
    }

    if (typeof parsed === 'object') {
      return
    }

  } catch (e) {
    console.log('Error parsing data:', e)
    //settingsLib.setItem('data', JSON.stringify(DEFAULT_DATA))
  }
}

function getData() {
  //console.debug('getData')
  //migrateDataIfNeeded()
  const saved = settingsLib.getItem('data');
  return saved;// || JSON.stringify(DEFAULT_DATA);
}

AppSideService(
  BaseSideService({
    onInit() {
      migrateDataIfNeeded()
    },
    onRequest(req, res) {
      if (req.method === 'GET_DATA') {
        res(null, {
          result: getData()
        })
      }
    },
    onSettingsChange({ key, newValue, oldValue }) {//can we push to the watch from here?
      //console.log('settings changed:',key)
      //this.notifyDevice()
    },
    // notifyDevice() {
    //   this.call({
    //     method: 'data',
    //     params: {
    //       data: getData(),
    //     }
    //   })
    // },
    onRun() {},
    onDestroy() {}
  })
)