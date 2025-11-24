import { gettext } from 'i18n'
import { DEFAULT_BUTTON, DEFAULT_ROW, DEFAULT_DATA, DEFAULT_PAGE,
  COLOR_BLACK, COLOR_BLUE, COLOR_GRAY, COLOR_GREEN, COLOR_INDIGO, COLOR_ORANGE, COLOR_ORANGE2,
  COLOR_RED, COLOR_VIOLET, COLOR_WHITE, COLOR_YELLOW,
  COLOR_DARK_RED, COLOR_CRIMSON, COLOR_PINK, COLOR_HOT_PINK,
  COLOR_DARK_ORANGE, COLOR_CORAL, COLOR_TOMATO,
  COLOR_GOLD, COLOR_KHAKI,
  COLOR_DARK_GREEN, COLOR_LIME, COLOR_OLIVE, COLOR_TEAL, COLOR_MINT,
  COLOR_NAVY, COLOR_SKY_BLUE, COLOR_CYAN, COLOR_TURQUOISE,
  COLOR_PURPLE, COLOR_MAGENTA, COLOR_LAVENDER,
  COLOR_BROWN, COLOR_TAN, COLOR_BEIGE,
  COLOR_LIGHT_GRAY, COLOR_DARK_GRAY, COLOR_SILVER,
  SYSTEM_TOAST, CUSTOM_TOAST, SYSTEM_MODAL, NO_NOTIFICATION } from '../utils/constants.js'

// === UTILITY FUNCTIONS ===
function tryParseJSON(json) {
  try {
    let o = JSON.parse(json);
    if (o && typeof o === "object") {
      return o;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function validateURL(str) {
  if (str == gettext('**URL**')) {
    return false;
  }
  return true;
}

function toColor(num) {
  let colorString = undefined;
  if (num != null) {
    colorString = "#" + num.toString(16).padStart(6, '0');
  }
  return colorString;
}

const wRange = (options = {}) => {
  const {
    limit = 100,
    step = 1,
    start = 0,
    customValues = []
  } = options;

  let arr = [];
  for (let i = start; i <= limit; i = i + step) {
    arr.push({ name: i.toString(), value: i });
  }

  customValues.forEach(val => {
    arr.push({ name: val.toString(), value: val });
  });

  arr.sort((a, b) => a.value - b.value);
  arr = arr.filter((item, index, self) =>
    index === self.findIndex(t => t.value === item.value)
  );

  return arr;
}

function indexRange(index, limit) {
  let arr = [];
  for (let i = 0; i <= limit; i++) {
    if (i !== index) {
      arr.push({
        name: gettext('move_to') + (i + 1).toString(),
        value: i
      })
    }
  }
  return arr;
}

const tSizeRange = () => {
  let arr = [{ name: 'default', value: undefined }];
  for (let i = 10; i <= 80; i = i + 2) {
    arr.push({ name: i.toString() + 'px', value: i });
  }
  return arr;
}

const colors = () => {
  return [
    { name: 'black', value: COLOR_BLACK },
    { name: 'white', value: COLOR_WHITE },
    { name: 'gray', value: COLOR_GRAY },

    { name: 'red', value: COLOR_RED },
    { name: 'dark red', value: COLOR_DARK_RED },
    { name: 'crimson', value: COLOR_CRIMSON },
    { name: 'pink', value: COLOR_PINK },
    { name: 'hot pink', value: COLOR_HOT_PINK },

    { name: 'orange', value: COLOR_ORANGE },
    { name: 'orange2', value: COLOR_ORANGE2 },
    { name: 'dark orange', value: COLOR_DARK_ORANGE },
    { name: 'coral', value: COLOR_CORAL },
    { name: 'tomato', value: COLOR_TOMATO },

    { name: 'yellow', value: COLOR_YELLOW },
    { name: 'gold', value: COLOR_GOLD },
    { name: 'khaki', value: COLOR_KHAKI },

    { name: 'green', value: COLOR_GREEN },
    { name: 'dark green', value: COLOR_DARK_GREEN },
    { name: 'lime', value: COLOR_LIME },
    { name: 'olive', value: COLOR_OLIVE },
    { name: 'teal', value: COLOR_TEAL },
    { name: 'mint', value: COLOR_MINT },

    { name: 'blue', value: COLOR_BLUE },
    { name: 'navy', value: COLOR_NAVY },
    { name: 'sky blue', value: COLOR_SKY_BLUE },
    { name: 'cyan', value: COLOR_CYAN },
    { name: 'turquoise', value: COLOR_TURQUOISE },

    { name: 'indigo', value: COLOR_INDIGO },
    { name: 'violet', value: COLOR_VIOLET },
    { name: 'purple', value: COLOR_PURPLE },
    { name: 'magenta', value: COLOR_MAGENTA },
    { name: 'lavender', value: COLOR_LAVENDER },

    { name: 'brown', value: COLOR_BROWN },
    { name: 'tan', value: COLOR_TAN },
    { name: 'beige', value: COLOR_BEIGE },

    { name: 'light gray', value: COLOR_LIGHT_GRAY },
    { name: 'dark gray', value: COLOR_DARK_GRAY },
    { name: 'silver', value: COLOR_SILVER }
  ];
}

// === LAYOUT BUILDER FUNCTIONS ===

const buildButtonView = (button, pindex, rindex, bindex, context) => {
  return View(
    {
      style: {
        border: '1px solid #d5d5d5',
        borderRadius: '8px',
        padding: '6px 1px',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'row',
        background: '#eaeaea',
        alignItems: 'flex-start'
      }
    },
    [
      View(
        {
          style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            justfyContent: 'center',
            alignItems: 'normal'
          }
        },
        [
          // Colonna sinistra - Info base pulsante
          buildButtonBasicInfo(button, pindex, rindex, bindex, context),
          // Colonna destra - Configurazione HTTP
          buildButtonHTTPConfig(button, pindex, rindex, bindex, context)
        ]
      ),
      Button({
        label: gettext('delete_button'),
        style: {
          fontSize: '12px',
          borderRadius: '30px',
          background: '#d18420ff',
          color: 'white',
          maxWidth: '3px'
        },
        onClick: () => context.deleteButton(pindex, rindex, bindex)
      })
    ]
  );
};

const buildButtonBasicInfo = (button, pindex, rindex, bindex, context) => {
  return View(
    {
      style: {
        flex: 1,
        flexDirection: 'column',
        justfyContent: 'center',
        alignItems: 'stretch',
        display: 'flex'
      }
    },
    [
      TextInput({
        placeholder: gettext('buttonText'),
        bold: false,
        value: button.spacer ? gettext('**SPACER**') : button.text || gettext('**NO TEXT**'),
        labelStyle: { fontSize: '12px', display: 'none' },
        subStyle: {
          textAlign: 'center',
          fontSize: '16px',
          color: button.spacer ? toColor(COLOR_BLACK) : toColor(button.text_color || COLOR_BLACK),
          background: button.spacer ? toColor(null) : toColor(button.back_color || null),
          borderRadius: button.radius ? (button.radius + 'px') : '0px'
        },
        maxLength: 200,
        onChange: (text) => {
          if (text.length <= 200 || text != gettext('**NO TEXT**') || text != gettext('**SPACER**')) {
            context.editButton('text', text, pindex, rindex, bindex);
          }
        }
      }),
      Select({
        options: indexRange(bindex, context.state.data.pages[pindex].rows[rindex].buttons.length - 1),
        onChange: (value) => {
          if (value < 999) {
            context.moveButton(pindex, rindex, bindex, value);
          }
        }
      }),
      Toggle({
        label: gettext('is_spacer'),
        value: button.spacer,
        subStyle: { color: '#333', fontSize: '10px' },
        onChange: (value) => context.editButton('spacer', value, pindex, rindex, bindex)
      }),
      Select({
        title: gettext('w') + button.w,
        value: button.w,
        options: wRange({ customValues: [16.66, 33.33, 66.66, 83.33] }),
        onChange: (value) => context.editButton('w', value, pindex, rindex, bindex)
      })
    ]
  );
};

const buildButtonHTTPConfig = (button, pindex, rindex, bindex, context) => {
  return View(
    {
      style: {
        flex: 1,
        flexDirection: 'column',
        justfyContent: 'center',
        alignItems: 'flex-start',
        display: button.spacer ? 'none' : 'flex'
      }
    },
    [
      // Stile pulsante
      Select({
        title: gettext('radius') + button.radius,
        value: button.radius,
        options: wRange({ step: 5 }),
        onChange: (value) => context.editButton('radius', value, pindex, rindex, bindex)
      }),
      Select({
        title: gettext('back_color'),
        value: button.back_color,
        options: colors(),
        onChange: (value) => context.editButton('back_color', value, pindex, rindex, bindex)
      }),
      Select({
        label: gettext('text_color'),
        options: colors(),
        onChange: (value) => context.editButton('text_color', value, pindex, rindex, bindex)
      }),
      Select({
        title: gettext('text_size') + button.text_size,
        value: button.text_size,
        options: tSizeRange(),
        onChange: (value) => context.editButton('text_size', value, pindex, rindex, bindex)
      }),

      // Configurazione HTTP Request
      TextInput({
        bold: false,
        value: button.request.url || gettext('**URL**'),
        placeholder: gettext('insert_url'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 200,
        onChange: (value) => {
          if (validateURL(value)) {
            context.editButton('url', value, pindex, rindex, bindex);
          } else {
            context.editButton('url', null, pindex, rindex, bindex);
            return Toast({ message: gettext('insert_valid_url') });
          }
        }
      }),
      Select({
        title: gettext('insert_method') + (button.request.method || '--'),
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'HEAD', value: 'HEAD' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'OPTIONS', value: 'OPTIONS' },
          { name: 'CONNECT', value: 'CONNECT' }
        ],
        onChange: (value) => context.editButton('method', value, pindex, rindex, bindex)
      }),
      Toggle({
        label: gettext('is_input'),
        value: button.input,
        subStyle: { color: '#333', fontSize: '10px' },
        onChange: (value) => context.editButton('input', value, pindex, rindex, bindex)
      }),

      // Autenticazione
      ...buildAuthFields(button, pindex, rindex, bindex, context),

      // Headers e Body
      TextInput({
        bold: false,
        value: button.request.headers || gettext('**HEADERS**'),
        placeholder: gettext('insert_headers'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 200,
        onChange: (value) => {
          if (value.length > 0 && value.length <= 200 || value != gettext('**HEADERS**')) {
            context.editButton('headers', value, pindex, rindex, bindex);
          }
        }
      }),
      TextInput({
        bold: false,
        value: button.request.body || gettext('**BODY**'),
        placeholder: gettext('insert_body'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 200,
        onChange: (value) => {
          if (value.length > 0 && value.length <= 200 || value != gettext('**BODY**')) {
            context.editButton('body', value, pindex, rindex, bindex);
          }
        }
      }),
      TextInput({
        bold: false,
        value: button.request.parse_result || gettext('**parse_result**'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 200,
        onChange: (value) => {
          if (value.length > 0 && value.length <= 200 || value != gettext('**parse_result**')) {
            context.editButton('parse_result', value, pindex, rindex, bindex);
          }
        }
      }),
      Select({
        title: gettext('response_style'),
        value: button.request.response_style,
        options: [
          { name: gettext('system_toast'), value: SYSTEM_TOAST },
          { name: gettext('custom_toast'), value: CUSTOM_TOAST },
          { name: gettext('no_notification'), value: NO_NOTIFICATION },
          { name: gettext('system_modal'), value: SYSTEM_MODAL }
        ],
        onChange: (value) => context.editButton('response_style', value, pindex, rindex, bindex)
      })
    ]
  );
};

const buildAuthFields = (button, pindex, rindex, bindex, context) => {
  const authFields = [
    Select({
      title: gettext('auth') + (button.request.auth || '--'),
      value: button.request.auth || '--',
      options: [
        { name: '--', value: '--' },
        { name: 'Basic', value: 'Basic' },
        { name: 'Bearer', value: 'Bearer' },
        { name: 'Digest', value: 'Digest' }
      ],
      onChange: (value) => context.editButton('auth', value, pindex, rindex, bindex)
    })
  ];

  // User field (Basic/Digest)
  if (button.request.auth === 'Basic' || button.request.auth === 'Digest') {
    authFields.push(
      TextInput({
        bold: false,
        value: button.request.user || gettext('**USER**'),
        placeholder: gettext('user'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 200,
        onChange: (value) => {
          if (value.length > 0 && value.length <= 200 || value != gettext('**USER**')) {
            context.editButton('user', value, pindex, rindex, bindex);
          }
        }
      }),
      TextInput({
        bold: false,
        value: button.request.pass || gettext('**PASS**'),
        placeholder: gettext('pass'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 400,
        onChange: (value) => {
          if (value.length > 0 && value.length <= 400 || value != gettext('**PASS**')) {
            context.editButton('pass', value, pindex, rindex, bindex);
          }
        }
      })
    );
  }

  // Token field (Bearer)
  if (button.request.auth === 'Bearer') {
    authFields.push(
      TextInput({
        bold: false,
        value: button.request.token || gettext('**TOKEN**'),
        placeholder: gettext('token'),
        subStyle: { color: COLOR_BLACK, fontSize: '14px' },
        maxLength: 512,
        onChange: (value) => {
          if (value.length > 0 && value.length <= 512 || value != gettext('**TOKEN**')) {
            context.editButton('token', value, pindex, rindex, bindex);
          }
        }
      })
    );
  }

  return authFields;
};

const buildRowView = (row, page, pindex, rindex, context) => {
  return View(
    {
      style: {
        border: '1px solid #eaeaea',
        borderRadius: '8px',
        padding: '6px 0',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        background: '#f5f5f5'
      }
    },
    [
      View(
        {
          style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justfyContent: 'center',
            alignItems: 'center'
          }
        },
        [
          Text({
            bold: false,
            align: 'center',
            paragraph: false,
            style: { fontSize: '16px' }
          }, [gettext('row') + (rindex + 1)]),
          Select({
            options: indexRange(rindex, page.rows.length - 1),
            onChange: (value) => {
              if (value < 999) {
                context.moveRow(pindex, rindex, value);
              }
            }
          }),
          Select({
            title: gettext('h') + row.h,
            value: row.h,
            options: wRange({ customValues: [16.66, 33.33, 66.66, 83.33] }),
            onChange: (value) => context.editRow('h', value, pindex, rindex)
          })
        ]
      ),
      Button({
        label: gettext('add_button'),
        style: {
          fontSize: '12px',
          borderRadius: '30px',
          background: '#ababab',
          color: 'white',
          marginRight: '10px',
          maxWidth: '10%',
        },
        onClick: () => context.addButton(pindex, rindex)
      }),
      Button({
        label: gettext('delete_row'),
        style: {
          fontSize: '12px',
          borderRadius: '30px',
          background: '#fdcb3e',
          color: 'white',
          maxWidth: '10%',
        },
        onClick: () => context.deleteRow(pindex, rindex)
      })
    ]
  );
};

const buildPageView = (page, pindex, context) => {
  return View(
    {
      style: {
        borderBottom: '1px solid #eaeaea',
        padding: '6px 0',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start'
      }
    },
    [
      View(
        {
          style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justfyContent: 'center',
            alignItems: 'center'
          }
        },
        [
          TextInput({
            placeholder: gettext('page_title'),
            bold: true,
            value: page.title || gettext('**NO TEXT**'),
            subStyle: {
              textAlign: 'center',
              fontSize: '18px',
              color: toColor(page.text_color || COLOR_BLACK),
              background: toColor(page.back_color || COLOR_WHITE)
            },
            maxLength: 200,
            onChange: (title) => {
              if (title.length <= 200 || title != gettext('**NO TEXT**')) {
                context.editPage('title', title, pindex);
              }
            }
          }),
          View(
            {
              style: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justfyContent: 'center',
                alignItems: 'center'
              }
            },
            [
              Select({
                title: gettext('page') + (pindex + 1),
                value: undefined,
                options: indexRange(pindex, context.state.data.pages.length - 1),
                onChange: (value) => {
                  if (value < 999) {
                    context.movePage(pindex, value);
                  }
                }
              }),
              Select({
                title: gettext('back_color'),
                value: page.back_color,
                options: colors(),
                onChange: (value) => context.editPage('back_color', value, pindex)
              }),
              Select({
                title: gettext('text_color'),
                value: page.text_color,
                options: colors(),
                onChange: (value) => context.editPage('text_color', value, pindex)
              })
            ]
          )
        ]
      ),
      Button({
        label: gettext('add_row'),
        style: {
          fontSize: '12px',
          borderRadius: '30px',
          background: '#ababab',
          color: 'white',
          marginRight: '10px',
          maxWidth: '10%',
        },
        onClick: () => context.addRow(pindex)
      }),
      Button({
        label: gettext('delete_page'),
        style: {
          fontSize: '12px',
          borderRadius: '30px',
          background: '#D85E33',
          color: 'white',
          maxWidth: '10%',
        },
        onClick: () => context.deletePage(pindex)
      })
    ]
  );
};

// === MAIN APP ===

AppSettingsPage({
  state: {
    data: {},
    is_conf_error: false,
    props: {}
  },

  // ... (tutti i metodi esistenti: addGlobalVariable, editGlobalVariable, ecc.)
  addGlobalVariable(key, val) {
    this.state.data.variables[key] = val;
    this.setItem();
  },
  editGlobalVariable(key, val) {
    this.state.data.variables[key] = val;
    this.setItem();
  },
  editGlobalVariableKey(oldkey, newkey) {
    let temp = this.state.data.variables[oldkey];
    this.state.data.variables[newkey] = temp;
    delete this.state.data.variables[oldkey];
    this.setItem()
  },
  deleteGlobalVariable(key) {
    delete this.state.data.variables[key]
    this.setItem()
  },
  addPage(title) {
    let newPage = DEFAULT_PAGE;
    newPage.title = title;
    this.state.data.pages.push(newPage);
    this.setItem()
  },
  editPage(prop, val, pindex) {
    switch (prop) {
      case 'title':
        this.state.data.pages[pindex].title = val
        break;
      case 'back_color':
        this.state.data.pages[pindex].back_color = val
        break;
      case 'text_color':
        this.state.data.pages[pindex].text_color = val
        break;
      case 'text_size':
        this.state.data.pages[pindex].text_size = val
        break;
    }
    this.setItem()
  },
  deletePage(index) {
    this.state.data.pages = this.state.data.pages.filter((_, ind) => ind !== index)
    this.setItem()
  },
  movePage(pindex, toindex) {
    let temp = this.state.data.pages[pindex];
    this.state.data.pages[pindex] = this.state.data.pages[toindex];
    this.state.data.pages[toindex] = temp;
    this.setItem();
  },
  addRow(pageindex) {
    let row = DEFAULT_ROW;
    this.state.data.pages[pageindex].rows.push(row);
    this.setItem()
  },
  editRow(prop, val, pindex, rindex) {
    switch (prop) {
      case 'h':
        this.state.data.pages[pindex].rows[rindex].h = val;
        break;
    }
    this.setItem()
  },
  deleteRow(pindex, rindex) {
    this.state.data.pages[pindex].rows = this.state.data.pages[pindex].rows.filter((_, ind) => ind !== rindex)
    this.setItem()
  },
  swapRows(pindex, rindex, toindex) {
    const rows = this.state.data.pages[pindex].rows;
    if (rindex >= rows.length || toindex >= rows.length || rindex < 0 || toindex < 0 || rindex === toindex) {
      return;
    }
    const temp = rows[rindex];
    rows[rindex] = rows[toindex];
    rows[toindex] = temp;
    this.setItem();
  },
  moveRow(pindex, fromIndex, toIndex) {
    const rows = this.state.data.pages[pindex].rows;
    if (fromIndex >= rows.length || toIndex >= rows.length || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }
    const rowToMove = rows.splice(fromIndex, 1)[0];
    rows.splice(toIndex, 0, rowToMove);
    this.setItem();
  },
  addButton(pageindex, rowindex) {
    let button = DEFAULT_BUTTON;
    this.state.data.pages[pageindex].rows[rowindex].buttons.push(button);
    this.setItem()
  },
  editButton(prop, val, pindex, rindex, bindex) {
    const btn = this.state.data.pages[pindex].rows[rindex].buttons[bindex];
    switch (prop) {
      case 'text': btn.text = val; break;
      case 'spacer': btn.spacer = val; break;
      case 'w': btn.w = val; break;
      case 'radius': btn.radius = val; break;
      case 'back_color': btn.back_color = val; break;
      case 'text_color': btn.text_color = val; break;
      case 'text_size': btn.text_size = val; break;
      case 'url': btn.request.url = val; break;
      case 'method': btn.request.method = val; break;
      case 'headers': btn.request.headers = val; break;
      case 'body': btn.request.body = val; break;
      case 'parse_result': btn.request.parse_result = val; break;
      case 'response_style': btn.request.response_style = val; break;
      case 'auth': btn.request.auth = val; break;
      case 'user': btn.request.user = val; break;
      case 'pass': btn.request.pass = val; break;
      case 'token': btn.request.token = val; break;
      case 'input': btn.input = val; break;
    }
    this.setItem()
  },
  swapButtons(pindex, rindex, bindex, toindex) {
    const buttons = this.state.data.pages[pindex].rows[rindex].buttons;
    if (bindex >= buttons.length || toindex >= buttons.length || bindex < 0 || toindex < 0) {
      return;
    }
    const temp = buttons[bindex];
    buttons[bindex] = buttons[toindex];
    buttons[toindex] = temp;
    this.setItem();
  },
  moveButton(pindex, rindex, fromIndex, toIndex) {
    const buttons = this.state.data.pages[pindex].rows[rindex].buttons;
    if (fromIndex >= buttons.length || toIndex >= buttons.length || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }
    const buttonToMove = buttons.splice(fromIndex, 1)[0];
    buttons.splice(toIndex, 0, buttonToMove);
    this.setItem();
  },
  deleteButton(pindex, rindex, bindex) {
    this.state.data.pages[pindex].rows[rindex].buttons = this.state.data.pages[pindex].rows[rindex].buttons.filter((_, ind) => ind !== bindex)
    this.setItem()
  },
  setItem() {
    const newString = JSON.stringify(this.state.data)
    this.state.props.settingsStorage.setItem('data', newString)
  },
  setState(props) {
    this.state.props = props
    const rawData = props.settingsStorage.getItem('data');
    console.log(rawData);
    const dt = tryParseJSON(rawData);

    if (dt) {
      console.log(dt);
      this.state.is_conf_error = false;
      if (Array.isArray(dt)) {
        console.log('isArray');
        this.state.data = dt[0] || DEFAULT_DATA;
      } else if (typeof dt === 'object') {
        this.state.data = dt;
      } else {
        console.log('data format invalid');
        this.state.is_conf_error = true;
        this.state.data = DEFAULT_DATA;
      }
    } else if (rawData) {
      console.log('data error');
      this.state.is_conf_error = true;
      this.state.data = DEFAULT_DATA;
    } else {
      console.log('data empty');
      this.state.is_conf_error = false;
      this.state.data = DEFAULT_DATA;
    }
  },
  deleteState() {
    this.state.data = DEFAULT_DATA
    this.setItem()
  },

  build(props) {
    this.setState(props)

    const contentItems = []
    const contentVariables = []

    // Welcome text (invariato)
    const welcomeText = View({}, [
      Text({ bold: true, align: 'center', paragraph: true, style: { fontSize: '36px' }},
        [gettext('title_text')]),
      Text({ bold: false, align: 'left', paragraph: true, style: { fontSize: '16px', padding: '10px 10px' }},
        [gettext('welcome_text')])
    ])

    // Pulsanti principali (invariati)
    const addPageBTN = View({ style: { fontSize: '12px', lineHeight: '35px', borderRadius: '30px', background: '#409EFF', color: 'white', textAlign: 'center', padding: '0 40px', width: '40%' }}, [
      TextInput({
        label: gettext('add_page'),
        labelStyle: { fontWeight: '500', textAlign: 'center' },
        onChange: (title) => this.addPage(title)
      })
    ]);

    const addVariableBTN = Button({
      label: gettext('add_variable'),
      style: { fontSize: '12px', borderRadius: '30px', background: toColor(COLOR_GREEN), color: 'white', width: '40%' },
      onClick: () => {
        let i = 1, key
        const vars = this.state.data.variables
        do {
          key = `var_${i}`
          i++
        } while (key in vars)
        this.addGlobalVariable(key, '')
      }
    });

    const clearBTN = View({ style: { fontSize: '12px', fontWeight: '500', lineHeight: '35px', borderRadius: '30px', background: '#db2c2c', color: 'white', textAlign: 'left', padding: '0 15px'}}, [
      TextInput({
        label: gettext('delete_storage'),
        labelStyle: { textAlign: 'center' },
        subStyle: { display: 'none' },
        disabled: true,
        placeholder: gettext('delete_storage') + '?',
        value: undefined,
        onChange: () => this.deleteState()
      })
    ]);

    const confBTN = View({ style: { fontSize: '12px', lineHeight: '35px', borderRadius: '30px', background: '#dedede', color: 'black', textAlign: 'left', padding: '0 15px', margin: '6px 0' }}, [
      TextInput({
        label: gettext('conf'),
        labelStyle: { textAlign: 'center' },
        subStyle: { display: 'none' },
        value: JSON.stringify(this.state.data),
        onChange: (value) => this.state.props.settingsStorage.setItem('data', value)
      })
    ]);

    const conf_error = View({ style: { padding: '12px 20px' }}, [
      Text({ bold: false, paragraph: true, style: { fontSize: '20px', padding: '12px 0', whiteSpace: 'pre-line' }},
        [gettext('config_error_text')]),
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' }}, [
        View({ style: { fontSize: '12px', lineHeight: '35px', borderRadius: '30px', background: '#dedede', color: 'black', textAlign: 'left', padding: '0 15px', margin: '6px 0', width: '50%' }}, [
          TextInput({
            label: gettext('fix_conf'),
            subStyle: { display: 'none' },
            value: props.settingsStorage.getItem('data'),
            onChange: (value) => this.state.props.settingsStorage.setItem('data', value)
          })
        ]),
        clearBTN
      ])
    ]);

    // === COSTRUZIONE DINAMICA DEL LAYOUT ===

    if (this.state.data) {
      const variables = this.state.data.variables || {};

      // Sezione Variabili Globali
      contentVariables.push(
        Text({ bold: true, align: 'left', paragraph: true, style: { fontSize: '16px', padding: '4px 4px' }},
          [gettext('variables')])
      )

      Object.entries(variables)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([vindex, value]) => {
          contentVariables.push(
            View({ style: { borderTop: '1px solid #eaeaea', padding: '6px 0 6px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}, [
              View({ style: { flex: 1, display: 'flex', flexDirection: 'column', justfyContent: 'center', alignItems: 'start' }}, [
                TextInput({
                  label: vindex,
                  placeholder: vindex,
                  bold: false,
                  value: value,
                  labelStyle: { fontWeight: '500' },
                  subStyle: { fontSize: '14px', color: COLOR_BLACK, background: COLOR_WHITE },
                  maxLength: 200,
                  onChange: (val) => {
                    if (val == null) return
                    if (val === vindex) return
                    if (val.length <= 200) {
                      this.editGlobalVariable(vindex, val)
                    }
                  }
                })
              ]),
              View({ style: { fontSize: '12px', fontWeight: '500', lineHeight: '35px', borderRadius: '30px', background: '#7cad9dff', color: 'white', textAlign: 'left', padding: '0 15px', margin: '0 5px 0 0' }}, [
                TextInput({
                  label: gettext('edit_variable'),
                  labelStyle: { textAlign: 'center' },
                  subStyle: { display: 'none' },
                  value: vindex,
                  onChange: (newValue) => {
                    if (newValue == null) return
                    if (newValue === vindex) return
                    this.editGlobalVariableKey(vindex, newValue)
                  }
                })
              ]),
              View({ style: { fontSize: '12px', fontWeight: '500', lineHeight: '35px', borderRadius: '30px', background: '#D85E33', color: 'white', textAlign: 'left', padding: '0 15px', margin: '0 5px 0 0' }}, [
                TextInput({
                  label: gettext('delete_variable'),
                  labelStyle: { textAlign: 'center' },
                  subStyle: { display: 'none' },
                  disabled: true,
                  placeholder: gettext('delete_variable') + ' ' + vindex + '?',
                  value: undefined,
                  onChange: (newValue) => this.deleteGlobalVariable(vindex)
                })
              ])
            ])
          )
        });

      // === COSTRUZIONE PAGES/ROWS/BUTTONS CON FUNZIONI HELPER ===
      const pages = this.state.data.pages || [];

      for (let [pindex, page] of pages.entries()) {
        // Aggiungi la view della pagina
        contentItems.push(buildPageView(page, pindex, this));

        // Aggiungi le righe della pagina
        for (let [rindex, row] of page.rows.entries()) {
          contentItems.push(buildRowView(row, page, pindex, rindex, this));

          // Aggiungi i pulsanti della riga
          for (let [bindex, button] of row.buttons.entries()) {
            contentItems.push(buildButtonView(button, pindex, rindex, bindex, this));
          }
        }
      }
    }

    // === RENDERING FINALE ===

    if (this.state.is_conf_error === true) {
      return View({ style: { padding: '12px 20px' }}, [conf_error])
    } else {
      return View({ style: { padding: '12px 5px' }}, [
        welcomeText,
        View({ style: { flex: 1, display: 'flex', justifyContent: 'space-evenly', flexDirection: 'row', alignItems: 'center' }},
          [addPageBTN, addVariableBTN]),
        contentVariables.length > 0 && View({ style: { marginTop: '12px', padding: '4px', border: '1px solid #eaeaea', borderRadius: '6px', backgroundColor: 'white' }},
          [...contentVariables]),
        contentItems.length > 0 && View({ style: { marginTop: '12px', padding: '4px', border: '1px solid #eaeaea', borderRadius: '6px', backgroundColor: 'white' }},
          [...contentItems]),
        confBTN,
        clearBTN
      ])
    }
  }
})