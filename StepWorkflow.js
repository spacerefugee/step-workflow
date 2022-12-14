const EventEmitter = require('events');
/**
 * StepWorkflow
 */
class StepWorkflow extends EventEmitter {
  #steps = new Map();
  #stepNames = new Map();
  #rollbacks = new Map();
  #errors = new Map();
  #stepKey;
  #final;
  #catch;
  #run = [];
  #done = false;
  /**
   * create a workflow
   * @param {object} [globalData] data that assign to instance
   */
  constructor(globalData = {}) {
    super();
    Object.assign(this, globalData);
  }
  /**
   * steps name
   * @returns {string[]} array of steps name
   */
  get steps() {
    return Array.from(this.#stepNames.values());
  }
  /**
   * step function
   * @param  {(string|function)} step
   * @param  {function} [stepFn]
   * @returns {StepWorkflow} instance
   */
  step(step, stepFn) {
    let stepName = step;
    if (typeof step === 'function') {
      stepFn = step;
      stepName = step.name || 'Anonymous';
    }
    const stepKey = Date.now() + '' + Math.floor(Math.random() * 1000);
    this.#stepKey = stepKey;
    this.#steps.set(stepKey, stepFn);
    this.#stepNames.set(stepKey, stepName);
    return this;
  }
  /**
   * error function, run when step runs failed
   * @param {function} fn
   * @returns {StepWorkflow} instance
   */
  error(fn) {
    if (typeof fn === 'function' && this.#stepKey) {
      this.#errors.set(this.#stepKey, fn);
    }
    return this;
  }
  /**
   * rollback function, run when step runs failed, will run all above rollback functions backwards
   * @param {function} fn
   * @returns {StepWorkflow} instance
   */
  rollback(fn) {
    if (typeof fn === 'function' && this.#stepKey) {
      this.#rollbacks.set(this.#stepKey, fn);
    }
    return this;
  }
  /**
   * final function - run after all steps run successfully
   * @param {function} fn
   * @returns {StepWorkflow} instance
   */
  final(fn) {
    if (typeof fn === 'function') {
      this.#final = fn;
    }
    return this;
  }
  /**
   * catch function - catch the unhandled errors
   * @param {function} fn
   * @returns {StepWorkflow} instance
   */
  catch(fn) {
    if (typeof fn === 'function') {
      this.#catch = fn;
    }
    return this;
  }
  async #rollback(error) {
    for (const { key, data } of this.#run) {
      if (this.#rollbacks.has(key)) {
        try {
          this.emit('rollback', data, error, this);
          await this.#rollbacks.get(key).call(this, data, error);
        } catch (err) {
          const _error = Object.assign(err, { rollback: true, stepName: this.#stepNames.get(key), data });
          throw _error;
        }
      }
    }
    this.#run = [];
  }
  /**
   * run the workflow step by step
   * @param {*} [initData] data that pass to this step
   * @param {string} [stepName] step name - workflow will start with this step, pass `null` for starting with first step
   * @param {boolean} oneStep only run this step, default is `false`, all the steps behind will run
   * @returns {Promise}
   */
  async run(initData, stepName, oneStep = false) {
    this.emit('start', initData, this);
    try {
      let data = initData;
      for (const [key, step] of this.#steps) {
        if (this.#done) break;
        this.stepName = this.#stepNames.get(key);
        if (stepName && this.stepName != stepName) {
          !oneStep && (stepName = null);
          continue;
        }
        const currentData = JSON.parse(JSON.stringify(data || null));
        try {
          this.emit('step', data, this);
          data = await step.call(this, data);
          this.#run.unshift({ key, data: currentData });
        } catch (error) {
          this.#run.unshift({ key, data: currentData });
          const _error = Object.assign(error, { stepName: this.#stepNames.get(key), data: currentData });
          if (this.#errors.has(key)) {
            await this.#errors.get(key).call(this, _error);
          } else {
            await this.#rollback(_error);
            throw _error;
          }
        }
      }
      if (this.#final) {
        this.stepName = this.#final.name || 'final';
        this.emit('final', data, this);
        data = await this.#final.call(this, data);
      }
      this.#run = [];
      this.#done = false;
      this.emit('done', data, this);
      return data;
    } catch (error) {
      this.emit('error', error, this);
      if (this.#catch) {
        return await this.#catch(error);
      } else {
        throw error;
      }
    }
  }
  done() {
    this.#done = true;
  }
}

/**
 *
 * @param {*} result
 * @returns {StepWorkflow} stepWorkflow
 */
module.exports = function (result) {
  if (!(this instanceof StepWorkflow)) {
    return new StepWorkflow(result);
  }
  return this;
};
