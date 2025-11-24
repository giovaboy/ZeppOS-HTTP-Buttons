import { getDeviceInfo } from '@zos/device'

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();

const KEY_SIZE = 64;
const KEYS_PER_ROW = 7;
const START_Y = 90;
const X_KEY_CENTER = (DEVICE_WIDTH/2)-(50)

export const KEY_SHIFT = 200;
export const KEY_NUM = 201;
export const KEY_ABC = 202;
export const KEY_abc = 203;
export const KEY_SYMB = 204;
export const KEY_SEND = 205;
export const KEY_CANCEL = 206;
export const KEY_BACKSPACE = 8;

function chunkArray(arr, size) {
  const chunks = [];
  for(let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function generateLayout(keysArray, yStart = START_Y, extraKeys = []) {
  const layout = [];
  const rows = chunkArray(keysArray, KEYS_PER_ROW);

  let id = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    for (let i = 0; i < row.length; i++) {
      const key = row[i];
      layout.push({
        id: id++,
        x: (i * KEY_SIZE) - 4,
        y: yStart + rowIndex * KEY_SIZE,
        text: key.text,
        value: key.value,
        //image: 'assets/keys/' + key.value + '.png'
      });
    }
  }

  extraKeys.forEach((key) => {
    layout.push({
      id: id++,
      x: key.x,
      y: key.y,
      text: key.text,
      value: key.value
    });
  });

  return layout;
}

const lettersLower = [
  { text: 'q', value: 113 }, { text: 'w', value: 119 }, { text: 'e', value: 101 },
  { text: 'r', value: 114 }, { text: 't', value: 116 }, { text: 'y', value: 121 },
  { text: 'u', value: 117 }, { text: 'i', value: 105 }, { text: 'o', value: 111 },
  { text: 'p', value: 112 }, { text: 'a', value: 97 },  { text: 's', value: 115 },
  { text: 'd', value: 100 }, { text: 'f', value: 102 }, { text: 'g', value: 103 },
  { text: 'h', value: 104 }, { text: 'j', value: 106 }, { text: 'k', value: 107 },
  { text: 'l', value: 108 }, { text: 'z', value: 122 }, { text: 'x', value: 120 },
  { text: 'c', value: 99 },  { text: 'v', value: 118 }, { text: 'b', value: 98 },
  { text: 'n', value: 110 }, { text: 'm', value: 109 }, { text: ' ', value: 32 }, { text: '<-',  value: KEY_BACKSPACE}
];

const lettersUpper = [
  { text: 'Q', value: 81 }, { text: 'W', value: 87 }, { text: 'E', value: 69 },
  { text: 'R', value: 82 }, { text: 'T', value: 84 }, { text: 'Y', value: 89 },
  { text: 'U', value: 85 }, { text: 'I', value: 73 }, { text: 'O', value: 79 },
  { text: 'P', value: 80 }, { text: 'A', value: 65 }, { text: 'S', value: 83 },
  { text: 'D', value: 68 }, { text: 'F', value: 70 }, { text: 'G', value: 71 },
  { text: 'H', value: 72 }, { text: 'J', value: 74 }, { text: 'K', value: 75 },
  { text: 'L', value: 76 }, { text: 'Z', value: 90 }, { text: 'X', value: 88 },
  { text: 'C', value: 67 }, { text: 'V', value: 86 }, { text: 'B', value: 66 },
  { text: 'N', value: 78 }, { text: 'M', value: 77 }, { text: ' ', value: 32 }, { text: '<-',  value: KEY_BACKSPACE}
];

export const symbolsKeys = [
  { text: '{', value: 123 }, { text: '}', value: 125 }, { text: '[', value: 91 },
  { text: ']', value: 93 }, { text: '<', value: 60 }, { text: '>', value: 62 },
  { text: '|', value: 124 }, { text: '\\', value: 92 }, { text: '^', value: 94 },
  { text: '~', value: 126 }, { text: '`', value: 96 }, { text: '_', value: 95 },
  { text: '"', value: 34 }, { text: '\'', value: 39 }, { text: ' ', value: 32 }, { text: '<-',  value: KEY_BACKSPACE}
];

export const numbersKeys = [
  { text: '1', value: 49 },
  { text: '2', value: 50 },
  { text: '3', value: 51 },
  { text: '4', value: 52 },
  { text: '5', value: 53 },
  { text: '6', value: 54 },
  { text: '7', value: 55 },

  { text: '8', value: 56 },
  { text: '9', value: 57 },
  { text: '0', value: 48 },
  { text: '@', value: 64 },
  { text: '#', value: 35 },
  { text: '$', value: 36 },
  { text: '%', value: 37 },

  { text: '&', value: 38 },
  { text: '*', value: 42 },
  { text: '-', value: 45 },
  { text: '+', value: 43 },
  { text: '=', value: 61 },
  { text: '(', value: 40 },
  { text: ')', value: 41 },

  { text: '/', value: 47 },
  { text: '?', value: 63 },
  { text: '!', value: 33 },
  { text: ':', value: 58 },
  { text: ';', value: 59 },
  { text: '.', value: 46 },
  { text: ',', value: 44 }
];

const extraKeysLower = [
  { text: 'A', value: KEY_ABC, x: X_KEY_CENTER - 100, y: DEVICE_HEIGHT - 120 },
  { text: 'OK',  value: KEY_SEND, x: X_KEY_CENTER, y: DEVICE_HEIGHT - 120 },
  { text: 'X', value: KEY_CANCEL, x: X_KEY_CENTER + 100, y: DEVICE_HEIGHT - 120 }
];

const extraKeysUpper = [
  { text: '123', value: KEY_NUM, x: X_KEY_CENTER - 100, y: DEVICE_HEIGHT - 120 },
  { text: 'OK',  value: KEY_SEND, x: X_KEY_CENTER, y: DEVICE_HEIGHT - 120 },
  { text: 'X', value: KEY_CANCEL, x: X_KEY_CENTER + 100, y: DEVICE_HEIGHT - 120 }
];

const extraKeysNumbers = [
  { text: '?', value: KEY_SYMB, x: X_KEY_CENTER - 100, y: DEVICE_HEIGHT - 120 },
  { text: 'OK',  value: KEY_SEND, x: X_KEY_CENTER, y: DEVICE_HEIGHT - 120 },
  { text: 'X', value: KEY_CANCEL, x: X_KEY_CENTER + 100, y: DEVICE_HEIGHT - 120 }
];

const extraKeysSymbols = [
  { text: 'a', value: KEY_abc, x: X_KEY_CENTER - 100, y: DEVICE_HEIGHT - 120 },
  { text: 'OK', value: KEY_SEND, x: X_KEY_CENTER, y: DEVICE_HEIGHT - 120 },
  { text: 'X', value: KEY_CANCEL, x: X_KEY_CENTER + 100, y: DEVICE_HEIGHT - 120 }
];

export const kb_lowercase = generateLayout(lettersLower, START_Y, extraKeysLower);
export const kb_uppercase = generateLayout(lettersUpper, START_Y, extraKeysUpper);
export const kb_numbers = generateLayout(numbersKeys, START_Y, extraKeysNumbers);
export const kb_symbols = generateLayout(symbolsKeys, START_Y, extraKeysSymbols);
