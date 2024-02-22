import { px } from "@zos/utils"
import { createWidget, widget, align, prop, text_style, event } from '@zos/ui'
import { setScrollMode, SCROLL_MODE_SWIPER } from '@zos/page'
import { getDeviceInfo } from '@zos/device';
import { BTN_PADDING, ROW_PADDING, BTN_RADIUS, btnPressColor, COLOR_BLACK, COLOR_GRAY_TOAST, COLOR_BLUE, COLOR_GRAY, COLOR_GREEN, COLOR_INDIGO, COLOR_ORANGE, COLOR_RED, COLOR_VIOLET, COLOR_WHITE, COLOR_YELLOW } from '../utils/constants.js';

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();
export const TEXT_SIZE = DEVICE_WIDTH / 16;

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
        scroll_complete_func(info) {
          // console.log('scroll complete')
          // console.log(JSON.stringify(info))
        }
      },
    });

    createWidget(widget.PAGE_SCROLLBAR, {});

    for (let [pi, page] of data.pages.entries()) {

      let titleHeigth = 0;
      let paddingXbtn = page.button_padding || BTN_PADDING;
      let paddingYbtn = page.row_padding || ROW_PADDING;

      console.log(page.title);
      let offsetYpage = (DEVICE_HEIGHT * pi);
      console.log('offsetYpage:', offsetYpage);

      let pageBackground = createWidget(widget.FILL_RECT, {
        x: 0, y: px(offsetYpage), w: px(DEVICE_WIDTH), h: px(DEVICE_HEIGHT),
        color: page.back_color || COLOR_BLACK
      })

      if (page.title) {
        titleHeigth = 50;
        let pageTitle = createWidget(widget.TEXT, {
          x: 0,
          y: px(offsetYpage),
          w: px(DEVICE_WIDTH),
          h: px(titleHeigth),
          color: page.text_color || COLOR_WHITE,
          text: page.title,
          text_size: page.text_size || TEXT_SIZE,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V,
          text_style: text_style.NONE
        });
      }

      for (let [ri, row] of page.rows.entries()) {
        let offsetYrow = (((DEVICE_HEIGHT - titleHeigth) / page.rows.length) * ri);
        console.log('new row:', ri);
        console.log('offsetYrow:', offsetYrow);

        // Make shure that the sum of button w per row is 100 or less
        //if not, let's size them evenly
        let calcBtnsPercWidthIs100 = row.buttons.reduce((n, { w }) => n + Number(w), 0);
        console.log('calcBtnsPercWidthIs100:', calcBtnsPercWidthIs100);

        if (calcBtnsPercWidthIs100 > 100) {
          let widthEqual = 100 / row.buttons.length;
          row.buttons.forEach((btn) => {
            btn.w = Math.round(widthEqual * 100) / 100;
          })
        }

        for (let [bi, button] of row.buttons.entries()) {
          console.log('new button id:', bi);

          let percwbefore = 0;
          row.buttons.slice(0, bi).forEach((btn) => {
            percwbefore += Number(btn.w);
          })

          console.log('percwbefore:', percwbefore);
          let sumwbefore = DEVICE_WIDTH * percwbefore / 100;
          console.log('sumwbefore:', sumwbefore);

          let startXforThisBtn = (sumwbefore + paddingXbtn);
          console.log('startXforThisBtn:', startXforThisBtn);

          let widthOfTheButton = ((DEVICE_WIDTH * Number(button.w)) / 100) - (paddingXbtn * 2);
          console.log('widthOfTheButton:', widthOfTheButton);

          console.log('spacer:', button.spacer);
          if (!button.spacer) {
            let btn = createWidget(widget.BUTTON, {
              text: button.text || 'btn_' + pi + ri + bi,
              text_size: button.text_size || TEXT_SIZE,
              x: px(startXforThisBtn),
              y: px(paddingYbtn + (titleHeigth) + offsetYrow + offsetYpage),
              w: px(widthOfTheButton),
              h: px((DEVICE_HEIGHT - titleHeigth) / page.rows.length - (paddingYbtn * 2)),// TODO: customizable row height
              radius: button.radius || BTN_RADIUS,
              normal_color: button.back_color || COLOR_GRAY,
              press_color: btnPressColor(button.back_color || COLOR_GRAY, 1.3),
              click_func: () => {
                //console.log('button click');
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
      line_width: 40,
      color: COLOR_GRAY_TOAST
    });

    this.refs.resultText = createWidget(widget.TEXT, {
      text: 'TEST',
      text_size: 32,
      x: px(60 + 10),
      y: px(346),
      w: px(360 - 20),
      h: px(70),
      color: COLOR_WHITE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    });

    this.refs.resultText.addEventListener(event.CLICK_DOWN, (info) => {
      console.log('result button click');
      this.refs.resultToast.setProperty(prop.VISIBLE, false);
      this.refs.resultText.setProperty(prop.VISIBLE, false);
    });

    this.refs.resultToast.setProperty(prop.VISIBLE, false);
    this.refs.resultText.setProperty(prop.VISIBLE, false);


  },
  notifyResult(txt, pageid, iserror) {
    console.log('notifyResult', txt);
    this.refs.resultText.setProperty(prop.MORE, {
      y: px(346) + (pageid * DEVICE_HEIGHT),
      color: iserror ? COLOR_WHITE : COLOR_WHITE,
      text: txt
    });
    this.refs.resultToast.setProperty(prop.MORE, {
      y: px(350) + (pageid * DEVICE_HEIGHT),
      color: iserror ? COLOR_RED : COLOR_GRAY
    });
    this.refs.resultToast.setProperty(prop.VISIBLE, true);
    this.refs.resultText.setProperty(prop.VISIBLE, true);
  },
}