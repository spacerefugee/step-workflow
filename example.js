function step1(data) {
  console.log('running :', this.stepName, data);
  console.log('globalData:', this.globalData);
  return data + 100;
}
function step2(data) {
  console.log('running :', this.stepName, data);
  console.log('globalData:', this.globalData2);
  return data * 2;
}
function step3(data) {
  console.log('running :', this.stepName, data);
  console.log('globalData:', this.globalData3);
  return data - 10;
}
function finalStep(data) {
  console.log('running :', this.stepName, data);
  console.log('globalData:', this.globalData4);
  return data / 2;
}

function asyncStep(data) {
  console.log('running :', this.stepName, data);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data + 100);
    }, 1000);
  });
}
function errorStep(data) {
  console.log('running :', this.stepName, data);
  throw new Error('this is a error');
}
function rollback(err, data) {
  console.log('rolling back:', this.stepName, data);
}
function asyncRollback(err) {
  console.log('rolling back:', this.stepName, err);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 1000);
  });
}

(async () => {
  const StepWorkflow = require('./StepWorkflow');

  // 传入一个对象可以作为实例变量，可以在所有step,rollback中用this访问(需要使用function关键字定义函数)
  const workflow = new StepWorkflow({
    globalData: 1,
    globalData2: 2,
    globalData3: 3,
    globalData4: 4,
  });
  workflow.step(step1).step(step2).step(step3).final(finalStep);
  // run方法接收三个参数
  // stepName: 从那个step开始执行，null或者不传默认就从第一个step开始执行
  // data: 执行step传入的参数
  // oneStep: 只执行一个step 默认false
  const result = await workflow.run(null, 100);
  console.log(result);
  // 从step2开始
  const result2 = await workflow.run('step2', 100);
  console.log(result2);

  // 直接调用
  await StepWorkflow()
    .step(step1)
    .rollback(rollback) // 回滚方法
    .step(step2)
    .rollback(rollback) // 回滚方法会往上执行，出错步骤前所有具有rollback的方法都会被执行
    .step(errorStep) // 会抛出错误的step
    // 错误处理，若继续抛出，则在catch捕获
    .error((error) => {
      console.log('error handler', error);
      throw error;
    })
    // step3不会执行，因为上一个步骤抛出异常
    .step(step3)
    .rollback(rollback) // 此回滚方法不会被执行，因为是上一个步骤抛出的异常
    // catch 捕获所有异常
    .catch((error) => console.log('catch handler', error))
    .run(null, 100);

  await StepWorkflow()
    .step(asyncStep) // setp支持async
    .rollback(asyncRollback) // 回滚方法也支持async
    .step(errorStep) // 会抛出错误的step
    .error((error) => {
      console.log('error handler', error);
    })
    // step3不会执行，因为上一个步骤抛出异常
    .step(step3)
    // 上面的error已经处理了错误，所以这个catch不会执行
    .catch((error) => console.log('catch handler', error))
    .run(null, 100);
})();
