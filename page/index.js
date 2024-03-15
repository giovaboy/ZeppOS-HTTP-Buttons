import { BasePage } from '@zeppos/zml/base-page'
import { log as Logger } from '@zos/utils'
import { layout } from 'zosLoader:./index.[pf].layout.js'

const logger = Logger.getLogger("http-buttons");

function searchJSON(obj, key) {
  let results = [];
  for (let k in obj) {
    if (obj.hasOwnProperty(k)) {
      if (k === key) {
        results.push(obj[k]);
      } else if (typeof obj[k] === "object") {
        results = results.concat(searchJSON(obj[k], key));
      }
    }
  }
  return results;
}

Page(
  BasePage({
    state: {
      data: null,
      isError: false
    },
    onInit() {
      logger.info('page onInit invoked')
    },
    build() {
      logger.info('page build invoked')
      this.getDataFromPhone()
    },
    getDataFromPhone() {
      this.request({
        method: 'GET_DATA'
      })
        .then(
          ({ result }) => {
            //logger.info('getDataFromPhone success', result)
            this.state.data = result.substring(1, result.length - 1)
            this.state.isError = false
            layout.render(this)
          }
        )
        .catch(
          (error) => {
            logger.error('getDataFromPhone error', error)
            this.state.isError = true
            layout.render(this)
          }
        )
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
      // logger.log("response_style", request.response_style)

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

          let txtToReturn = undefined;//JSON.stringify(result.body);

          if (request.parse_result) {
            txtToReturn = searchJSON(result.body, request.parse_result)
            if (txtToReturn.length < 1) {
              txtToReturn = JSON.stringify(result.body);
            } else {
              txtToReturn = JSON.stringify(txtToReturn)
              txtToReturn = txtToReturn.substring(1, txtToReturn.length - 1);
            }
          } else {
            txtToReturn = JSON.stringify(result.body);
          }

          layout.notifyResult(txtToReturn, pageid, false, request.response_style)

        })
        .catch((error) => {
          logger.error('error=>', JSON.stringify(error))
          layout.notifyResult(JSON.stringify(error), pageid, true, request.response_style)
        });

      return task;
    },
    onDestroy() {
      logger.debug('page onDestroy invoked')
      // deleteWidget(layout.refs.customToast)
      // deleteWidget(layout.refs.customToastFillRect)
      // deleteWidget(layout.refs.customToastText)
    },
  })
)
