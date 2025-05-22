const WbMqtt = require('./to-wb-mqtt');

const devTemplate = {
  "meta": { "driver": "NodeJS", "title": "ironLogic_1", "error": "" },
  "controls": [
    { "title": "addresses", "type": "text",       "readonly": true,   "order": 0 },
    { "title": "SNs",       "type": "text",       "readonly": true,   "order": 1 },
    { "title": "connect",   "type": "switch",     "readonly": false,  "order": 2 },
    { "title": "open_1270", "type": "pushbutton", "readonly": false,  "order": 3 },
    { "title": "time_1270", "type": "text",       "readonly": true,   "order": 4 },
    { "title": "open_1294", "type": "pushbutton", "readonly": false,  "order": 5 },
    { "title": "time_1294", "type": "text",       "readonly": true,   "order": 6 },
    { "title": "open_1330", "type": "pushbutton", "readonly": false,  "order": 7 },
    { "title": "time_1330", "type": "text",       "readonly": true,   "order": 8 },
    { "title": "heartBeat", "type": "value",      "readonly": true,   "order": 9 },
    { "title": "reboot",    "type": "pushbutton", "readonly": false,  "order": 10 }
  ]
}


const qqq = new WbMqtt(devTemplate);

qqq.on('cmd', (control, val) => {
  console.log('ON', control, val)
  qqq.wbPublish('time_1270', 1254);
  qqq.wbPublish('open_1294', false);
  qqq.wbPublish('heartBeat', 'aaa');
})


qqq.on('status', (status) => {
  console.log('status', status)
})