import { px, log } from "@zos/utils"
import { createWidget, widget, align, prop, text_style, event, getTextLayout } from '@zos/ui'
import { setScrollMode, SCROLL_MODE_SWIPER } from '@zos/page'
import { getDeviceInfo } from '@zos/device'
import { showToast } from '@zos/interaction'
import { BTN_PADDING, ROW_PADDING, BTN_RADIUS, btnPressColor, COLOR_BLACK, COLOR_GRAY_TOAST, COLOR_GRAY, COLOR_RED, COLOR_WHITE, CUSTOM_TOAST, SYSTEM_TOAST, SYSTEM_MODAL } from '../utils/constants.js';

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();
const TEXT_SIZE = DEVICE_WIDTH / 16;

const logger = log.getLogger('http-buttons')

export const layout = {
  refs: {},
  render(vm) {
    /* BUILD UI */
    let data = JSON.parse(vm.state.data)

    setScrollMode({
      mode: SCROLL_MODE_SWIPER,
      options: {
        height: DEVICE_HEIGHT,
        count: data.pages.length,
        // scroll_complete_func(info) {
        //   // logger.debug('scroll complete')
        //   // logger.debug(JSON.stringify(info))
        // }
      },
    });

    createWidget(widget.PAGE_SCROLLBAR, {});

    for (let [pi, page] of data.pages.entries()) {
      logger.debug('page:',pi);
      let offsetYpage = (DEVICE_HEIGHT * pi);
      let titleHeight = 0;
      let paddingXbtn = page.button_padding || BTN_PADDING;
      let paddingYbtn = page.row_padding || ROW_PADDING;

      logger.debug('offsetYpage:', offsetYpage);

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
      logger.debug('calcRowsPercHeigthIs100:', calcRowsPercHeigthIs100);

      if (calcRowsPercHeigthIs100 > 100) {
        let heigthEqual = 100 / page.rows.length;
        page.rows.forEach((row) => {
          row.h = Math.round(heigthEqual * 100) / 100;
        })
      }

      let pageButtonSpaceH = DEVICE_HEIGHT - titleHeight

      for (let [ri, row] of page.rows.entries()) {

        let perchbefore = 0;

        page.rows.slice(0, ri).forEach((r) => {
          perchbefore += Number(r.h);
        })
        //logger.debug('perchbefore:', perchbefore);

        let sumhbefore = pageButtonSpaceH * perchbefore / 100;
        logger.debug('sumhbefore:', sumhbefore);

        let startYforThisBtn = titleHeight + sumhbefore + offsetYpage + paddingYbtn;
        logger.debug('startYforThisBtn:', startYforThisBtn);

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
          logger.debug('heigthofthebutton:', heigthofthebutton);

          //logger.debug('spacer:', button.spacer);
          if (!button.spacer) {
            let btn = createWidget(widget.BUTTON, {
              text: button.text || 'btn_' + pi + ri + bi,
              text_size: button.text_size || TEXT_SIZE,
              x: px(startXforThisBtn),
              y: px(startYforThisBtn),
              w: px(widthOfTheButton),
              h: px(heigthofthebutton),
              radius: button.radius || BTN_RADIUS,
              normal_color: button.back_color || COLOR_GRAY,
              press_color: btnPressColor(button.back_color || COLOR_GRAY, 1.3),
              click_func: () => {
                vm.getYourData(button.request, pi)
              }
            });
          }

        };//buttons
      };//rows
    };//pages

    this.refs.resultToast = createWidget(widget.STROKE_RECT, {
      x: px(60),
      y: px(350),
      w: px(360),
      h: px(70),
      radius: 40,
      line_width: 50,
      color: COLOR_GRAY_TOAST
    });

    this.refs.resultText = createWidget(widget.TEXT, {
      text: 'TEST',
      text_size: 32,
      x: px(60 + 10),
      y: px(346),
      w: px(360 - 20),
      h: px(70),//*1.25
      color: COLOR_WHITE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    });

    this.refs.resultText.addEventListener(event.CLICK_DOWN, (info) => {
      logger.debug('result button click');
      this.refs.resultToast.setProperty(prop.VISIBLE, false);
      this.refs.resultText.setProperty(prop.VISIBLE, false);
    });

    this.refs.resultToast.setProperty(prop.VISIBLE, false);
    this.refs.resultText.setProperty(prop.VISIBLE, false);

  },
  notifyResult(txt, pageid, isError, type) {
    if (type == SYSTEM_TOAST) {
      showToast({
        content: txt,
      })
    } else if (type == CUSTOM_TOAST) {
      logger.debug('notifyResult', txt);
      let { width, height } = getTextLayout(txt, {
        text_size: 32,
        text_width: px(360 - 20),
        wrapped	: 1,//whether the text is line feed, 0: no line feed; 1: line feed
        rows_max: 6
      })
      this.refs.resultText.setProperty(prop.MORE, {
        y: px(346-70-height) + (pageid * DEVICE_HEIGHT),w:width,h:height,
        color: isError ? COLOR_WHITE : COLOR_WHITE,
        text: txt
      });
      this.refs.resultToast.setProperty(prop.MORE, {
        y: px(350) + (pageid * DEVICE_HEIGHT),w:width+20,h:height,
        color: isError ? COLOR_RED : COLOR_GRAY
      });
      this.refs.resultToast.setProperty(prop.VISIBLE, true);
      this.refs.resultText.setProperty(prop.VISIBLE, true);
    } else if (type == SYSTEM_MODAL) {
      this.refs.systemModal = createModal({
        content: txt,
        autoHide: true,
        onClick: (keyInfo) => {
          logger.debug(keyInfo)
          const { type } = keyInfo
          if (type === MODAL_CONFIRM) {
            logger.debug('confirm')
          } else {
            this.refs.systemModal.show(false)
          }
        },
      })
      this.refs.systemModal.show(true)

    } else {
      showToast({
        content: txt,
      })
    }
  },
}