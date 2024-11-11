---
title: 2024秋冬开源操作系统训练营第一二阶段总结-FunCheney
date: 2024-11-11 07:40:28
categories:
    - 2024秋冬季季开源操作系统训练营
tags:
    - author:FunCheney
    - repo:https://github.com/LearningOS/2024a-rcore-FunCheney
    - ...
---

### 第一阶段

之前在公司工作的时候就了解到了 rust，工作中客户端使用 rust，当时觉得 rust 离后端(服务端)比较远，就错过了 rust 的深入了解与学习。
在这几年的工作与学习中，慢慢接触到rust在操作系统的领域也在使用。于是准备学习一下这门新的语言。自己也想对操作系统相关方面做一些
更加深入的了解。

一次偶然的机会在github 上看到了 rcore，用 rust 写操作系统，这个和自己的需求完美契合了。。。

本课程第一阶段采用 rustlings，在线测评，然后对应的知识点也会有出处。是一个非常好的学习工具，但是整体来说数据结构部分相对较难，需要
一些相关数据结构的基础，以及对 rust 语法的了解。

自己对 rust 相关的一学习的例子与记录： https://github.com/FunCheney/Fos/tree/main/rust-study

整体感觉：
1. 语言的学习还是要多动手练习，多写代码才能理解
2. 数据结构与算法相关的章节还需要持续的练习
3. 后续还要安排并发相关的学习与记录：https://github.com/FunCheney/Fos/tree/main/rust-study/rust-atomics-and-locks

### 第二阶段

整体来时实验教程偏简单且大多都一笔带过。学习的过程中主要还是参考: rCore-Tutorial-Book 第三版！

因为在训练营开始之前我就已经在通过看： rCore-Tutorial-Book 以及抄 https://github.com/rcore-os/rCore-Tutorial-v3 中每一章节相关的代码，
因此在训练营阶段也在抄其中代码，在自己的仓库里面手写了一遍相关代码。

对 risc-v 精简指令架构有了一些了解：https://github.com/FunCheney/Fos/tree/main/code/asm 主要代码实现。
整体感觉：
1. risc-v 的指令架构没有 intel x86 指令复杂。
2. 文件系统，与锁相关的实验部分用时教程，偏难。
3. rust-sbi 和 qemu 会简化很多汇编的相关的工作。降低了对操作系统启动记载相关的一些理解门槛，之间看过 linux 0.11 相关的启动逻辑，还是比较复杂。
4. 通过在线测评的方式，通过一些测试用例可以起到检测的收手段。比自己写代码的时候（尤其是还在学习过程中）不知到对错会更有方向。但是还是缺少一些
   最佳的实现知道，因为不知道自己过了是否就是好的编码方式，好的实现思路。
