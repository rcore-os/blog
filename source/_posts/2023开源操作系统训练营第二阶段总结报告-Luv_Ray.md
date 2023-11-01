---
title: 2023开源操作系统训练营第二阶段总结报告-Luv_Ray.md
date: 2023-11-2 00:00:00
tags:
    - author:Luv_Ray
    - repo:https://github.com/LearningOS/2023a-rcore-Luv-Ray
---

# 2023rCore 训练营第二阶段总结

其实很早以前就知道 rcore 这个项目了，之前学 rust 时做过 Stanford 的 [CS 110L](https://reberhardt.com/cs110l/spring-2020/)。
不过由于之前做过 MIT 的 xv6，在操作系统 lab 方面定位有些重合，就没有去做 rcore。

在今年暑假想要找些 rust 项目看时，在 github 上找到 arceos，后面才知道 rcore 只是社区众多项目中的其中一个，这次报名也是希望能进一步参与后面的项目。

## 实验
rcore 的实验其实挺简单，重要的是理解系统概念以及现有的 api，这一点其实和 xv6 有点相似。
然而这也对应了另一个问题，只做实验其实不一定有很好的学习效果，有可能只根据类型试着调用 api 就能通过测试，学习的深度某种程度上只能靠自觉来保证。

另外，感觉各个 lab 的测试样例并不算强，其实编写 kernel 是很容易在 corner case 上出各种漏洞的，希望自己的实现没太大问题。

由于 rust 本身的约束，产生漏洞的风险比 c 要小，但是在使用 unsafe 时，由于 rust 本身做了更多抽象，直接接触底层时就会有更大的潜在隐患。

比如在 `sys_task_info` 中，需要将 `&TaskInfo` 转换为 u8 的 buffer，我使用了 `as` 来直接进行转换

```rust
let k_ti = &TaskInfo {
        status: get_task_status(),
        syscall_times: get_task_syscall_times(),
        time: get_time_ms(),
    } as *const TaskInfo
        as *const [u8; mem::size_of::<TaskInfo>() / mem::size_of::<u8>()];
```
转换为裸指针是 safe 的，但是访问裸指针时很容易触发未定义行为，unsafe 里有很多隐秘的 **unsound** 情况。

实际上，对于 `TaskInfo` 数组：
```rust
/// Task information
pub struct TaskInfo {
    /// Task status in it's life cycle
    status: TaskStatus,
    /// The numbers of syscall called by task
    syscall_times: [u32; MAX_SYSCALL_NUM],
    /// Total running time of task
    time: usize,
}
```
其内存布局是**不确定**的，编译器甚至不保证 `status`，`syscall_times`，`time` 是按顺序排布的，添加 `#[repr(C)]` 才能保证会是我们想象的类似 C 语言的内存布局。

同时，这个结构体中的元素比较简单所以没问题，但是直接裸指针转换是很不好的风格，在面对内部可变性、内存对齐、未初始化元素时极易访问未初始化内存，对未初始化内存的任何写入和读取都是**UB**。

在 [bytemuck](https://docs.rs/bytemuck/latest/bytemuck/fn.cast.html) 提供了对于类型转换的更好方式。

类似这种，其实很有多潜在的需要解决的问题都被忽略了，实验中保留了比较核心的概念和问题，但是仔细挖掘文档和现有的代码的话，会有更多的值得学习和思考的问题。

# 总结
rcore 是个很好的 rust 和 OS 项目，国内的开源教学项目实在很少，大部分学生都会去学习 MIT、CMU 等学校的开源课程，不过国外的英文课程对国内学生有一定门槛，会有一些额外的负担。
我之前写过的 Stanford 的 rust 课程在 20 年后的版本都不公开代码了，难免说开源的行为会持续多久，所以国内还是很需要这种优质的开源课程来弥补空白的，在此感谢各位老师和助教的付出，也希望未来在各个方面能有更多的优质开源课程。
