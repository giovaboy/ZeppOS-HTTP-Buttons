import { gettext } from 'i18n'
import { DEFAULT_BUTTON, DEFAULT_ROW, DEFAULT_DATA, DEFAULT_PAGE, COLOR_BLACK, COLOR_BLUE, COLOR_GRAY, COLOR_GREEN, COLOR_INDIGO, COLOR_ORANGE, COLOR_RED, COLOR_VIOLET, COLOR_WHITE, COLOR_YELLOW, SYSTEM_TOAST, CUSTOM_TOAST, SYSTEM_MODAL, NO_NOTIFICATION } from '../utils/constants.js'

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


function validateURL(str) {//TODO: fix for variables {}
  if (str == gettext('**URL**')) {
    return false;
  } else {
    const pattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR IP (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', // fragment locator
      'i'
    );
    //return pattern.test(str);
    return true
  }
}

function toColor(num) {
  let colorString = undefined;
  if (num != null) {
    colorString = "#" + num.toString(16).padStart(6, '0');
  }
  return colorString;
}

const wRange = (options = {}) => {
// Usage: wRange({ customValues: [33.33, 66.67] })
  const {
    limit = 100,
    step = 1,
    start = 0,
    customValues = []
  } = options;

  let arr = [];

  // Generate the regular range
  for (let i = start; i <= limit; i = i + step) {
    arr.push({
      name: i.toString(),
      value: i
    });
  }

  // Add custom values
  customValues.forEach(val => {
    arr.push({
      name: val.toString(),
      value: val
    });
  });

  // Sort by value and remove duplicates
  arr.sort((a, b) => a.value - b.value);
  arr = arr.filter((item, index, self) =>
    index === self.findIndex(t => t.value === item.value)
  );

  return arr;
}

function indexRange(index, limit) {
  let arr = [];
  const step = 1;

  //arr.push({ name: '--', value: 999 })
  for (let i = 0; i <= limit; i = i + step) {
    if (i !== index) {
      arr.push({
        name: gettext('move_to') + (i + 1).toString(),
        value: i
      })
    }
  };
  return (arr)
}

const tSizeRange = () => {
  let arr = [];
  const limit = 80;
  const step = 2;

  arr.push({ name: 'default', value: undefined })

  for (let i = 10; i <= limit; i = i + step) {
    arr.push({
      name: i.toString() + 'px',
      value: i
    })
  };
  return (arr)
}

const colors = () => {
  let arr = [
    { name: 'black', value: COLOR_BLACK },
    { name: 'white', value: COLOR_WHITE },
    { name: 'orange', value: COLOR_ORANGE },
    { name: 'red', value: COLOR_RED },
    { name: 'green', value: COLOR_GREEN },
    { name: 'blue', value: COLOR_BLUE },
    { name: 'yellow', value: COLOR_YELLOW },
    { name: 'indigo', value: COLOR_INDIGO },
    { name: 'violet', value: COLOR_VIOLET },
    { name: 'gray', value: COLOR_GRAY }
  ]

  return (arr)
}

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
    this.state.data.pages = this.state.data.pages.filter((_, ind) => {
      return ind !== index
    })
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
    this.state.data.pages[pindex].rows = this.state.data.pages[pindex].rows.filter((_, ind) => {
      return ind !== rindex
    })
    this.setItem()
  },
  swapRows(pindex, rindex, toindex) {
    const rows = this.state.data.pages[pindex].rows;

    // Bounds checking
    if (rindex >= rows.length || toindex >= rows.length ||
        rindex < 0 || toindex < 0 || rindex === toindex) {
      return;
    }

    // Swap the rows
    const temp = rows[rindex];
    rows[rindex] = rows[toindex];
    rows[toindex] = temp;

    this.setItem();
  },
  moveRow(pindex, fromIndex, toIndex) {
    const rows = this.state.data.pages[pindex].rows;

    // Bounds checking
    if (fromIndex >= rows.length || toIndex >= rows.length || 
        fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    // Remove the row from its current position
    const rowToMove = rows.splice(fromIndex, 1)[0];

    // Insert it at the new position
    rows.splice(toIndex, 0, rowToMove);

    this.setItem();
  },
  addButton(pageindex, rowindex) {
    let button = DEFAULT_BUTTON;
    this.state.data.pages[pageindex].rows[rowindex].buttons.push(button);
    this.setItem()
  },
  editButton(prop, val, pindex, rindex, bindex) {
    switch (prop) {
      case 'text':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].text = val;
        break;
      case 'spacer':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].spacer = val;
        break;
      case 'w':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].w = val;
        break;
      case 'radius':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].radius = val;
        break;
      case 'back_color':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].back_color = val;
        break;
      case 'text_color':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].text_color = val;
        break;
      case 'text_size':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].text_size = val
        break;
      case 'url':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.url = val;
        break;
      case 'method':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.method = val;
        break;
      case 'headers':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.headers = val;
        break;
      case 'body':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.body = val;
        break;
      case 'parse_result':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.parse_result = val;
        break;
      case 'response_style':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.response_style = val;
        break;
      case 'auth':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.auth = val;
        break;
      case 'user':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.user = val;
        break;
      case 'pass':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.pass = val;
        break;
      case 'token':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].request.token = val;
        break;
      case 'input':
        this.state.data.pages[pindex].rows[rindex].buttons[bindex].input = val;
        break;
    }
    this.setItem()
  },
  swapButtons(pindex, rindex, bindex, toindex) {
    const buttons = this.state.data.pages[pindex].rows[rindex].buttons;

    // Bounds checking
    if (bindex >= buttons.length || toindex >= buttons.length || bindex < 0 || toindex < 0) {
      return;
    }

    // Swap the buttons
    const temp = buttons[bindex];
    buttons[bindex] = buttons[toindex];
    buttons[toindex] = temp;

    this.setItem();
  },
  moveButton(pindex, rindex, fromIndex, toIndex) {
    const buttons = this.state.data.pages[pindex].rows[rindex].buttons;

    // Bounds checking
    if (fromIndex >= buttons.length || toIndex >= buttons.length ||
        fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    // Remove the button from its current position
    const buttonToMove = buttons.splice(fromIndex, 1)[0];

    // Insert it at the new position
    buttons.splice(toIndex, 0, buttonToMove);

    this.setItem();
  },
  deleteButton(pindex, rindex, bindex) {
    this.state.data.pages[pindex].rows[rindex].buttons = this.state.data.pages[pindex].rows[rindex].buttons.filter((_, ind) => {
      return ind !== bindex
    })
    this.setItem()
  },
  setItem() {
    const newString = JSON.stringify(this.state.data)
    //console.log(newString)
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
      // data not empty but not JSON
      console.log('data error');
      this.state.is_conf_error = true;
      this.state.data = DEFAULT_DATA;
    } else {
      // data empty
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
    //this.deleteState()
    const contentItems = []
    const contentVariables = []
    const welcomeText = View(
      {},
      [
        Text({
          bold: true,
          align: 'center',
          paragraph: true,
          style: {
            fontSize: '36px'
          }
        }, [gettext('title_text')]),
        Text({
          bold: false,
          align: 'left',
          paragraph: true,
          style: {
            fontSize: '16px',
            padding: '10px 10px'
          }
        }, [gettext('welcome_text')])
      ]
    )
    const addPageBTN = View(
      {
        style: {
          fontSize: '12px',
          lineHeight: '35px',
          borderRadius: '30px',
          background: '#409EFF',
          color: 'white',
          textAlign: 'center',
          padding: '0 40px',
          width: '40%'
        }
      },
      [
        TextInput({
          label: gettext('add_page'),
          labelStyle:{fontWeight: '500' ,textAlign: 'center'},
          onChange: (title) => {
            this.addPage(title)
          }
        })]);

    const addVariableBTN = Button({
        label: gettext('add_variable'),
        style: {
          fontSize: '12px',
          borderRadius: '30px',
          background: toColor(COLOR_GREEN),
          color: 'white',
          width: '40%',
        },
        onClick: () => {
          let i = 1
          let key
          const vars = this.state.data.variables
          do {
            key = `var_${i}`
            i++
          } while (key in vars)

          this.addGlobalVariable(key, '')
        }
      });

    const clearBTN = Button({
        style: {
          fontSize: '12px', lineHeight: '35px', borderRadius: '30px', background: '#db2c2c', color: 'white', textAlign: 'center', padding: '0 15px', width: '50%'
        },
        label: gettext('delete_storage'),
        onClick: () => {
          this.deleteState()
        }
      });

    const confBTN = View(
      {
        style: {
          fontSize: '12px',
          lineHeight: '35px',
          borderRadius: '30px',
          background: '#dedede',
          color: 'black',
          textAlign: 'left',
          padding: '0 15px',
          margin: '6px 0',
          width: '50%'
        }
      },
      [TextInput({
        label: gettext('conf'),
        labelStyle:{textAlign: 'center'},
        subStyle: { display: 'none' },
        value: JSON.stringify(this.state.data),
        onChange: (value) => {
          this.state.props.settingsStorage.setItem('data', value)
        }
      }),
      ]
    );

    const conf_error = View(
      {
        style: {
          padding: '12px 20px',
        }
      },
      [Text({
        bold: false,
        paragraph: true,
        style: {
          fontSize: '20px',
          padding: '12px 0',
          whiteSpace: 'pre-line'
        }
      }, [gettext('config_error_text')]),
      View({
        style: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center'
        }
      }
        , [
          View({
            style: {
              fontSize: '12px',
              lineHeight: '35px',
              borderRadius: '30px',
              background: '#dedede',
              color: 'black',
              textAlign: 'left',
              padding: '0 15px',
              margin: '6px 0',
              width: '50%'
            }
          },
            [TextInput({
              label: gettext('fix_conf'),
              subStyle: { display: 'none' },
              value: props.settingsStorage.getItem('data'),
              onChange: (value) => {
                this.state.props.settingsStorage.setItem('data', value)
              }
            })]
          ),
          clearBTN
        ])
      ]
    );

    if (this.state.data) {
      const variables = this.state.data.variables || {};  // se null/undefined, uso oggetto vuoto

      contentVariables.push(
        Text({
          bold: true,
          align: 'left',
          paragraph: true,
          style: {
            fontSize: '16px',
            padding: '4px 4px'
          }
        }, [gettext('variables')])
      )
      Object.entries(variables)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([vindex, value]) => {
        contentVariables.push(
          View(
            {
              style: {
                borderTop: '1px solid #eaeaea',
                padding: '6px 0 6px 10px',
                //marginBottom: '6px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }
            },
            [View(
              {
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justfyContent: 'center',
                  alignItems: 'start'
                }
              },
              [
                TextInput({
                  label: vindex,
                  placeholder: vindex,
                  bold: false,
                  value: value,
                  labelStyle: { fontWeight: '500' },
                  subStyle: {
                    //textAlign: 'center',
                    fontSize: '14px',
                    color: COLOR_BLACK,
                    background: COLOR_WHITE
                  },
                  maxLength: 200,
                  onChange: (val) => {
                    if (val == null) return
                    if (val === vindex) return 
                    if (val.length <= 200) {
                      this.editGlobalVariable(vindex, val)
                    } else {
                      console.log("global_variable title can't be too long!")
                    }
                  }
                })
              ]),
            View(
              {
                style: {
                  fontSize: '12px',
                  fontWeight: '500',
                  lineHeight: '35px',
                  borderRadius: '30px',
                  background: '#7cad9dff',
                  color: 'white',
                  textAlign: 'left',
                  padding: '0 15px',
                  margin: '0 5px 0 0',
                  //width: '22%'
                }
              },
              [TextInput({
                label: gettext('edit_variable'),
                labelStyle:{textAlign: 'center'},
                subStyle: { display: 'none' },
                value: vindex,
                onChange: (newValue) => {
                  if (newValue == null) return
                  if (newValue === vindex) return
                  this.editGlobalVariableKey(vindex, newValue)
                }
              }),
              ]
            ),View({style: {
                fontSize: '12px',
                  fontWeight: '500',
                  lineHeight: '35px',
                  borderRadius: '30px',
                  background: '#D85E33',
                  color: 'white',
                  textAlign: 'left',
                  padding: '0 15px',
                  margin: '0 5px 0 0',
              }},
            [TextInput({
              label: gettext('delete_variable'),
              labelStyle:{textAlign: 'center'},
              subStyle: { display: 'none' },
              disabled: true,
              placeholder: gettext('delete_variable') + ' ' + vindex + '?',
              value: undefined,
              onChange: (newValue) => {
                  this.deleteGlobalVariable(vindex)
                }
            })]),
          ]),
        )

      });//variables
      //pages
      const pages = this.state.data.pages || {};  // se null/undefined, uso oggetto vuoto

      for (let [pindex, page] of pages.entries()) {
        //console.log(page.title, index);
        contentItems.push(
          View(
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
                        this.editPage('title', title, pindex)
                      } else {
                        console.log("page title can't be too long!")
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
                    [Select({
                      title: gettext('page') + (pindex + 1),
                      //label: pindex + 1,
                      value: undefined,
                      options: indexRange(pindex, this.state.data.pages.length - 1),
                      onChange: (value) => {
                        if (value < 999) {
                          this.movePage(pindex, value)
                        }
                      }
                    }),
                    Select({
                      title: gettext('back_color'),
                      //label: page.back_color,
                      value: page.back_color,
                      //style:{color: 'red'},
                      //subStyle: {color: 'red'},
                      options: colors(),
                      onChange: (value) => {
                        this.editPage('back_color', value, pindex)
                      }
                    }),
                    Select({
                      title: gettext('text_color'),
                      //label: page.text_color,
                      value: page.text_color,
                      options: colors(),
                      onChange: (value) => {
                        this.editPage('text_color', value, pindex)
                      }
                    })]),
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
                onClick: () => {
                  this.addRow(pindex)
                }
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
                onClick: () => {
                  this.deletePage(pindex)
                }
              })
            ]
          )
        );
        //rows
        for (let [rindex, row] of page.rows.entries()) {
          contentItems.push(
            View(
              {
                style: {
                  border: '1px solid #eaeaea',
                  borderRadius: '8px',
                  padding: '6px 0',
                  marginBottom: '6px',
                  //marginLeft: '6px',
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
                      style: {
                        //color: '#333',
                        fontSize: '16px'
                      }
                    }, [/*gettext('page')+(pindex + 1)+' - ' +*/gettext('row') + (rindex + 1)]),
                    Select({
                      //title: gettext('row_order')+(rindex + 1),
                      //label: rindex + 1,
                      //value: rindex,
                      options: indexRange(rindex, page.rows.length - 1),
                      onChange: (value) => {
                        if (value < 999) {
                          this.moveRow(pindex, rindex, value)
                        }
                      }
                    }),
                    Select({
                      title: gettext('h') + row.h,
                      //label: row.h,
                      value: row.h,
                      options: wRange({customValues: [16.66, 33.33, 66.66, 83.33]}),
                      onChange: (value) => {
                        this.editRow('h', value, pindex, rindex)
                      }
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
                  onClick: () => {
                    this.addButton(pindex, rindex)
                  }
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
                  onClick: () => {
                    this.deleteRow(pindex, rindex)
                  }
                })
              ]
            )
          );
          //buttons
          for (let [bindex, button] of row.buttons.entries()) {
            contentItems.push(
              View(
                {
                  style: {
                    //borderBottom: '1px solid #eaeaea',
                    border: '1px solid #d5d5d5',
                    borderRadius: '8px',
                    padding: '6px 1px',
                    marginBottom: '6px',
                    //marginLeft: '10px',
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
                    [View(
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
                          //label: gettext('buttonText'),
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
                              this.editButton('text', text, pindex, rindex, bindex)
                            } else {
                              console.log("button title can't be empty or too long!")
                            }
                          }
                        }),
                        Select({
                          options: indexRange(bindex, page.rows[rindex].buttons.length - 1),
                          onChange: (value) => {
                            if (value < 999) {
                              this.moveButton(pindex, rindex, bindex, value)
                            }
                          }
                        }),
                        Toggle({
                          label: gettext('is_spacer'),
                          value: button.spacer,
                          subStyle: {
                            color: '#333',
                            fontSize: '10px'
                          },
                          onChange: (value) => {
                            this.editButton('spacer', value, pindex, rindex, bindex)
                          }
                        }),
                        Select({
                          title: gettext('w') + button.w,
                          value: button.w,
                          options: wRange({customValues: [16.66, 33.33, 66.66, 83.33]}),
                          onChange: (value) => {
                            this.editButton('w', value, pindex, rindex, bindex)
                          }
                        })
                      ]),
                    View(
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
                        Select({
                          title: gettext('radius') + button.radius,
                          value: button.radius,
                          options: wRange({step: 5}),
                          onChange: (value) => {
                            this.editButton('radius', value, pindex, rindex, bindex)
                          }
                        }),
                        Select({
                          title: gettext('back_color'),
                          //label: button.back_color,
                          value: button.back_color,
                          options: colors(),
                          onChange: (value) => {
                            this.editButton('back_color', value, pindex, rindex, bindex)
                          }
                        }),
                        Select({
                          label: gettext('text_color'),
                          //value: button.text_color,
                          options: colors(),
                          onChange: (value) => {
                            this.editButton('text_color', value, pindex, rindex, bindex)
                          }
                        }),
                        Select({
                          title: gettext('text_size') + button.text_size,
                          value: button.text_size,
                          options: tSizeRange(),
                          onChange: (value) => {
                            this.editButton('text_size', value, pindex, rindex, bindex)
                          }
                        }),
                        TextInput({
                          //label: gettext('url'),
                          //labelStyle: { fontSize: '12px' },
                          bold: false,
                          value: button.request.url || gettext('**URL**'),
                          placeholder: gettext('insert_url'),
                          subStyle: {
                            color: button.request.url ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 200,
                          onChange: (value) => {
                            if (validateURL(value)) { //} || value != gettext('**URL**')) {
                              this.editButton('url', value, pindex, rindex, bindex)
                            } else {
                              this.editButton('url', null, pindex, rindex, bindex)
                              console.log("url not valid!")
                              return Toast({
                                message: gettext('insert_valid_url'),
                              })
                            }
                          }
                        }),
                        Select({
                          title: gettext('insert_method') + (button.request.method || '--'),
                          //value: {name: button.request.method, value: button.request.method },
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
                          onChange: (value) => {
                            this.editButton('method', value, pindex, rindex, bindex)
                          }
                        }),
                         Toggle({
                          label: gettext('is_input'),
                          value: button.input,
                          subStyle: {
                            color: '#333',
                            fontSize: '10px',
                            //display: (button.request.method === 'TRACE') ? 'none' : 'block',
                          },
                          onChange: (value) => {
                            this.editButton('input', value, pindex, rindex, bindex)
                          }
                        }),
                        Select({
                          title: gettext('auth') + (button.request.auth || '--'),
                          value: button.request.auth || '--',
                          options: [
                            { name: '--', value: '--' },
                            { name: 'Basic', value: 'Basic' },
                            { name: 'Bearer', value: 'Bearer' },
                            { name: 'Digest', value: 'Digest' }
                          ],
                          onChange: (value) => {
                            this.editButton('auth', value, pindex, rindex, bindex)
                          }
                        }),
                        TextInput({
                          //label: gettext('user'),
                          //labelStyle: { fontSize: '10px' },
                          bold: false,
                          value: button.request.user || gettext('**USER**'),
                          placeholder: gettext('user'),
                          subStyle: {
                            display: (button.request.auth === 'Basic' || button.request.auth === 'Digest') ? 'block' : 'none',
                            color: button.request.user ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 200,
                          onChange: (value) => {
                            if (value.length > 0 && value.length <= 200 || value != gettext('**USER**')) {
                              this.editButton('user', value, pindex, rindex, bindex)
                            } else {
                              console.log("button user can't be empty or too long!")
                            }
                          }
                        }),
                        TextInput({
                          //label: gettext('pass'),
                          //labelStyle: { fontSize: '10px' },
                          bold: false,
                          value: button.request.pass || gettext('**PASS**'),
                          placeholder: gettext('pass'),
                          subStyle: {
                            display: (button.request.auth === 'Basic' || button.request.auth === 'Digest') ? 'block' : 'none',
                            color: button.request.pass ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 400,
                          onChange: (value) => {
                            if (value.length > 0 && value.length <= 400 || value != gettext('**PASS**')) {
                              this.editButton('pass', value, pindex, rindex, bindex)
                            } else {
                              console.log("button pass can't be empty or too long!")
                            }
                          }
                        }),
                        TextInput({
                          //label: gettext('token'),
                          //labelStyle: { fontSize: '10px' },
                          bold: false,
                          value: button.request.token || gettext('**TOKEN**'),
                          placeholder: gettext('token'),
                          subStyle: {
                            display: (button.request.auth === 'Bearer') ? 'block' : 'none',
                            color: button.request.token ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 512,
                          onChange: (value) => {
                            if (value.length > 0 && value.length <= 512 || value != gettext('**TOKEN**')) {
                              this.editButton('token', value, pindex, rindex, bindex)
                            } else {
                              console.log("button token can't be empty or too long!")
                            }
                          }
                        }),
                        TextInput({
                          //label: gettext('headers'),
                          //labelStyle: { fontSize: '10px' },
                          bold: false,
                          value: button.request.headers || gettext('**HEADERS**'),
                          placeholder: gettext('insert_headers'),
                          subStyle: {
                            color: button.request.headers ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 200,
                          onChange: (value) => {
                            if (value.length > 0 && value.length <= 200 || value != gettext('**HEADERS**')) {
                              this.editButton('headers', value, pindex, rindex, bindex)
                            } else {
                              console.log("button headers can't be empty or too long!")
                            }
                          }
                        }),
                        TextInput({
                          //label: gettext('body'),
                          //labelStyle: { fontSize: '10px' },
                          bold: false,
                          value: button.request.body || gettext('**BODY**'),
                          placeholder: gettext('insert_body'),
                          subStyle: {
                            color: button.request.body ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 200,
                          onChange: (value) => {
                            if (value.length > 0 && value.length <= 200 || value != gettext('**BODY**')) {
                              this.editButton('body', value, pindex, rindex, bindex)
                            } else {
                              console.log("button body can't be empty or too long!")
                            }
                          }
                        }),
                        TextInput({
                          //label: gettext('parse_result'),
                          //labelStyle: { fontSize: '10px' },
                          bold: false,
                          value: button.request.parse_result || gettext('**parse_result**'),
                          subStyle: {
                            color: button.request.parse_result ? COLOR_BLACK : COLOR_BLACK,//'#756f6f',
                            fontSize: '14px'
                          },
                          maxLength: 200,
                          onChange: (value) => {
                            if (value.length > 0 && value.length <= 200 || value != gettext('**parse_result**')) {
                              this.editButton('parse_result', value, pindex, rindex, bindex)
                            } else {
                              console.log("button parse_result can't be empty or too long!")
                            }
                          }
                        }),
                        Select({
                          title: gettext('response_style'),// + button.request.response_style,
                          value: button.request.response_style,
                          options: [{ name: gettext('system_toast'), value: SYSTEM_TOAST }, { name: gettext('custom_toast'), value: CUSTOM_TOAST }, { name: gettext('no_notification'), value: NO_NOTIFICATION }, { name: gettext('system_modal'), value: SYSTEM_MODAL }],
                          onChange: (value) => {
                            this.editButton('response_style', value, pindex, rindex, bindex)
                          }
                        }),
                      ]),
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
                    onClick: () => {
                      this.deleteButton(pindex, rindex, bindex)
                    }
                  })
                ]
              )

            );
          }
        }
      }
      //console.log('contentItems:', contentItems);
    };
    if (this.state.is_conf_error === true) {
      return View(
        {
          style: {
            padding: '12px 20px'
          }
        },
        [conf_error])
    }
    else {
      return View(
        {
          style: {
            padding: '12px 5px'
          }
        },
        [
          welcomeText,
          View({
            style: {
              flex: 1,
              display: 'flex',
              justifyContent: 'space-evenly',
              flexDirection: 'row',
              alignItems: 'center',
            }
          }, [addPageBTN, addVariableBTN]),
          contentVariables.length > 0 &&
          View(
            {
              style: {
                marginTop: '12px',
                padding: '4px',
                border: '1px solid #eaeaea',
                borderRadius: '6px',
                backgroundColor: 'white'
              }
            },
            [...contentVariables]
          ),
          contentItems.length > 0 &&
          View(
            {
              style: {
                marginTop: '12px',
                padding: '4px',
                border: '1px solid #eaeaea',
                borderRadius: '6px',
                backgroundColor: 'white'
              }
            },
            [...contentItems]
          ),
          confBTN,
          clearBTN
        ]
      )
    }
  }
})
