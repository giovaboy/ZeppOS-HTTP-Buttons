export const data = {
    "pages": [{
        "title": "Amplifier",
        "text_size": 30,
        "back_color": 0x000000,
        "text_color": 0xffffff,
        "rows": [{
            "buttons": [
                {spacer:true,w:5},{
                    "text": "OFF",
                    "text_size": 40,
                    "icon": "",
                    "back_color": 0x8B0000,
                    "text_color": 0xffffff,
                    "radius": 100,
                    "w": 45,//percent of DEVICE_WIDTH
                    request: {
                        "url": 'http://192.168.1.113/a/off',
                        "method": 'get',
                        "headers": "",
                        "basic_auth": "",
                        "params": '',
                    }
                },
                {
                    "text": "VOL+",
                    "text_size": 40,
                    "icon": "",
                    "back_color": 0x808080,
                    "text_color": 0xffffff,
                    "radius": 20,
                    "w": 38,
                    request: {
                        "url": "http://192.168.1.113/a/volup",
                        "method": 'get',
                        "headers": "",
                        "basic_auth": "",
                        "params": '',
                    }
                },{spacer:true,w:12}
            ]
        },
        {
            "buttons": [
                {spacer:true,w:5},{
                    "text": "ON",
                    "text_size": 40,
                    "icon": "",
                    "back_color": "0x3cb371",
                    "text_color": 0xffffff,
                    "radius": 100,
                    "w": 45,
                    request: {
                        "url": "http://192.168.1.113/a/on",
                        "method": 'get',
                        "headers": "",
                        "basic_auth": "",
                        "params": '',
                    }
                },
                {
                    "text": "VOL-",
                    "text_size": 40,
                    "icon": "",
                    "back_color": 0x808080,
                    "text_color": 0xffffff,
                    "radius": 20,
                    "w": 38,
                    request: {
                        "url": "http://192.168.1.113/a/voldown",
                        "method": 'get',
                        "headers": "",
                        "basic_auth": "",
                        "params": '',
                    }
                },
            ]
        }
        ]
    },
    {
        "title": "second page",
        "back_color": 0x0000ab,
        "text_color": 0xffffff,
        "rows": [{
            "buttons": [
                {
                    "text": "TEST",
                    "icon": "",
                    "back_color": 0x8B0000,
                    "text_color": 0xffffff,
                    "w": 30,
                    radius: 60,
                    request: {
                        "url": 'https://bible-api.com/john%203:16',
                        "method": 'get',
                        json_result: 'title',
                    }
                },
                {
                    "text": "p2-ON",
                    "icon": "",
                    "back_color": "0x3cb371",
                    "text_color": "0xfefefe",
                    request: {
                        "url": 'https://bible-api.com/john%203:16',
                        "method": 'get',
                        json_result: 'title',
                    },
                    "w": 10
                },
                {
                    "text": "3",
                    "icon": "",
                    "back_color": "0x3cb371",
                    "text_color": "0xfefefe",
                    radius: 50,
                    request: {
                        "url": 'https://bible-api.com/john%203:16',
                        "method": 'get',
                        json_result: 'title',
                    },
                    "w": 60
                }
            ]
        },
        {
            "buttons": [
                {spacer:true,w:10},
                {
                    "text": "p2-3",
                    "icon": "",
                    "back_color": "0xb5b5b5",
                    "text_color": "0xeeeeee",
                    request: {
                        "url": 'https://bible-api.com/john%203:16',
                        "method": 'get',
                        json_result: 'title',
                    },
                    "w": 80
                }
            ]
        }
        ]

    }]
}