import { px } from '@zos/utils'
import { createWidget, deleteWidget, widget, align, prop, text_style, event, getTextLayout, anim_status} from '@zos/ui'
import { setPageBrightTime } from '@zos/display'
import { setScrollMode, setScrollLock, SCROLL_MODE_SWIPER } from '@zos/page'
import { getDeviceInfo } from '@zos/device'
import { showToast, createModal } from '@zos/interaction'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE } from 'zosLoader:./keyboard.[pf].layout.js'
import { BTN_PADDING, ROW_PADDING, BTN_RADIUS, btnPressColor, COLOR_BLACK, COLOR_GRAY_TOAST, COLOR_GRAY, COLOR_RED, COLOR_WHITE, CUSTOM_TOAST, SYSTEM_TOAST, SYSTEM_MODAL, NO_NOTIFICATION } from '../utils/constants.js';

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();
const TEXT_SIZE = DEVICE_WIDTH / 16;

const NOTIFICATION_X = 60
const NOTIFICATION_Y = 350
const NOTIFICATION_WIDTH = DEVICE_WIDTH - (NOTIFICATION_X * 2)
const NOTIFICATION_H_MIN = 40
const NOTIFICATION_TEXT_SIZE = 32

const logger = getLogger('http-buttons-layout')

export const LOADING_TEXT_WIDGET = {
  x: 0,
  y: (DEVICE_HEIGHT/2)+155,
  w: DEVICE_WIDTH, h: TEXT_SIZE*1.5,
  text_size: TEXT_SIZE,
  color: COLOR_WHITE,
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
  text_style: text_style.WRAP,
  text: getText('loading')
};

export const LOADING_IMG_ANIM_WIDGET = {//155*155
    anim_path: 'anim',
    anim_prefix: 'loading',
    anim_ext: 'png',
    anim_fps: 24,
    anim_size: 54,
    repeat_count: 0,
    anim_status: anim_status.START,
    x: (DEVICE_WIDTH/2)-(155/2), y: DEVICE_HEIGHT/2
  };

export const layout = {
  refs: {},
  render(vm) {
    logger.debug(getText('loading'))
    if (vm.state.isError || !vm.state.data) {
      createWidget(widget.TEXT, {
        x: 0, y: 0,
        w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
        color: COLOR_WHITE,
        text_size: 36,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
        text: getText('comunication_error')
      })
      return;
    }
    /* BUILD UI */
    logger.info(vm.state.data)
    let inputText = '';
    let currentKeyboard = null;
    let kbBackground = null;
    let currentLayoutIds = null;
    let data = JSON.parse(vm.state.data)

    setPageBrightTime({ brightTime: 60000 })

    setScrollMode({
      mode: SCROLL_MODE_SWIPER,
      options: {
        height: DEVICE_HEIGHT,
        count: data.pages.length,
      },
    });

    createWidget(widget.PAGE_SCROLLBAR, {});

    for (let [pi, page] of data.pages.entries()) {
      logger.debug('new page id:', pi);

      let offsetYpage = (DEVICE_HEIGHT * pi);
      let titleHeight = 0;
      let paddingXbtn = page.button_padding || BTN_PADDING;
      let paddingYbtn = page.row_padding || ROW_PADDING;

      //logger.debug('offsetYpage:', offsetYpage);

      let pageBackground = createWidget(widget.FILL_RECT, {
        x: 0, y: px(offsetYpage), w: px(DEVICE_WIDTH), h: px(DEVICE_HEIGHT),
        color: page.back_color || COLOR_BLACK
      })

      if (page.title) {
        titleHeight = 50;
        let pageTitle = createWidget(widget.TEXT, {
          x: 0,
          y: px(offsetYpage),
          w: px(DEVICE_WIDTH),
          h: px(titleHeight),
          color: page.text_color || COLOR_WHITE,
          text: page.title,
          text_size: page.text_size || TEXT_SIZE,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V,
          text_style: text_style.NONE
        });
      }

      // Make shure that the sum of rows h per page is 100 or less
      //if not, let's size them evenly
      let calcRowsPercHeigthIs100 = page.rows.reduce((n, { h }) => n + Number(h), 0);
      //logger.debug('calcRowsPercHeigthIs100:', calcRowsPercHeigthIs100);

      if (calcRowsPercHeigthIs100 > 100) {
        let heigthEqual = 100 / page.rows.length;
        page.rows.forEach((row) => {
          row.h = Math.round(heigthEqual * 100) / 100;
        })
      }

      let pageButtonSpaceH = DEVICE_HEIGHT - titleHeight

      for (let [ri, row] of page.rows.entries()) {
        logger.debug('new row id:', ri);

        let perchbefore = 0;

        page.rows.slice(0, ri).forEach((r) => {
          perchbefore += Number(r.h);
        })
        //logger.debug('perchbefore:', perchbefore);

        let sumhbefore = pageButtonSpaceH * perchbefore / 100;
        //logger.debug('sumhbefore:', sumhbefore);

        let startYforThisBtn = titleHeight + sumhbefore + offsetYpage + paddingYbtn;
        //logger.debug('startYforThisBtn:', startYforThisBtn);

        // Make shure that the sum of button w per row is 100 or less
        //if not, let's size them evenly
        let calcBtnsPercWidthIs100 = row.buttons.reduce((n, { w }) => n + Number(w), 0);
        //logger.debug('calcBtnsPercWidthIs100:', calcBtnsPercWidthIs100);

        if (calcBtnsPercWidthIs100 > 100) {
          let widthEqual = 100 / row.buttons.length;
          row.buttons.forEach((btn) => {
            btn.w = Math.round(widthEqual * 100) / 100;
          })
        }

        for (let [bi, button] of row.buttons.entries()) {
          logger.debug('new button id:', bi);

          let percWbefore = 0;
          row.buttons.slice(0, bi).forEach((btn) => {
            percWbefore += Number(btn.w);
          })

          //logger.debug('percWbefore:', percWbefore);
          let sumwbefore = DEVICE_WIDTH * percWbefore / 100;
          //logger.debug('sumwbefore:', sumwbefore);

          let startXforThisBtn = (sumwbefore + paddingXbtn);
          //logger.debug('startXforThisBtn:', startXforThisBtn);

          let widthOfTheButton = ((DEVICE_WIDTH * Number(button.w)) / 100) - (paddingXbtn * 2);
          //logger.debug('widthOfTheButton:', widthOfTheButton);

          let heigthofthebutton = ((pageButtonSpaceH * Number(row.h)) / 100) - (paddingYbtn * 2);
          //logger.debug('heigthofthebutton:', heigthofthebutton);

          //logger.debug('spacer:', button.spacer);
          if (!button.spacer) {
            let btn = createWidget(widget.BUTTON, {
              text: button.text || 'btn_' + pi + ri + bi,
              text_size: button.text_size || TEXT_SIZE,
              color: button.text_color || COLOR_WHITE,
              x: px(startXforThisBtn),
              y: px(startYforThisBtn),
              w: px(widthOfTheButton),
              h: px(heigthofthebutton),
              radius: button.radius || BTN_RADIUS,
              normal_color: button.back_color || COLOR_GRAY,
              press_color: btnPressColor(button.back_color || COLOR_GRAY, 1.3),
              click_func: () => {
                if (button.input) {

                  function onKeyPress(kb, id, value) {
                    logger.debug(`id:${id} char:${value}`)
                    switch (value) {
                      case KEY_BACKSPACE:
                        if (inputText.length > 0) {
                          inputText = inputText.slice(0, -1);
                          kb.setProperty(prop.TEXT, inputText);
                        }
                        break;
                      case KEY_ABC:
                        renderKeyboard(kb_uppercase);
                        break;
                      case KEY_NUM:
                        renderKeyboard(kb_numbers);
                        break;
                      case KEY_SYMB:
                        renderKeyboard(kb_symbols);
                        break;
                      case KEY_abc:
                        renderKeyboard(kb_lowercase);
                        break;
                      case KEY_SEND:
                        sendText(inputText);
                        break;
                      case KEY_CANCEL:
                        inputText = '';
                        kb.setProperty(prop.TEXT, inputText);
                        closeKeyboard();
                        break;
                      default:
                        // Carattere normale
                        inputText += String.fromCharCode(value);
                        kb.setProperty(prop.TEXT, inputText);
                    }
                  }

                  function sendText(text) {
                    inputText = ''
                    logger.debug('Testo inviato:', text);
                    vm.executeButtonRequest(button.request, pi, text)
                    closeKeyboard()
                  }

                  function closeKeyboard() {
                    if (currentKeyboard) {
                      deleteWidget(currentKeyboard)
                      deleteWidget(kbBackground)
                      currentKeyboard = null
                      kbBackground = null
                      setScrollLock({lock: false})
                      setScrollMode({
                        mode: SCROLL_MODE_SWIPER,
                        options: {
                          height: DEVICE_HEIGHT,
                          count: data.pages.length,
                        },
                      });
                    }
                  }

                  function renderKeyboard(layout) {
                    //closeKeyboard()
                    setScrollLock({lock: true})

                    if (!currentKeyboard) {
                      inputText = '';
                      // Sfondo coprente
                      kbBackground = createWidget(widget.FILL_RECT, {
                        x: 0, y: px(offsetYpage),
                        w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
                        color: 0x000000,
                        alpha: 210       // (0-255)
                      });
                      currentKeyboard = createWidget(widget.KEYBOARD, {
                        click_func: onKeyPress,
                        key_attr: layout
                      });

                      currentKeyboard.setProperty(prop.Y, px(offsetYpage))

                      currentKeyboard.setProperty(prop.TEXT_STYLE, {
                        x: 0, y:  px(offsetYpage + 100),  //posizione testo sopra la tastiera
                        w: DEVICE_WIDTH,
                        align_h: align.CENTER,
                        color: 0xffffff,
                        show: 1
                      });

                      currentKeyboard.setProperty(prop.TEXT, inputText);
                      currentLayoutIds = new Set(layout.map(k => k.id));
                    } else {
                      applyLayout(layout);
                    }
                  }

                  function applyLayout(newLayout) {
                    if (!currentKeyboard) {
                      renderKeyboard(newLayout);
                      return;
                    }

                    const newIds = new Set(newLayout.map(k => k.id));

                    // aggiorna o aggiunge
                    newLayout.forEach(key => {
                      if (currentLayoutIds.has(key.id)) {
                        currentKeyboard.setProperty(prop.KEY_PARA, {
                          id: key.id,
                          x: key.x, y: key.y,
                          text: key.text,  // solo char singolo
                          image: key.image, // opzionale per pulsanti speciali
                          value: key.value
                        });
                      } else {
                        currentKeyboard.setProperty(prop.ADD_KEY, key);
                      }
                    });

                    // rimuove i tasti non più presenti
                    currentLayoutIds.forEach(oldId => {
                      if (!newIds.has(oldId)) {
                        currentKeyboard.setProperty(prop.DEL_KEY, { id: oldId });
                      }
                    });

                    currentLayoutIds = newIds;
                  }

                  renderKeyboard(kb_lowercase);
                } else {
                  vm.executeButtonRequest(button.request, pi)
                }
              }
            });
          }
        };//buttons
      };//rows
    };//pages

    this.refs.customToast = createWidget(widget.GROUP, {
      x: px(NOTIFICATION_X),
      y: px(NOTIFICATION_Y),
      w: px(NOTIFICATION_WIDTH),
      h: px(NOTIFICATION_H_MIN),
    })

    this.refs.customToastFillRect = this.refs.customToast.createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: px(NOTIFICATION_WIDTH),
      h: px(NOTIFICATION_H_MIN),
      radius: 30,
      color: COLOR_GRAY_TOAST,
      alpha: 235,
    })

    this.refs.customToastText = this.refs.customToast.createWidget(widget.TEXT, {
      x: 10,
      y: 10,
      w: px(NOTIFICATION_WIDTH - 20),
      h: px(NOTIFICATION_H_MIN - 20),
      color: COLOR_WHITE,
      text_size: NOTIFICATION_TEXT_SIZE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.WRAP,
      text: 'Hi'
    })

    this.refs.customToast.addEventListener(event.CLICK_DOWN, () => {
      this.refs.customToast.setProperty(prop.VISIBLE, false);
    })

    this.refs.customToast.setProperty(prop.VISIBLE, false);

  },
  notifyResult(txt, pageid, isError, type) {
    if (type == SYSTEM_TOAST) {
      showToast({
        content: txt,
      })
    } else if (type == CUSTOM_TOAST) {
      let { width, height } = getTextLayout(txt, {
        text_size: NOTIFICATION_TEXT_SIZE,
        text_width: px(NOTIFICATION_WIDTH - 20),
        wrapped: 1,//whether the text is line feed, 0: no line feed; 1: line feed
        rows_max: 7
      })

      this.refs.customToast.setProperty(prop.MORE, {
        x: px(NOTIFICATION_X), y: px(NOTIFICATION_Y - height + 20) + (pageid * DEVICE_HEIGHT), w: px(NOTIFICATION_WIDTH), h: height + 20,
      });
      this.refs.customToastFillRect.setProperty(prop.MORE, {
        x: 0, y: 0, w: px(NOTIFICATION_WIDTH), h: height + 20,
        color: isError ? COLOR_RED : COLOR_GRAY_TOAST,
      });
      this.refs.customToastText.setProperty(prop.MORE, {
        text: txt,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
        x: 10, y: 10, w: px(NOTIFICATION_WIDTH - 20), h: height,
      });

      this.refs.customToast.setProperty(prop.VISIBLE, true);

    } else if (type == SYSTEM_MODAL) {
      let systemModal = createModal({
       // title: txt,
        text: txt,
        autoHide: true,
        show: true
      })
    } else if (type == NO_NOTIFICATION) {
      return;
    } else {
      showToast({
        content: txt,
      })
    }
  }
}