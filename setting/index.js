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
  SYSTEM_TOAST, CUSTOM_TOAST, SYSTEM_MODAL, NO_NOTIFICATION, SHOW_IMAGE,
  KB_TYPE_CHAR, KB_TYPE_NUMERIC } from '../utils/constants.js'

// === UTILITY FUNCTIONS ===
// Deep-clones a default template. The DEFAULT_* objects in constants.js are
// shared singletons, so they must never be inserted into state by reference.
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

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

const keyboardTypes = () => {
  return [
    { name: gettext('kb_char'), value: KB_TYPE_CHAR },
    { name: gettext('kb_numeric'), value: KB_TYPE_NUMERIC }
  ];
}

// === LAYOUT BUILDER FUNCTIONS ===

// A destructive-action control that looks like a button but is backed by a
// disabled TextInput: tapping opens the framework's native dialog, and the
// delete (onConfirm) only fires after the user confirms. A real Button would
// delete on the first tap with no confirmation (see the note on clearBTN).
const deleteConfirm = (label, background, onConfirm, { name, style, icon } = {}) => {
  // Confirm dialog always names the element, e.g. Delete Button "ON/OFF"?.
  // `icon` (optional) replaces the button text with a glyph (e.g. a trash can),
  // while the confirm text stays explicit.
  const placeholder = label + (name ? ' "' + name + '"' : '') + '?';
  return View({ style: { fontSize: '12px', fontWeight: '500', lineHeight: '35px', borderRadius: '30px', background, color: 'white', textAlign: 'center', padding: '0 15px', ...style } }, [
    TextInput({
      label: icon || label,
      labelStyle: { textAlign: 'center' },
      subStyle: { display: 'none' },
      disabled: true,
      placeholder,
      value: undefined,
      onChange: () => onConfirm()
    })
  ]);
};

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
            justifyContent: 'center',
            alignItems: 'normal'
          }
        },
        [
          // Left column - Basic button info
          buildButtonBasicInfo(button, pindex, rindex, bindex, context),
          // Right column - HTTP configuration
          buildButtonHTTPConfig(button, pindex, rindex, bindex, context)
        ]
      ),
      deleteConfirm(gettext('delete_button'), '#ffffff', () => context.deleteButton(pindex, rindex, bindex), { name: button.spacer ? gettext('**SPACER**') : (button.text || ''), icon: '🗑', style: { border: '2px solid #D85E33' } })
    ]
  );
};

const buildButtonBasicInfo = (button, pindex, rindex, bindex, context) => {
  return View(
    {
      style: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
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
        justifyContent: 'center',
        alignItems: 'flex-start',
        display: button.spacer ? 'none' : 'flex'
      }
    },
    [
      // Button style options
      // [redesign step 1] Slider instead of a long "0..100 step 5" dropdown.
      Slider({
        label: gettext('radius') + (button.radius != null ? button.radius : 0),
        min: 0,
        max: 100,
        step: 1,
        value: button.radius || 0,
        onChange: (value) => context.editButton('radius', value, pindex, rindex, bindex)
      }),
      Select({
        title: gettext('back_color'),
        value: button.back_color,
        options: colors(),
        onChange: (value) => context.editButton('back_color', value, pindex, rindex, bindex)
      }),
      Select({
        title: gettext('text_color'),
        value: button.text_color,
        options: colors(),
        onChange: (value) => context.editButton('text_color', value, pindex, rindex, bindex)
      }),
      Select({
        title: gettext('text_size') + (button.text_size != null ? button.text_size : 'default'),
        value: button.text_size,
        options: tSizeRange(),
        onChange: (value) => context.editButton('text_size', value, pindex, rindex, bindex)
      }),

      // HTTP Request configuration
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
      // Keyboard type selector (only visible when input is enabled)
      View({
        style: {
          display: button.input ? 'block' : 'none'
        }
      }, [
        Select({
          title: gettext('keyboard_type'),
          value: button.keyboard_type || KB_TYPE_CHAR,
          options: keyboardTypes(),
          onChange: (value) => context.editButton('keyboard_type', value, pindex, rindex, bindex)
        })
      ]),

      // Authentication
      ...buildAuthFields(button, pindex, rindex, bindex, context),

      // Headers and Body
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
          { name: gettext('system_modal'), value: SYSTEM_MODAL },
          { name: gettext('show_image'), value: SHOW_IMAGE }
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

// Compact summary of a collapsed row: the names of the buttons it contains.
const buildRowSummary = (row) => {
  const names = (row.buttons || [])
    .map((b) => b.spacer ? '▭' : (b.text || '—'))
    .join('   ·   ');
  return Text({ align: 'center', style: { fontSize: '13px', color: '#666', padding: '4px 8px' } }, [names || '(no buttons)']);
};

// Row header — all controls on one line: Row:N (emphasized) · reorder · height
// · add button (+) · delete (🗑) · collapse switch (open = show buttons).
const buildRowView = (row, page, pindex, rindex, context, rowOpen) => {
  return View(
    {
      style: {
        border: '1px solid #eaeaea',
        borderRadius: '8px',
        padding: '4px 6px',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        background: '#f5f5f5'
      }
    },
    [
      // Row:N kept as a styled Text (a Select's title can't be styled) with the
      // reorder select beneath it. The reorder select is hidden when the page
      // has a single row (nothing to reorder) — the title still shows.
      View({ style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [
        Text({ bold: true, align: 'center', style: { fontSize: '18px' } }, [gettext('row') + (rindex + 1)]),
        ...(page.rows.length > 1 ? [
          Select({
            options: indexRange(rindex, page.rows.length - 1),
            onChange: (value) => {
              if (value < 999) {
                context.moveRow(pindex, rindex, value);
              }
            }
          })
        ] : [])
      ]),
      View({ style: { flex: 1 } }, [
        Select({
          title: gettext('h') + row.h,
          value: row.h,
          options: wRange({ customValues: [16.66, 33.33, 66.66, 83.33] }),
          onChange: (value) => context.editRow('h', value, pindex, rindex)
        })
      ]),
      Button({
        label: '+',
        style: { fontSize: '20px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '50%', background: '#ababab', color: 'white', padding: '0', marginLeft: '4px' },
        onClick: () => context.addButton(pindex, rindex)
      }),
      deleteConfirm(gettext('delete_row'), '#ffffff', () => context.deleteRow(pindex, rindex), { name: String(rindex + 1), icon: '🗑', style: { margin: '0 4px', border: '2px solid #D85E33' } }),
      // Expand/collapse chevron. A Button (not a switch) so its arrow always
      // reflects the real state — ▾ open, ▸ collapsed.
      Button({
        label: rowOpen ? '▾' : '◂',
        style: { fontSize: '18px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px' },
        onClick: () => context.state.props.settingsStorage.setItem('ui_row_' + pindex + '_' + rindex, rowOpen ? 'false' : 'true')
      })
    ]
  );
};

// Summary of a collapsed page: each row's button names on its own line.
const buildPageSummary = (page) => {
  return View({ style: { padding: '4px 8px' } },
    (page.rows || []).map((row) =>
      // paragraph: true so each row renders as a block (its own line); a plain
      // Text renders as an inline <span> and they'd all run together.
      Text({ align: 'center', paragraph: true, style: { fontSize: '13px', color: '#666' } }, [
        (row.buttons || []).map((b) => b.spacer ? '▭' : (b.text || '—')).join('   ·   ') || '—'
      ])
    )
  );
};

// Page header. Title (editable, with the page's own colors as a preview) sits
// above the reorder select (hidden when there's a single page), with a collapse
// chevron on the right. The color/delete/add-row controls show only when open.
const buildPageView = (page, pindex, context, pageOpen, pageCount) => {
  return View(
    {
      style: {
        borderBottom: '1px solid #eaeaea',
        padding: '6px 0',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
      }
    },
    [
      // Header line: title (+ reorder beneath it) and the collapse chevron.
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        View({ style: { flex: 1, display: 'flex', flexDirection: 'column' } }, [
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
          ...(pageCount > 1 ? [
            Select({
              value: undefined,
              options: indexRange(pindex, pageCount - 1),
              onChange: (value) => {
                if (value < 999) {
                  context.movePage(pindex, value);
                }
              }
            })
          ] : [])
        ]),
        // Delete page — always visible (even when the page is collapsed).
        deleteConfirm(gettext('delete_page'), '#ffffff', () => context.deletePage(pindex), { name: page.title || String(pindex + 1), icon: '🗑', style: { margin: '0 4px', border: '2px solid #D85E33' } }),
        Button({
          label: pageOpen ? '▾' : '◂',
          style: { fontSize: '18px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px' },
          onClick: () => context.state.props.settingsStorage.setItem('ui_page_' + pindex, pageOpen ? 'false' : 'true')
        })
      ]),
      // Editing controls, only when the page is expanded: colors + add row.
      ...(pageOpen ? [
        View(
          { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginTop: '6px' } },
          [
            View({ style: { flex: 1 } }, [
              Select({ title: gettext('back_color'), value: page.back_color, options: colors(), onChange: (value) => context.editPage('back_color', value, pindex) })
            ]),
            View({ style: { flex: 1 } }, [
              Select({ title: gettext('text_color'), value: page.text_color, options: colors(), onChange: (value) => context.editPage('text_color', value, pindex) })
            ])
          ]
        ),
        View(
          { style: { display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: '6px' } },
          [
            Button({
              label: '+',
              style: { fontSize: '20px', fontWeight: '700', minWidth: '36px', width: '36px', height: '36px', borderRadius: '50%', background: '#ababab', color: 'white', padding: '0' },
              onClick: () => context.addRow(pindex)
            })
          ]
        )
      ] : [])
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
    let newPage = clone(DEFAULT_PAGE);
    newPage.title = title;
    this.state.data.pages.push(newPage);
    // Expand the freshly added page (pages are collapsed by default).
    this.state.props.settingsStorage.setItem('ui_page_' + (this.state.data.pages.length - 1), 'true');
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
    let row = clone(DEFAULT_ROW);
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
    let button = clone(DEFAULT_BUTTON);
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
      case 'keyboard_type': btn.keyboard_type = val; break;
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
        this.state.data = dt[0] || clone(DEFAULT_DATA);
      } else if (typeof dt === 'object') {
        this.state.data = dt;
      } else {
        console.log('data format invalid');
        this.state.is_conf_error = true;
        this.state.data = clone(DEFAULT_DATA);
      }
    } else if (rawData) {
      console.log('data error');
      this.state.is_conf_error = true;
      this.state.data = clone(DEFAULT_DATA);
    } else {
      console.log('data empty');
      this.state.is_conf_error = false;
      this.state.data = clone(DEFAULT_DATA);
    }
  },
  deleteState() {
    this.state.data = clone(DEFAULT_DATA)
    this.setItem()
  },

  build(props) {
    this.setState(props)

    const contentItems = []
    const contentVariables = []

    // Welcome text
    const welcomeText = View({}, [
      Text({ bold: true, align: 'center', paragraph: true, style: { fontSize: '36px' }},
        [gettext('title_text')]),
      Text({ bold: false, align: 'left', paragraph: true, style: { fontSize: '16px', padding: '10px 10px' }},
        [gettext('welcome_text')])
    ])

    // "Add Page" button (kept as text, not a "+", because tapping it opens a
    // dialog to type the new page's title). Blue pill at the bottom of the
    // page-picker card.
    const addPageBTN = View({ style: { fontSize: '13px', fontWeight: '500', lineHeight: '35px', borderRadius: '30px', background: '#409EFF', color: 'white', textAlign: 'center', padding: '0 20px' }}, [
      TextInput({
        label: gettext('add_page'),
        labelStyle: { fontWeight: '500', textAlign: 'center' },
        onChange: (title) => this.addPage(title)
      })
    ]);

    // Compact round "+" (styled text, not an emoji). Sits inline with the
    // Variables toggle. Auto-expands the list on add (see onClick).
    const addVariableBTN = Button({
      label: '+',
      style: { fontSize: '22px', fontWeight: '700', minWidth: '36px', width: '36px', height: '36px', borderRadius: '50%', background: toColor(COLOR_GREEN), color: 'white', padding: '0' },
      onClick: () => {
        let i = 1, key
        const vars = this.state.data.variables
        do {
          key = `var_${i}`
          i++
        } while (key in vars)
        // The "+" is only visible when the panel is already open, so no need to
        // force-expand here.
        this.addGlobalVariable(key, '')
      }
    });

    // A disabled TextInput (NOT a Button) on purpose: tapping it opens the
    // framework's native input dialog showing the placeholder as a confirm
    // ("delete storage?"), and onChange only fires once the user confirms.
    // A real Button would delete immediately with no confirmation — which we
    // don't want for a destructive action. Keep as-is.
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

    // Test mode switch (bottom of the page): when ON, the watch loads the
    // hardcoded TEST_DATA suite instead of the user's config. Non-destructive —
    // the user's config is untouched and comes back when switched OFF.
    const testMode = props.settingsStorage.getItem('test_mode') === 'true'
    const testModeSwitch = View({ style: { marginTop: '12px', padding: '4px 12px', border: '1px solid #eaeaea', borderRadius: '6px', backgroundColor: testMode ? '#fff3cd' : 'white' }}, [
      Toggle({
        label: gettext('test_mode'),
        value: testMode,
        subStyle: { color: '#8a6d3b', fontSize: '12px' },
        onChange: (value) => this.state.props.settingsStorage.setItem('test_mode', value ? 'true' : 'false')
      }),
      Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#8a6d3b', padding: '2px 0 4px' }},
        [gettext('test_mode_hint')])
    ])

    // === DYNAMIC LAYOUT BUILDING ===

    if (this.state.data) {
      const variables = this.state.data.variables || {};

      // [redesign step 4] Collapse the variables list behind a toggle so it
      // doesn't push the page picker far down; state in the UI-only key.
      const varCount = Object.keys(variables).length;
      const varsOpen = this.state.props.settingsStorage.getItem('ui_vars_open') === 'true';
      // Header: "Variables: (N)" label with a ▾/◂ chevron (a button, so it always
      // reflects the real open state) — matching the page and row headers. The
      // "+" add button lives at the bottom of the list (shown only when open).
      contentVariables.push(
        View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
          Text({ bold: true, align: 'left', style: { flex: 1, fontSize: '16px' } }, [gettext('variables') + ' (' + varCount + ')']),
          Button({
            label: varsOpen ? '▾' : '◂',
            style: { fontSize: '18px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px' },
            onClick: () => this.state.props.settingsStorage.setItem('ui_vars_open', varsOpen ? 'false' : 'true')
          })
        ])
      );

      if (varsOpen) {
        Object.entries(variables)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([vindex, value]) => {
          contentVariables.push(
            View({ style: { borderTop: '1px solid #eaeaea', padding: '6px 0 6px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}, [
              View({ style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'start' }}, [
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
              // Disabled TextInput (NOT a Button) on purpose: it opens a native
              // confirm dialog ("delete <var>?") before onChange fires. A Button
              // would delete on the first tap with no confirmation.
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
        // "+" add-variable button at the bottom of the (open) list.
        contentVariables.push(
          View({ style: { display: 'flex', justifyContent: 'center', margin: '8px 0 2px' }}, [addVariableBTN])
        );
      }

      // === BUILD PAGES/ROWS/BUTTONS WITH HELPER FUNCTIONS ===
      const pages = this.state.data.pages || [];

      // "Pages: (n)" header between the variables block and the pages list.
      contentItems.push(
        Text({ bold: true, align: 'left', paragraph: true, style: { fontSize: '16px', padding: '4px 4px' } }, [gettext('pages') + ' (' + pages.length + ')'])
      );

      // Pages are collapsible cards (like rows) — no picker. All pages render,
      // each collapsed by default (ui_page_<i>); open one to edit it. Collapsed
      // shows a summary of its buttons (one line per row).
      for (let [pindex, page] of pages.entries()) {
        const pageOpen = this.state.props.settingsStorage.getItem('ui_page_' + pindex) === 'true';
        const pageChildren = [buildPageView(page, pindex, this, pageOpen, pages.length)];
        if (pageOpen) {
          for (let [rindex, row] of page.rows.entries()) {
            // Each row is itself collapsible: open → button editors; collapsed →
            // a one-line summary of the button names. UI-only key, default closed.
            const rowOpen = this.state.props.settingsStorage.getItem('ui_row_' + pindex + '_' + rindex) === 'true';
            const rowChildren = [buildRowView(row, page, pindex, rindex, this, rowOpen)];
            if (rowOpen) {
              for (let [bindex, button] of row.buttons.entries()) {
                rowChildren.push(buildButtonView(button, pindex, rindex, bindex, this));
              }
            } else {
              rowChildren.push(buildRowSummary(row));
            }
            pageChildren.push(
              View({ style: { border: '1px solid #c9c9c9', borderRadius: '10px', padding: '6px', marginBottom: '10px', background: '#f0f0f0' }}, rowChildren)
            );
          }
        } else {
          pageChildren.push(buildPageSummary(page));
        }
        contentItems.push(
          Section({ style: { marginBottom: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }}, pageChildren)
        );
      }

      // Add Page at the bottom (always reachable, even with 0 pages).
      contentItems.push(
        View({ style: { display: 'flex', justifyContent: 'center', margin: '10px 0' }}, [addPageBTN])
      );
    }

    // === FINAL RENDERING ===

    if (this.state.is_conf_error === true) {
      return View({ style: { padding: '12px 20px' }}, [conf_error])
    } else {
      return View({ style: { padding: '12px 5px' }}, [
        welcomeText,
        // Variables in a card Section; the "Variables (N)" toggle inside is the
        // header (collapsed by default), so the Section itself has no title.
        contentVariables.length > 0 && Section({ style: { marginTop: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }},
          [...contentVariables]),
        ...contentItems,
        confBTN,
        clearBTN,
        testModeSwitch
      ])
    }
  }
})