# step-workflow

A ES6 workflow execution tool with transaction mechanism

Inspired by [stepify](https://github.com/chemdemo/node-stepify).

### Example

```javascript
// 传入一个对象可以作为实例变量，可以在所有step,rollback中用this访问(需要使用function关键字定义函数)
const workflow = new StepWorkflow({
  globalData: 1,
  globalData2: 2,
  globalData3: 3,
  globalData4: 4,
});
workflow.step(step1).step(step2).step(step3).final(finalStep);
// run方法接收三个参数
// data: 执行step传入的参数
// stepName: 从那个step开始执行，null或者不传默认就从第一个step开始执行
// oneStep: 只执行一个step 默认false
const result = await workflow.run(100);
console.log(result);
// 从step2开始
const result2 = await workflow.run(100，'step2');
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
  .run(100);

await StepWorkflow()
  .step(asyncStep) // setp支持async
  .rollback(asyncRollback) // 回滚方法也支持async
  .step(errorStep) // 会抛出错误的step
  .error((error) => {
    console.log('error handler', error);
  })
  // step3继续执行，因为上一个步骤的异常已经被处理
  .step(step3)
  // 上面的error已经处理了错误，所以这个catch不会执行
  .catch((error) => console.log('catch handler', error))
  .run(100);
```

### Documentation

#### StepWorkflow

创建一个新的 workflow 实例

参数：

- `globalData:[Object]`: 传入的对象的所有键值都会被定义到实例本身，可以在`step`,`rollback`,`error`中使用 `this` 访问(必须使用 fucntion 关键字定义函数)

```javascript
const workflow = new StepWorkflow({ data: 123 });
workflow.step(function () {
  console.log(this.data); // 123
});

// 直接使用函数也可以
const workflow = StepWorkflow({ data: 123 });
workflow.step(function () {
  console.log(this.data); // 123
});
```

#### run

执行 workflow

参数：

- `data[any]`: 执行 [step](#step) 传入的参数
- `stepName[String]`: 从指定 step 开始执行，null 或者不传默认就从第一个 step 开始执行
- `oneStep[Boolean]`: 只执行指定的 step，不往后执行，默认 `false`

返回：最后一个[step](#step) 或者 [final](#final)(如果有) 的返回值

```javascript
const workflow = new StepWorkflow();
workflow.step(function (data) {
  console.log(data); // 123
});
workflow.run(123);
```

#### step

定义一个步骤函数

参数：

- `stepName[String]`: 步骤的名称，可选，不传入名称时默认使用`stepFn`的名称，当`stepFn`为匿名函数时会使用`Anonymous` 作为名称。
- `stepFn[Function]`: 步骤的函数，可以是 async 函数。函数接收一个参数，为上一步的返回值，若是第一步，则接受的是[run](#run)传入的参数。

返回：当前[StepWorkflow](#StepWorkflow)实例

```javascript
const workflow = new StepWorkflow();
workflow
  .step(function step1(data) {
    console.log(data); // 123
    return 234;
  })
  .step(function step2(data) {
    console.log(data); // 234
  })
  .run(123);
```

#### rollback

定义一个回滚函数。定义[step](#step)后，再调用`rollback`，则为此步骤的回滚函数。当此步骤抛出错误时，`rollback` 会被调用。

`rollback`回滚函数会往上调用，即有多个步骤时，所有执行成功的步骤对应的回滚函数都会被调用。

参数：

- `rollbackFn[Funciton]`: 回滚函数，可以是 async 函数。函数接收两个参数，第一个参数为对应[step](#step)的传入参数，第二个为抛出的`error`，`error`包含抛出错误对应的`stepName`和`data`

返回：当前[StepWorkflow](#StepWorkflow)实例

```javascript
const workflow = new StepWorkflow();
workflow
  .step(function step1(data) {
    console.log(data); // 1
    return 2;
  })
  .rollback(function (data, error) {
    console.log(error); // this is a error
    console.log(error.stepName); // step3
    console.log(error.data); // 3
    console.log(data); // step1的参数 1
  })
  .step(function step2(data) {
    console.log(data); // 2
    return 3;
  })
  .rollback(function (data, error) {
    console.log(error); // this is a error
    console.log(error.stepName); // step3
    console.log(error.data); // 3
    console.log(data); // step2的参数 2
  })
  .step(function step3(data) {
    console.log(data); // 3
    throw new Error('this is a error');
  })
  .rollback(function (data, error) {
    console.log(error); // this is a error
    console.log(error.stepName); // step3
    console.log(error.data); // 3
    console.log(data); // 3
  })
  .run(1);
```

#### error

定义一个错误处理函数。定义[step](#step)后，再调用`error`，则为此步骤的错误处理函数。当[step](#step)出现异常时，`error`会被调用

当`error`的[step](#step)抛出异常时，所有[rollback](#rollback)都不会被调用

当`error`没有继续抛出异常，后续的[step](#step)会继续执行

当`error`继续抛出异常时，后续的[step](#step)不会执行，并且异常会被[catch](#catch)（如果有）捕获

参数：

- `errorFn[Funciton]`: 错误函数，可以是 async 函数。函数接收一个参数，为对应[step](#step)抛出的`error`，`error`包含`stepName`步骤名称和`data`步骤的传入参数。

返回：当前[StepWorkflow](#StepWorkflow)实例

```javascript
const workflow = new StepWorkflow();
workflow
  .step(function step1(data) {
    console.log(data); // 1
    return 2;
  })
  .rollback(function (error) {
    // 该回滚函数不会被调用
  })
  .error(function (error) {
    // 该错误函数不会被调用，因为不是step1抛出的错误
  })
  .step(function step2(data) {
    console.log(data); // 2
    return 3;
  })
  .rollback(function (error) {
    // 该回滚函数不会被调用，因为error函数已经处理了错误
  })
  .error(function (error) {
    // 错误函数会被调用
    console.log(error); // this is a error
    console.log(error.stepName); // step2
    console.log(error.data); // 1
  })
  .run(1);
```

#### catch

错误处理函数，workflow 中一切没有处理的异常都会走到这里，包括[error](#error)中未被处理的异常。

参数：

- `catchFn[Funciton]`: 错误处理函数，可以是 async 函数。函数接收一个参数`error`

返回：当前[StepWorkflow](#StepWorkflow)实例

```javascript
const workflow = new StepWorkflow();
workflow
  .step(function step1() {
    throw new Error('this is error');
  })
  .error(function (error) {
    // 若error出现错误，会被catch捕获
    throw error;
  })
  .rollback(function (error) {
    // 若rollback出现错误，会被catch捕获
    throw error;
  })
  .catch(function (error) {
    console.log(error); // this is a error
  })
  .run();
```

#### done

标记 workflow 已结束，直接执行[final](#final)函数，如果在[step](#step)、[error](#error)或者[rollback](#rollback)以外调用，会使 workflow 只运行[final](#final)函数

```javascript
const workflow = new StepWorkflow();
workflow
  .step(function step1() {
    this.done();
  })
  .step(function step2() {
    // 不会执行
  })
  .final(function () {
    console.log('done'); // done
  })
  .run();

const workflow2 = new StepWorkflow();
workflow2
  .step(function step1() {
    // 不会执行
  })
  .step(function step2() {
    // 不会执行
  })
  .final(function () {
    console.log('done'); // done
  });
workflow2.done(); // 在此调用done会使workflow只执行final函数
workflow2.run();
```

#### final

所有`step`执行完后会执行`final`函数，调用[done](#done)也会执行。

参数：

- `finalFn[Funciton]`: 最终函数，可以是 async 函数。

#### Events

- start: workflow 开始时触发
- step: 每个 step 执行时触发
- final: final 执行时触发
- done: 所有 step 执行完触发
- error: 出现错误时触发
- rollback: 回滚函数执行时触发
