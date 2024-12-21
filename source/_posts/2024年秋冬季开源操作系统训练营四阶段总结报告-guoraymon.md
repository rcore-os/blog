---
title: 2024年秋冬季开源操作系统训练营四阶段总结报告-guoraymon
date: 2024-12-21 16:20:45
categories:
    - 2024秋冬季开源操作系统训练营
tags:
    - author:guoraymon
    - repo:https://github.com/guoraymon/async-os
---

第四阶段参加了项目四基于协程异步机制的 OS，主要学习了协程异步的基本原理，阅读了 Tokio 源码，还了解了 io_uring。最终实现了简单的异步任务调度的操作系统，实现了异步任务调度功能，已经用于模拟异步延迟的 delay 函数，下一阶段还要继续实现异步的 I/O。

第四阶段还旁听了项目一题目一 Unikernel 支持 LinuxApp 第一周的学习，并参与项目实验，切身体验到了单内核应用开发所遇到的问题和难点。第二周是关于实现 Linux 应用支持的，因为本身对 Linux 应用了解就较少，也没精力和时间投入学习，只能战略性先放弃了。

我觉得经过两个项目的学习，我已经有了一个构建单内核异步操作系统的想法：内核像库一样提供，开发者只需选择需要使用的 future，然后像构建普通应用一样构建单内核操作系统，可以主要应用于嵌入式系统。接下来就是尝试实现这个框架，OS 库实现内存分配，异步任务调度等功能，使开发者调用库即可构建支持 Http Server 的单内核 OS，并运行到真机上。

同时，我也输出了两篇笔记，内容如下：

# 【Async OS】协程基本概念

## 协程的目的
协程的目的在于解决并发问题。常规并发是借助操作系统提供的线程来实现，其过程包含生成线程，通过系统调用执行 I/O 操作，并且在 I/O 执行期间会阻塞相应线程直至操作完成。在此过程中，存在两大显著问题：
1. 用户态和内核态切换成本颇高。每次切换都涉及到系统资源的开销以及一定的时间消耗，这在频繁进行切换的场景下，会对整体性能产生较大影响。
2. 操作系统线程需要预分配堆栈。每个线程都要提前分配好相应的堆栈空间来存储运行时的数据，当要实现大规模并发时，大量的线程就意味着需要大量内存来维持这些堆栈，内存资源占用较大。

## 协程解决并发问题的方式
协程主要通过以下两种方式来解决上述并发问题：
1. 实现用户态的线程，也就是协程本身。协程运行在用户态，避免了频繁进出内核态带来的高昂切换成本，使得执行流程相对更为高效、轻便。
2. 采用无栈协程的方式，实现不保存堆栈。这就避免了像操作系统线程那样，为每个任务都预留大量堆栈空间，从而节省内存开销。

## 线程、绿色线程与协程
协程的概念相对模糊，它本质上是一种可以暂停后再恢复执行的函数。不过其暂停机制存在歧义，可分为显式的通过语法函数实现（对应协作式调度）以及隐式地由运行时执行（对应抢占式调度）这两种情况。像知名的 Golang 使用的是堆栈式的抢占式调度方案，在 Rust 术语里，将这种类似操作系统线程的、堆栈式的抢占式调度方案定义为 “绿色线程” 或 “虚拟线程”。从本质上看，它们除了是在用户态实现之外，和操作系统线程并无根本差异。而严格意义上的协程，理应是无栈的协作式调度。

## 协作式调度与抢占式调度
协作式调度的特点是，任务若不主动让出执行权（yield），就会持续执行下去。与之相反，抢占式调度则是任务随时可能被切换出去。现代操作系统出于避免恶意程序长时间占用 CPU 的考量，大多采用抢占式调度方式。然而，抢占式调度存在明显缺点，由于任务随时可能被切换，所以必须保存任务的堆栈，如此一来，当任务再次被切回时，才能恢复到切换出去时的状态。这就导致在大规模并发场景下，需要耗费大量内存来保存众多任务的堆栈。

## 有栈协程与无栈协程
有栈协程就是上述提到的在抢占式调度场景下，需要保存任务堆栈的协程类型。那么无栈协程是如何实现的呢？在协作式调度中，因为任务不会被外部强制切出，所以可以在主动让出执行权（yield）时，仅保存必要的状态信息，无需像有栈协程那样完整保存计算过程中的数据。更进一步来说，甚至可以直接利用状态机来实现，从而彻底摆脱对堆栈保存的依赖。

## Rust 的协程情况
早期 Rust 曾有过一个堆栈式协程的方案，但在 1.0 版本发布前被移除了。对于 Rust 而言，绿色线程需要解决的关键问题是怎样减小预分配堆栈的大小，进而降低内存开销，毕竟若不能比操作系统线程更节省内存，那使用操作系统线程就好了，没必要再另辟蹊径。
其中 Golang 采用的一种方法是堆栈复制，即先分配一个较小的堆栈，待其达到上限时，再将数据转移至更大的堆栈。但这种方式会引发两个问题：一方面，需要跟踪并更新原先指向堆栈的指针，这一过程本质上和垃圾回收器类似，只是将释放内存变成了移动内存；另一方面，内存复制操作会带来额外的性能开销。而 Golang 本身就有垃圾回收器且能接受额外的性能开销，所以在某些方面可以应对这种方式带来的问题。但对于注重性能和内存管理效率的 Rust 来说，这两点都是难以接受的，因此 Rust 最终选择使用无栈式的协程方案，其实现原理是将代码编译成状态机，虽然这种方式相对较难理解，但社区中已有不少优秀文章对此进行了清晰讲解，例如 [blog-os 的 async-await 章节](https://os.phil-opp.com/async-await/)。以下是编译成状态机后的大致伪代码示例：

```
enum ExampleStateMachine {
    Start(StartState),
    WaitingOnFooTxt(WaitingOnFooTxtState),
    WaitingOnBarTxt(WaitingOnBarTxtState),
    End(EndState),
}

impl Future for ExampleStateMachine {
    type Output = String; // return type of `example`

    fn poll(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        loop {
            match self { // TODO: handle pinning
                ExampleStateMachine::Start(state) => {…}
                ExampleStateMachine::WaitingOnFooTxt(state) => {…}
                ExampleStateMachine::WaitingOnBarTxt(state) => {…}
                ExampleStateMachine::End(state) => {…}
            }
        }
    }
}
```

## 总结
协程主要是用于解决并发问题，而非性能问题。

Golang 中的协程属于 “`有栈协程`”，与操作系统中基于堆栈式抢占式调度的线程本质相同，在 Rust 中被称作 “`绿色线程`”。而 Rust 实现的协程是 “`无栈协程`”，采用无堆栈的协作式调度方案，其核心原理是将代码编译成状态机。

> 网上常见对于 async Rust 的批判，认为其提升不了多少性能，却需要投入大量资源进行开发，还增加了开发复杂度，甚至会导致 “`函数着色`” 问题。实际上，这些批判有一定道理，但需要明确的是协程本身旨在解决并发问题，而非聚焦于性能提升。


# 【Async OS】最小化异步操作系统

## 前提
需要了解操作系统基础知识，实现简单的操作系统内核框架，并且要实现堆内存分配，因为必须要使用 `Box` 和 `Pin`，还要实现打印功能用于测试，还需要实现时间获取，用于模拟异步延迟。

## Async in Rust
Rust 提供了 Future trait 用于实现异步操作，其结构定义如下：

```rust
pub trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output>;
}
```

poll 方法接受两个参数，`Pin<&mut Self>` 其实和 `&mut Self` 类似，只是需要 `Pin` 来固定内存地址，`cx` 参数是用于传入一个唤醒器，在异步任务完成时可以通过唤醒器发出信号。poll 方法返回一个 Poll 枚举：

```rust
pub enum Poll<T> {
    Ready(T),
    Pending,
}
```

大致工作原理其实很简单，调用异步函数的 poll 方法，如果返回的是 `Pending` 表示值还不可用，CPU 可以先去执行其他任务，稍候再试。返回 `Ready` 则表示任务已完成，可以接着执行往下的程序。

## 运行时
知道基本原理后，基于异步来构建操作系统的思路就很清晰了，即遇到 `Pending` 就切换到另一个任务，直到所有任务都完成。

先创建一个 `Runtime` 结构体，包含 `tasks` 队列，用于存储需要执行的任务。`spawn` 方法用于将任务添加到队列，`run` 方法用于执行异步任务，其逻辑是先取出队列中一个任务，通过 `loop` 不断尝试执行异步任务，如果任务 `Pending`，则先去执行另一个任务，以此实现非阻塞，直到队列任务全部为空。

> poll 方法需要传入 Waker 参数，用于在异步任务完成后发出信号，因为目前是 loop 盲等的机制，并没有实现真正的唤醒，所以先采用一个虚假唤醒器。


```rust
pub struct Runtime {
    tasks: VecDeque<Task>,
}

impl Runtime {
    pub fn new() -> Self {
        Runtime {
            tasks: VecDeque::new(),
        }
    }

    pub fn spawn(&mut self, future: impl Future<Output = ()> + Send + Sync + 'static) {
        self.tasks.push_back(Task::new(future))
    }
    
    pub fn run(&mut self) {
        while let Some(mut task) = self.tasks.pop_front() {
            let waker = dummy_waker();
            let mut context = Context::from_waker(&waker);
            loop {
                match task.poll(&mut context) {
                    Poll::Ready(val) => break val,
                    Poll::Pending => {
                        self.tasks.push_back(task);
                        break;
                    }
                };
            }
        }
    }
}
```

## 任务
任务的结构也很简单，含有一个内部 future，在 poll 时执行 future 的 poll。内部 future 定义很长但是不复杂，基于的 future 结构是 `Future<Output = ()>`，然后需要一个 `'static` 生命周期，同时需要 `Send` 和 `Sync` 实现跨线程共享，虽然现在没用到，但是 Rust 编译器可不同意你不写。`dyn` 声明动态类型也是必须要，同时还需要使用 `Box` 包裹来使编译器确定闭包大小，`Pin` 用于固定内存位置不可以动。

```rust
struct Task {
    future: Pin<Box<dyn Future<Output = ()> + Send + Sync + 'static>>,
}

impl Task {
    pub fn new(future: impl Future<Output = ()> + Send + Sync + 'static) -> Task {
        Task {
            future: Box::pin(future),
        }
    }

    fn poll(&mut self, cx: &mut Context) -> Poll<()> {
        self.future.as_mut().poll(cx)
    }
}
```

## 虚假唤醒器
无需了解过多，真正实现唤醒器的时候才需深入了解。

```rust
fn dummy_waker() -> Waker {
    unsafe { Waker::from_raw(dummy_raw_waker()) }
}

fn dummy_raw_waker() -> RawWaker {
    fn no_op(_: *const ()) {}
    fn clone(_: *const ()) -> RawWaker {
        dummy_raw_waker()
    }

    let vtable = &RawWakerVTable::new(clone, no_op, no_op, no_op);
    RawWaker::new(0 as *const (), vtable)
}
```

## Delay
基础框架实现完后，还需要实现一个延迟任务，用于模拟耗时操作。我打算实现一个 `delay` 方法模拟 `sleep`，以测试任务 sleep 的时候运行时会切换到下一个任务。代码很简单，`DelayFuture` 结构体包含一个 `target_time` 和一个 `waker`，`target_time` 表示延迟到什么时候，`waker` 用于在延迟完成后发出信号。`poll` 方法中判断当前时间是否大于 `target_time`，如果大于则返回 `Ready`，否则返回 `Pending`。

```rust
pub async fn delay(ms: usize) {
    DelayFuture::new(ms).await;
}

struct DelayFuture {
    target_time: usize,
    waker: Option<Waker>,
}

impl DelayFuture {
    fn new(ms: usize) -> Self {
        DelayFuture {
            target_time: get_time_ms() + ms,
            waker: None,
        }
    }
}

impl Future for DelayFuture {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        if get_time_ms() >= self.target_time {
            Poll::Ready(())
        } else {
            Poll::Pending
        }
    }
}
```

## 测试
`rust_main` 操作系统的 rust 入口，`task1` 和 `task2` 是两个异步任务，`task1` 先打印 `start task 1`，然后延迟 200ms，再打印 `end task 1`。`task2` 也是类似，只是延迟时间更长。运行时先执行 `task1`，然后切换到 `task2`，再切换到 `task1`，最后切换到 `task2`。

```rust
#[no_mangle]
fn rust_main() {
    let mut rt = Runtime::new();
    rt.spawn(task1());
    rt.spawn(task2());
    rt.run();
}

async fn task1() {
    println!("start task 1");
    delay(200).await;
    println!("end task 1");
}

async fn task2() {
    println!("start task 2");
    delay(500).await;
    println!("end task 2");
}
```

打印结果：
```
start task 1
start task 2
end task 1
end task 2
```

## 总结
Rust 的异步编程还是很方便的，但是目前的实现还是很粗糙，比如没有实现真正的唤醒器，也没有实现真正的异步操作，只是模拟了异步延迟。下一步是实现真正的唤醒器，然后尝试实现异步的 I/O。
