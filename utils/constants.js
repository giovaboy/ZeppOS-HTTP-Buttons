export const DEFAULT_SPACER = { text: "SPACER", spacer: true, w: "30", request: {} };
export const DEFAULT_BUTTON = { text: "Click me!", spacer: false, w: "40", request: {} };
export const DEFAULT_ROW = { h: 100, buttons: [DEFAULT_SPACER, DEFAULT_BUTTON] };
export const DEFAULT_PAGE = { rows: [DEFAULT_ROW] };
export const DEFAULT_DATA = { variables: {"var1":"1", "var2":"2"}, pages: [DEFAULT_PAGE] };

export const BTN_WIDTH = 100;
export const BTN_HEIGHT = 40;
export const BTN_RADIUS = 12;
export const BTN_PADDING = 12;
export const ROW_PADDING = 12;

export const LINE_COLOR = 0x333333;

export const COLOR_WHITE = 0xffffff;
export const COLOR_BLACK = 0x000000;
export const COLOR_ORANGE = 0xFFA500;
export const COLOR_ORANGE2 = 0xfc6950;
export const COLOR_RED = 0x8B0000;
export const COLOR_GREEN = 0x3cb371;
export const COLOR_BLUE = 0x0884d0;
export const COLOR_YELLOW = 0xFFFF00;
export const COLOR_INDIGO = 0x4B0082;
export const COLOR_VIOLET = 0xEE82EE;
export const COLOR_GRAY = 0x808080;
export const COLOR_GRAY_TOAST = 0x626262;

export const CUSTOM_TOAST = 0
export const SYSTEM_TOAST = 1
export const SYSTEM_MODAL = 2
export const NO_NOTIFICATION = 3

export const NOTIFICATION_X = 60
export const NOTIFICATION_Y = 350
export const NOTIFICATION_WIDTH = 360
export const NOTIFICATION_H_MIN = 40
export const NOTIFICATION_TEXT_SIZE = 32
/** HELPERS */

/**
 * Multiplies/Divides each component (red, green, blue) of a hexadecimal color by a multiplier.
 * @param {number} hex_color - The hexadecimal color to multiply.
 * @param {number} multiplier - The multiplier/divider. [example 1]: 1.3 = +30% [example 2]: 0.7 = -30%.
 * @return {string} The resulting hexadecimal color after multiplication.
 */
export function multiplyHexColor(hex_color, multiplier) {
  hex_color = Math.floor(hex_color).toString(16).padStart(6, "0"); // @fix 1.0.6

  let r = parseInt(hex_color.substring(0, 2), 16);
  let g = parseInt(hex_color.substring(2, 4), 16);
  let b = parseInt(hex_color.substring(4, 6), 16);

  r = Math.min(Math.round(r * multiplier), 255);
  g = Math.min(Math.round(g * multiplier), 255);
  b = Math.min(Math.round(b * multiplier), 255);

  const result = "0x" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return result;
}

/**
 * Adjusts the brightness of a hexadecimal color based on a multiplier.
 * If any color component (red, green, blue) is at its maximum value (255) and the multiplier is greater than 1, the color is made dimmer by dividing it by the multiplier.
 * Otherwise, the color is made brighter by multiplying it by the multiplier.
 * @param {number} hex_color - The hexadecimal color to adjust. This should be a number that will be converted to a hexadecimal string.
 * @param {number} multiplier - The factor by which to adjust the brightness of the color. If greater than 1, the color will be made brighter, unless any color component is already at its maximum value. If less than 1, the color will be made dimmer.
 * @return {string} The resulting hexadecimal color after adjustment.
 */
export function btnPressColor(hex_color, multiplier) { // @add 1.0.6
  hex_color = Math.floor(hex_color).toString(16).padStart(6, "0");

  let r = parseInt(hex_color.substring(0, 2), 16);
  let g = parseInt(hex_color.substring(2, 4), 16);
  let b = parseInt(hex_color.substring(4, 6), 16);

  // check if any of the color components are at their maximum value
  if (r === 255 || g === 255 || b === 255) {
    // and if so + the multiplier is greater than 1, divide the color
    if (multiplier > 1) {
      return multiplyHexColor("0x" + hex_color, 1 / multiplier); // inverse
    }
  }
  // otherwise usual multiplication
  return multiplyHexColor("0x" + hex_color, multiplier);
}