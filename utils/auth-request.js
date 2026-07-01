import { log as Logger } from '@zos/utils'
import { parseChallenge, buildDigestAuth, requestUri } from './digest.js'

const logger = Logger.getLogger("http-buttons-auth-request");

export async function digestRequest(pluginContext, opts) {
  const { method, url, username, password, body = undefined, headers = {}, timeout } = opts;
  const uri = requestUri(url)

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
