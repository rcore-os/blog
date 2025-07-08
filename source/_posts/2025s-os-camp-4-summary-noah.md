---
title: 2025年春夏开源操作系统训练营四阶段总结-noah-低侵入式的异步协程运行时
date: 2025-06-18 23:59:00
categories:
    - report
---

## 序言

非常高兴能参加到开源操作系统训练营第四阶段的学习，跟大家一起进步。经历完这四个阶段，自己有非常大的收获，让我理解了操作系统内部的运行机制，通过组件化的管理来实现更现代化的操作系统，最终在操作系统中支持异步机制提高操作系统的性能。

在每周的学习过程中，非常感谢[向勇老师](https://space.bilibili.com/507884048)给与了很多的指导和鼓励，成为了我前进的支柱。同时也要感谢[周积萍](https://github.com/zjp-CN)学长给与了很多帮助和支持以及建设性的意见，让我遇到困难时不迷茫。在第四阶段的过程中，也从其他同学那学到了很多，能便捷的获取到学习资料和代码，当有疑惑了也有人能够理解你，跟你一起深入到技术中进行讨论，那种感觉真是舒服。

## 每周工作

对于一个程序员来说，时间总是不够的，在四周时间里，我主要做了以下几个方面的工作：

**第一周 - 回顾**

当我第一周(2025-06-01)加入训练营的时候，发现去年的学长大佬们已经早早的开始了自己的课题。我就从基础慢慢开始，这周主要是把文档中的例会视频都看了一遍，基本了解了协程异步的作用以及目前是如何把异步应用到操作系统内核当中去的。

**第二周 - 定目标**

在看例会视频的时候，我发现有学长讨论 rust 异步的函数着色问题，碰巧我之前在写 rust 的时候也遇到了这个问题，很多时候一套逻辑代码，要分别实现一个同步版本一个异步版本，从一些学长的代码中看确实是分开写的，比如[赵方亮学长的仓库](https://github.com/AsyncModules/async-os/tree/main/modules)，在 2025-06-07 例会讨论中，有同学在参加 "大学生操作系统大赛" 的时候也遇到了此问题，最近在学习 zig 这门语言，说是能解决这个问题，我便想借着这个机会深入研究下。也是对于函数着色问题的一些自己的尝试，于是便确立了如下目标：

- 长期目标：实现低侵入式的异步协程框架，服务于操作系统内核
- 本期目标：实现简单的异步协程运行时 (zig)

后续在调研的过程中，发现 rust 的异步机制，是基于 Future 来实现的，这是一种无栈协程，跟我之前理解的 Go 语言的那种有栈协程还不一样。

**第三周 - 学习和实验**

后续的两个周，主要是学习文档中的异步协程资料，编写实验代码，验证自己的想法。

- 学习内容
    - [C：实现一个迷你无栈协程框架——Minico](https://www.less-bug.com/posts/c-implement-a-mini-stackless-coroutine-framework-minico/) - 理解什么是无栈协程
    - [stack-less rust coroutine 100-loc](https://blog.aloni.org/posts/a-stack-less-rust-coroutine-100-loc/) - 理解 rust 无栈协程
    - [Rust 圣经 - 手写 Future Runtime](https://course.rs/advance/async/future-excuting.html) - 理解 Waker 机制
    - [200 行代码绿色线程](https://web.archive.org/web/20220527113808/https://cfsamson.gitbook.io/green-threads-explained-in-200-lines-of-rust/supporting-windows) - 如何从零实现协程(绿色线程)

- 实验部分

    基于上面的学习的内容，进行了如下实验来验证想法：

    - 实现在 zig 中调用 rust 封装的绿色线程任务
    - 实现基于 Future 的异步运行时 (用 zig 语言)
    - 用 asm + zig 实现有栈协程切换机制

**第四周 - 代码结合**

- 异步协程运行时 xasync 框架代码编写
    - 基本完成跑通简单测例
    - 同时初步解决了函数着色问题

完成上述四周的工作后，基本实现我在开源操作系统训练营本阶段的目标，符合预期。

## xasync 异步协程运行时

### 使用者角度

我在设计 xasync 异步协程的时候，借鉴了 [zig 协程](https://kristoff.it/blog/zig-colorblind-async-await/) 的设计思路，感觉 zig 协程更容易让使用者理解和减轻负担，那么从使用者的角度出发，什么样的协程用起来才是最舒服的，我认为尽量保持一套代码，只通过一些简单的标记就可以实现同步和异步的切换，是更加友好的协程框架实现方式。下面是我理解的伪代码。

```zig
var is_async = true // 如果关闭后，底层会走阻塞逻辑

fn read(file) {
    if (is_async) {
        scheudle(future:run(sys_read(file))) // 生成 future，交给 executor 和 eventloop 调度处理
        suspend()
    } else {
        sys_read(file)
    }
}

fn long_time_action() {
    read("large file")
    sleep(100)
}

fn other_action() {
    
}

fn main() {
    let frame = xasync(long_time_action) // 使用者也可以用 xasync 来标记上层代码是异步的
    // xawait(frame) // 需要等待的时候才等待
    
    other_action()
}
```

通过上面的注释，可以仔细看下调用流程，这是我个人期望的协程框架使用方式的理解。

### 架构设计

![总体设计图](https://github.com/osxspace/qhos/blob/main/output/asyncos/xasync.png?raw=true)

上面是架构设计图，分为前后两部分把 `有栈协程` 和 `无栈协程` 结合起来，其中`红线理解为前进` `蓝线理解为返回`，比方说协程切换的前进返回、Future poll 前进和状态返回、协程调度的前进和唤醒的返回等。

目前图中描述的是有三个协程(绿色线程)在需要的场景下不断让出执行权，在异步任务结束后能随时切换到具体的任务上继续执行。这种机制在需要等待返回结果的情况下尤为重要。后续会优化成协程池方便使用。

下面从测例的角度简单剖析下实现代码和原理。

### Future

**测例代码**

```zig

const Counter = struct {
    const Self = @This();
    num: u32,
    max: u32,

    fn init(num: u32, max: u32) Self {
        return .{
            .num = num,
            .max = max,
        };
    }

    fn doCount(ctx: *Context) Result {
        const counter = @as(*Counter, @ptrCast(@alignCast(ctx.payload)));
        if (counter.num < counter.max) {
            std.debug.print("counter num = {}\n", .{counter.num});
            counter.num += 1;
            return .wait;
        } else {
            return .{ .done = &counter.num };
        }
    }

    fn doNextCount(result: ?*anyopaque, ctx: *Context) *Future {
        var counter = @as(*Counter, @ptrCast(@alignCast(ctx.payload)));

        const num = @as(*u32, @ptrCast(@alignCast(result)));
        const value = num.*;

        counter.num = 0;
        counter.max = value + 5;

        return run(Counter.doCount, counter);
    }
};

test "counter-chain-done" {
    const allocator = std.testing.allocator;

    var executor = Executor.init(allocator);
    defer executor.deinit();

    var counter = Counter.init(0, 5);
    const fut = runWithAllocator(allocator, Counter.doCount, &counter).chain(Counter.printNum); // 这里支持链式调用

    executor.schedule(fut);

    executor.run();
}
```

上面的代码是把一个 Counter 计数器，改成了异步机制，当 num > max 的时候才会终止运行。在实现的时候利用 zig uinon(enum) 的特性，尽量做到了零成本抽象。

**支持组合**

还支持了 Then 组合操作，因为在封装 Future 代码的时候可能要把原有的阻塞代码拆成多个 Future 逐步执行。代码如下：

```zig
test "counter-chain-counter" {
    const allocator = std.testing.allocator;

    var executor = Executor.init(allocator);
    defer executor.deinit();

    var counter = Counter.init(0, 5);
    const fut = runWithAllocator(allocator, Counter.doCount, &counter).chain(Counter.doNextCount); // 这里支持链式调用

    executor.schedule(fut);

    executor.run();
}
```

后续还会在 Future 上进行扩展支持 Join 等更多组合操作。

### Executor

Executor 中有两个队列：

- ready_queue: std.ArrayList(*Future) - 调度队列，供调用者放入 Future 任务
- futs: std.ArrayList(*Future) - 执行队列，实际调度器处理的 Future 任务

Future 先是进入到调度队列，如果调度开始执行后，会从调度队列取出任务放入执行队列，这时候执行队列中可能还有其他未完成的任务，当 Future 结束后会从执行队列中移除，如果执行队列中的所有任务都是等待状态，则 Executor 处于 idle 状态，等待 event_loop 唤醒，具体使用方式在上面的测例代码中已体现。

目前调度策略比较简单，而且没有经过任何优化，后续会不断完善。

### Coroutine(绿色线程)

目前已经支持协程间的切换，下面的代码是非对称协程的实现方式：

```zig
var base_coro: Coroutine = undefined;
var count_coro: Coroutine = undefined;
var count: i32 = 1;

fn addCount() void {
    count += 1;
    base_coro.resumeFrom(&count_coro);
    count += 1;
    base_coro.resumeFrom(&count_coro);
    count += 1;
    base_coro.resumeFrom(&count_coro);
}

test "simple counter suspend and resume coroutine" {
    const allocator = std.testing.allocator;

    base_coro = try Coroutine.init(allocator, null);
    defer base_coro.deinit();
    count_coro = try Coroutine.init(allocator, addCount);
    defer count_coro.deinit();

    try std.testing.expect(1 == count);

    count_coro.resumeFrom(&base_coro);
    try std.testing.expect(2 == count);

    count_coro.resumeFrom(&base_coro);
    try std.testing.expect(3 == count);

    count_coro.resumeFrom(&base_coro);
    try std.testing.expect(4 == count);

    std.debug.print("all finished\n", .{});
}
```

这个测试就是用协程的方式去执行 addCount 所在的 count_coro 协程，在 addCount 中也可以随时切换调用者协程 base_coro，执行原有逻辑。

还支持了函数参数的传递，在上下文切换的时候，不是两个函数的切换，是通过一个中间函数 `call`，它会根据汇编传过来的参数指针地址，转换成具体的 *Coroutine，再从其中拿出 func_ptr 和 args_ptr，就相当于中间层转发了一下。从下面的代码看目前参数类型都是定死的，有点牵强，目前够用。

```zig
fn call(coro_ptr_int: u64) void {
    const coro: *Coroutine = @ptrFromInt(coro_ptr_int);

    std.debug.print("current coro address: 0x{x}\n", .{@intFromPtr(coro)});

    if (coro.frame.func_ptr != null) {
        if (coro.frame.args_ptr != null) {
            const func_ptr = @as(*const fn (*const anyopaque) void, @ptrCast(coro.frame.func_ptr.?));
            const args_ptr = coro.frame.args_ptr.?;
            func_ptr(args_ptr);
        } else {
            const func_ptr = @as(*const fn () void, @ptrCast(coro.frame.func_ptr.?));
            func_ptr();
        }
    } else {
        std.debug.print("the func pointer is null\n", .{});
    }
}
```

### Eventloop

事件响应机制也就是 eventloop (reactor 模型)，其实是所有异步协程实现的底层支持，我甚至认为就算不用异步，只用事件机制和回调的方式也能做到高性能。这一部分在本期训练营并没有深入的去学习，目前只是实现了一个大概。如果这层封装好了，做成一层统一的抽象去处理 epoll、io_uring、iocp、kqueue 以及中断信号量等，也将会有很大的收获，给自己挖个坑，明年把这部分填上。

eventloop 的核心代码就是用一个循环，不停的调用系统需要等待的函数，等待系统给出响应，这里用的是 epoll_wait，这些系统提供的函数其实在操作系统里面都有自己的实现，一般性能都比较高，而且可以阻塞也可以非阻塞。当系统给出响应后，再触发回调去唤醒 Executor。

```zig
pub fn poll(self: *Self, timeout_ms: i32) !usize {
    try self.events.resize(16); // 预分配事件数组，先这么写

    const n = std.posix.epoll_wait(self.epfd, self.events.items, timeout_ms);

    for (self.events.items[0..n]) |event| {
        const fd = event.data.fd;

        if (self.callbacks.get(fd)) |callback| {
            if (event.events & std.posix.system.EPOLL.IN != 0) {
                var buf: [8]u8 = undefined;
                _ = std.posix.read(fd, &buf) catch {}; // 这里目前只处理了 timer 的情况

                if (callback.callback_fn) |func| {
                    func(callback.user_data);
                }
            }
        }
    }

    return n;
}

pub fn run(self: *Self) !void {
        self.running = true;

        while (self.running) {
            _ = try self.poll(100); // 100ms 超时
        }
    }
}
```

### 整体组合 xasync

把上面各部分组合起来，看看能不能达到预期效果。

**Timer**

这部分注册一个 TimerHandle 到 event loop 当中。

```zig
const Timer = struct {
    const Self = @This();

    handle: TimerHandle,
    completed: bool = false,
    waker: ?*const Waker = null,

    fn init(nanoseconds: u64) !Self {
        const handle = try TimerHandle.init(&global_event_loop, nanoseconds); // 注册给 event_loop
        return .{
            .handle = handle,
        };
    }

    fn deinit(self: *Self) void {
        self.handle.deinit();
    }

    fn timerCompletedCallback(data: ?*anyopaque) void { // event_loop 回调
        if (data) |ptr| {
            const timer: *Timer = @ptrCast(@alignCast(ptr));
            timer.completed = true;
            std.debug.print("timer callback completed!\n", .{});
            if (timer.waker) |waker| {
                waker.wake(); // 唤醒
            }
        }
    }

    // future poll
    fn poll(ctx: *Context) Result {
        const timer: *Timer = @ptrCast(@alignCast(ctx.payload));
        if (timer.completed) {
            std.debug.print("poll timer is completed\n", .{});
            return .{ .done = null };
        } else {
            timer.waker = ctx.waker;
            return .wait;
        }
    }
};
```

**Sleep**

这部分把 Timer 包装成 Future

```zig
fn sleep(nanoseconds: u64) void {
    std.debug.print("sleep comes in\n", .{});
    if (!sys_is_block) {
        const timer_ptr = global_runtime.allocator.create(Timer) catch unreachable;
        timer_ptr.* = Timer.init(nanoseconds) catch unreachable;

        const callback = EventCallback{
            .callback_fn = Timer.timerCompletedCallback,
            .user_data = timer_ptr,
        };
        timer_ptr.handle.setCallback(callback) catch unreachable;

        const timer_fut = future.runWithAllocator(global_runtime.allocator, Timer.poll, timer_ptr).chain(struct {
            fn thenFn(_: ?*anyopaque, ctx: *Context) *Future {
                const timer = @as(*Timer, @ptrCast(@alignCast(ctx.payload)));
                ctx.allocator.destroy(timer);
                return future.done(null);
            }
        }.thenFn);

        global_runtime.executor.schedule(timer_fut);

        global_runtime.switchTaskToBase(); // 类似 suspend - 这个地方实现还有点歧义
        // global_runtime.switchToExecutor(); // 如果需要等待返回结果则需要切换到 executor 等待其 resume 回来
    } else {
        std.Thread.sleep(nanoseconds);
    }
}

fn delay() void {
    std.debug.print("delay comes in\n", .{});
    sleep(5 * std.time.ns_per_s);
}
```

**main**

整合完毕后对于使用者来说，代码如下：

```zig
xasync(delay);
// xawait(); // 需要等待的时候开启
std.debug.print("hello xasync\n", .{});
```

### 运行效果

**不等待完成**

```sh
delay comes in
sleep comes in
hello xasync                - 注意这里，没有等待 timer 异步执行结束，而是直接返回
timer callback completed!
poll timer is completed     - 注意这里，timer 结束了
main will quit
event loop quit
```

**等待完成**

```sh
delay comes in
sleep comes in
timer callback completed!
poll timer is completed
hello xasync                - 注意这里，虽然底层是异步协程执行，但是这里等待 timer 执行完毕才打印
main will quit
event loop quit
```

## 总结

从目前执行效果和 API 的调用方式看符合预期，基本达成了本期的目标：`实现简单的异步协程运行时 (zig)`，按照这种方式解决`函数着色问题`是有希望的。

虽然本期目标基本达成，但是中间学习的过程中还是有很多技术细节没有完全搞懂，有些学习资料没有完全看完，后续还要继续努力。

## 后续规划

- 参数和返回值的类型支持且能自动推导
- 支持线程池 thread pool
- eventloop 完善
- 是否后台调度支持用户配置 - 现在需要改代码来实现
- 支持 rust 调用
- 封装 asyncio
- 集成到 arceos/rcore 中
- 性能对比测试

## 答疑和思考

**为什么要用 zig 写**

- 没有任何原因，个人偏好，peace & love.

**实现代码在哪里**

- [xasync1](https://github.com/osxspace/qhos/tree/main/output/xasync1)