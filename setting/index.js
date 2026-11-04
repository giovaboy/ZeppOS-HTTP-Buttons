import { gettext } from 'i18n'
import { DEFAULT_BUTTON, DEFAULT_ROW, DEFAULT_DATA, DEFAULT_PAGE,
  BTN_RADIUS, BTN_PADDING, ROW_PADDING, COLOR_BLACK, COLOR_BLUE, COLOR_GRAY, COLOR_GREEN, COLOR_INDIGO, COLOR_ORANGE, COLOR_ORANGE2,
  COLOR_RED, COLOR_VIOLET, COLOR_WHITE, COLOR_YELLOW,
  COLOR_DARK_RED, COLOR_BRIGHT_RED, COLOR_CRIMSON, COLOR_PINK, COLOR_HOT_PINK,
  COLOR_DARK_ORANGE, COLOR_CORAL, COLOR_TOMATO,
  COLOR_GOLD, COLOR_KHAKI,
  COLOR_DARK_GREEN, COLOR_LIME, COLOR_OLIVE, COLOR_TEAL, COLOR_MINT,
  COLOR_NAVY, COLOR_SKY_BLUE, COLOR_CYAN, COLOR_TURQUOISE,
  COLOR_PURPLE, COLOR_MAGENTA, COLOR_LAVENDER,
  COLOR_BROWN, COLOR_TAN, COLOR_BEIGE,
  COLOR_LIGHT_GRAY, COLOR_DARK_GRAY, COLOR_SILVER,
  SYSTEM_TOAST, CUSTOM_TOAST, SYSTEM_MODAL, NO_NOTIFICATION, SHOW_IMAGE,
  KB_TYPE_CHAR, KB_TYPE_NUMERIC, DEFAULT_REQUEST_TIMEOUT_MS,
  LOADING_STYLE_BORDER, LOADING_STYLE_PULSE, LOADING_STYLE_CORNER } from '../utils/constants.js'
import { LOG_KEY } from '../app-side/log.js'
import { logsEnabled } from '../config.js'
import { CARD_MAX, cardAllowed, cardButtons } from '../utils/card.js'

// Shown in the footer link and next to the README links. Keep in sync with
// package.json / app.json when bumping the app version. Calendar versions
// (since 2026.11.0, after 1.6.0): YEAR.MONTH.N, N from 0 within the month;
// app.json version.code goes up by one at every release.
const APP_VERSION = '2026.11.0';
const GITHUB_URL = 'https://github.com/giovaboy/ZeppOS-HTTP-Buttons';

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

// An empty field shows a marker as its value ("**USER**", "**NO TEXT**"…).
// Confirming the field unchanged handed the marker back to onChange, and it
// was saved as the real value (a user name "**USER**" sent to the server):
// a marker means empty. A config that already holds one shows the same marker,
// so the user sees an empty field and can fill it.
const unmark = (value, ...markers) => {
  const v = value == null ? '' : String(value);
  return markers.some((m) => v === m || v === gettext(m)) ? '' : v;
}

// The open pages, rows and buttons (keys ui_page_<p> / ui_row_<p>_<r> /
// ui_btn_<p>_<r>_<b> = 'true', by position). When pages or rows are deleted or moved, their state moves with
// them: by position alone the next page inherited a deleted page's state, and
// keys of deleted pages lingered.
function openUiKeys(storage, pages) {
  const open = new Set();
  (pages || []).forEach((pg, p) => {
    if (storage.getItem('ui_page_' + p) === 'true') open.add('ui_page_' + p);
    ((pg && pg.rows) || []).forEach((row, r) => {
      if (storage.getItem('ui_row_' + p + '_' + r) === 'true') open.add('ui_row_' + p + '_' + r);
      ((row && row.buttons) || []).forEach((_, b) => {
        if (storage.getItem('ui_btn_' + p + '_' + r + '_' + b) === 'true') open.add('ui_btn_' + p + '_' + r + '_' + b);
      });
    });
  });
  return open;
}
// The open buttons of a row, moved from row (p, r) to row (np, nr)
function moveRowButtons(before, after, pages, p, r, np, nr) {
  const row = pages[p] && pages[p].rows && pages[p].rows[r];
  ((row && row.buttons) || []).forEach((_, b) => {
    if (before.has('ui_btn_' + p + '_' + r + '_' + b)) after.add('ui_btn_' + np + '_' + nr + '_' + b);
  });
}
// Write only what changes (each write rebuilds the page)
function applyUiKeys(storage, before, after) {
  before.forEach((k) => { if (!after.has(k)) storage.removeItem(k); });
  after.forEach((k) => { if (!before.has(k)) storage.setItem(k, 'true'); });
}
// order: for each new position, the old index that goes there
function pagesUiAfter(before, pages, order) {
  const after = new Set();
  order.forEach((oldP, newP) => {
    if (before.has('ui_page_' + oldP)) after.add('ui_page_' + newP);
    ((pages[oldP] && pages[oldP].rows) || []).forEach((_, r) => {
      if (before.has('ui_row_' + oldP + '_' + r)) after.add('ui_row_' + newP + '_' + r);
      moveRowButtons(before, after, pages, oldP, r, newP, r);
    });
  });
  return after;
}
function rowsUiAfter(before, pages, pindex, order) {
  const rowPrefix = 'ui_row_' + pindex + '_', btnPrefix = 'ui_btn_' + pindex + '_';
  const after = new Set([...before].filter((k) => !k.startsWith(rowPrefix) && !k.startsWith(btnPrefix)));
  order.forEach((oldR, newR) => {
    if (before.has(rowPrefix + oldR)) after.add(rowPrefix + newR);
    moveRowButtons(before, after, pages, pindex, oldR, pindex, newR);
  });
  return after;
}
function buttonsUiAfter(before, pindex, rindex, order) {
  const prefix = 'ui_btn_' + pindex + '_' + rindex + '_';
  const after = new Set([...before].filter((k) => !k.startsWith(prefix)));
  order.forEach((oldB, newB) => { if (before.has(prefix + oldB)) after.add(prefix + newB); });
  return after;
}
// [0..n-1] without one index, or with one index moved to another
const withoutIndex = (n, index) => [...Array(n).keys()].filter((i) => i !== index);
const movedIndex = (n, from, to) => {
  const order = [...Array(n).keys()];
  order.splice(to, 0, order.splice(from, 1)[0]);
  return order;
};

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

// Request-timeout choices, stored in ms (what the fetch expects) but shown in
// seconds. The "default" entry (undefined) makes a button fall back to the
// global value — and the global select fall back to the app default (10 s).
// 60 s is the ceiling: beyond it the zml messaging window would fire first.
const timeoutLabel = (ms) => (ms / 1000) + ' s';
const timeoutRange = () => {
  return [
    { name: gettext('timeout_default'), value: undefined },
    ...[5, 10, 15, 20, 30, 45, 60].map((s) => ({ name: timeoutLabel(s * 1000), value: s * 1000 }))
  ];
}

const colors = () => {
  return [
    { name: 'black', value: COLOR_BLACK },
    { name: 'white', value: COLOR_WHITE },
    { name: 'gray', value: COLOR_GRAY },

    { name: 'red', value: COLOR_BRIGHT_RED },
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

const responseStyles = () => [
  { name: gettext('system_toast'), value: SYSTEM_TOAST },
  { name: gettext('custom_toast'), value: CUSTOM_TOAST },
  { name: gettext('no_notification'), value: NO_NOTIFICATION },
  { name: gettext('system_modal'), value: SYSTEM_MODAL },
  { name: gettext('show_image'), value: SHOW_IMAGE }
];
// The stored style as a number, for the choice; unset is what the watch then
// shows, a system toast
const responseStyleValue = (style) =>
  (style === undefined || style === null || style === '') ? SYSTEM_TOAST : Number(style);
const keyboardTypes = () => {
  return [
    { name: gettext('kb_char'), value: KB_TYPE_CHAR },
    { name: gettext('kb_numeric'), value: KB_TYPE_NUMERIC }
  ];
}

// A color picker: collapsed, one line (a swatch of the current color, its
// name, a chevron); open, a grid of swatches, 8 per line, the current one with
// a blue border and a check. Picking closes it. One picker open at a time in
// the whole page (ui_color_open holds its id), so the page doesn't grow.
// Colors are stored as numbers, as before; one off the palette (set in the
// JSON) shows its own swatch and its hex code.
const COLOR_OPEN_KEY = 'ui_color_open';
const COLORS_PER_LINE = 8;
const isLight = (c) => {
  const n = Number(c) || 0;
  return (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) > 160;
};
const colorPicker = (context, id, title, current, onColor) => {
  const storage = context.state.props.settingsStorage;
  const open = storage.getItem(COLOR_OPEN_KEY) === id;
  const palette = colors();
  const has = current !== undefined && current !== null && current !== '';
  const value = has ? Number(current) : undefined;
  const match = palette.find((c) => c.value === value);
  const name = match ? match.name : (has ? toColor(value) : '—');
  const header = View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '8px' } }, [
    View({ style: { width: '26px', minWidth: '26px', height: '26px', borderRadius: '6px', border: '1px solid #999', background: has ? toColor(value) : 'transparent', marginRight: '8px' } }, []),
    Text({ style: { flex: 1, fontSize: '15px' } }, [title + ': ' + name]),
    Button({
      label: open ? '▾' : '◂',
      style: { fontSize: '16px', fontWeight: '700', minWidth: '30px', width: '30px', height: '30px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px' },
      onClick: () => open ? storage.removeItem(COLOR_OPEN_KEY) : storage.setItem(COLOR_OPEN_KEY, id)
    })
  ]);
  if (!open) return header;
  const lines = [];
  for (let i = 0; i < palette.length; i += COLORS_PER_LINE) lines.push(palette.slice(i, i + COLORS_PER_LINE));
  const grid = View({ style: { display: 'flex', flexDirection: 'column', marginTop: '4px' } }, lines.map((line) =>
    View({ style: { display: 'flex', flexDirection: 'row', marginTop: '4px' } }, [
      ...line.map((c, i) => View({ style: { flex: 1, marginLeft: i ? '4px' : '0' } }, [
        Button({
          label: c.value === value ? '✓' : '',
          onClick: () => {
            storage.removeItem(COLOR_OPEN_KEY);
            if (c.value !== value) onColor(c.value);
          },
          style: {
            width: '100%', minWidth: '0', height: '30px', padding: '0', borderRadius: '6px',
            background: toColor(c.value), color: isLight(c.value) ? '#000' : '#fff',
            border: c.value === value ? '3px solid ' + CHOICE_ACCENT : '1px solid #bbb',
            fontSize: '14px', fontWeight: '700'
          }
        })
      ])),
      // The last line keeps the swatches' width
      ...Array.from({ length: COLORS_PER_LINE - line.length }, () => View({ style: { flex: 1, marginLeft: '4px' } }, []))
    ])
  ));
  return View({}, [header, grid]);
}

// A choice among a few options, as in zeppamp's and zhue's settings pages: one
// button per option, the chosen one in the accent. A Select doesn't show its
// value in its closed state (the title had to carry it) and takes two lines.
// perRow buttons per line, sharing the width.
const CHOICE_ACCENT = '#409EFF';  // the page's blue (Add Page, links)
const choice = (options, chosen, onPick, perRow = options.length) => {
  const lines = [];
  for (let i = 0; i < options.length; i += perRow) lines.push(options.slice(i, i + perRow));
  return View({ style: { display: 'flex', flexDirection: 'column', marginTop: '4px' } }, lines.map((line) =>
    View({ style: { display: 'flex', flexDirection: 'row', marginTop: '6px' } }, line.map((o, i) =>
      View({ style: { flex: 1, marginLeft: i ? '6px' : '0' } }, [
        Button({
          label: o.name,
          onClick: () => { if (o.value !== chosen) onPick(o.value) },
          style: {
            width: '100%', fontSize: '13px', fontWeight: '500', borderRadius: '24px', padding: '6px 4px',
            background: o.value === chosen ? CHOICE_ACCENT : '#e0e0e0',
            color: o.value === chosen ? 'white' : '#333'
          }
        })
      ])
    ))
  ));
}

// A small grey label above a field or a choice
const fieldLabel = (text) => Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#666', padding: '8px 2px 0' } }, [text]);

// A text field under its label. Empty, it shows a grey dash (still tappable);
// confirming the dash, or an old marker ("**USER**") a config may hold,
// gives an empty value. onValue gets the cleaned text.
// secret (password, token): shown as dots, so it doesn't show on screen or in
// a screenshot; confirming the dots unchanged keeps the value, typing replaces
// it. A variable reference ("{ring_token}") isn't a secret and shows as is.
const EMPTY_FIELD = '—';
const textField = (label, value, placeholderKey, max, oldMarker, onValue, { secret = false } = {}) => {
  const current = unmark(value, EMPTY_FIELD, oldMarker);
  const masked = secret && current && current.indexOf('{') === -1 ? '•'.repeat(Math.min(current.length, 10)) : null;
  return View({ style: { marginTop: '2px', marginBottom: '6px' } }, [
    fieldLabel(label),
    TextInput({
      bold: false,
      value: masked || current || EMPTY_FIELD,
      placeholder: gettext(placeholderKey),
      subStyle: { color: current ? COLOR_BLACK : '#999', fontSize: '14px', wordBreak: 'break-all' },
      maxLength: max,
      onChange: (v) => {
        if (masked && v === masked) return;
        const clean = unmark(v, EMPTY_FIELD, oldMarker);
        if (clean.length <= max) onValue(clean);
      }
    })
  ]);
};

// === LAYOUT BUILDER FUNCTIONS ===

// Destructive actions take two taps, as in zeppamp's and zhue's settings pages:
// the first stores what is asked (ui_confirm = an id), the page is built again
// with the question in red and the action + Cancel side by side, the second
// runs it. One question at a time; tapping the × again, Cancel, or any save
// (setItem) clears it. Replaces the disabled TextInput that opened the system's
// text-input dialog to ask, with OK on a field nobody types in.
const CONFIRM_KEY = 'ui_confirm';
const askingFor = (context, id) => context.state.props.settingsStorage.getItem(CONFIRM_KEY) === id;
// The round red ×: asks (or, asked already, takes the question back)
const deleteX = (context, id, style = {}) => Button({
  label: '×',
  style: { fontSize: '20px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '50%', background: '#db2c2c', color: 'white', padding: '0', flexShrink: 0, ...style },
  onClick: () => {
    const st = context.state.props.settingsStorage;
    if (askingFor(context, id)) st.removeItem(CONFIRM_KEY); else st.setItem(CONFIRM_KEY, id);
  }
});
// The question, shown under what it is about while it is asked
const confirmBar = (context, id, question, actionLabel, run) => !askingFor(context, id) ? [] : [
  View({ style: { display: 'flex', flexDirection: 'column', margin: '6px 0', padding: '8px', background: '#fdecea', border: '1px solid #f5c2c0', borderRadius: '8px' } }, [
    Text({ paragraph: true, style: { fontSize: '14px', color: '#b3261e', fontWeight: '600' } }, [question]),
    View({ style: { display: 'flex', flexDirection: 'row', marginTop: '8px' } }, [
      View({ style: { flex: 1 } }, [
        Button({
          label: actionLabel,
          style: { width: '100%', fontSize: '14px', fontWeight: '600', borderRadius: '24px', background: '#db2c2c', color: 'white' },
          onClick: () => { context.state.props.settingsStorage.removeItem(CONFIRM_KEY); run(); }
        })
      ]),
      View({ style: { flex: 1, marginLeft: '8px' } }, [
        Button({
          label: gettext('cancel'),
          style: { width: '100%', fontSize: '14px', fontWeight: '600', borderRadius: '24px', background: '#e0e0e0', color: '#333' },
          onClick: () => context.state.props.settingsStorage.removeItem(CONFIRM_KEY)
        })
      ])
    ])
  ])
];
const quoted = (name) => name ? ' "' + name + '"' : '';

// Two-column form controls have different intrinsic heights (the radius slider
// is taller than the selects), so the two columns drift out of alignment. Wrap
// each control in a fixed-height, vertically-centred cell and they line up on a
// grid. Tune FIELD_MIN_H if the grid looks too airy or too tight.
const FIELD_MIN_H = '64px';
const fieldCell = (child) => View({ style: { minHeight: FIELD_MIN_H, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }, [child]);
const fieldCol = (children) => View({ style: { flex: 1 } }, children.map(fieldCell));

// What a collapsed button card shows under its preview: what it does
// The request blocks the settings page can't edit (session login/logout, poll),
// so a button that has them doesn't look like a plain one
const jsonOnlyBlocks = (button) => {
  const r = (button && button.request) || {};
  return [r.session ? 'session' : null, r.poll ? 'poll' : null].filter(Boolean);
};
const jsonOnlyNote = (button) => {
  const blocks = jsonOnlyBlocks(button);
  return blocks.length ? [
    Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#8a6d3b', background: '#fff3cd', borderRadius: '6px', padding: '3px 6px', margin: '4px 0 0' } },
      [blocks.join(' · ') + ' — ' + gettext('json_only')])
  ] : [];
};

const buttonSummary = (button) => {
  if (button.spacer) return gettext('is_spacer') + ' · ' + gettext('w') + button.w;
  const r = button.request || {};
  // A long URL (a whole paragraph in a query) filled the card: cut
  const url = r.url || '—';
  return (r.method || 'GET') + ' ' + (url.length > 70 ? url.slice(0, 67) + '…' : url) +
    (button.card && cardAllowed(button) ? '  ·  ' + gettext('on_card') : '');
};

// A button's card. Collapsed by default (ui_btn_<p>_<r>_<b>): the preview, what
// the button does, delete and the chevron; open: every field. With every field
// always shown, two buttons already made the page very long (seen on the phone).
const buildButtonView = (button, pindex, rindex, bindex, context) => {
  const buttonsInRow = context.state.data.pages[pindex].rows[rindex].buttons.length;
  const openKey = 'ui_btn_' + pindex + '_' + rindex + '_' + bindex;
  const open = context.state.props.settingsStorage.getItem(openKey) === 'true';
  return View(
    {
      style: {
        border: '1px solid #d5d5d5',
        borderRadius: '8px',
        padding: '6px',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'column',
        // White: the row's content, against the row's grey
        background: '#ffffff'
      }
    },
    [
      // Top row: preview · reorder · delete.
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        View({ style: { flex: 1 } }, [
          TextInput({
            placeholder: gettext('buttonText'),
            bold: false,
            value: button.spacer ? gettext('**SPACER**') : button.text || gettext('**NO TEXT**'),
            labelStyle: { fontSize: '12px', display: 'none' },
            subStyle: {
              textAlign: 'center',
              fontSize: '16px',
              lineHeight: '32px',
              // != null / direct toColor, NOT ||: black is 0 (falsy).
              color: button.spacer ? toColor(COLOR_BLACK) : toColor(button.text_color != null ? button.text_color : COLOR_BLACK),
              background: button.spacer ? toColor(null) : toColor(button.back_color),
              borderRadius: button.radius ? (button.radius + 'px') : '0px'
            },
            maxLength: 200,
            onChange: (text) => {
              const t = unmark(text, '**NO TEXT**', '**SPACER**');
              if (t.length <= 200) context.editButton('text', t, pindex, rindex, bindex);
            }
          })
        ]),
        deleteX(context, 'btn:' + pindex + ':' + rindex + ':' + bindex, { marginLeft: '4px' }),
        Button({
          label: open ? '▾' : '◂',
          style: { fontSize: '18px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px', flexShrink: 0 },
          onClick: () => context.state.props.settingsStorage.setItem(openKey, open ? 'false' : 'true')
        })
      ]),
      ...confirmBar(context, 'btn:' + pindex + ':' + rindex + ':' + bindex,
        gettext('delete_button') + quoted(button.spacer ? gettext('is_spacer') : button.text) + '?', gettext('delete_action'),
        () => context.deleteButton(pindex, rindex, bindex)),
      // Collapsed: one line saying what the button does, and nothing else
      ...(!open ? [
        Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#555', padding: '4px 4px 0', wordBreak: 'break-all' } }, [buttonSummary(button)]),
        ...jsonOnlyNote(button)
      ] : [
      ...jsonOnlyNote(button),
      // ---- open: every field ----
      // Position in the row, on its own line: beside the preview it slid under
      // the delete × (seen on the phone), and with no title it read as an
      // empty field. Its title says where the button is.
      ...(buttonsInRow > 1 ? [
        Select({
          title: gettext('position') + (bindex + 1) + '/' + buttonsInRow,
          options: indexRange(bindex, buttonsInRow - 1),
          onChange: (value) => { if (value < 999) { context.moveButton(pindex, rindex, bindex, value); } }
        })
      ] : []),
      // Spacer toggle + width on one line (so the spacer switch isn't full-width).
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        View({ style: { flex: 1 } }, [
          Toggle({
            label: gettext('is_spacer'),
            value: button.spacer,
            subStyle: { color: '#333', fontSize: '10px' },
            onChange: (value) => context.editButton('spacer', value, pindex, rindex, bindex)
          })
        ]),
        View({ style: { flex: 1 } }, [
          Select({
            title: gettext('w') + button.w,
            value: button.w,
            options: wRange({ customValues: [16.66, 33.33, 66.66, 83.33] }),
            onChange: (value) => context.editButton('w', value, pindex, rindex, bindex)
          })
        ])
      ]),
      // STYLE — two columns (hidden for spacers, which have no visible content).
      ...(button.spacer ? [] : [
        View({ style: { display: 'flex', flexDirection: 'row' } }, [
          fieldCol([
            Slider({
              label: gettext('radius') + (button.radius != null ? button.radius : 0),
              min: 0, max: 100, step: 1,
              value: button.radius || 0,
              onChange: (value) => context.editButton('radius', value, pindex, rindex, bindex)
            })
          ]),
          fieldCol([
            Select({
              title: gettext('text_size') + (button.text_size != null ? button.text_size : 'default'),
              value: button.text_size,
              options: tSizeRange(),
              onChange: (value) => context.editButton('text_size', value, pindex, rindex, bindex)
            })
          ])
        ]),
        // The colors full width: open, their grid needs it
        colorPicker(context, 'btn:' + pindex + ':' + rindex + ':' + bindex + ':back', gettext('back_color'), button.back_color,
          (c) => context.editButton('back_color', c, pindex, rindex, bindex)),
        colorPicker(context, 'btn:' + pindex + ':' + rindex + ':' + bindex + ':text', gettext('text_color'), button.text_color,
          (c) => context.editButton('text_color', c, pindex, rindex, bindex))
      ]),
      // FUNCTIONS (hidden for spacers), below a divider. The URL first, full
      // width; method and timeout side by side; the choices as buttons (auth,
      // response, keyboard: a Select shows nothing closed and takes two lines);
      // every text field with its label (a value alone, e.g. "url", didn't say
      // which field it was).
      ...(button.spacer ? [] : [
        View({ style: { display: 'flex', flexDirection: 'column', borderTop: '1px solid #d5d5d5', marginTop: '8px', paddingTop: '2px' } }, [
          textField(gettext('field_url'), button.request.url, 'insert_url', 200, '**URL**',
            (v) => context.editButton('url', v.trim() || null, pindex, rindex, bindex)),
          View({ style: { display: 'flex', flexDirection: 'row', marginTop: '4px' } }, [
            View({ style: { flex: 1 } }, [
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
              })
            ]),
            View({ style: { flex: 1, marginLeft: '8px' } }, [
              Select({
                title: gettext('timeout') + ': ' + (button.request.timeout ? timeoutLabel(button.request.timeout) : gettext('timeout_default')),
                value: button.request.timeout,
                options: timeoutRange(),
                onChange: (value) => context.editButton('timeout', value, pindex, rindex, bindex)
              })
            ])
          ]),
          ...buildAuthFields(button, pindex, rindex, bindex, context),
          textField(gettext('field_headers'), button.request.headers, 'insert_headers', 200, '**HEADERS**',
            (v) => context.editButton('headers', v, pindex, rindex, bindex)),
          textField(gettext('field_body'), button.request.body, 'insert_body', 200, '**BODY**',
            (v) => context.editButton('body', v, pindex, rindex, bindex)),
          textField(gettext('field_parse_result'), button.request.parse_result, 'insert_parse_result', 200, '**parse_result**',
            (v) => context.editButton('parse_result', v, pindex, rindex, bindex)),
          // No style set: the watch shows a system toast
          fieldLabel(gettext('response_style')),
          choice(responseStyles(), responseStyleValue(button.request.response_style),
            (value) => context.editButton('response_style', value, pindex, rindex, bindex), 3),
          // Input: the switch, and beside it the keyboard when it's on
          View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '6px' } }, [
            View({ style: { flex: 1 } }, [
              Toggle({
                label: gettext('is_input'),
                value: button.input,
                subStyle: { color: '#333', fontSize: '10px' },
                onChange: (value) => context.editButton('input', value, pindex, rindex, bindex)
              })
            ]),
            View({ style: { flex: 1, marginLeft: '8px' } }, button.input ? [
              choice([{ name: 'abc', value: KB_TYPE_CHAR }, { name: '123', value: KB_TYPE_NUMERIC }],
                Number(button.keyboard_type || KB_TYPE_CHAR),
                (value) => context.editButton('keyboard_type', value, pindex, rindex, bindex))
            ] : [])
          ]),
          // On the watch's shortcut card (app-widget/index.js), up to CARD_MAX
          ...(cardAllowed(button) ? [
            View({ style: { marginTop: '6px' } }, [
              Toggle({
                label: gettext('show_on_card'),
                value: !!button.card,
                subStyle: { color: '#333', fontSize: '10px' },
                onChange: (value) => context.setOnCard(pindex, rindex, bindex, value)
              })
            ])
          ] : [])
        ])
      ])
      ]) // ---- end of the open card ----
    ]
  );
};

// Auth as choice buttons ("—" none, Basic, Bearer, Digest; none is stored as
// '--', as the Select did), then its fields: user and password, or the token
const buildAuthFields = (button, pindex, rindex, bindex, context) => {
  const auth = button.request.auth || '--';
  const fields = [
    fieldLabel(gettext('auth_title')),
    choice([
      { name: '—', value: '--' },
      { name: 'Basic', value: 'Basic' },
      { name: 'Bearer', value: 'Bearer' },
      { name: 'Digest', value: 'Digest' }
    ], auth, (value) => context.editButton('auth', value, pindex, rindex, bindex))
  ];
  if (auth === 'Basic' || auth === 'Digest') {
    fields.push(
      textField(gettext('field_user'), button.request.user, 'user', 200, '**USER**',
        (v) => context.editButton('user', v, pindex, rindex, bindex)),
      textField(gettext('field_pass'), button.request.pass, 'pass', 400, '**PASS**',
        (v) => context.editButton('pass', v, pindex, rindex, bindex), { secret: true })
    );
  }
  if (auth === 'Bearer') {
    fields.push(
      textField(gettext('field_token'), button.request.token, 'token', 512, '**TOKEN**',
        (v) => context.editButton('token', v, pindex, rindex, bindex), { secret: true })
    );
  }
  return fields;
};

// === MINIATURES of collapsed pages and rows ===
// Drawn as the watch draws them (page/index.[pf].layout.js): rows share the
// screen by their height %, buttons share the row by their width % (sums over
// 100 are split evenly, as the watch does), each button with its colors, text
// and radius; a spacer is an empty slot. The names alone said nothing of the
// sizes.
const MINI_SCREEN = 180;              // px, the page miniature's height
const MINI_SCALE = MINI_SCREEN / 480; // the default: a 480 px watch
// The watch's screen as the side service saved it (shape, width, height), or
// null before the watch ever asked for its config
const watchScreen = (storage) => {
  try {
    const s = JSON.parse(storage.getItem('watch_screen') || 'null');
    return s && (s.shape === 'round' || s.shape === 'square') && s.width > 0 && s.height > 0 ? s : null;
  } catch (e) { return null; }
};
const MINI_ROW_H = 34;                // px, the strip of a collapsed row
const evenOver100 = (values) => {
  const nums = values.map((v) => Number(v) || 0);
  return nums.reduce((a, b) => a + b, 0) > 100 ? nums.map(() => 100 / nums.length) : nums;
};
const colorOr = (c, fallback) => toColor(c !== undefined && c !== null && c !== '' ? Number(c) : fallback);
// pad: the space around each button, in miniature px ({ x, y }): the watch
// leaves BTN_PADDING / ROW_PADDING (12 px, or the page's button_padding /
// row_padding) on each side of a button inside its slot
const miniPad = (page, scale) => ({
  x: ((page && Number(page.button_padding)) || BTN_PADDING) * scale,
  y: ((page && Number(page.row_padding)) || ROW_PADDING) * scale
});
const miniButtons = (row, scale = MINI_SCALE, pad = { x: 1, y: 1 }) => {
  const buttons = (row && row.buttons) || [];
  const widths = evenOver100(buttons.map((b) => b.w));
  return buttons.map((b, i) => View({ style: { width: widths[i] + '%', flex: '0 0 ' + widths[i] + '%', height: '100%', padding: pad.y.toFixed(1) + 'px ' + pad.x.toFixed(1) + 'px', boxSizing: 'border-box' } },
    b.spacer ? [] : [
      View({ style: {
        width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colorOr(b.back_color, COLOR_GRAY),
        borderRadius: Math.round((b.radius != null ? Number(b.radius) : BTN_RADIUS) * scale) + 'px'
      } }, [
        Text({ style: { fontSize: '9px', lineHeight: '11px', color: colorOr(b.text_color, COLOR_WHITE), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' } }, [b.text || ''])
      ])
    ]));
};

// A collapsed row: a strip of its buttons on the page's background
const buildRowSummary = (row, page) => {
  if (!row.buttons || !row.buttons.length) {
    return Text({ align: 'center', style: { fontSize: '13px', color: '#666', padding: '4px 8px' } }, ['(no buttons)']);
  }
  return View({ style: { display: 'flex', flexDirection: 'row', height: MINI_ROW_H + 'px', margin: '4px 6px 2px', padding: '2px', borderRadius: '6px', overflow: 'hidden', background: colorOr(page && page.back_color, COLOR_BLACK) } },
    // the watch's horizontal space between buttons; little vertical space in a strip
    miniButtons(row, MINI_SCALE, { x: miniPad(page, MINI_SCALE).x, y: 1 }));
};

// Row header — all controls on one line: Row:N (emphasized) · reorder · height
// · delete (×) · collapse chevron (open = show buttons; Add Button is under them).
const buildRowView = (row, page, pindex, rindex, context, rowOpen) => {
  // The row's title bar: across the top of the row's container (its negative
  // margins cancel the container's padding), darker, a line under it. As a
  // box of its own it read as one more item beside the buttons.
  return View(
    {
      style: {
        margin: '0 -6px 6px',
        padding: '6px 8px',
        borderBottom: '1px solid #c9c9c9',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        background: '#dcdcdc'
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
            title: gettext('move_title'),
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
      deleteX(context, 'row:' + pindex + ':' + rindex, { marginLeft: '4px' }),
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

// A collapsed page: a small screen with its title and rows (the title takes
// 50 px on the watch). With the watch's screen known: a circle for a round
// one (the corners cut, as on the watch), its proportions for a square one
// (e.g. 390x450); else a rounded square.
const buildPageSummary = (page, screen) => {
  const rows = page.rows || [];
  const heights = evenOver100(rows.map((r) => r.h));
  const H = MINI_SCREEN;
  const W = screen ? Math.round(MINI_SCREEN * screen.width / screen.height) : MINI_SCREEN;
  const scale = screen ? H / screen.height : MINI_SCALE;
  const round = !!screen && screen.shape === 'round';
  const titleH = page.title ? Math.round(50 * scale) : 0;
  return View({ style: { display: 'flex', justifyContent: 'center', padding: '6px 0 2px' } }, [
    View({ style: {
      width: W + 'px', height: H + 'px', borderRadius: round ? '50%' : (screen ? '16px' : '12px'), overflow: 'hidden',
      display: 'flex', flexDirection: 'column', background: colorOr(page.back_color, COLOR_BLACK), border: '1px solid #bbb'
    } }, [
      ...(page.title ? [
        Text({ align: 'center', style: { height: titleH + 'px', lineHeight: titleH + 'px', fontSize: '11px', fontWeight: '600', color: colorOr(page.text_color, COLOR_WHITE), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px', flex: '0 0 ' + titleH + 'px' } }, [page.title])
      ] : []),
      View({ style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
        rows.map((row, i) => View({ style: { height: heights[i] + '%', flex: '0 0 ' + heights[i] + '%', display: 'flex', flexDirection: 'row', boxSizing: 'border-box' } }, miniButtons(row, scale, miniPad(page, scale)))))
    ])
  ]);
};

// Page header. Title (editable, with the page's own colors as a preview) sits
// above the reorder select (hidden when there's a single page), with a collapse
// chevron on the right. The color/delete/add-row controls show only when open.
const buildPageView = (page, pindex, context, pageOpen, pageCount, screen) => {
  const chevron = Button({
    label: pageOpen ? '▾' : '◂',
    style: { fontSize: '18px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px' },
    onClick: () => context.state.props.settingsStorage.setItem('ui_page_' + pindex, pageOpen ? 'false' : 'true')
  });
  // Collapsed: only the miniature (it shows the title in its colors), with
  // delete and the chevron beside it; the title field, Move to… and the
  // colors are for the open page
  if (!pageOpen) {
    return View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
      View({ style: { flex: 1 } }, [buildPageSummary(page, screen)]),
      View({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [
        deleteX(context, 'page:' + pindex, { marginLeft: '4px' }),
        View({ style: { marginTop: '8px' } }, [chevron])
      ])
    ]);
  }
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
              lineHeight: '32px', // match the 32px delete/chevron buttons on this row
              // != null, NOT ||: black is 0 (falsy), so `back_color || WHITE`
              // would turn a black background white.
              color: toColor(page.text_color != null ? page.text_color : COLOR_BLACK),
              background: toColor(page.back_color != null ? page.back_color : COLOR_WHITE)
            },
            maxLength: 200,
            onChange: (title) => {
              const t = unmark(title, '**NO TEXT**');
              if (t.length <= 200) context.editPage('title', t, pindex);
            }
          }),
          ...(pageCount > 1 ? [
            Select({
              title: gettext('move_title'),
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
        deleteX(context, 'page:' + pindex, { marginLeft: '4px' }),
        chevron
      ]),
      // Editing controls, only when the page is expanded: page colors. (Add Row
      // lives at the bottom of the row list, like Add Page after the pages.)
      ...(pageOpen ? [
        colorPicker(context, 'page:' + pindex + ':back', gettext('back_color'), page.back_color,
          (c) => context.editPage('back_color', c, pindex)),
        colorPicker(context, 'page:' + pindex + ':text', gettext('text_color'), page.text_color,
          (c) => context.editPage('text_color', c, pindex))
      ] : [])
    ]
  );
};

// The app's logo, drawn like the miniatures: the icon's three buttons
// (assets/*/icon.png: "HT" and "TP" round, "Buttons" orange, in the palette's
// green, dark red and orange) in a line, without the icon's dark disc. Drawn,
// not an image: sharp at any size, nothing to load.
const LOGO_H = 64;   // px, the height of the three buttons (~325 px wide in all)
const appLogo = () => {
  const h = LOGO_H, gap = Math.round(h * 0.22) + "px";
  const label = (text) => Text({ style: { color: "white", fontSize: Math.round(h * 0.42) + "px", fontWeight: "500", lineHeight: "1" } }, [text]);
  const round = (text, color, first) => View({ style: {
    width: h + "px", height: h + "px", borderRadius: "50%", background: toColor(color), marginLeft: first ? "0" : gap,
    display: "flex", alignItems: "center", justifyContent: "center"
  } }, [label(text)]);
  return View({ style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" } }, [
    round("HT", COLOR_GREEN, true),
    round("TP", COLOR_RED, false),
    View({ style: {
      marginLeft: gap, height: h + "px", padding: "0 " + Math.round(h * 0.35) + "px", borderRadius: Math.round(h * 0.2) + "px",
      background: toColor(COLOR_ORANGE), display: "flex", alignItems: "center", justifyContent: "center"
    } }, [Text({ style: { color: "white", fontSize: Math.round(h * 0.5) + "px", fontWeight: "500", lineHeight: "1" } }, ["Buttons"])])
  ]);
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
  // A rename onto an existing name replaced that variable silently: refused,
  // like an empty name or one with braces (it is written {name} in requests).
  // The buttons using {oldkey} are not changed.
  editGlobalVariableKey(oldkey, newkey) {
    const name = String(newkey == null ? '' : newkey).trim();
    if (!name || name === oldkey) return;
    if (/[{}]/.test(name)) return this.notify('var_bad_name');
    if (Object.prototype.hasOwnProperty.call(this.state.data.variables, name)) return this.notify('var_exists');
    let temp = this.state.data.variables[oldkey];
    this.state.data.variables[name] = temp;
    delete this.state.data.variables[oldkey];
    this.setItem()
  },
  // A button on the shortcut card or off it; refused past CARD_MAX
  setOnCard(pindex, rindex, bindex, on) {
    const btn = this.state.data.pages[pindex].rows[rindex].buttons[bindex];
    if (on && !btn.card && cardButtons(this.state.data).length >= CARD_MAX) return this.notify('card_full');
    this.editButton('card', !!on, pindex, rindex, bindex);
  },
  // A message for the user (an i18n key), shown by the Toast at the bottom of
  // the page: a Toast returned from an onChange is not drawn
  notify(key) {
    this.state.props.settingsStorage.setItem('ui_notice', key);
  },
  deleteGlobalVariable(key) {
    delete this.state.data.variables[key]
    this.setItem()
  },
  // Global fetch timeout (data.timeout, ms). undefined = app default: delete
  // the key so the config doesn't carry a redundant value.
  // The buttons' loading animation (utils/button-loader.js); the default
  // (pulsing border) is stored as no key at all
  editLoadingStyle(style) {
    if (style && style !== LOADING_STYLE_PULSE) {
      this.state.data.loading_style = style;
    } else {
      delete this.state.data.loading_style;
    }
    this.setItem()
  },
  editGlobalTimeout(ms) {
    if (ms) {
      this.state.data.timeout = ms;
    } else {
      delete this.state.data.timeout;
    }
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
    this.reorderPages(withoutIndex(this.state.data.pages.length, index))
  },
  // Moves the page (it used to swap it with the target, unlike rows and buttons)
  movePage(pindex, toindex) {
    const pages = this.state.data.pages;
    const to = Number(toindex);
    if (pindex < 0 || pindex >= pages.length || !(to >= 0) || to >= pages.length || pindex === to) return;
    this.reorderPages(movedIndex(pages.length, pindex, to))
  },
  // The pages in `order` (old indexes), their open state with them
  reorderPages(order) {
    const st = this.state.props.settingsStorage;
    if (st.getItem(COLOR_OPEN_KEY)) st.removeItem(COLOR_OPEN_KEY);
    const pages = this.state.data.pages;
    const before = openUiKeys(st, pages);
    applyUiKeys(st, before, pagesUiAfter(before, pages, order));
    this.state.data.pages = order.map((i) => pages[i]);
    this.setItem()
  },
  // The rows of a page in `order` (old indexes), their open state with them
  reorderRows(pindex, order) {
    const st = this.state.props.settingsStorage;
    if (st.getItem(COLOR_OPEN_KEY)) st.removeItem(COLOR_OPEN_KEY);
    const page = this.state.data.pages[pindex];
    const before = openUiKeys(st, this.state.data.pages);
    applyUiKeys(st, before, rowsUiAfter(before, this.state.data.pages, pindex, order));
    page.rows = order.map((i) => page.rows[i]);
    this.setItem()
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
    this.reorderRows(pindex, withoutIndex(this.state.data.pages[pindex].rows.length, rindex))
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
    const to = Number(toIndex);
    if (fromIndex >= rows.length || !(to >= 0) || to >= rows.length || fromIndex < 0 || fromIndex === to) {
      return;
    }
    this.reorderRows(pindex, movedIndex(rows.length, fromIndex, to))
  },
  addButton(pageindex, rowindex) {
    let button = clone(DEFAULT_BUTTON);
    const buttons = this.state.data.pages[pageindex].rows[rowindex].buttons;
    buttons.push(button);
    // Open, to be edited (buttons are collapsed by default)
    this.state.props.settingsStorage.setItem('ui_btn_' + pageindex + '_' + rowindex + '_' + (buttons.length - 1), 'true');
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
      // undefined (the "default" choice) is dropped by JSON.stringify in
      // setItem, so the key disappears from the config instead of lingering.
      case 'timeout': btn.request.timeout = val; break;
      case 'auth': btn.request.auth = val; break;
      case 'user': btn.request.user = val; break;
      case 'pass': btn.request.pass = val; break;
      case 'token': btn.request.token = val; break;
      case 'input': btn.input = val; break;
      case 'keyboard_type': btn.keyboard_type = val; break;
      // The key only when on: a config without cards stays as it was
      case 'card': if (val) btn.card = true; else delete btn.card; break;
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
    const to = Number(toIndex);
    if (fromIndex >= buttons.length || !(to >= 0) || to >= buttons.length || fromIndex < 0 || fromIndex === to) {
      return;
    }
    this.reorderButtons(pindex, rindex, movedIndex(buttons.length, fromIndex, to))
  },
  deleteButton(pindex, rindex, bindex) {
    this.reorderButtons(pindex, rindex, withoutIndex(this.state.data.pages[pindex].rows[rindex].buttons.length, bindex))
  },
  // The buttons of a row in `order` (old indexes), their open state with them
  reorderButtons(pindex, rindex, order) {
    const st = this.state.props.settingsStorage;
    if (st.getItem(COLOR_OPEN_KEY)) st.removeItem(COLOR_OPEN_KEY);
    const row = this.state.data.pages[pindex].rows[rindex];
    const before = openUiKeys(st, this.state.data.pages);
    applyUiKeys(st, before, buttonsUiAfter(before, pindex, rindex, order));
    row.buttons = order.map((i) => row.buttons[i]);
    this.setItem()
  },
  setItem() {
    const newString = JSON.stringify(this.state.data)
    const st = this.state.props.settingsStorage
    // A question still asked is about a position that may have changed
    if (st.getItem(CONFIRM_KEY)) st.removeItem(CONFIRM_KEY)
    st.setItem('data', newString)
  },
  setState(props) {
    this.state.props = props
    const rawData = props.settingsStorage.getItem('data');
    const dt = tryParseJSON(rawData);

    if (dt) {
      this.state.is_conf_error = false;
      if (Array.isArray(dt)) {
        this.state.data = dt[0] || clone(DEFAULT_DATA);
      } else if (typeof dt === 'object') {
        this.state.data = dt;
      } else {
        this.state.is_conf_error = true;
        this.state.data = clone(DEFAULT_DATA);
      }
    } else if (rawData) {
      this.state.is_conf_error = true;
      this.state.data = clone(DEFAULT_DATA);
    } else {
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
    // Header: the app's logo (it carries the name: no title under it) and
    // what the page is for
    const welcomeText = View({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 10px 8px' }}, [
      appLogo(),
      Text({ bold: false, align: 'center', paragraph: true, style: { fontSize: '14px', color: '#555', padding: '12px 4px 0' }},
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
      label: gettext('add_variable'),
      style: { fontSize: '13px', fontWeight: '500', borderRadius: '30px', background: toColor(COLOR_GREEN), color: 'white', padding: '4px 22px' },
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
    // Re-Init: two taps too (the question says what it does)
    const clearBTN = View({ style: { display: 'flex', flexDirection: 'column', marginTop: '18px' }}, [
      Button({
        label: gettext('delete_storage'),
        style: { width: '100%', fontSize: '14px', fontWeight: '600', borderRadius: '24px', background: '#db2c2c', color: 'white' },
        onClick: () => askingFor(this, 'reinit') ? props.settingsStorage.removeItem(CONFIRM_KEY) : props.settingsStorage.setItem(CONFIRM_KEY, 'reinit')
      }),
      ...confirmBar(this, 'reinit', gettext('reinit_question'), gettext('delete_storage'), () => this.deleteState())
    ]);

    // Collapsible advanced JSON editor. Pretty-printed + multi-line so users can
    // read it, select-all + copy for a backup, or paste an edited config back.
    // Saved automatically while the JSON parses; invalid JSON just toasts and is
    // not saved. Keeps the old "select all + copy" capability, made usable.
    const jsonOpen = props.settingsStorage.getItem('ui_json_open') === 'true';
    const confBTN = Section({ style: { marginTop: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }}, [
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' }}, [
        Text({ bold: true, align: 'left', style: { flex: 1, fontSize: '16px' }}, [gettext('conf')]),
        Button({
          label: jsonOpen ? '▾' : '◂',
          style: { fontSize: '18px', fontWeight: '700', minWidth: '32px', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e0e0', color: '#333', padding: '0', marginLeft: '4px' },
          onClick: () => this.state.props.settingsStorage.setItem('ui_json_open', jsonOpen ? 'false' : 'true')
        })
      ]),
      ...(jsonOpen ? [
        Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#666', padding: '4px 2px' }}, [gettext('conf_hint')]),
        TextInput({
          multiline: true,
          rows: 14,
          value: JSON.stringify(this.state.data, null, 2),
          // pre-wrap keeps the pretty-print line breaks/indentation in the inline
          // preview (default white-space:normal collapsed them onto one line).
          subStyle: { fontSize: '12px', color: COLOR_BLACK, whiteSpace: 'pre-wrap' },
          onChange: (value) => {
            // Saved only as the watch can use it: an object with a "pages"
            // list (the watch's own check). Anything else stays unsaved, with a
            // message (notify: a Toast returned from here isn't drawn)
            const parsed = tryParseJSON(value);
            if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.pages)) {
              this.state.props.settingsStorage.setItem('data', JSON.stringify(parsed));
            } else if (value && value.trim()) {
              this.notify(parsed ? 'json_no_pages' : 'invalid_json');
            }
          }
        })
      ] : [])
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

    // Global request timeout — how long every HTTP request (and the image
    // download) may run before failing. Each button's own Timeout select
    // overrides it. Shown as a card between the pages and the JSON editor.
    const globalTimeoutMs = this.state.data && this.state.data.timeout;
    const timeoutCard = Section({ style: { marginTop: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }}, [
      Text({ bold: true, align: 'left', style: { fontSize: '16px' }}, [gettext('timeout_global')]),
      // 8 choices, 4 per line ("default" is 10 s: the hint below says so;
      // longer, it would wrap in a quarter of the width)
      choice(
        timeoutRange(),
        globalTimeoutMs || undefined,
        (value) => this.editGlobalTimeout(value),
        4
      ),
      // A value set in the JSON that no button stands for
      ...(globalTimeoutMs && !timeoutRange().some((o) => o.value === globalTimeoutMs) ? [
        Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#333', padding: '6px 2px 0' }}, [gettext('timeout') + ': ' + timeoutLabel(globalTimeoutMs)])
      ] : []),
      Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#666', padding: '4px 2px' }}, [gettext('timeout_hint')]),
      Link({ source: GITHUB_URL + '#async-jobs-polling', style: { fontSize: '12px', color: '#409EFF' }}, [gettext('open_readme')])
    ])

    // The buttons' loading animation, for every button (config loading_style)
    const loadingStyles = [
      { name: gettext('loading_pulse'), value: LOADING_STYLE_PULSE },
      { name: gettext('loading_border'), value: LOADING_STYLE_BORDER },
      { name: gettext('loading_corner'), value: LOADING_STYLE_CORNER },
    ]
    const currentLoading = (this.state.data && this.state.data.loading_style) || LOADING_STYLE_PULSE
    const loadingCard = Section({ style: { marginTop: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }}, [
      Text({ bold: true, align: 'left', style: { fontSize: '16px' }}, [gettext('loading_style')]),
      choice(loadingStyles, currentLoading, (value) => this.editLoadingStyle(value)),
      Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#666', padding: '4px 2px' }}, [gettext('loading_hint')])
    ])

    // Logs box (shared rule, ../_shared/zeppos-ai-doc/logging.md): the latest
    // watch ([w]) and phone lines, already scrubbed by the side service. A
    // multi-line TextInput because a Text can't be selected; its changes are
    // ignored. Each log write rebuilds this page while it is open.
    let logLines = []
    try { logLines = JSON.parse(props.settingsStorage.getItem(LOG_KEY) || '[]') } catch (e) { logLines = [] }
    const logsCard = Section({ style: { marginTop: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }}, [
      Text({ bold: true, align: 'left', style: { fontSize: '16px' }}, [gettext('logs_title') + ' (' + logLines.length + ')']),
      Text({ align: 'left', paragraph: true, style: { fontSize: '12px', color: '#666', padding: '4px 2px' }},
        [gettext(logLines.length ? 'logs_hint' : 'logs_empty')]),
      ...(logLines.length ? [
        TextInput({
          label: gettext('logs_copy'),
          value: logLines.join('\n'),
          multiline: true,
          rows: 8,
          labelStyle: { fontSize: '12px', color: '#666' },
          subStyle: { fontSize: '11px', fontFamily: 'monospace', color: COLOR_BLACK, whiteSpace: 'pre-wrap', maxHeight: '240px', overflow: 'hidden' },
          onChange: () => {}
        }),
        View({ style: { display: 'flex', justifyContent: 'center', margin: '8px 0 2px' }}, [
          Button({
            label: gettext('logs_clear'),
            style: { fontSize: '13px', fontWeight: '500', borderRadius: '30px', background: '#ababab', color: 'white', padding: '4px 22px' },
            onClick: () => this.state.props.settingsStorage.removeItem(LOG_KEY)
          })
        ])
      ] : [])
    ])

    // Footer — GitHub link (app name + version), same shape as the sibling
    // companion apps' settings footers.
    const footer = View({ style: { marginTop: '30px', marginBottom: '20px', textAlign: 'center', padding: '15px', borderTop: '1px solid #dee2e6' }}, [
      Link({ source: GITHUB_URL, style: { fontSize: '12px', color: '#6c757d' }}, [gettext('title_text') + ' v' + APP_VERSION]),
      Text({ style: { fontSize: '16px', color: '#adb5bd', marginTop: '5px' }}, [' | ' + gettext('made_with_love')])
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
              deleteX(this, 'var:' + vindex)
            ])
          )
          contentVariables.push(...confirmBar(this, 'var:' + vindex, gettext('delete_variable_q') + quoted(vindex) + '?', gettext('delete_action'), () => this.deleteGlobalVariable(vindex)))
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
        const pageChildren = [
          buildPageView(page, pindex, this, pageOpen, pages.length, watchScreen(props.settingsStorage)),
          ...confirmBar(this, 'page:' + pindex, gettext('delete_page') + quoted(page.title || String(pindex + 1)) + '?', gettext('delete_action'), () => this.deletePage(pindex))
        ];
        if (pageOpen) {
          for (let [rindex, row] of page.rows.entries()) {
            // Each row is itself collapsible: open → button editors; collapsed →
            // a one-line summary of the button names. UI-only key, default closed.
            const rowOpen = this.state.props.settingsStorage.getItem('ui_row_' + pindex + '_' + rindex) === 'true';
            const rowChildren = [
              buildRowView(row, page, pindex, rindex, this, rowOpen),
              ...confirmBar(this, 'row:' + pindex + ':' + rindex, gettext('delete_row') + ' ' + (rindex + 1) + '?', gettext('delete_action'), () => this.deleteRow(pindex, rindex))
            ];
            if (rowOpen) {
              for (let [bindex, button] of row.buttons.entries()) {
                rowChildren.push(buildButtonView(button, pindex, rindex, bindex, this));
              }
              // Add Button under the buttons, centered, like Add Row under the
              // rows and Add Page under the pages (it was a "+" in the row's bar)
              rowChildren.push(
                View({ style: { display: 'flex', justifyContent: 'center', margin: '4px 0 2px' }}, [
                  Button({
                    label: gettext('add_button'),
                    style: { fontSize: '13px', fontWeight: '500', borderRadius: '30px', background: '#ababab', color: 'white', padding: '4px 22px' },
                    onClick: () => this.addButton(pindex, rindex)
                  })
                ])
              );
            } else {
              rowChildren.push(buildRowSummary(row, page));
            }
            pageChildren.push(
              View({ style: { border: '1px solid #c9c9c9', borderRadius: '10px', padding: '0 6px 6px', marginBottom: '10px', background: '#f0f0f0', overflow: 'hidden' }}, rowChildren)
            );
          }
          // Add Row at the bottom of the rows (like Add Page after the pages).
          pageChildren.push(
            View({ style: { display: 'flex', justifyContent: 'center', margin: '8px 0 2px' }}, [
              Button({
                label: gettext('add_row'),
                style: { fontSize: '13px', fontWeight: '500', borderRadius: '30px', background: '#ababab', color: 'white', padding: '4px 22px' },
                onClick: () => this.addRow(pindex)
              })
            ])
          );
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
      return View({ style: { padding: '12px 20px' }}, [conf_error, logsEnabled() && logsCard])
    } else {
      return View({ style: { padding: '12px 5px' }}, [
        welcomeText,
        // Variables in a card Section; the "Variables (N)" toggle inside is the
        // header (collapsed by default), so the Section itself has no title.
        contentVariables.length > 0 && Section({ style: { marginTop: '12px', padding: '8px', border: '1px solid #d5d5d5', borderRadius: '12px', background: '#ffffff' }},
          [...contentVariables]),
        ...contentItems,
        timeoutCard,
        loadingCard,
        confBTN,
        clearBTN,
        testModeSwitch,
        // Not in public releases (config.js LOG_LEVEL 'off')
        logsEnabled() && logsCard,
        footer,
        // Rendered here (a Toast returned from an onChange is ignored): the
        // message set by notify() (JSON editor, variable rename)
        Toast({
          message: gettext(props.settingsStorage.getItem('ui_notice') || 'invalid_json'),
          // The default 2 s was too short to read a sentence (seen on the phone)
          duration: 6000,
          visible: !!props.settingsStorage.getItem('ui_notice'),
          onClose: () => this.state.props.settingsStorage.removeItem('ui_notice')
        })
      ])
    }
  }
})