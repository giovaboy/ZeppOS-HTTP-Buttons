# HTTP-Buttons

A highly customizable ZeppOS application that lets you create buttons to trigger HTTP requests directly from your smartwatch. Perfect for home automation, IoT control, and quick API interactions.

## Screenshots

<p align="center">
  <img src="screen/1.png" width="180" alt="Main screen">
  <img src="screen/2.png" width="180" alt="Button configuration">
  <img src="screen/3.png" width="180" alt="Multiple pages">
</p>
<p align="center">
  <img src="screen/4.png" width="180" alt="Custom colors">
  <img src="screen/5.png" width="180" alt="Settings">
</p>

## Features

- **Multiple Pages** — Swipe between different button layouts
- **Customizable Buttons** — Set colors, sizes, radius, and text for each button
- **HTTP Methods** — Support for GET, POST, PUT, DELETE, PATCH, and more
- **Authentication** — Basic, Bearer, and Digest authentication support
- **Global Variables** — Define reusable variables like IP addresses or tokens
- **Input Keyboard** — On-watch keyboard for dynamic request parameters
- **Response Handling** — Choose between toast, modal, or silent notifications
- **JSON Parsing** — Extract specific fields from API responses

## Installation

1. Install the app from the Zepp App Store
2. Open the Zepp app on your phone
3. Go to the app settings to configure your buttons

## Configuration

All configuration is done through the companion app on your phone. You can:

- Add/remove pages, rows, and buttons
- Set button properties (text, colors, size)
- Configure HTTP requests (URL, method, headers, body)
- Define global variables for reuse across buttons
- Choose response notification style

### Global Variables

Define variables once and use them in any button URL, header, or body with `{variable_name}` syntax:

```json
{
  "variables": {
    "server_ip": "192.168.1.100",
    "api_token": "your-token-here"
  }
}
```

Then use in URLs: `http://{server_ip}/api/action`

### Input Buttons

Enable the "Input" option on a button to show an on-watch keyboard. The typed text replaces `{input}` in your request URL or body.

## Configuration Example

```json
{
  "variables": {
    "TV": "192.168.1.20",
    "AMP": "192.168.1.10"
  },
  "pages": [
    {
      "title": "Home",
      "back_color": 0,
      "rows": [
        {
          "h": 50,
          "buttons": [
            {
              "text": "ON",
              "w": 50,
              "back_color": 3978097,
              "radius": 100,
              "request": {
                "url": "http://{AMP}/on",
                "method": "GET",
                "response_style": 1
              }
            },
            {
              "text": "OFF",
              "w": 50,
              "back_color": 9109504,
              "radius": 100,
              "request": {
                "url": "http://{AMP}/off",
                "method": "GET",
                "response_style": 1
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Use Cases

- **Home Automation** — Control lights, thermostats, and smart devices
- **Media Control** — Play/pause, volume, channel switching
- **IoT Devices** — Trigger actions on Raspberry Pi, ESP32, etc.
- **API Testing** — Quick endpoint testing from your wrist
- **Shortcuts** — Execute webhooks and automations (IFTTT, Home Assistant, etc.)

## Compatibility

Works with ZeppOS 3.0+ devices including:
- Amazfit GTR/GTS series
- Amazfit Balance, Cheetah, T-Rex Ultra
- And other ZeppOS compatible watches

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Made with ❤️ for the ZeppOS community