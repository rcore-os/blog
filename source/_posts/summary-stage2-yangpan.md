---
title: summary-stage2-yangpan
date: 2021-08-30 08:42:45
categories:
	- report
tags:
	- author:yangyangpanpan
	- summerofcode2021
	- zcore
---

## 学习概况

 - 潘庆霖学长zcore毕业论文阅读
 - 完成zCore-tutorial前三章，及前三章代码理解
 - 看了代码有关，例如weak, std::sync::atomic等相关语法
 - 完成前三章理解记录，已上传到自己的repo
 - repo:https://codechina.csdn.net/qq_40298363/zcore-tutorial

<!-- more -->

## 要点理解

**RUST语言特点**

 - 内存安全：所有权机制
 - 线程安全：在 Rust 中,要求可能被不同线程访问到的变量必须实现 Sync Trait,或者用实现了 Sync Trait 的互斥锁对相关变量进行封装
 - unsafe: 在 Rust 中,如果完全遵循我们前面提到的所有权机制和线程安全的限定,在类似系统内核这样的底层领域,有部分功能将会无法实现。Rust 给出的 unsafe 语法,允许开发者使用 unsafe 关键字划定代码块,在unsafe 代码块内部,开发者可以绕过部分编译期检查,灵活地使用裸指针操作内存,使用嵌入汇编对代码进行优化、对硬件进行控制,等等

**zCore设计原则**

核心理解：将内核服务用面向对象的思想封装

kernel­hal­bare：完全基于实际硬件的接口实现

kernel­hal：向上提供一套硬件相关 API,这一套 API 给出上层实现所需要的所有操作硬件的接口，API 之内的实现和所依赖的环境,对于上层实现而言是透明的

object层：内核对象实现

syscall:实现各个系统调用的处理例程,将所有的处理例程封装为一个系统调用库

zircon­loader 库中,将内核中初始化内核对象、设定系统调用入口、运行首个用户态程序等逻辑进行封装,形成一个库函数

优势：可扩展性，安全，可移植性

**kernel­-hal实现**

对比以前的代码增加了HAL硬件抽象层，可以看出kernel-hal只提供了接口，kernel-hal-unix提供了实现。在 HAL 接口层的设计上,我们借助 Rust 的能够指定函数链接过程的特性。在 kernel­hal 中规定了所有可供 zircon­object 库及 zircon­syscall 库调用的虚拟硬件接口,以函数 API 的形式给出,内部均为未实现状态,并设置函数为弱引用链接状态。在 kernel­hal­bare 中给出裸机环境下的硬件接口具体实现,在 zCore 项目编译、链接的过程中将会替换 kernel­hal 中未实现的同名接口,从而达到能够在编译时灵活选择 HAL 层的效果。

kernel­hal 库仅负责接口定义,具体的实现可以有多种形式,完全基于实际硬件的 kernel­hal­bare能够让上层 OS 运行在实际硬件上,基于宿主 OS 提供的系统调用进行实现的kernel­hal­unix 能够让上层 OS 内核运行在 Linux 这样的类 Unix 系统上。

加入kernel-hal目的，是为了更好满足硬件平台异构性

**组合**

rust中没有继承机制，可利用组合代替。使用一个 struct 来提供所有的公共属性和方法，作为所有类的第一个成员，利用一个宏为内核对象 struct 自动实现 KernelObject trait 的宏。如此可实现代码复用，不用为每一个内核对象手动实现KernelObject trait。安全，高效。

**async机制**

每个异步任务分成三个阶段：

 - 轮询阶段（poll phase）。一个 Future 被轮询后，会开始执行直到被阻塞。通常由执行器 Executor 负责对 Future 进行轮询；
 - 等待阶段。事件源 Reactor 注册等待一个事件发生，并确保当该事件准备好后唤醒相应的 Future。
 - 唤醒阶段。事件发生，对应的 Future 被唤醒，执行器 Executor 调度该 Future 再一次轮询它，此时返回的结果表明继续执行的条件已满足，该异步任务会继续执行直到再一次被阻塞，回到轮询阶段。如此不断循环直到这个异步任务全部完成。

Rust 中的异步运行时可以分成两个部分：

 - 事件源 Reactor;
 - 执行器 Executor。

前者负责通知一个 Future 它的等待条件达成，可以继续向下执行；后者则负责对多个 Future（也就是多个异步任务）进行执行，并在此期间负责它们的调度、管理。这两部分的功能完全独立，在中间层通过 Waker 进行协作。

