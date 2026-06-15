import { createKeyboard, inputType, deleteKeyboard } from '@zos/ui'
import { KB_TYPE_NUMERIC } from './constants.js'
import { getLogger } from './logger.js'

const logger = getLogger('http-buttons-keyboard')

/**
 * Whether the system keyboard API (createKeyboard, API_LEVEL 4.0+) is available
 * on this device. On older firmwares the named export resolves to undefined and
 * we fall back to the hand-drawn keyboard.
 * @returns {boolean}
 */
export function isSystemKeyboardAvailable() {
  return typeof createKeyboard === 'function'
}

/**
 * Maps a button's keyboard_type to a system keyboard inputType.
 * Numeric -> NUM; every other type -> CHAR (the character keyboard handles
 * uppercase/lowercase/symbols on its own).
 * @param {number} keyboardType
 * @returns {number}
 */
function getSystemInputType(keyboardType) {
  return keyboardType === KB_TYPE_NUMERIC ? inputType.NUM : inputType.CHAR
}

/**
 * Opens the native system keyboard and, on confirmation, fires the button
 * request with the entered text.
 * @param {object} vm - the page view-model (exposes executeButtonRequest)
 * @param {object} button - the button definition (request, keyboard_type)
 * @param {number} pageId - the page index, used for the result notification
 */
export function openSystemKeyboard(vm, button, pageId) {
  createKeyboard({
    inputType: getSystemInputType(button.keyboard_type),
    onComplete: (_, result) => {
      const text = (result && result.data != null) ? result.data : ''
      logger.debug('system keyboard complete:', text)
      deleteKeyboard()
      vm.executeButtonRequest(button.request, pageId, text)
    },
    onCancel: () => {
      logger.debug('system keyboard cancelled')
      deleteKeyboard()
    }
  })
}
