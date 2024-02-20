import { gettext } from 'i18n'
//import { COLOR_BLACK, COLOR_WHITE } from '../utils/constants';
//import { DEFAULT_DATA } from '../utils/constants.js'

const DEFAULT_BUTTON = { text: 'new', spacer: false, w: 20, request: {} };
const DEFAULT_ROW = { buttons: [DEFAULT_BUTTON] };
const DEFAULT_PAGE = { rows: [DEFAULT_ROW] };
const DEFAULT_DATA = { pages: [DEFAULT_PAGE] };

function toColor(num) {
  let colorString = undefined;
  if (num) {
    colorString = "#" + num.toString(16).padStart(6, '0');
  }
  return colorString;
}

const wRange = () => {
  let arr = [];
  const limit = 100;
  const step = 5;

  for (let i = 0; i <= limit; i = i + step) {
    arr.push({
      name: i.toString(),
      value: i
    })
  };
  return (arr)
}

function indexRange(limit) {
  let arr = [];
  const step = 1;

  for (let i = 0; i <= limit; i = i + step) {
    arr.push({
      name: (i+1).toString(),
      value: i
    })
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
    { name: 'black', value: 0x000000 },
    { name: 'white', value: 0xffffff },
    { name: 'orange', value: 0xFFA500 },
    { name: 'red', value: 0x8B0000 },
    { name: 'green', value: 0x3cb371 },
    { name: 'blue', value: 0x0884d0 },
    { name: 'yellow', value: 0xFFFF00 },
    { name: 'indigo', value: 0x4B0082 },
    { name: 'violet', value: 0xEE82EE }
  ]

  return (arr)
}

AppSettingsPage({
  state: {
    data: [],
    props: {}
  },
  addPage(title) {
    let page = DEFAULT_PAGE;
    page.title = title;
    page.rows = [];
    this.state.data[0].pages.push(page);
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
  movePage(pindex, toindex){
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
  moveRow(pindex, rindex, toindex){
    var temp = this.state.data[0].pages[pindex].rows[rindex];
    this.state.data[0].pages[pindex].rows[rindex] = this.state.data[0].pages[pindex].rows[toindex];
    this.state.data[0].pages[pindex].rows[toindex] = temp;

    this.setItem();
  },
  addButton(pageindex, rowindex) {
    let button = { text: 'new', spacer: false, w: 20, request: {} };
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
  moveButton(pindex, rindex, bindex, toindex){
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
    if (this.state.props.settingsStorage.getItem('data')) {
      this.state.props.settingsStorage.removeItem('data');
    }
  },
  build(props) {
    this.setState(props)
    //this.deleteState()
    const contentItems = []
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
        label: ('DeleteStorage'),
        onClick: () => {
          this.deleteState()
        }
      })
      ]
    );
    const confBTN = View(
      { style: {
        fontSize: '12px',
        lineHeight: '30px',
        borderRadius: '30px',
        //background: '#409EFF',
        color: 'black',
        textAlign: 'center',
        padding: '0 15px',
        width: '30%'
      }},
      [TextInput({
        label: gettext('conf'),
        subStyle: {display:'none'},
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
              flexDirection: 'row'
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
                  alignItems: 'center'
                }
              },
              [
                TextInput({
                  label: gettext('pageTitle'),
                  bold: true,
                  value: page.title,
                  subStyle: {
                    textAlign: 'center',
                    fontSize: '14px',
                    color: toColor(page.text_color),
                    background: toColor(page.back_color)
                  },
                  maxLength: 200,
                  onChange: (title) => {
                    if (title.length <= 200) {
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
                    title: gettext('pageOrder'),
                    label: pindex + 1,
                    value: pindex,
                    options: indexRange(this.state.data[0].pages.length - 1),
                    onChange: (value) => {
                      this.movePage(pindex, value)
                    }
                  }),
                    Select({
                      title: gettext('back_color'),
                      //label: page.back_color,
                      value: page.back_color,
                      style:{color: 'red'},
                      subStyle: {color: 'red'},
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
                borderBottom: '1px solid #eaeaea',
                padding: '6px 0',
                marginBottom: '6px',
                marginLeft: '6px',
                display: 'flex',
                flexDirection: 'row'
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
                    alignItems: 'center'
                  }
                },
                [
                  Text({
                    label: gettext('rowNumber'),
                    bold: false,
                    value: rindex + 1,
                    style: {
                      color: '#333',
                      fontSize: '14px'
                    }
                  }, [gettext('page')+ ' - '+(pindex + 1) +gettext('row') + ' - ' + (rindex + 1)]),
                  Select({
                    title: gettext('rowOrder'),
                    label: rindex + 1,
                    value: rindex,
                    options: indexRange(page.rows.length - 1),
                    onChange: (value) => {
                      this.moveRow(pindex, rindex, value)
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
                  borderRadius: '20',
                  padding: '6px 0',
                  marginBottom: '6px',
                  marginLeft: '10px',
                  display: 'flex',
                  flexDirection: 'row',
                  background: '#eaeaea'
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
                      alignItems: 'center'
                    }
                  },
                  [View(
                    {
                      style: {
                        flex: 1,
                        flexDirection: 'column',
                        justfyContent: 'center',
                        alignItems: 'flex-start',
                        display: 'flex'
                      }
                    },
                    [
                      TextInput({
                        label: gettext('buttonText'),
                        bold: false,
                        value: button.text,
                        //labelStyle: { fontSize: '12px' },
                        subStyle: {
                          textAlign: 'center',
                          fontSize: '14px',
                          color: toColor(button.text_color || 0x000000),
                          background: toColor(button.back_color || 0xffffff)
                        },
                        maxLength: 200,
                        onChange: (text) => {
                          if (text.length > 0 && text.length <= 200) {
                            this.editButton('text', text, pindex, rindex, bindex)
                          } else {
                            console.log("button title can't be empty or too long!")
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
                      }),
                      Select({
                        title: gettext('buttonOrder'),
                        label: bindex + 1,
                        value: bindex,
                        options: indexRange(page.rows[rindex].buttons.length - 1),
                        onChange: (value) => {
                          this.moveButton(pindex, rindex, bindex, value)
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
                        title: gettext('textSize'),
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
        addBTN,
        contentItems.length > 0 &&
        View(
          {
            style: {
              marginTop: '12px',
              padding: '10px',
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
