---
title: rCore-camp2022-clstilmldy
date: 2022-08-01 11:42:34
categories:
    - report
tags:
    - author:celestilmelody
    - summerofcode2022
    - rcore-lab
---

repo:<daily_schedule_for_os_traning_camp_2022>

## rust语言学习

​	Rust 中有许多我第一次听说的概念（比如所有权、借用、模式匹配、生命周期等等），以及感到奇妙的用法（比如枚举、宏编程、迭代器、闭包等等）。

​	Rust 拥有出色的文档（rustwiki、以及官方推出的一系列教程等等）、强大的编译器（可以给出清晰的错误提示信息）等等，这些都是我其他语言不具有的；虽然使用上确实有难度，但是 Rust 确实很强大。

<!-- more -->

## rCore 学习

​	很遗憾，到目前为止，我只完成了lab1。没完成的原因有很多，不过我参与 rCore 学习的目的也是想学习操作系统与rust，而且接下来也可以继续一边系统地学习操作系统，一边通过 rCore 加深对操作系统的理解。其实7月我浪费了很多时间，希望8月好好学习，争取参加之后9月的rCore camp。

### 仅对lab1来谈实验感悟吧

​	作为rust初学者，在写实验的时候会很谨慎地考虑如何写rust，担心编译失败；其实lab-1要求比较简单，难点是理解以提供的代码，以及如何使用已经提供的代码，哪些是需要用的等等（感觉实验普遍都是这样）

​	实验要求中，统计任务的相关系统调用的次数。

​	我一开始是想通过寻找函数`syscall`的调用位置来进行补充，但发现仅在函数`trap_handler`中使用过系统调用，而后者实际是与嵌入的汇编代码进行交互的，不知从何处下手，故陷入僵局。

>[系统调用-特权级机制](http://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/1rv-privilege.html)
>
>- 内核和 U 模式的应用程序之间的接口被称为 **应用程序二进制接口** (Application Binary Interface, ABI) —— **系统调用**
>- 系统调用的本质是一种异常 —— **陷入异常控制流**，在该过程中会切换 CPU 特权级
>- 当调用一个系统调用时会触发 CPU 异常，CPU 进入异常处理流程
>
>所以系统调用是用`trap_handler`控制的

> [不同类型的上下文与切换](http://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/2task-switching.html#id4)
>
> [任务切换的设计与实现](http://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/2task-switching.html#term-task-switch-impl)
>
> - 与 Trap 切换不同，它不涉及特权级切换
> - 与 Trap 切换不同，它的一部分是由编译器帮忙完成的
> - 与 Trap 切换相同，它对应用是透明的
>
> 任务切换是来自两个不同应用在内核中的 Trap 控制流之间的切换 ——  **换栈**
>
> 所以仍然使用`trap_handler`控制系统调用
>
> *handle an interrupt, exception, or system call from user space*	

​	于是考虑到从系统调用函数`syscall`中寻找答案；实际上该函数也是由各种系统调用函数组成，在深入部分函数，如 `sys_yield`，明白该函数是通过 `TaskManager` 调用的，而我们维护了一个全局的任务管理器；结合任务提示 —— `系统调用次数可以考虑在进入内核态系统调用异常处理函数之后，进入具体系统调用函数之前维护` —— 我们可以在进入具体函数调用之前，通过任务管理器，获取当前任务，对应的`syscall_times[syscall_id] += 1`即可（当然需要修改TaskControlBlock） —— 补充函数 `pub fn update_syscall_record(syscall_id: usize)`。

​	虽然对 `多道程序与分时多任务` 、 `系统调用` 等等，并非完全理解（初始操作系统，懵懵懂懂，主要是还没有理清思路）但感觉获得了很大的收获。

​	通过阅读文档，大概对本章操作系统的内容理解50%，通过实验对内容再次加深理解，大概理解有70%。通过rCore有助于加深对操作系统的理解，还是很高兴能参与第一阶段的学习的。
