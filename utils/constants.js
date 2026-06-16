export const DEFAULT_SPACER = { text: "SPACER", spacer: true, w: "33.33", request: {} };
export const DEFAULT_BUTTON = { text: "Click me!", spacer: false, w: "33.33", request: {method: "GET", url: "https://httpbin.io/base64/Q3VzdG9taXplIG1lLCBhZGQgbW9yZSBidXR0b25zIGFuZCBwYWdlcywgaW4gdGhlIFpFUFAgYXBwbGljYXRpb25zIHNldHRpbmdzLg%3D%3D", response_style: 0} };
export const DEFAULT_INPUT = { text: "Click me!", spacer: false, w: "33.33", request: {method: "GET", url: "https://httpbin.io/anything/{input}", response_style: 2, "parse_result": "url"}, input: true, keyboard_type: 0 };
export const DEFAULT_ROW = { h: 100, buttons: [DEFAULT_SPACER, DEFAULT_BUTTON, DEFAULT_INPUT] };
export const DEFAULT_PAGE = { rows: [DEFAULT_ROW] };
export const DEFAULT_DATA_OLD = { variables: {"var1":"1", "var2":"2"}, pages: [DEFAULT_PAGE] };

export const DEFAULT_DATA = {"variables":{"city":"London"},"pages":[{"title":"👋 Welcome","back_color":856343,"text_color":16777215,"rows":[{"h":50,"buttons":[{"text":"🐱 Cat fact","w":50,"radius":18,"back_color":32896,"text_color":16777215,"request":{"method":"GET","url":"https://catfact.ninja/fact","parse_result":"fact","response_style":0}},{"text":"😂 Dad joke","w":50,"radius":18,"back_color":16766720,"text_color":856343,"request":{"method":"GET","url":"https://icanhazdadjoke.com/","headers":"{\"Accept\": \"application/json\"}","parse_result":"joke","response_style":0}}]},{"h":50,"buttons":[{"text":"⌨ Echo your text","w":100,"radius":18,"back_color":558288,"text_color":16777215,"input":true,"keyboard_type":0,"request":{"method":"GET","url":"https://httpbin.io/anything/{input}","parse_result":"url","response_style":0}}]}]},{"title":"⚙ Features","back_color":856343,"text_color":16777215,"rows":[{"h":33,"buttons":[{"text":"GET","w":33,"radius":18,"back_color":3978097,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/get","parse_result":"url","response_style":1}},{"text":"POST","w":33,"radius":18,"back_color":16542032,"text_color":16777215,"request":{"method":"POST","url":"https://httpbin.io/post","body":"{\"hello\": \"world\"}","parse_result":"json","response_style":1}},{"text":"UUID","w":34,"radius":18,"back_color":8388736,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/uuid","parse_result":"uuid","response_style":2}}]},{"h":33,"buttons":[{"spacer":true,"w":25,"request":{}},{"text":"City = {city}","w":75,"radius":18,"back_color":4915330,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/anything/{city}","parse_result":"url","response_style":0}}]},{"h":34,"buttons":[{"text":"My headers","w":100,"radius":18,"back_color":14423100,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/headers","headers":"{\"X-Demo\": \"HTTP-Buttons\"}","parse_result":"headers","response_style":0}}]}]},{"title":"🔐 Auth","back_color":856343,"text_color":16777215,"rows":[{"h":50,"buttons":[{"text":"Digest","w":50,"radius":18,"back_color":15631086,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/digest-auth/auth/user/pass","auth":"Digest","user":"user","pass":"pass","response_style":2}},{"text":"Basic","w":50,"radius":18,"back_color":16776960,"text_color":8421504,"request":{"method":"GET","url":"https://httpbin.io/basic-auth/user/pass","auth":"Basic","user":"user","pass":"pass","response_style":2}}]},{"h":50,"buttons":[{"text":"Bearer","w":100,"radius":18,"back_color":558288,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/bearer","auth":"Bearer","token":"demo123","response_style":2}}]}]}]};
export const EXAMPLE_DATA_B = {"variables":{"token":"demo123"},"pages":[{"title":"HTTP Buttons","back_color":856343,"text_color":16777215,"rows":[{"h":33,"buttons":[{"text":"GET","w":33,"radius":14,"back_color":3978097,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/get","parse_result":"url","response_style":0}},{"text":"POST","w":33,"radius":14,"back_color":558288,"text_color":16777215,"request":{"method":"POST","url":"https://httpbin.io/post","body":"{\"hello\": \"world\"}","parse_result":"json","response_style":0}},{"text":"Headers","w":34,"radius":14,"back_color":16542032,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/headers","headers":"{\"X-Demo\": \"HTTP-Buttons\"}","parse_result":"headers","response_style":0}}]},{"h":33,"buttons":[{"text":"Echo input","w":100,"radius":14,"back_color":32896,"text_color":16777215,"input":true,"keyboard_type":0,"request":{"method":"GET","url":"https://httpbin.io/anything/{input}","parse_result":"url","response_style":2}}]},{"h":34,"buttons":[{"text":"Variable: {token}","w":100,"radius":14,"back_color":8388736,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/anything/{token}","parse_result":"url","response_style":0}}]}]},{"title":"Response styles","back_color":856343,"text_color":16777215,"rows":[{"h":50,"buttons":[{"text":"Toast","w":50,"radius":14,"back_color":32896,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/uuid","parse_result":"uuid","response_style":1}},{"text":"Custom","w":50,"radius":14,"back_color":4915330,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/uuid","parse_result":"uuid","response_style":0}}]},{"h":50,"buttons":[{"text":"Modal","w":50,"radius":14,"back_color":14423100,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/uuid","parse_result":"uuid","response_style":2}},{"text":"Silent","w":50,"radius":14,"back_color":8421504,"text_color":16777215,"request":{"method":"GET","url":"https://httpbin.io/status/200","response_style":3}}]}]}]}

// Keyboard types for input buttons
export const KB_TYPE_CHAR = 0;     // text (abc/ABC/symbols, switchable at runtime)
export const KB_TYPE_NUMERIC = 1;  // 123

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

export const COLOR_DARK_RED = 0x8B0000;
export const COLOR_CRIMSON = 0xDC143C;
export const COLOR_PINK = 0xFFC0CB;
export const COLOR_HOT_PINK = 0xFF69B4;
export const COLOR_DARK_ORANGE = 0xFF8C00;
export const COLOR_CORAL = 0xFF7F50;
export const COLOR_TOMATO = 0xFF6347;
export const COLOR_GOLD = 0xFFD700;
export const COLOR_KHAKI = 0xF0E68C;
export const COLOR_DARK_GREEN = 0x006400;
export const COLOR_LIME = 0x00FF00;
export const COLOR_OLIVE = 0x808000;
export const COLOR_TEAL = 0x008080;
export const COLOR_MINT = 0x98FF98;
export const COLOR_NAVY = 0x000080;
export const COLOR_SKY_BLUE = 0x87CEEB;
export const COLOR_CYAN = 0x00FFFF;
export const COLOR_TURQUOISE = 0x40E0D0;
export const COLOR_PURPLE = 0x800080;
export const COLOR_MAGENTA = 0xFF00FF;
export const COLOR_LAVENDER = 0xE6E6FA;
export const COLOR_BROWN = 0xA52A2A;
export const COLOR_TAN = 0xD2B48C;
export const COLOR_BEIGE = 0xF5F5DC;
export const COLOR_LIGHT_GRAY = 0xD3D3D3;
export const COLOR_DARK_GRAY = 0xA9A9A9;
export const COLOR_SILVER = 0xC0C0C0;

export const CUSTOM_TOAST = 0
export const SYSTEM_TOAST = 1
export const SYSTEM_MODAL = 2
export const NO_NOTIFICATION = 3

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