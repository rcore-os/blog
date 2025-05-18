---
title: 尚书的rcore阶段4学习笔记
date: 2024-12-22 12:30:56
tags:
    - author:zerich
---

## 前言

在阶段4我进入了项目四：基于协程异步机制的操作系统，由于之前缺乏对相关知识的了解，前期花了大量时间来阅读源码和理解，最后才实现了在OS中boot了一个简单的的异步executor。

## async keyword

在 Rust 中,使用 async 关键字修饰的函数会返回一个实现了 Future trait 的匿名类型

```rust
pub trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output>;
}
```

例如

```rust
async fn my_async_function() -> u32 {
    42
}
```

编译器会将其转换为类似以下的代码:

```rust
fn my_async_function() -> impl Future<Output = u32> {
    struct MyAsyncFunction {
        // 异步函数的状态
    }

    impl Future for MyAsyncFunction {
        type Output = u32;

        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
            // 异步函数的执行逻辑
            Poll::Ready(42)
        }
    }

    MyAsyncFunction {
        // 初始化异步函数的状态
    }
}
```

这种设计允许编译器生成最优化的异步执行代码,同时提供了灵活性和类型安全性。

当然，对于rust的异步编程还有许多深入的概念，例如关于自引用的 Pin<> , 关于优化轮询的 Waker 等。

## why async-OS

所以为什么要实现一个基于协程异步机制的操作系统呢？答案当然是为了并发的性能。内核可以通过轻量的内核线程和优化的异步调度执行来提升对系统调用的批处理速度。

参考[async-module](https://github.com/AsyncModules/async-os/blob/main/modules/trampoline/async_syscall.md)关于系统调用的优化，存在两种方向：

1. 减少由于系统调用导致的特权级以及上下文切换开销
2. 异步批处理

在高并发场景下，使用类似dpdk/spdk等通过用户态轮询完全绕过内核是可行的，但是如果仍然使用系统调用，那么当应用通过系统调用同步地进入内核态时，内核就可以对这些系统调用进行异步批处理，从而提升性能。
并且异步调度的 poll / wake 机制更适合设备驱动的工作状态。

## design

考虑一种简单的情形，在OS初始化阶段，把栈初始化之后，直接开始运行全局的executor，负责对内核中的异步协程进行调度。这样，我们所有的系统调用都可以写成async的形式。

那么，当用户程序需要调用系统调用时，会先同步的进入内核态并设置scause寄存器的值来指定系统调用号，然后调用syscall之后await，在系统调用执行完之后再切换回用户态。所以这里的syscall api实现了一个异步和同步切换的过程。
当然另一种思路是，通过内核向用户态发送通知或者共享内存等方式，实现完全的异步系统调用，这里不再讨论。

## implement

所以，我们在内核态需要建立自己的异步运行时，在抽象上的第一个问题是，Rust 欠缺对 async-trait 的支持。

例如

```rust
pub trait Mutex {
    async fn wait(&mut self) -> FutexWait;
}
```

Rust 编译器默认不支持 async trait function。编译器提示说使用 async-trait 这个 crate。可惜的是，这个 crate 不是零开销的, 会将返回值改写成 Box<dyn Future> 的形式。

还是继续考虑对futex的实现。我们既然想让对互斥锁的wait支持异步，那么就先实现一个 Future。

```rust
impl Future for FutexWait {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = &mut *self;
        loop {
            match this.queue.poll(&mut this.id, cx.waker()) {
                Ok(poll) => break poll,
                Err(queue) => this.queue = queue,
            }
        }
    }
}
```

如果可以从互斥锁队列queue中拿到结果，那么就返回poll， 否则就对等待队列进行更新并继续循环。

接下来考虑进程的执行单元task，Task 结构体包含了任务的各种属性,如可执行文件、父任务、子任务、任务 ID、时间信息、信号相关的字段等。如果我们想要把task交给executor执行，就需要为task的返回值实现 Future 。

也就是说，我们把task的返回值当成 Output 以实现一个 TaskFut:Future 的结构体 ， 接着将这个 task 封装成一个异步的 loop 传入 executor 中。 在 loop 中 ，我们通过 trap 切换回用户空间 ， 并且捕获用户空间的中断和异常 ， 在切换回内核空间之后继续处理。

## try

接着，在老师的指导下，我进行了将二阶段 rCore-tutorial 操作系统实现异步的尝试。

在 rust 的入口处，我们使用mm::init()来使用HEAP_ALLOCATOR来初始化堆内存，接下来我们就可以直接在堆内存上建立executor

```rust
#[no_mangle]
/// the rust entry-point of os
pub fn rust_main() -> ! {
    clear_bss();
    println!("[kernel] Hello, world!");
    logging::init();
    mm::init();
    mm::remap_test();
    
    let mut rt = RUNTIME.execlusive_access();
    rt.spawn(task1)
    rt.run()
}

async fn task1() {
    println!("[kernel] task1: hello async world!");
}
```

这样就是最简单的内核态的async执行测试。