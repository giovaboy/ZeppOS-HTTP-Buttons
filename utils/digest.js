// Pure HTTP Digest auth helpers (no device/@zos imports) so they can run on
// BOTH the device page and the phone-side app-side. Moved verbatim out of
// auth-request.js, which now re-exports from here.

export function md5(input) {
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

// SHA-256 (FIPS 180-4), pure JS like md5() above. Inputs are ASCII (credentials,
// realm, hex digests), processed one byte per char. Returns lowercase hex.
export function sha256(input) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  const bytes = [];
  for (let i = 0; i < input.length; i++) bytes.push(input.charCodeAt(i) & 0xff);

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // 64-bit big-endian message length; the high 32 bits are 0 for our short inputs
  bytes.push(0, 0, 0, 0,
    (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) | 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  function toHex(x) {
    let s = '';
    for (let i = 3; i >= 0; i--) {
      const b = (x >>> (i * 8)) & 0xff;
      s += (b < 16 ? '0' : '') + b.toString(16);
    }
    return s;
  }

  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

export function parseChallenge(header) {
  const obj = {};
  // Values may be quoted ("...") or unquoted: e.g. httpbin.org quotes nonce/qop,
  // while go-httpbin (httpbin.io) sends `qop=auth, nonce=..., algorithm=MD5` bare.
  header.replace(/(\w+)=(?:\"([^\"]*)\"|([^,\s]+))/g, (_, k, quoted, unquoted) => {
    obj[k] = quoted !== undefined ? quoted : unquoted;
    return '';
  });
  return obj;
}

function generateCnonce() {
  return Math.random().toString(36).substring(2, 18);
}

export function buildDigestAuth({ username, password, method, uri, challenge, body = "" }) {
  const { realm, nonce, qop, opaque, algorithm } = challenge;
  const nc = '00000001';
  const cnonce = generateCnonce();

  // Pick the hash from the advertised algorithm (default MD5), and handle the
  // -sess variants. Supports MD5, MD5-sess, SHA-256, SHA-256-sess.
  const sess = /-sess$/i.test(algorithm || '');
  const base = (algorithm || 'MD5').replace(/-sess$/i, '').toUpperCase();
  const H = base === 'SHA-256' ? sha256 : md5;

  let HA1 = H(`${username}:${realm}:${password}`);
  if (sess) {
    HA1 = H(`${HA1}:${nonce}:${cnonce}`);
  }

  let HA2;
  if (qop === "auth-int") {
    const bodyHash = H(typeof body === 'string' ? body : JSON.stringify(body));
    HA2 = H(`${method}:${uri}:${bodyHash}`);
  } else {
    HA2 = H(`${method}:${uri}`);
  }

  const response = H(`${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`);

  let auth = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop="${qop}", nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  if (algorithm) auth += `, algorithm=${algorithm}`;
  if (opaque) auth += `, opaque="${opaque}"`;
  return auth;
}

// Simple URL decoding function (since we can't use built-in APIs)
function simpleUrlDecode(str) {
  return str
    .replace(/\+/g, ' ')  // Replace + with space
    .replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

export function parseUrlSimple(url) {
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
