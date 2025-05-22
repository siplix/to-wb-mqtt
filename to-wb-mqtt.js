const MQTT = require('mqtt');
const EventEmitter = require('events');

const MQTT_IP = '127.0.0.1';
const MQTT_USER = 'mqtusr';
const MQTT_PASS = 'mqtpaswd';

class WbMqtt extends EventEmitter {
  constructor(template) {
    super();
    this.template = this._templateValidate(template);
    this.drvName = template.meta.title;

    this._controls = [];

    this.status = 'disconnected';

    const options = {
      clientId: 'myNodeJS-' + (Math.random() * 1000000).toFixed(),
      port: 1883,
      host: MQTT_IP,
      protocol: 'mqtt',
      clean: true,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 3000,
    };
    if (MQTT_USER && MQTT_PASS) {
      options.username = MQTT_USER;
      options.password = MQTT_PASS;
    }
    this._mqttClient = MQTT.connect(options);
    this._init();
  }

  _init() {
    this._mqttClient.on('connect', () => {
      const mqttInitValues = [];
      const mqttSubscribeTopics = [];
      
      this.template.controls.forEach((control) => {
        this._controls.push(control.title);
        if (!control.readonly) {
          const subscribeTopic = `/devices/${this.drvName}/controls/${control.title}/on`;
          mqttSubscribeTopics.push(subscribeTopic);
        }
      });

      this._templateIteration(this.template, `/devices/${this.drvName}`, (topic, value) => {
        const payload = typeof value === 'object' ? JSON.stringify(value) : value.toString();
        mqttInitValues.push({ topic: topic, payload: payload });
      });
      mqttInitValues.forEach((el) => {
        this._mqttClient.publish(el.topic, el.payload, { retain: true });
      });
      mqttSubscribeTopics.forEach((el) => {
        this._mqttClient.subscribe(el);
      });

      console.log(`[TO-WB-MQTT] ${this.drvName} - connected`);
      this.status = 'connected';
      this.emit('status', 'connected');
    });

    this._mqttClient.on('message', (topic, message) => {
      // message is Buffer
      const val = message.toString();
      const control = topic.match(/controls\/([^\/]*)/)[1];
      this.emit('cmd', control, val);
    });

    this._mqttClient.on('error', (error) => {
      console.log(`[TO-WB-MQTT] ${this.drvName} - ${error.message}`);
      // this.emit('error', error);
    });

    this._mqttClient.on('close', () => {
      this.status = 'disconnected';
      console.log(`[TO-WB-MQTT] ${this.drvName} - disconnected`);
      // this.emit('status', 'disconnected');
    });

    this._mqttClient.on('reconnect', () => {
      this.status = 'reconnecting';
      console.log(`[TO-WB-MQTT] ${this.drvName} - reconnecting`);
      // this.emit('status', 'reconnecting');
    });
  }

  wbPublish(cmd, val) {
    if (this._controls.includes(cmd)) {
      const topic = `/devices/${this.drvName}/controls/${cmd}`;
      const payload = val.toString();
      this._mqttClient.publish(topic, payload);
    }
  }

  _templateIteration(obj, basePathString, cb) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        let pathSegmentsToAdd = [key]; // Часть пути, которую нужно добавить к basePathString

        // Если подобъект массив, и его элемент - объект, содержащий свойство "title"
        // добавляем к пути значение свойства "title" и новый элемент .../meta...
        if (Array.isArray(obj) && obj[key] && typeof obj[key] === 'object' && obj[key].title) {
          pathSegmentsToAdd = [obj[key].title, 'meta'];
        }

        // Формируем полный строковый путь к текущему элементу obj[key]
        const currentItemStringPath = basePathString + '/' + pathSegmentsToAdd.join('/');

        // Вызываем колбэк если елемент не массив
        if (!Array.isArray(obj[key])) {
          cb(currentItemStringPath, obj[key]);
        }

        // Рекурсивный вызов для вложенных объектов, передаем обновленный строковый путь
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this._templateIteration(obj[key], currentItemStringPath, cb);
        }
      }
    }
  }

  _templateValidate(data) {
    const requiredMetaKeys = ['driver', 'title', 'error'];
    const validTypes = new Set(['switch', 'range', 'pushbutton', 'value', 'text']);
    const requiredControlKeys = ['title', 'type', 'readonly', 'order'];

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('[JSON validate] not JSON object');
    }
    const orderValues = new Set();

    if (!data.hasOwnProperty('meta')) {
      throw new Error(`[JSON validate] root "meta" is missing`);
    }
    const meta = data.meta;
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
      throw new Error(`[JSON validate] "meta" must be an object`);
    }
    for (const key of requiredMetaKeys) {
      if (!meta.hasOwnProperty(key)) {
        throw new Error(`[JSON validate] in "meta" missing key: ${key}.`);
      }
    }
    if (typeof meta.title !== 'string' || typeof meta.error !== 'string' || typeof meta.driver !== 'string') {
      throw new Error(`[JSON validate] "meta.driver", "meta.title" and "meta.error" must be a string`);
    }

    if (!data.hasOwnProperty('controls')) {
      throw new Error(`[JSON validate] Driver: "${meta.title}" - controls missing`);
    }
    const controls = data.controls;
    if (!Array.isArray(controls) || controls.length === 0) {
      throw new Error(`[JSON validate] Driver: "${meta.title}" - controls must be array and not empty`);
    }

    for (let i = 0; i < controls.length; i++) {
      const controlItem = controls[i];

      if (typeof controlItem !== 'object' || controlItem === null || Array.isArray(controlItem)) {
        throw new Error(`[JSON validate] Driver: "${meta.title}" - all controls items must be objects`);
      }
      for (const key of requiredControlKeys) {
        if (!controlItem.hasOwnProperty(key)) {
          throw new Error(`[JSON validate] Driver: "${meta.title}" - in "controls[${i}]" missing key: ${key}`);
        }
      }
      if (typeof controlItem.title !== 'string' || typeof controlItem.type !== 'string') {
        throw new Error(
          `[JSON validate] Driver: "${meta.title}" - in "controls[${i}]" "title" and "type" must be string`
        );
      }
      if (!validTypes.has(controlItem.type)) {
        throw new Error(
          `[JSON validate] Driver: "${meta.title}" - "controls[${i}].type" incorrect ('${
            controlItem.type
          }'), allowed : ${Array.from(validTypes).join(', ')}`
        );
      }
      if (controlItem.type === 'range') {
        if (!controlItem.hasOwnProperty('min') || !controlItem.hasOwnProperty('max')) {
          throw new Error(
            `[JSON validate] Driver: "${meta.title}" - "controls[${i}].type"="range" but missing key "min" or "max"`
          );
        }
        if (!Number.isInteger(controlItem.min) || !Number.isInteger(controlItem.max)) {
          throw new Error(
            `[JSON validate] Driver: "${meta.title}" - "controls[${i}].type"="range" but "min" and "max" must be integer`
          );
        }
      }
      if (typeof controlItem.readonly !== 'boolean') {
        throw new Error(
          `[JSON validate] Driver: "${meta.title}" - "controls[${i}].readonly" must be boolean (true/false)`
        );
      }

      const orderVal = controlItem.order;
      if (typeof orderVal !== 'number' || !Number.isInteger(orderVal) || orderVal < 0) {
        throw new Error(
          `[JSON validate] Driver: "${meta.title}" - "controls[${i}].order" ('${orderVal}') must be an integer and positive`
        );
      }
      if (orderValues.has(orderVal)) {
        throw new Error(
          `[JSON validate] Driver: "${meta.title}" - in "controls" all 'order' values must be unique. Duplicate order found: ${orderVal}`
        );
      }
      orderValues.add(orderVal);
    }
    const sortedOrders = Array.from(orderValues).sort((a, b) => a - b);

    for (let k = 0; k < controls.length; k++) {
      if (sortedOrders[k] !== k) {
        throw new Error(
          `[JSON validate] Driver: "${meta.title}" - The minimum value of "order" is not 0 or there is a gap in the sequence of values ​​of the "order" properties`
        );
      }
    }

    return data;
  }
}

module.exports = WbMqtt;