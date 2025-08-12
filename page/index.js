import { BasePage } from '@zeppos/zml/base-page'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, prop, anim_status } from '@zos/ui'
import { layout, LOADING_TEXT_WIDGET, LOADING_IMG_ANIM_WIDGET } from 'zosLoader:./index.[pf].layout.js'
import { digestRequest, basicRequest, bearerRequest } from '../utils/auth-request.js'

const logger = getLogger('http-buttons')

function isJsonString(str) {
  if (typeof str !== 'string') return false;
  try {
      JSON.parse(str);
      return true;
  } catch (e) {
      logger.error('isJsonString:',e);
      return false;
  }
}

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
      logger.debug('page onInit invoked')
      this.loadingText = null;
      this.loadingImgAnim = null;
    },
    build() {
      logger.debug('page build invoked')
      this.showLoading()
      this.getDataFromPhone()
    },
    getDataFromPhone() {
      this.request({
        method: 'GET_DATA'
      })
        .then(
          ({ result }) => {
            //logger.info('getDataFromPhone success', result)
            this.state.data = result
            this.state.isError = false
            layout.render(this)
            this.hideLoading()
          }
        )
        .catch(
          (error) => {
            logger.error('getDataFromPhone error', error)
            this.state.isError = true
            layout.render(this)
            this.hideLoading()
          }
        )
    },
    showLoading() {
      logger.debug('page showLoading invoked')
      this.state.loadingText = createWidget(widget.TEXT, { ...LOADING_TEXT_WIDGET });
      this.state.loadingImgAnim = createWidget(widget.IMG_ANIM, { ...LOADING_IMG_ANIM_WIDGET });
    },
    hideLoading() {
      logger.debug('page hideLoading invoked')
      this.state.loadingText.setProperty(prop.VISIBLE, false);
      this.state.loadingImgAnim.setProperty(prop.VISIBLE, false);
      this.state.loadingImgAnim.setProperty(prop.ANIM_STATUS, anim_status.STOP);
      deleteWidget(this.state.loadingText)
      deleteWidget(this.state.loadingImgAnim)
    },
    executeButtonRequest(request, pageid, input = null) {
      let url = request.url;
      let method = request.method;
      let headers = request.headers;
      let body = request.body;
      let auth = request.auth;
      let user = request.user;
      let pass = request.pass;
      let token = request.token;
      let dt = JSON.parse(this.state.data)

      let txtToReturn;
      let task;

      if (dt.variables) {
        Object.entries(dt.variables).forEach(([key, value]) => {
          let search = "".concat("{", key, "}")
          logger.debug('gloabal_var_replace', search, value)
          if (url) {
            url = url.replaceAll(search, value)
          }
          if (headers) {
            headers = headers.replaceAll(search, value);
          }
          if (body) {
            body = body.replaceAll(search, value);
          }
          if (user) {
            user = user.replaceAll(search, value)
          }
          if (pass) {
            pass = pass.replaceAll(search, value)
          }
          if (token) {
            token = token.replaceAll(search, value)
          }
        })
      }

      if (input) {
        let search = "{input}"
        logger.debug('input_replace', search, input)
        if (url) {
          url = url.replaceAll(search, input)
        }
        if (headers) {
          headers = headers.replaceAll(search, input);
        }
        if (body) {
          body = body.replaceAll(search, input);
        }
        if (user) {
          user = user.replaceAll(search, input)
        }
        if (pass) {
          pass = pass.replaceAll(search, input)
        }
        if (token) {
          token = token.replaceAll(search, input)
        }
      }

       logger.debug("method", method)
       logger.debug("url", url)
       logger.debug("headers", headers)
       logger.debug("body", body)
       logger.debug("auth", auth)
       logger.debug("user", user)
       logger.debug("pass", pass)
       logger.debug("token", token)
      // logger.log("pageid", pageid)
      // logger.log("response_style", request.response_style)

      if (auth === 'Digest') {
        task = digestRequest(this, {
          url: url,
          method: method,
          headers: (headers && isJsonString(headers)) ? JSON.parse(headers) : undefined,
          body: (body && isJsonString(body)) ? JSON.parse(body) : undefined,
          timeout: 5000,
          username: user,
          password: pass
        }).then(result => {
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
        }).catch(error => {
          logger.error('error=>', JSON.stringify(error))
          layout.notifyResult(JSON.stringify(error), pageid, true, request.response_style)
        });
      } else if (auth === 'Basic'){
        task = basicRequest(this, {
          url: url,
          method: method,
          headers: (headers && isJsonString(headers)) ? JSON.parse(headers) : undefined,
          body: (body && isJsonString(body)) ? JSON.parse(body) : undefined,
          timeout: 5000,
          username: user,
          password: pass
        }).then(result => {
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
        }).catch(error => {
          logger.error('error=>', JSON.stringify(error))
          layout.notifyResult(JSON.stringify(error), pageid, true, request.response_style)
        });
      } else if (auth === 'Bearer'){
        task = bearerRequest(this, {
          url: url,
          method: method,
          headers: (headers && isJsonString(headers)) ? JSON.parse(headers) : undefined,
          body: (body && isJsonString(body)) ? JSON.parse(body) : undefined,
          timeout: 5000,
          token: token
        }).then(result => {
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
        }).catch(error => {
          logger.error('error=>', JSON.stringify(error))
          layout.notifyResult(JSON.stringify(error), pageid, true, request.response_style)
        });
      } else {
        task = this.httpRequest({
          url: url,
          method: method,
          headers: (headers && isJsonString(headers)) ? JSON.parse(headers) : undefined,
          body: (body && isJsonString(body)) ? JSON.parse(body) : undefined,
          timeout: 5000
        })
          .then((result) => {
            // logger.debug('result.status', result.status)
            // logger.debug('result.statusText', result.statusText)
            // logger.debug('result.headers', result.headers)
            // logger.debug('result.body', JSON.stringify(result.body))

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
      }

      return task;
    },
    onDestroy() {
      logger.debug('page onDestroy invoked')
      deleteWidget(layout.refs.customToast)
      deleteWidget(layout.refs.customToastFillRect)
      deleteWidget(layout.refs.customToastText)
    },
  })
)
