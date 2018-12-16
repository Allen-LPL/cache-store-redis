const EventEmitter = require('events');
const redis = require('redis');

// 啥都不干
const noop = function noop() {};

/**
 * redis 基础操作类
 *
 * @class RedisStore
 * @extends {EventEmitter}
 */
class RedisStore extends EventEmitter {
  /**
   * 构造函数
   *
   * @param {Object} options
   *
   * @memberof RedisStore
   */
  constructor(opts) {
    super();
    this.init(opts);
  }

  /**
   * 初始化
   *
   * @param {Object} opts 初始化参数
   *
   * @memberof RedisStore
   */
  init(opts) {
    const options = opts || {};

    this.prefix = options.prefix || ''; // key 前缀
    delete options.prefix;

    this.serializer = options.serializer || JSON; // 序列号工具

    // 实例化 redis
    if (options.client) {
      this.client = options.client; // 已有客户端
    } else if (options.socket) {
      this.client = redis.createClient(options.socket, options);
    } else {
      this.client = redis.createClient(options);
    }

    if (options.pass) {
      this.client.auth(options.pass, (err) => {
        if (err) {
          throw err;
        }
      });
    }

    this.client.on('error', err => this.emit('disconnect', err));
    this.client.on('connect', () => this.emit('connect'));
  }

  /**
   * 但个获取数据
   *
   * @param {String} sid 键名
   * @param {Function} fn 回调函数
   *
   * @memberof RedisStore
   */
  get(sid, fn) {
    const store = this;
    const psid = store.prefix + sid;

    if (!fn) {
      fn = noop;
    }

    store.client.get(psid, (err, data) => {
      if (err) {
        return fn(err);
      }

      if (!data) {
        return fn();
      }

      let result;

      try {
        result = store.serializer.parse(data.toString());
      } catch (e) {
        return fn(e);
      }

      return fn(null, result);
    });
  }

  /**
   * 单个存入数据
   *
   * @param {String} sid 键名
   * @param {any} data 数据
   * @param {Number} ttl 超时(秒)，默认永久
   * @param {Function} fn 回调
   * @returns
   *
   * @memberof RedisStore
   */
  set(sid, data, ttl, fn) {
    const store = this;
    const args = [store.prefix + sid];

    if (typeof ttl === 'function') {
      fn = ttl;
      ttl = 0;
    } else if (!fn) {
      fn = noop;
    }

    let strData;

    try {
      strData = store.serializer.stringify(data);
    } catch (er) {
      return fn(er);
    }

    args.push(strData);

    if (ttl > 0) {
      args.push('EX', ttl);
    }

    store.client.set(args, (err, reply) => {
      if (err) {
        return fn(err);
      }

      return fn(null, reply);
    });

    return true;
  }

  /**
   * 注销给定键名的数据
   *
   * @param {String|Array} sid 键名或键名数组
   * @param {Function} fn 回调函数
   *
   * @memberof RedisUtils
   */
  destroy(sid, fn) {
    const prefix = this.prefix;

    if (Array.isArray(sid)) {
      const multi = this.client.multi();
      sid.forEach(s => multi.del(prefix + s));
      multi.exec(fn);
    } else {
      sid = prefix + sid;
      this.client.del(sid, fn);
    }
  }

  /**
   * Clear all cache.
   *
   * @param {Function} fn 回调函数
   *
   * @memberof RedisUtils
   */
  clear(fn) {
    this.client.flushdb(fn);
  }
}

/**
 * Module exports.
 */
module.exports = RedisStore;
