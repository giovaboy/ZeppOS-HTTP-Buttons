import { log as Logger } from '@zos/utils'

const logger = Logger.getLogger("http-buttons-auth-request");

function md5(input) {
  // Convert string to array of 32-bit words
  function stringToWords(str) {
    const words = [];
    for (let i = 0; i < str.length * 8; i += 8) {
      words[i >> 5] |= (str.charCodeAt(i / 8) & 0xFF) << (i % 32);
    }
    return words;
  }

  // Convert array of 32-bit words to hex string
  function wordsToHex(words) {
    let hex = '';
    for (let i = 0; i < words.length * 32; i += 8) {
      hex += String.fromCharCode((words[i >> 5] >>> (i % 32)) & 0xFF);
    }
    return hex;
  }

  // Safe addition for 32-bit integers
  function safeAdd(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  // Rotate left
  function rotateLeft(value, amount) {
    return (value << amount) | (value >>> (32 - amount));
  }

  // MD5 auxiliary functions
  function md5F(x, y, z) { return (x & y) | (~x & z); }
  function md5G(x, y, z) { return (x & z) | (y & ~z); }
  function md5H(x, y, z) { return x ^ y ^ z; }
  function md5I(x, y, z) { return y ^ (x | ~z); }

  // Generic MD5 step function
  function md5Step(func, a, b, c, d, x, s, t) {
    a = safeAdd(a, safeAdd(safeAdd(func(b, c, d), x), t));
    return safeAdd(rotateLeft(a, s), b);
  }

  // Main MD5 computation
  const x = stringToWords(input);
  const len = input.length * 8;

  // Padding
  x[len >> 5] |= 0x80 << (len % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  // Initialize hash values
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;

  // Process message in 512-bit chunks
  for (let i = 0; i < x.length; i += 16) {
    const oldA = a, oldB = b, oldC = c, oldD = d;

    // Round 1
    a = md5Step(md5F, a, b, c, d, x[i + 0], 7, 0xD76AA478);
    d = md5Step(md5F, d, a, b, c, x[i + 1], 12, 0xE8C7B756);
    c = md5Step(md5F, c, d, a, b, x[i + 2], 17, 0x242070DB);
    b = md5Step(md5F, b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
    a = md5Step(md5F, a, b, c, d, x[i + 4], 7, 0xF57C0FAF);
    d = md5Step(md5F, d, a, b, c, x[i + 5], 12, 0x4787C62A);
    c = md5Step(md5F, c, d, a, b, x[i + 6], 17, 0xA8304613);
    b = md5Step(md5F, b, c, d, a, x[i + 7], 22, 0xFD469501);
    a = md5Step(md5F, a, b, c, d, x[i + 8], 7, 0x698098D8);
    d = md5Step(md5F, d, a, b, c, x[i + 9], 12, 0x8B44F7AF);
    c = md5Step(md5F, c, d, a, b, x[i + 10], 17, 0xFFFF5BB1);
    b = md5Step(md5F, b, c, d, a, x[i + 11], 22, 0x895CD7BE);
    a = md5Step(md5F, a, b, c, d, x[i + 12], 7, 0x6B901122);
    d = md5Step(md5F, d, a, b, c, x[i + 13], 12, 0xFD987193);
    c = md5Step(md5F, c, d, a, b, x[i + 14], 17, 0xA679438E);
    b = md5Step(md5F, b, c, d, a, x[i + 15], 22, 0x49B40821);

    // Round 2
    a = md5Step(md5G, a, b, c, d, x[i + 1], 5, 0xF61E2562);
    d = md5Step(md5G, d, a, b, c, x[i + 6], 9, 0xC040B340);
    c = md5Step(md5G, c, d, a, b, x[i + 11], 14, 0x265E5A51);
    b = md5Step(md5G, b, c, d, a, x[i + 0], 20, 0xE9B6C7AA);
    a = md5Step(md5G, a, b, c, d, x[i + 5], 5, 0xD62F105D);
    d = md5Step(md5G, d, a, b, c, x[i + 10], 9, 0x02441453);
    c = md5Step(md5G, c, d, a, b, x[i + 15], 14, 0xD8A1E681);
    b = md5Step(md5G, b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
    a = md5Step(md5G, a, b, c, d, x[i + 9], 5, 0x21E1CDE6);
    d = md5Step(md5G, d, a, b, c, x[i + 14], 9, 0xC33707D6);
    c = md5Step(md5G, c, d, a, b, x[i + 3], 14, 0xF4D50D87);
    b = md5Step(md5G, b, c, d, a, x[i + 8], 20, 0x455A14ED);
    a = md5Step(md5G, a, b, c, d, x[i + 13], 5, 0xA9E3E905);
    d = md5Step(md5G, d, a, b, c, x[i + 2], 9, 0xFCEFA3F8);
    c = md5Step(md5G, c, d, a, b, x[i + 7], 14, 0x676F02D9);
    b = md5Step(md5G, b, c, d, a, x[i + 12], 20, 0x8D2A4C8A);

    // Round 3
    a = md5Step(md5H, a, b, c, d, x[i + 5], 4, 0xFFFA3942);
    d = md5Step(md5H, d, a, b, c, x[i + 8], 11, 0x8771F681);
    c = md5Step(md5H, c, d, a, b, x[i + 11], 16, 0x6D9D6122);
    b = md5Step(md5H, b, c, d, a, x[i + 14], 23, 0xFDE5380C);
    a = md5Step(md5H, a, b, c, d, x[i + 1], 4, 0xA4BEEA44);
    d = md5Step(md5H, d, a, b, c, x[i + 4], 11, 0x4BDECFA9);
    c = md5Step(md5H, c, d, a, b, x[i + 7], 16, 0xF6BB4B60);
    b = md5Step(md5H, b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
    a = md5Step(md5H, a, b, c, d, x[i + 13], 4, 0x289B7EC6);
    d = md5Step(md5H, d, a, b, c, x[i + 0], 11, 0xEAA127FA);
    c = md5Step(md5H, c, d, a, b, x[i + 3], 16, 0xD4EF3085);
    b = md5Step(md5H, b, c, d, a, x[i + 6], 23, 0x04881D05);
    a = md5Step(md5H, a, b, c, d, x[i + 9], 4, 0xD9D4D039);
    d = md5Step(md5H, d, a, b, c, x[i + 12], 11, 0xE6DB99E5);
    c = md5Step(md5H, c, d, a, b, x[i + 15], 16, 0x1FA27CF8);
    b = md5Step(md5H, b, c, d, a, x[i + 2], 23, 0xC4AC5665);

    // Round 4
    a = md5Step(md5I, a, b, c, d, x[i + 0], 6, 0xF4292244);
    d = md5Step(md5I, d, a, b, c, x[i + 7], 10, 0x432AFF97);
    c = md5Step(md5I, c, d, a, b, x[i + 14], 15, 0xAB9423A7);
    b = md5Step(md5I, b, c, d, a, x[i + 5], 21, 0xFC93A039);
    a = md5Step(md5I, a, b, c, d, x[i + 12], 6, 0x655B59C3);
    d = md5Step(md5I, d, a, b, c, x[i + 3], 10, 0x8F0CCC92);
    c = md5Step(md5I, c, d, a, b, x[i + 10], 15, 0xFFEFF47D);
    b = md5Step(md5I, b, c, d, a, x[i + 1], 21, 0x85845DD1);
    a = md5Step(md5I, a, b, c, d, x[i + 8], 6, 0x6FA87E4F);
    d = md5Step(md5I, d, a, b, c, x[i + 15], 10, 0xFE2CE6E0);
    c = md5Step(md5I, c, d, a, b, x[i + 6], 15, 0xA3014314);
    b = md5Step(md5I, b, c, d, a, x[i + 13], 21, 0x4E0811A1);
    a = md5Step(md5I, a, b, c, d, x[i + 4], 6, 0xF7537E82);
    d = md5Step(md5I, d, a, b, c, x[i + 11], 10, 0xBD3AF235);
    c = md5Step(md5I, c, d, a, b, x[i + 2], 15, 0x2AD7D2BB);
    b = md5Step(md5I, b, c, d, a, x[i + 9], 21, 0xEB86D391);

    // Add this chunk's hash to result so far
    a = safeAdd(a, oldA);
    b = safeAdd(b, oldB);
    c = safeAdd(c, oldC);
    d = safeAdd(d, oldD);
  }

  // Convert hash to hex string
  const result = wordsToHex([a, b, c, d]);
  
  // Convert to hexadecimal representation
  let hex = '';
  for (let i = 0; i < result.length; i++) {
    const byte = result.charCodeAt(i);
    hex += ((byte < 16 ? '0' : '') + byte.toString(16));
  }
  
  return hex;
}

function parseChallenge(header) {
  const obj = {};
  header.replace(/(\w+)=\"([^\"]+)\"/g, (_, k, v) => { obj[k] = v; });
  return obj;
}

function generateCnonce() {
  return Math.random().toString(36).substring(2, 18);
}

function buildDigestAuth({ username, password, method, uri, challenge, body = "" }) {
  const { realm, nonce, qop } = challenge;
  const nc = '00000001';
  const cnonce = generateCnonce();

  const HA1 = md5(`${username}:${realm}:${password}`);
  let HA2;

  if (qop === "auth-int") {
    const bodyHash = md5(typeof body === 'string' ? body : JSON.stringify(body));
    HA2 = md5(`${method}:${uri}:${bodyHash}`);
  } else {
    HA2 = md5(`${method}:${uri}`);
  }

  const response = md5(`${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`);

  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop="${qop}", nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

// Simple URL decoding function (since we can't use built-in APIs)
function simpleUrlDecode(str) {
  return str
    .replace(/\+/g, ' ')  // Replace + with space
    .replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

function parseUrlSimple(url) {
  const [_, pathAndQuery] = url.split("://");
  const [hostAndPath, queryString] = pathAndQuery.split("?");
  const parts = hostAndPath.split("/");
  
  // Clean up pathname - handle trailing slashes better
  const pathParts = parts.slice(1).filter(part => part !== "");
  const pathname = pathParts.length > 0 ? "/" + pathParts.join("/") : "/";
  
  const query = {};
  if (queryString) {
    queryString.split("&").forEach(param => {
      if (param) {  // Skip empty parameters
        const [key, value = ""] = param.split("=");
        if (key) {
          query[simpleUrlDecode(key)] = simpleUrlDecode(value);
        }
      }
    });
  }

  return { pathname, query };
}

export async function digestRequest(pluginContext, opts) {
  const { method, url, username, password, body = undefined, headers = {}, timeout } = opts;
  const uri = parseUrlSimple(url).pathname

  const defaultHeaders = {
    "Content-Type": "application/json",
    ...(headers || {})
  };

  logger.debug("method > ", method)
  logger.debug("url > ", url)
  logger.debug("uri > ", uri)
  logger.debug("defaultHeaders > ", defaultHeaders)
  logger.debug("body > ", body)

  let res;
  try {
    res = await pluginContext.httpRequest({
      url: url,
      method: method,
      headers: defaultHeaders,
      body: body,
      timeout: timeout
    });
    logger.debug("Richiesta completata: ", JSON.stringify(res));
  } catch (error) {
    logger.error("Errore nella richiesta: ", JSON.stringify(error));
    return error;
  }

  logger.debug("res.status > ", res.status)

  if (res.status === 401 && res.headers['www-authenticate']?.startsWith('Digest')) {
    const challenge = parseChallenge(res.headers['www-authenticate']);
    logger.debug("challenge > ", challenge)

    const auth = buildDigestAuth({ username, password, method, uri, challenge, body });
    logger.debug("auth > ", auth)

    res = await pluginContext.httpRequest({
      method: method,
      url: url,
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      timeout: timeout
    });

    logger.debug("res > ", JSON.stringify(body))
  }

  return res;
}

 export async function basicRequest(pluginContext, {
  url,
  method = "GET",
  headers = {},
  body,
  timeout = 5000,
  username,
  password
}) {
  function encodeBase64(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    let i = 0;

    while (i < str.length) {
        // Get three characters (or what's left)
        const chr1 = str.charCodeAt(i++);
        const chr2 = i < str.length ? str.charCodeAt(i++) : 0;
        const chr3 = i < str.length ? str.charCodeAt(i++) : 0;

        // Track how many actual characters we processed
        const actualChars = (chr2 === 0 && i - 1 >= str.length) ? 1 :
                            (chr3 === 0 && i - 1 >= str.length) ? 2 : 3;

        // Convert to 4 base64 characters
        const enc1 = chr1 >> 2;
        const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        const enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        const enc4 = chr3 & 63;

        // Build output with appropriate padding
        output += chars[enc1] + chars[enc2];
        output += actualChars > 1 ? chars[enc3] : '=';
        output += actualChars > 2 ? chars[enc4] : '=';
    }

    return output;
}

  const credentials = `${username}:${password}`;
  const auth = `Basic ${encodeBase64(credentials)}`;

  const defaultHeaders = {
    ...headers,
    'Authorization': auth
  };

  try {
    const res = await pluginContext.httpRequest({
      url,
      method,
      headers: defaultHeaders,
      body,
      timeout
    });

    return res;
  } catch (error) {
    logger.error("Errore nella richiesta: ", JSON.stringify(error));
    throw error;
  }
}

export async function bearerRequest(pluginContext, {
  url,
  method = "GET",
  headers = {},
  body,
  timeout = 5000,
  token
}) {
  const defaultHeaders = {
    ...headers,
    'Authorization': `Bearer ${token}`
  };

  try {
    const res = await pluginContext.httpRequest({
      url,
      method,
      headers: defaultHeaders,
      body,
      timeout
    });

    return res;
  } catch (error) {
    logger.error("Errore nella richiesta: ", JSON.stringify(error));
    throw error;
  }
}