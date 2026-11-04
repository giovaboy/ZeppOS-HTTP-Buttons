// The shortcut card's buttons: the ones marked "card": true in the config
// (settings: "Show on card"), in the config's order, at most CARD_MAX. Spacers
// can't go on it (nothing to press). Image buttons can: page/run receives the
// picture. Plain JS, no @zos imports: the settings page uses it too.

export const CARD_MAX = 6

// A button that may go on the card
export function cardAllowed(button) {
  return !!button && !button.spacer
}

// [{ p, r, b, button }] of the card's buttons
export function cardButtons(config) {
  const out = []
  const pages = (config && config.pages) || []
  for (let p = 0; p < pages.length; p++) {
    const rows = (pages[p] && pages[p].rows) || []
    for (let r = 0; r < rows.length; r++) {
      const buttons = (rows[r] && rows[r].buttons) || []
      for (let b = 0; b < buttons.length; b++) {
        if (buttons[b] && buttons[b].card && cardAllowed(buttons[b])) out.push({ p, r, b, button: buttons[b] })
        if (out.length >= CARD_MAX) return out
      }
    }
  }
  return out
}

// The params of the page the card opens for a button (page/run.js). `from`:
// 'page' when the buttons page opens it (an audio button)
export const runParams = (p, r, b, from) => JSON.stringify(from ? { p, r, b, from } : { p, r, b })
