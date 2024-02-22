import { gettext } from 'i18n'
import { DEFAULT_BUTTON, DEFAULT_ROW, DEFAULT_DATA, DEFAULT_PAGE, COLOR_BLACK, COLOR_BLUE, COLOR_GRAY, COLOR_GREEN, COLOR_INDIGO, COLOR_ORANGE, COLOR_RED, COLOR_VIOLET, COLOR_WHITE, COLOR_YELLOW } from '../utils/constants.js'

function toColor(num) {
  let colorString = undefined;
   if (num != null) {
      colorString = "#" + num.toString(16).padStart(6, '0');
   }
  return colorString;
}

const wRange = () => {
  let arr = [];
  const limit = 100;
  const step = 3;

  for (let i = 0; i <= limit; i = i + step) {
    arr.push({
      name: i.toString(),
      value: i
    })
  };
  return (arr)
}

function indexRange(index, limit) {
  let arr = [];
  const step = 1;

  arr.push({ name: '--', value: 999 })
  for (let i = 0; i <= limit; i = i + step) {
    if (i != index) {
      arr.push({
        name: gettext('orderTo') + (i + 1).toString(),
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
    data: [],
    props: {}
  },
  addPage(title) {
    let newPage = DEFAULT_PAGE;
    newPage.title = title;
    this.state.data[0].pages.push(newPage);
    this.setItem()
  },
  editPage(prop, val, pindex) {
    switch (prop) {
      case 'title':
        this.state.data[0].pages[pindex].title = val
        break;
      case 'back_color':
        this.state.data[0].pages[pindex].back_color = val
        break;
      case 'text_color':
        this.state.data[0].pages[pindex].text_color = val
        break;
      case 'text_size':
        this.state.data[0].pages[pindex].text_size = val
        break;
    }
    this.setItem()
  },
  deletePage(index) {
    this.state.data[0].pages = this.state.data[0].pages.filter((_, ind) => {
      return ind !== index
    })
    this.setItem()
  },
  movePage(pindex, toindex) {
    var temp = this.state.data[0].pages[pindex];
    this.state.data[0].pages[pindex] = this.state.data[0].pages[toindex];
    this.state.data[0].pages[toindex] = temp;

    this.setItem();
  },
  addRow(pageindex) {
    let row = DEFAULT_ROW;
    this.state.data[0].pages[pageindex].rows.push(row);
    this.setItem()
  },
  deleteRow(pindex, rindex) {
    this.state.data[0].pages[pindex].rows = this.state.data[0].pages[pindex].rows.filter((_, ind) => {
      return ind !== rindex
    })
    this.setItem()
  },
  moveRow(pindex, rindex, toindex) {
    var temp = this.state.data[0].pages[pindex].rows[rindex];
    this.state.data[0].pages[pindex].rows[rindex] = this.state.data[0].pages[pindex].rows[toindex];
    this.state.data[0].pages[pindex].rows[toindex] = temp;
    this.setItem();
  },
  addButton(pageindex, rowindex) {
    let button = DEFAULT_BUTTON;
    this.state.data[0].pages[pageindex].rows[rowindex].buttons.push(button);
    this.setItem()
  },
  editButton(prop, val, pindex, rindex, bindex) {
    switch (prop) {
      case 'text':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].text = val;
        break;
      case 'spacer':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].spacer = val;
        break;
      case 'w':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].w = val;
        break;
      case 'radius':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].radius = val;
        break;
      case 'back_color':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].back_color = val;
        break;
      case 'text_color':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].text_color = val;
        break;
      case 'text_size':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].text_size = val
        break;
      case 'url':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].request.url = val;
        break;
      case 'method':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].request.method = val;
        break;
      case 'headers':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].request.headers = val;
        break;
      case 'params':
        this.state.data[0].pages[pindex].rows[rindex].buttons[bindex].request.params = val;
        break;
    }
    this.setItem()
  },
  moveButton(pindex, rindex, bindex, toindex) {
    var temp = this.state.data[0].pages[pindex].rows[rindex].buttons[bindex];
    this.state.data[0].pages[pindex].rows[rindex].buttons[bindex] = this.state.data[0].pages[pindex].rows[rindex].buttons[toindex];
    this.state.data[0].pages[pindex].rows[rindex].buttons[toindex] = temp;
    this.setItem();
  },
  deleteButton(pindex, rindex, bindex) {
    this.state.data[0].pages[pindex].rows[rindex].buttons = this.state.data[0].pages[pindex].rows[rindex].buttons.filter((_, ind) => {
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
    if (props.settingsStorage.getItem('data')) {
      this.state.data = JSON.parse(props.settingsStorage.getItem('data'))
    } else {
      this.state.data = [DEFAULT_DATA]
    }
    console.log('setState - data: ', this.state.data)
  },
  deleteState() {
    this.state.data = [DEFAULT_DATA]
    this.setItem()
  },
  build(props) {
    this.setState(props)
    //this.deleteState()
    const contentItems = []
    const welcomeText = View(
      {},
      [
        Text({
          bold: true,
          align: 'center',
          paragraph: true,
          style: {
            //color: '#333',
            fontSize: '36px'
          }
        }, [gettext('title_text')]),
        Text({
          bold: false,
          align: 'left',
          paragraph: true,
          style: {
            //color: '#333',
            fontSize: '16px',
            padding: '10px 0'
          }
        }, [gettext('welcome_text')])
      ]
    )
    const addBTN = View(
      {
        style: {
          fontSize: '12px',
          lineHeight: '30px',
          borderRadius: '30px',
          background: '#409EFF',
          color: 'white',
          textAlign: 'center',
          padding: '0 15px',
          width: '30%'
        }
      },
      [
        TextInput({
          label: gettext('addPage'),
          onChange: (title) => {
            this.addPage(title)
          }
        })
      ]
    );
    const clearBTN = View(
      {},
      [Button({
        style: {
          fontSize: '12px', lineHeight: '30px', borderRadius: '30px', background: '#db2c2c', color: 'white', textAlign: 'center', padding: '0 15px', width: '30%'
        },
        label: gettext('delete_storage'),
        onClick: () => {
          this.deleteState()
        }
      })
      ]
    );
    const confBTN = View(
      {
        style: {
          fontSize: '12px',
          lineHeight: '30px',
          borderRadius: '30px',
          background: '#dedede',
          color: 'black',
          textAlign: 'left',
          padding: '0 15px',
          margin: '6px 0',
          width: '30%'
        }
      },
      [TextInput({
        label: gettext('conf'),
        subStyle: { display: 'none' },
        value: JSON.stringify(this.state.data),
        onChange: (value) => {
          this.state.props.settingsStorage.setItem('data', value)
        }
      }),
      ]
    )
    //pages
    for (let [pindex, page] of this.state.data[0].pages.entries()) {
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
                  placeholder: gettext('pageTitle'),
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
                    //title: gettext('pageOrder'),
                    //label: pindex + 1,
                    value: undefined,
                    options: indexRange(pindex, this.state.data[0].pages.length - 1),
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
              label: gettext('addRow'),
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
              label: gettext('deletePage'),
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
                    //title: gettext('rowOrder')+(rindex + 1),
                    //label: rindex + 1,
                    //value: rindex,
                    options: indexRange(rindex, page.rows.length - 1),
                    onChange: (value) => {
                      if (value < 999) {
                        this.moveRow(pindex, rindex, value)
                      }
                    }
                  })
                ]
              ),
              Button({
                label: gettext('addButton'),
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
                label: gettext('deleteRow'),
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
                        //title: gettext('buttonOrder'),
                        //label: bindex + 1,
                        //value: bindex,
                        options: indexRange(rindex, page.rows[rindex].buttons.length - 1),
                        onChange: (value) => {
                          if (value < 999) {
                            this.moveButton(pindex, rindex, bindex, value)
                          }
                        }
                      }),
                      Toggle({
                        label: gettext('isSpacer'),
                        value: button.spacer,
                        //style: { fontSize: '10px' },
                        subStyle: {
                          color: '#333',
                          fontSize: '10px'
                        },
                        onChange: (value) => {
                          this.editButton('spacer', value, pindex, rindex, bindex)
                        }
                      }),
                      Select({
                        title: gettext('w'),
                        label: button.w,
                        value: button.w,
                        options: wRange(),
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
                        title: gettext('radius'),
                        label: button.radius,
                        value: button.radius,
                        options: wRange(),
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
                        title: gettext('text_size'),
                        //label: bindex,
                        value: bindex,
                        options: tSizeRange(),
                        onChange: (value) => {
                          this.editButton('text_size', value, pindex, rindex, bindex)
                        }
                      }),
                      TextInput({
                        label: gettext('url'),
                        bold: false,
                        value: button.request.url,
                        labelStyle: { fontSize: '10px' },
                        subStyle: {
                          color: '#333',
                          fontSize: '10px'
                        },
                        maxLength: 200,
                        onChange: (url) => {
                          if (url.length > 0 && url.length <= 200) {
                            this.editButton('url', url, pindex, rindex, bindex)
                          } else {
                            console.log("button url can't be empty or too long!")
                          }
                        }
                      }),
                      TextInput({
                        label: gettext('method'),
                        bold: false,
                        value: button.request.method,
                        labelStyle: { fontSize: '10px' },
                        subStyle: {
                          color: '#333',
                          fontSize: '10px'
                        },
                        maxLength: 200,
                        onChange: (method) => {
                          if (method.length > 0 && method.length <= 200) {
                            this.editButton('method', method, pindex, rindex, bindex)
                          } else {
                            console.log("button method can't be empty or too long!")
                          }
                        }
                      }),
                      TextInput({
                        label: gettext('headers'),
                        bold: false,
                        value: button.request.headers,
                        labelStyle: { fontSize: '10px' },
                        subStyle: {
                          color: '#333',
                          fontSize: '10px'
                        },
                        maxLength: 200,
                        onChange: (headers) => {
                          if (headers.length > 0 && headers.length <= 200) {
                            this.editButton('headers', headers, pindex, rindex, bindex)
                          } else {
                            console.log("button headers can't be empty or too long!")
                          }
                        }
                      }),
                      TextInput({
                        label: gettext('params'),
                        bold: false,
                        value: button.request.params,
                        labelStyle: { fontSize: '10px' },
                        subStyle: {
                          color: '#333',
                          fontSize: '10px'
                        },
                        maxLength: 200,
                        onChange: (params) => {
                          if (params.length > 0 && params.length <= 200) {
                            this.editButton('params', params, pindex, rindex, bindex)
                          } else {
                            console.log("button params can't be empty or too long!")
                          }
                        }
                      })]),
                  ]
                ),

                Button({
                  label: gettext('deleteButton'),
                  style: {
                    fontSize: '12px',
                    borderRadius: '30px',
                    background: '#35d7b9',
                    color: 'white'
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
      //console.log('contentItems:', contentItems);
    };
    return View(
      {
        style: {
          padding: '12px 20px'
        }
      },
      [
        welcomeText,
        addBTN,
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
})
