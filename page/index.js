import { BasePage } from '@zeppos/zml/base-page'
import { log as Logger } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { layout } from 'zosLoader:./index.[pf].layout.js'

const logger = Logger.getLogger("http-buttons");

Page(
  BasePage({
    state: {
      data: null,
      isError: false
    },
    onInit() {
      logger.info('page onInit invoked')
      setPageBrightTime({ brightTime: 60000 });
      this.getDataFromPhone()
      //layout.render(this)
    },
    build() {
      logger.info('page build invoked')
    },
    getDataFromPhone() {
      this.request({
        method: 'GET_DATA'
      })
        .then(({ result }) => {
          logger.info('getDataFromPhone success',result)
          this.state.data = result.substring(1, result.length - 1)
          layout.render(this)
        })
        .catch((res) => {
          logger.error('getDataFromPhone error', res)
          this.state.isError = true
          layout.render(this)
        })
    },
    // onCall(req) {
    //   logger.log('onCall req', JSON.stringify(req))
    //   if (req.method === 'data') {
    //     this.state.data = req.params.data.substring(1, req.params.data.length - 1)
    //     layout.render(this)
    //   }
    //   //const data = req.result
    //   //logger.log('call data', data)

    //   //localStorage.setItem('data', JSON.stringify(data))
    // },

    executeButtonRequest(request, pageid) {
      let url = request.url;
      let dt = JSON.parse(this.state.data)
      if (dt.variables) {
        Object.entries(dt.variables).forEach(([key, value]) => {
          let search = "".concat("{", key, "}")
          logger.log('gloabal_var_replace', search, value)
          url = url.replaceAll(search, value)
        })
      }

      // logger.log("method", request.method)
      // logger.log("url", url)
      // logger.log("headers", request.headers)
      // logger.log("body", request.body)
      // logger.log("pageid", pageid)
      // logger.log("responsestyle", request.responsestyle)

      const task = this.httpRequest({
        url: url,
        method: request.method,
        headers: request.headers || undefined,
        body: request.body || undefined,
        timeout: 5000
      })
        .then((result) => {
          // logger.log('result.status', result.status)
          // logger.log('result.statusText', result.statusText)
          // logger.log('result.headers', result.headers)
          // logger.log('result.body', JSON.stringify(result.body))

          layout.notifyResult(JSON.stringify(result.body), pageid, false, request.responsestyle)

        })
        .catch((error) => {
          logger.error('error=>', JSON.stringify(error))
          layout.notifyResult(JSON.stringify(error), pageid, true, request.responsestyle)
        });


      // const download = this.download('https://docs.zepp.com/zh-cn/img/logo.png', {
      //   headers: {},
      //   timeout: 6000,
      //   filePath: 'logo2.png',
      // })


      return task;
    },
    onDestroy() {
      logger.debug('page onDestroy invoked')
    },
  })
)
