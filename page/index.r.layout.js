import { px } from '@zos/utils'
import { createWidget, deleteWidget, widget, align, prop, text_style, event, getTextLayout, anim_status} from '@zos/ui'
import { setPageBrightTime } from '@zos/display'
import { setScrollMode, setScrollLock, SCROLL_MODE_SWIPER } from '@zos/page'
import { getDeviceInfo } from '@zos/device'
import { showToast, createModal } from '@zos/interaction'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE } from 'zosLoader:./keyboard.[pf].layout.js'
import { isSystemKeyboardAvailable, openSystemKeyboard } from '../utils/keyboard.js'
import { openAppKeyboard } from '../utils/app-keyboard.js'
import { pressButton } from '../utils/press-queue.js'
import { runAudioTest, playLastRecording } from '../utils/audio-test.js'
import { stopAllLoaders } from '../utils/button-loader.js'
import { BTN_PADDING, ROW_PADDING, BTN_RADIUS, btnPressColor, COLOR_BLACK, COLOR_GRAY_TOAST, COLOR_GRAY, COLOR_RED, COLOR_WHITE, CUSTOM_TOAST, SYSTEM_TOAST, SYSTEM_MODAL, NO_NOTIFICATION, SHOW_IMAGE, KB_TYPE_CHAR, KB_TYPE_NUMERIC } from '../utils/constants.js';

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();
// This screen's key layouts, for the keyboard the app draws
const KEYS = { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE };
const TEXT_SIZE = DEVICE_WIDTH / 16;

const NOTIFICATION_X = 60
const NOTIFICATION_Y = 350
const NOTIFICATION_WIDTH = DEVICE_WIDTH - (NOTIFICATION_X * 2)
const NOTIFICATION_H_MIN = 40
const NOTIFICATION_TEXT_SIZE = 32

const logger = getLogger('http-buttons-layout')

// Native pixel size of the loading anim PNGs (assets .../anim/loading*.png).
// It's the real asset size, so it is NOT scaled by px() — the anim is drawn at
// its intrinsic resolution; we only center it and place the caption beneath it.
const LOADING_ANIM_SIZE = 155;

export const LOADING_TEXT_WIDGET = {
  x: 0,
  y: (DEVICE_HEIGHT/2)+LOADING_ANIM_SIZE,
  w: DEVICE_WIDTH, h: TEXT_SIZE*1.5,
  text_size: TEXT_SIZE,
  color: COLOR_WHITE,
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
  text_style: text_style.WRAP,
  text: getText('loading')
};

export const LOADING_IMG_ANIM_WIDGET = {
    anim_path: 'anim',
    anim_prefix: 'loading',
    anim_ext: 'png',
    anim_fps: 24,
    anim_size: 54,
    repeat_count: 0,
    anim_status: anim_status.START,
    x: (DEVICE_WIDTH/2)-(LOADING_ANIM_SIZE/2), y: DEVICE_HEIGHT/2
  };

export const layout = {
  refs: {},
  // Full-screen descriptive message for the error/empty states. For the
  // "no config at all" case it also offers a button to load the example config.
  renderMessage(vm, text, offerLoad) {
    createWidget(widget.TEXT, {
      x: px(20), y: 0,
      w: px(DEVICE_WIDTH - 40), h: offerLoad ? px(DEVICE_HEIGHT * 0.68) : DEVICE_HEIGHT,
      color: COLOR_WHITE, text_size: 30,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.WRAP, text: text
    })
    if (offerLoad) {
      const bw = DEVICE_WIDTH * 0.6, bh = 64
      createWidget(widget.BUTTON, {
        x: px((DEVICE_WIDTH - bw) / 2), y: px(DEVICE_HEIGHT * 0.72),
        w: px(bw), h: px(bh), radius: px(bh / 2),
        normal_color: COLOR_GRAY, press_color: btnPressColor(COLOR_GRAY, 1.3),
        color: COLOR_WHITE, text_size: TEXT_SIZE,
        text: getText('load_example'),
        click_func: () => vm.loadExampleConfig()
      })
    }
  },
  render(vm) {
    // Distinct, descriptive states (never overwrite the user's config):
    // comms failure, invalid JSON, or no config at all (offers Load example).
    // The page parsed the config once (vm.state.config); a press reads the
    // same object.
    if (vm.state.isError) {
      this.renderMessage(vm, getText('comunication_error'), false)
      return;
    }
    if (vm.state.configError) {
      this.renderMessage(vm, getText('config_error'), false)
      return;
    }
    if (!vm.state.config) {
      this.renderMessage(vm, getText('no_config'), true)
      return;
    }
    // A config with no pages (all deleted in the settings) drew nothing at
    // all: a black screen
    if (!vm.state.config.pages.length) {
      this.renderMessage(vm, getText('no_pages'), false)
      return;
    }
    /* BUILD UI */
    let data = vm.state.config

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
                // Names the button in the log lines (page, row, button, label)
                const label = 'p' + pi + 'r' + ri + 'b' + bi + (button.text ? ' ' + String(button.text).slice(0, 20) : '')
                // One press at a time per button (utils/press-queue.js): a tap
                // on a busy button waits its turn; the loading animation
                // (utils/button-loader.js, config loading_style) runs until
                // the last one is done.
                // A new press hides the last result: the press's animation,
                // created now, would be drawn over it (and a new result comes)
                const runRequest = (text) => this.hideToast() || pressButton(vm, pi + '_' + ri + '_' + bi, {
                  rect: { x: startXforThisBtn, y: startYforThisBtn, w: widthOfTheButton, h: heigthofthebutton, radius: button.radius || BTN_RADIUS },
                  back: button.back_color || COLOR_GRAY,
                  label,
                  start: (t, done) => {
                    if (button.audio_last) {
                      // EXPERIMENT (test mode): play the last recording
                      playLastRecording(vm, pi, label, done)
                    } else if (button.audio_test) {
                      // EXPERIMENT (test mode): record and POST audio (utils/audio-test.js)
                      runAudioTest(vm, button, pi, label, done)
                    } else if (button.request && button.request.response_style === SHOW_IMAGE) {
                      // Images go one at a time, whatever the button
                      // (vm.pressImage); done once the picture is shown or
                      // failed.
                      vm.pressImage(button.request, pi, t, label, done)
                    } else {
                      const p = vm.executeButtonRequest(button.request, pi, t, label)
                      if (p && p.then) p.then(done, done)
                      else done()
                    }
                  },
                }, text)
                if (button.input) {
                  // Prefer the native system keyboard (API_LEVEL 4.0+);
                  // fall back to the hand-drawn keyboard on older devices.
                  if (isSystemKeyboardAvailable()) {
                    openSystemKeyboard(vm, button, pi, runRequest)
                    return
                  }

                  // The keyboard the app draws (utils/app-keyboard.js), over
                  // this page's screen; the pages don't scroll while it is open
                  openAppKeyboard({
                    keys: KEYS, keyboardType: button.keyboard_type, y: px(offsetYpage),
                    onSubmit: (text) => runRequest(text),
                    onOpen: () => setScrollLock({ lock: true }),
                    onClose: () => {
                      setScrollLock({ lock: false })
                      setScrollMode({ mode: SCROLL_MODE_SWIPER, options: { height: DEVICE_HEIGHT, count: data.pages.length } })
                    },
                  })
                } else {
                  runRequest()
                }
              }
            });
          }
        };//buttons
      };//rows
    };//pages

    // The custom toast is created when it shows (showToastBox), not here: on
    // the watch the widget created last is drawn on top, and a toast made at
    // the page's start ended up under the loading animation of a button
    // pressed later
    this.refs.customToast = null;
    this.refs.customToastFillRect = null;
    this.refs.customToastText = null;

    /* Fullscreen image overlay (response_style = SHOW_IMAGE) is built lazily in
       showImage() with TOP-LEVEL widgets — IMG does not render as a GROUP child,
       which left a black background with no image on top. */
    this.refs.imageViewBg = null;
    this.refs.imageViewImg = null;

  },
  // Page teardown: the loading animations and their shared tick
  stopLoaders() {
    stopAllLoaders()
  },
  hideImage() {
    if (this.refs.imageViewImg) { deleteWidget(this.refs.imageViewImg); this.refs.imageViewImg = null; }
    if (this.refs.imageViewSpinner) { deleteWidget(this.refs.imageViewSpinner); this.refs.imageViewSpinner = null; }
    if (this.refs.imageViewLoadingText) { deleteWidget(this.refs.imageViewLoadingText); this.refs.imageViewLoadingText = null; }
    if (this.refs.imageViewBg) { deleteWidget(this.refs.imageViewBg); this.refs.imageViewBg = null; }
  },
  showImage(vm, filePath, pageid) {
    const offsetY = (pageid || 0) * DEVICE_HEIGHT;
    this.hideImage();
    // Top-level widgets, placed on the page that triggered the request (the
    // swiper offsets each page by one screen height). Black backdrop first,
    // image (created with its src) on top; tap either to dismiss.
    this.refs.imageViewBg = createWidget(widget.FILL_RECT, {
      x: 0, y: px(offsetY), w: px(DEVICE_WIDTH), h: px(DEVICE_HEIGHT),
      color: COLOR_BLACK, alpha: 255,
    });
    // Create at native size first so we can read the image's real dimensions,
    // then scale-to-fit (keeping aspect) and center it on both axes.
    let drawn = null; // { iw, ih, w, h } for the page's log line
    const img = createWidget(widget.IMG, { x: 0, y: px(offsetY), src: filePath });
    const iw = img.getProperty(prop.W);
    const ih = img.getProperty(prop.H);
    if (iw && ih && iw > 0 && ih > 0) {
      const scale = Math.min(DEVICE_WIDTH / iw, DEVICE_HEIGHT / ih);
      const w = Math.round(iw * scale);
      const h = Math.round(ih * scale);
      drawn = { iw, ih, w, h };
      img.setProperty(prop.MORE, {
        x: px(Math.round((DEVICE_WIDTH - w) / 2)),
        y: px(Math.round(offsetY + (DEVICE_HEIGHT - h) / 2)),
        w: px(w), h: px(h),
        auto_scale: true,
        auto_scale_obj_fit: true, // box already matches aspect, so fill = no distortion
      });
    } else {
      // Dimensions unknown: fall back to fit-to-screen keeping aspect (may
      // top-align for non-square images).
      img.setProperty(prop.MORE, {
        x: 0, y: px(offsetY),
        w: px(DEVICE_WIDTH), h: px(DEVICE_HEIGHT),
        auto_scale: true,
        auto_scale_obj_fit: false,
      });
    }
    this.refs.imageViewImg = img;
    this.refs.imageViewBg.addEventListener(event.CLICK_DOWN, () => this.hideImage());
    this.refs.imageViewImg.addEventListener(event.CLICK_DOWN, () => this.hideImage());
    return drawn;
  },
  // Hide the custom toast (a new press): it is drawn again at the next result
  hideToast() {
    if (this.refs.customToast) this.refs.customToast.setProperty(prop.VISIBLE, false);
  },
  // The custom toast, created anew at each result so it is the newest widget
  // and sits over the loading animations already running (the watch has no
  // z-order: the widget created last is on top)
  showToastBox(txt, height, pageid, isError) {
    if (this.refs.customToast) {
      try { deleteWidget(this.refs.customToast); } catch (e) { /* gone with the page */ }
    }
    const group = createWidget(widget.GROUP, {
      x: px(NOTIFICATION_X), y: px(NOTIFICATION_Y - height + 20) + (pageid * DEVICE_HEIGHT),
      w: px(NOTIFICATION_WIDTH), h: height + 20,
    });
    this.refs.customToastFillRect = group.createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: px(NOTIFICATION_WIDTH), h: height + 20,
      radius: 30, color: isError ? COLOR_RED : COLOR_GRAY_TOAST, alpha: 235,
    });
    this.refs.customToastText = group.createWidget(widget.TEXT, {
      x: 10, y: 10, w: px(NOTIFICATION_WIDTH - 20), h: height,
      color: COLOR_WHITE, text_size: NOTIFICATION_TEXT_SIZE,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.WRAP, text: txt,
    });
    group.addEventListener(event.CLICK_DOWN, () => group.setProperty(prop.VISIBLE, false));
    this.refs.customToast = group;
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

      this.showToastBox(txt, height, pageid, isError);

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