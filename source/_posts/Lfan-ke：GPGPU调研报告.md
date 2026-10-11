---
title: 'Lfan-ke: GPU GPGPU GPGPGPU！'
date: 2025-06-20 13:07:00
categories:
    - Lfan-ke
tags:
    - author:heke
    - repo:https://github.com/Lfan-ke/arceos-stage4.git
    - 2025S
    - AsyncOS
    - 补完计划
    - ArceOS
    - 阶段四
    - OpenCL
    - GPU
    - GPGPU
    - POCL
    - WGPU
    - WebGPU
    - Vortex
    - stage4
    - virtio-v1.2
    - Virtio

mathjax: true
mermaid.js: true
mermaid: enable:true theme:default
description: 解析`WebGPU`、`Virtio1.2`规范，以及`WGPU`、`Vortex`源码，探索异步操作系统与内核态GPU资源管理的结合方案。
cssclasses:
  - worm
  - spring
  - summer
aliases:
  - 第四阶段总结报告
heke: "1228"
---

# 第四阶段总结报告

about-me: [heke1228@gitee](https://gitee.com/heke1228), [heke1228@atom](https://atomgit.com/heke1228), [Lfan-ke@github](https://github.com/Lfan-ke), [heke1228@codeberg](https://codeberg.org/heke1228)

> 本阶段从理解与熟悉Rust异步编程开始，探究内核态的`GPU/GPGPU`资源管理与异步操作系统的结合方案。

<!-- more -->

## Rust异步编程

异步协程/纤程/微线程/绿色线程/虚拟线程/Future/Fiber/Promise/Coroutine/Goroutine/GreenTask/GreenThread/Microthread……名字各异（下文统一称：协程），但是表述的都是轻量级的用户态线程，挂起和恢复不涉及系统调用，开销小且灵活。使用方式在不同语言环境中大同小异，但是在实现上多多少少有不同。

Python的协程使用：

2006年通过PEP 342引入，利用生成器`yield`实现协程，Py3.4正式引入`asyncio`库，Py3.5正式协程标准化。到目前[2025.06.20 Py3.13]为止，Py协程仍然在不断发展，比如Py3.7引入的`asyncio.run/create_task`、Py3.11引入的`async with asyncio.TaskGroup() as tg`方法等等。

Py的协程源于`yield`生成器，目前也是可以将`async def`视为返回类生成器的`coroutine`对象。`await`相当于`yield from`。同一个线程同一时间只会运行一个协程任务队列，可以使用[`new_event_loop`](https://docs.python.org/zh-cn/3/library/asyncio-eventloop.html#asyncio.new_event_loop)创建队列手动塞入不同的任务再使用[`set_event_loop`](https://docs.python.org/zh-cn/3/library/asyncio-eventloop.html#asyncio.set_event_loop)管理当前活跃的任务队列，倘若开启多个协程任务队列则会直接报错。事件循环由`asyncio`库管理，用户直接使用高层`API`即可：

```python
import asyncio

async def hello():
    print("Hello")
    await asyncio.sleep(1)
    print("World")

asyncio.run(hello())
```

C++的协程使用：

C++和Java的协程支持较晚，C++20才正式引入协程支持。通过`co_await`、`co_yield`和`co_return`关键字实现，Java可以使用SE19/21的虚拟线程，也可以使用子语言比如Kotlin的协程支持。C++的协程和Rust相似，依赖编译器生成状态机代码，属于无栈协程。

```
#include <cppcoro/task.hpp>
#include <cppcoro/sync_wait.hpp>
#include <iostream>

cppcoro::task<> hello() {
    std::cout << "Hello";
    co_await cppcoro::sleep_for(std::chrono::seconds(1));
    std::cout << "World";
}

int main() {
    cppcoro::sync_wait(hello());
}
```

JavaScript的协程使用：

之前的Js异步大多使用定时器/下帧调用实现，早期Promise形式的Promises/A规范率先在CommonJS社区流行，后续ECMA在ES6增加了Promises/A+规范的完善支持。在ES8之后正式引入了`async/await`语法。Js的协程是单线程事件驱动模型，通过微任务队列调度。

{% asset_img js-event-loop.png JavaScript 事件循环：异步任务完成后，回调经消息队列回到主线程执行 %}

```typescript
// 早期 Promise 链
function fetchData() {
  return fetch('api/data')
    .then(response => response.json())
    .then(data => process(data))
    .catch(error => console.error(error));
}

// async/await 语法糖
async function fetchData() {
  try {
    const response = await fetch('api/data');
    const data = await response.json();
    return process(data);
  } catch (error) {
    console.error(error);
  }
}
```

<!--

喜欢使用F12看笔记的鸟儿有虫吃：

https://docs.qq.com/aio/DSFBEZ1pJY0VaWVBU?electronTabTitle=ES6%E8%A1%A5%E5%AE%8C%E8%AE%A1%E5%88%92&p=S8EfqAKi6NZFkJAKiaPlxB&client_hint=0

-->

Rust的协程使用：

Rust的协程基于Future Trait。Rust的Future得手动轮询poll函数实现才会执行。所以需要用户开发的运行时才会驱动执行。与C++类似，为无栈协程，会被编译为状态机模型，涉及唤醒模型的时候需要Wake Trait注册唤醒器，在任务均阻塞的时候避免CPU空转，而是被挂起等待被唤醒。常用的驱动库有：[tokio](https://tokio.rs/)、[async-std](https://async.rs/)等等。tokio 正在成为事实上的 Rust 异步运行时标准。

```
use tokio::time::{sleep, Duration};

async fn hello() {
    println!("Hello");
    sleep(Duration::from_secs(1)).await;
    println!("World");
}

#[tokio::main]
async fn main() {
    hello().await;
}
```

### Rust异步运行时简易实现

由于Rust提供了Future接口，其余的调度策略等等等均由用户自定义，这样子可操作性就非常高。上述不同语言的协程实现思路均可以作为灵感来源。抛去官方的无栈协程概念不谈，也可以自己利用进程跳板的类似机制封装一个有栈协程调度器。这里实现一个[简易的无栈协程调度器](https://github.com/Lfan-ke/mini-async-rt)（暂时[2025.06]不涉及唤醒机制，优先级也是结构体多封装一个数字，使用优先队列存任务，所以只讲解最简单原型）。

目前方案及其简陋，是一个单线程的异步运行时模型，但是在合适的地方会提示多线程调度器或者其他优化的实现方案。

首先讲解Future Trait：

```
pub trait Future {

	type Output;

	fn pool(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

所有实现`Future`特质的对象必须有`poll`惰性轮询方法。就像你管理5个小朋友，你需要将他们的作业收起来交给老师。那么你为了尽快收齐作业，你会如何去做？当然是一遍一遍一个挨着一个问：”小朋友，你的周末作业写完了吗？“。Rust的异步类似，轮询的时候只有两个状态：`写完了-Poll::Ready(Output)`和`没写完再等等-Poll::Pending`。

```rust
// 实际上在此基础上你可以封装更为复杂的轮询类型，比如：接收数据直到没有数据为止：
type Output = Option<Homework>;

match state {
	Poll::Ready(Some(homework)) => 收取,
	Poll::Ready(None) => 完成！,
	Poll::Pending => 挂起,
}
```

你为了方便管理这5个小朋友，你在QQ拉了一个小群，同时有一些小朋友家里有节假日活动，得过几天才能继续完成作业，你为了避免打扰他们，给他们建了另外一个小群：

```rust
let ready_queue = vec![student; 2];
let sleep_queue = vec![student; 3];
```

你说：”完成作业的小朋友就可以退群！当然，有活动的小朋友在活动完成之后可以加入收集作业群一起讨论作业！“

这样子一来，便成为了：你常日里可以轮询作业群的小朋友：”写完了吗？“，写完就收集作业踢出群聊。在轮询结束就在每日晚问请假群的小朋友：”接下来可以加入作业群了吗？“

```rust
// 上述的情况适用于单线程的轮询，为了节省CPU资源，检查sleep_queue的时候可以gap几百毫秒
// 当老师需要你检查新的小朋友的作业的时候，你就可以将其加入作业群，然后轮询：
pub fn spawn(&mut self, future: impl Future<Output = ()> + 'static) {
    self.ready_queue.push_back(Box::pin(student));
}
```

但是很快，你发现你一直在push小朋友，你自己烦，小朋友也烦，所以有没有办法让他们准备好的时候告诉你，你再去将他们移动群聊？比如，告诉小朋友的家长：”你家孩子还没写作业，办完活动告我一声，给孩子拉到作业群“。或者直接给对方父母入群二维码，当他们一家游玩结束后自己加群，这样子就不会自己一直轮询一直问了。

```rust
// 那么你现在就相当于spawn了一个额外的线程，设置了一个waker
// 当满足条件的时候将会触发waker的wake方法，也就是“把孩子拉入作业群”

let waker = parent_waker();
let mut cx = Context::from_waker(&waker);

while let Some(student) = ready_queue.clone().iter().pop() {
	if let Poll::Ready(请假) = student.poll(&_cx) {
		// 伪代码，协助理解
		ready_queue.remove(student);
		sleep_queue.push(student);
	}
}

// 在 poll 的时候：
impl Future for Student {

	type Output = ();

	fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {

		if 活动完成 {
			Poll::Ready(())
		} else {
			// 已经告知对方父母完事了提醒我
			if self.waker_saved { return Poll::Pending; }
			// 还未告知就得告知一下
			let parent = _cx.waker().clone();
			thread::spawn(move || {
				// 他们自己花 some_duration 游玩
				thread::sleep(some_duration);
				// 游玩结束就触发他们父母提醒我拉群
				parent.wake();
			})
		}
	}
}
```

其中学校要统计学生节假日的行程，以确保孩子们安全，这个时候你就可以新建一个收集表，每天让孩子一家填写相关的事宜，当你发现有危险地区时就能及时阻止，或者孩子一家块回来了，就能让父母按照对应的方式提醒你：

```rust
static VTABLE: RawWakerVTable = RawWakerVTable::new(
	|data| { /* 克隆 data */ }, // clone
	|data| { /* 用 data 唤醒 */ }, // wake
	|data| { /* 引用唤醒 */ }, // wake_by_ref
	|data| { /* 释放 data */ }, // drop
);
```

比如上面的你需要父母按照某个方式提醒你，或者他们自己到时候自己加群：

```rust
// 在 RawWakerVTable::new 的第二个函数参数位置写入：
|群的二维码| { 扫码加群 }
```

那么接下来，请假群节假日和父母出去玩的孩子加入作业群的策略就变成了：

```rust
// 刚开始老师让你管理五个学生：
let mut ready_queue = [student; 5];
let mut sleep_queue = [student; 0];

// 你在作业群发现有些孩子出去玩，你将他们加入请假群：
while let Some(student) = ready_queue.clone().iter().pop() {
	if 请假出去玩 {
		// 伪代码，协助理解
		ready_queue.remove(student);
		sleep_queue.push(student);
	}
}

// 之后 poll 时告知其父母，回来后自己扫码加群
// 之后，你就会发现，当请假出去玩的回家时，就会自己加群了
```

接下来你只需要Poll作业群里的孩子们，让他们交作业即可了！当请加群和作业群都没人之后就是作业收齐了，就可以完成任务走人了！

后续如果想自己封装一个有特殊功能的Rust异步协程运行时可以参考：[简易实现](https://github.com/Lfan-ke/mini-async-rt)。其中如果需要异步的IO，可以基于tokio的子项目：[mio](https://github.com/tokio-rs/mio)进行组装，当然也可以自己基于硬件特性、操作系统特性封装唤醒机制，比如[epoll](https://man7.org/linux/man-pages/man7/epoll.7.html)、[kqueue](https://man.freebsd.org/cgi/man.cgi?query=kqueue)、[iocp](https://learn.microsoft.com/en-us/windows/win32/fileio/i-o-completion-ports)等等。

其中封装前对具体是路不是非常明确可以先行参考：[利用`std:net`封装一个异步`http`客户端。](https://blog.windeye.top/rust_async/learningrustasyncwithwebserver/?accessToken=eyJhbGciOiJIUzI1NiIsImtpZCI6ImRlZmF1bHQiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE3NDg5MTQzMzksImZpbGVHVUlEIjoiS2xrS3ZlZ1pvZXVkdzdxZCIsImlhdCI6MTc0ODkxNDAzOSwiaXNzIjoidXBsb2FkZXJfYWNjZXNzX3Jlc291cmNlIiwicGFhIjoiYWxsOmFsbDoiLCJ1c2VySWQiOjg2NTc1OTcyfQ._cNsyZBbNSX3JtfBKZz3ZX7w6LyF1haKNnC5YynbMY8)此博客的思路，受益匪浅。

### Rust异步爬虫的简单使用

就像py的aiohttp，rust也有自己的异步网络请求库：

```rust
use reqwest;  // reqwest = "0.12.15"

let response = reqwest::get(format!("https://www.baidu.com/s?wd={}", q)).await?;
```

之后利用tokio运行时运行异步任务即可。

### Rust嵌入式异步框架介绍

[Embassy](https://embassy.dev/book/)是一款异步嵌入式开发框架。比RTOS更加轻量级，采用Rust的异步协程模型进行开发。其中包含一个异步执行器、一些硬件抽象层供不同板子的开发和一些异步硬件组件库：

- [embassy-executor](https://docs.embassy.dev/embassy-executor/git/cortex-m/index.html#embassy-executor)
- [embassy-stm32](https://docs.embassy.dev/embassy-stm32/)、[emmbassy-nrf](https://docs.embassy.dev/embassy-nrf/)、[embassy-rp](https://docs.embassy.dev/embassy-rp/)、[esp-rs](https://github.com/esp-rs)
- [embassy-net](https://docs.embassy.dev/embassy-net/)、[nrf-softdevice](https://github.com/embassy-rs/nrf-softdevice)、[embassy-lora](https://docs.embassy.dev/embassy-lora/)<!-- 吐槽：想起Lora微调…… -->、[embassy-usb](https://docs.embassy.dev/embassy-usb/)、[embassy-boot](https://github.com/embassy-rs/embassy/tree/master/embassy-boot)

其中，直接使用PAC层编程比较繁杂，使用HAL层抽象编程便比较轻便简单：

```rust
#![no_std]
#![no_main]

use cortex_m_rt::entry;
use embassy_stm32::gpio::{Input, Level, Output, Pull, Speed};
use {defmt_rtt as _, panic_probe as _};

#[entry]
fn main() -> ! {
	let p = embassy_stm32::init(Default::default());
	let mut led = Output::new(p.PB14, Level::High, Speed::VeryHigh);
	let button = Input::new(p.PC13, Pull::Up);

	loop {
		if button.is_low() {
			led.set_high();
		} else {
			led.set_low();
		}
	}
}
```

其中Embassy的大卖点是异步框架：

```rust
#![no_std]
#![no_main]
#![feature(type_alias_impl_trait)]

use embassy_executor::Spawner;
use embassy_stm32::exti::ExtiInput;
use embassy_stm32::gpio::{Input, Level, Output, Pull, Speed};
use {defmt_rtt as _, panic_probe as _};

#[embassy_executor::main]
async fn main(_spawner: Spawner) {
    let p = embassy_stm32::init(Default::default());
    let mut led = Output::new(p.PB14, Level::Low, Speed::VeryHigh);
    let mut button = ExtiInput::new(Input::new(p.PC13, Pull::Up), p.EXTI13);

    loop {
        button.wait_for_any_edge().await;
        if button.is_low() {
            led.set_high();
        } else {
            led.set_low();
        }
    }
}
```


补充内容：

{% asset_img nrf-hal-peripherals.png nRF 系列由 HAL 实现的外设 %}

## WebGPU

src：[W3规范](https://www.w3.org/TR/webgpu/)，[WGSL](https://www.w3.org/TR/WGSL/)，[WGPU](https://wgpu.rs/)，[MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/WebGPU_API)

WebGPU，WWW在2021年发布WebGPU的新API，以解决上述跨平台问题，真正的跨平台框架。WebGPU是WebGL的继任者，语法类似 Rust，支持更复杂的着色器功能。比VLK更容易使用，使用WGSL作为着色器语言。可以跨平台多端使用，不仅局限于Web场景。提供更高效、灵活、安全的图形编程接口。

其中Rust依据WebGPU规范有封装框架WGPU，可以利用便捷的接口来使用GPU的计算和渲染能力。

### WebGPU规范概览

WebGPU是一个提供GPU能力调用的规范接口。其中GPU嘛，目前火热的就是进行`渲染-Render`（比如：某3A大作震撼的特效渲染）和`通用计算-GPGPU`（比如：人工智能模型要在某卡上训练/推理）。所以GPU的能力大致就归类为：

- Render Pass
- Compute Pass

<!-- F12 Boy专属名词解释：异构计算就是采用不同架构的东西进行计算，比如CPU+GPU/NPU/FPGA/DSP/其他核心/加速器/外设...就是异构计算 -->

<!-- 其中像OCL/CUDA/WebGPU/SYCL等等这些有专有称呼：统一编程模型 -->

<!--  而且不同平台实现不同，比如镰刀封装OCL，WGPU封装VLK/GLES/WebGPU等等-->

其中无论是渲染还是计算，都需要外界代码指导GPU如何进行计算，这些外界代码被称为：着色器代码。但是一定是用户可读的代码吗？不一定，比如：SPIR-V着色器代码中间表示。但是大部分还是用户易读的代码：Cuda/OCL C扩展代码，WSGL代码等等。在送向GPU的时候会被编译为GPU可执行的机器码，供GPU取址译码执行（详见第三小节-`GPU架构`）。

代码示例：

- wsgl

```wsgl
struct Uniforms {
    mvpMatrix : mat4x4<f32>,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;

struct Output {
    @builtin(position) Position : vec4<f32>,
    @location(0) vColor : vec4<f32>,
};

@vertex
fn vs_main(@location(0) pos: vec4<f32>, @location(1) color: vec4<f32>) -> Output {
    var output: Output;
    output.Position = uniforms.mvpMatrix * pos;
    output.vColor = color;
    return output;
}


@fragment
fn fs_main(@location(0) vColor: vec4<f32>) -> @location(0) vec4<f32> {
    return vColor;
}
```

- opencl c

```c
kernel void wildpointer(global uint * buffer) {

	size_t gidx = get_global_id(0);
	size_t gidy = get_global_id(1);
	size_t lidx = get_local_id(0);

	buffer[gidx + 4 * gidy] = (1 << gidx) | (0x10 << gidy);
}
```

可以看到，都需要`buffer`（例子1的uniforms、pos等等，例子2的buffer），而buffer一般是由CPU将数据传输到GPU的，最后的结果也可以利用数据传输指令传回。这里提到了一个非常主要的资源：`buffer-缓冲区`。

除了代码和缓存区外，渲染管线还可能需要以下的资源：

- 纹理 - texture - 比如你CF枪上的皮肤/建模次世代阴影等等
- 采样器 - sample - 决定纹理如何映射到面
- 图形管道/计算管道 - pipeline - 渲染和计算
- 组和布局 - bindgroup & layout - 决定数据在GPU是什么样子的，什么数据什么时候可读写

当你定义好对应的资源，以及缓冲区和代码后，就可以提交命令到管道，然后等待GPU执行渲染/计算了。

### WGPU相关的介绍

src：[官文](https://wgpu.rs/)，[官仓](https://github.com/gfx-rs/wgpu)，[DW](https://deepwiki.com/gfx-rs/wgpu)

WGPU是基于WebGPU规范封装的跨平台异步GPU能力调用的库。由于Rust可以非常方便的与C-BindGen/Web-WasmPack互通，WGPU可以被非常方便地跨各平台使用，安卓、手表、浏览器、小程序、桌面端、其他嵌入式设备等等等。

WGPU的项目库关系为：

```planetext
用户代码(JS/TS)   用户代码(Rust)
        │                │
        ▼                ▼
  deno_webgpu          wgpu
        │                │
        └───────►  wgpu-core
                         │
                      wgpu-hal
                         │
       ┌───────────┬─────┴───────┐
       ▼           ▼             |
  naga (着色器) ─ wgpu-types ─── ▼
                            底层图形API
                                 ▼
                       vlk, gles, mtl, dx12...
```

倘若WGPU直接编译在Web平台，则不会依赖wgpu-core，而是直接利用wasm调用WebGPU/WebGL接口。

其中用户层的`vk, gles, mtl, dx12`直接利用了现有的`crate`：`ash, glow, metal, windows(winapi::um::d3d12)`，而这些库大多是靠`bindgen-c/o-c`来绑定API的。之后被`wgpu-hal`统一抽象为`WebGPU`编程模型接口，不同的着色器语言被`naga`编译为中间表示后按照目前所选后端转化为对应的表示。

这里以`vulkan`为例，`wgpu-hal`使用`vk::Fence+Semaphores`来封装`Future`的`fn poll`来提供上层的`async`能力。而`wgpu-core`提供不安全的资源管理与交互。`wgpu`顶层则将`wgpu-core`安全化。

Rust的`ash`通过`c-abi`调用`c-vk`，而`vk`又是如何调用内核态的驱动以及如何驱动GPU设备进行计算的呢？

`Vulkan Driver`会自带一个加载器，通过读取特定目录的`json`来加载对应硬件厂家提供的`ICD`驱动。之后通过调用符合`Vulkan`规范的`ICD`驱动提供的函数接口来驱动`GPU`进行渲染/计算。`OpenCL`也类似。

## GPU架构

src：[VirtioGPUv1.2规范](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html#x1-2080009)，[Vortex](https://vortex.cc.gatech.edu/)，[MIAOW](https://miaowgpu.org/)，[POCL](https://deepwiki.com/vortexgpgpu/pocl)

GPU，一个熟悉又陌生的芯片。阶段四为了完成目标分析文档，实现统一内核态异步GPU计算能力资源管理驱动，理解GPU的架构是非常必要的。它和CPU类似，都有取指译码执行访存错处，也有流水线冒险分支预测等等优化手段，但是与CPU相比，究竟是什么样子的结构呢？

{% asset_img gpu-above-sm.png SM 以上的结构 %}

图中的 SM 是 Streaming Multiprocessor（流式多处理器），原图误写为 Serial MultiProcessor。
<figure>
  <figcaption style="text-align:center; font-size:0.8em; color:#666;">笔记来源：智研院</figcaption>
</figure>

{% asset_img gpu-below-sm.png SM 以下的结构 %}
<figure>
  <figcaption style="text-align:center; font-size:0.8em; color:#666;">笔记来源：智源院</figcaption>
</figure>

大致的架构类似于上面图片，SM之上是块调度器，SM之下是各项小核。小核类似于CPU的运算结构：ALU，FPU等等等。SM之上是设备共享内存，设备共享内存每个计算单元都可以访问，主机的内存需要总线映射访问。SM之内是每一个运算模块的共享内存，运算模块也有自己专属的个人小空间内存。

GPGPU（包含：GPU、NPU等等）的架构主要是：
- `SIMD` - 单指令多数据 - 类似于RV的V扩展，N个数据同时执行同一个指令
- `SIMT` - 单指令多线程 - N个核心同时执行相同的指令

### VirtioGPU简易介绍


暂时略，未来补，可以先参考[`rCore-ch9`](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter9/0intro.html)的简易虚拟GPU设备

### Vortex GPGPU介绍

一款基于RV架构的GPGPU。实现了OpenCL ICD及其测例，可以作为非常好的软硬一体的学习资料。

Vt的GPU架构是SIMT，属于一个Core含有多个Wrap（线程束），每个Wrap含有多个Lane（线程，类似于Thread）。

每个Lane的结构和RV64GC的CPU一致，包含译码、ALU/FPU...计算、数据写回等等操作，但是有以下区别：
- 部分CSR由Wrap共享，即：Lane并行计算之后，常见的错误会被统一MapReduce到Wrap CSR中
- 部分CSR每个Lane独立存在，即：只有特殊的存Lane个人信息的CSR寄存器独立存在，其余寄存器就是上面第一种情况，由Wrap统一共享，即：一个Wrap有4个Lane，4个Lane共享Wrap的CSR。

取指由Wrap取，取得之后每个Lane共享指令。且每个Lane具有硬件计算地址偏移，取数据的时候会硬件计算当前Lane应当取得的数据的地址（即：结合LaneID进行偏移计算）。

>剩下的之后补，可以先看[源码解析文档](https://docs.qq.com/aio/DSEhnREJnQ2pUdEhN?electronTabTitle=ArceOS%E2%80%85%E4%B8%89%E5%9B%9B&nlc=1&p=m3LkHb3Dz7JQjH7NJNUFXu&client_hint=0)。

## GPU驱动

### 远古时期的"GPU/UI"

远古时期，仅仅是一块简单的`LED/LCD/OLED`小屏幕，像素较少，使用颜色矩阵就可以精确的控制每一个像素的颜色，只需要板子接电使用应用层协议比如`IIC`传输指令即可。随着发展，每次都从计算某个像素的某点亮灭/颜色，过于麻烦，所以有了简易驱动，内部包含着绘制点线几何以及基本字体的代码和文件，此时UI编程便变成了发送指令：`(x, y, w, h[, data])`来控制显示。随着用户的画面需求逐渐升级，3D渲染的需求激增，英伟达推出了一个硬件支持3D渲染的显卡，后续微软、苹果等等公司也推出了相应的3D图形API，如上文提到的D3D，MTL（此时还是OGL）。

随着算力激增，绘制图形的任务被高度抽象为了渲染。此时推出的渲染引擎都接口高度化，用户不能精细控制每一个细节，比如`OpenGL`，而上述计算顶点与颜色的过程被抽象为：计算顶点，片段着色，光栅化，输出帧缓冲，显示。随着人工智能需求的算力激增，利用纹理存储数据、顶点变换模拟数学运算、使用帧缓冲作为输出结果：以逃课的方式使用GPU进行并行计算的大有人在，人工智能研究人员迫切需要一个“流计算”模型来并行计算大规模数据。2003年斯坦福提出BrookGPU，为GPGPU编程提供了抽象层，2006年英伟达闭源推出Cuda，此后利用GPU的并行计算能力的通用计算框架发展至今。

由于渲染绘制画面不是问题了，人们更多的开始关心如何显示的更加流畅美观，从此3D模型三角面越来越多，前端从画点画面逐渐变为了浏览器堆DIV组件、桌面端堆CMP等等。硬件变为了向人工智能通用计算助力的XPU，如：NPU等等，或者追求画质的光追RTC/RA等等。

### 通用计算与渲染引擎

通用计算是指利用原本为特定领域设计的处理器（如GPU、TPU、FPGA等）通过软件编程来执行通用计算任务，通常与CPU组成异构计算系统。通用计算任务就是传统上由CPU处理的、非专用领域的各类计算任务，比如数据的加减乘除。与通用计算相对的就是专用计算，比如GPU的图形渲染。而异构计算就是不同处理器协调处理某个计算任务，比如CPU指定GPU运算任务进行神经网络训练等等。

定义通用计算任务接口可以使得原本用于不同专用领域但是可以执行通用计算的硬件可以共用同一套软件接口执行类似的计算操作。比如之后要讲解的POCL，如果使用经典的Basic就是每个Lane的计算任务按照Cuda经典的`(x, y, z)`依次`for i in x: for i in y: for i in z: ...`来依次进行计算，使用CPU的Pthread实现是会启动多线程来支持并行计算，Cuda会使用Cuda直接硬件支持的并行计算。

上面的通用计算任务接口可以当作`一套代码到处运行`。就像告诉ABC：你把鸡蛋剥皮，A用手剥皮、B用酸溶解、C使用机械辅助一样，中间结果不可知，但是输入输出一致的软件规范。

渲染引擎是利用硬件加速，将图形数据转换为最终像素画面的系统。比如你使用软件进行阴影投射水面折射光线追踪与直接使用光线追踪硬件核心对比，肯定后者更快。拿三角形举例，你提供3个三角形的坐标以及颜色的集合：
```rust
struct Point {
	x: isize,
	y: isize,
	z: isize,
	r, g, b, a, ...
}

let p1, p2, p3, p4, p5: Point ...
```
你在CPU上绘制点，使用CPU进行光栅化操作，你先得初始化一个屏幕大小的矩阵储存下一帧的图片（即：每个像素的颜色信息）。遍历三角形坐标计算遮挡，遍历三角形区域，计算每个像素的颜色，倘若三个点颜色不一致，还得利用重心公式计算颜色偏移进行渐变……

或者简单来说，使用OpenCV绘制三个三角形，也得一个一个绘制，但是GPU可以并行计算不同区域的颜色，进行并行着色。
### 用户态驱动OCL介绍

大致过程为：POCL做了以下事情：
- 适配了CPU单线程和多线程进行OCL支持
- 适配了Cuda
- 支持结合LLVM扩展所支持的平台，比如Vortex就是这样子做的
- OCL的代码经过LLVM变为IR，IR再翻译为Vortex GPGPU平台支持的指令格式

暂略，之后补，可以先看[适配RISC-V的POCL源码](https://github.com/vortexgpgpu/pocl)。
