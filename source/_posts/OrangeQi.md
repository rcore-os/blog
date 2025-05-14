---
title: OrangeQi
date: 2025-04-28 02:39:23
tags:
---


之前对操作系统有一定理论基础，rcore 和 arceos 项目对我最大的挑战主要包括：
1. risc-v 体系结构的知识，尤其是特权架构。这对理解 trap、context_switch、地址空间相关的代码极其重要。
2. arceos 项目的组织构建。最底层是 axhal，抽象了硬件架构和运行平台，往上是各个 module 例如 axtask 等，再向上是 axapi 乃至 ulib。这种组件化的设计思想充分利用的 rust 语言的优势，极大方便构建。

unikernel 架构是没有特权级切换的，应用程序也运行在 s 态。刚开始没有仔细理解 ppt，给我造成了挺大的困扰。

hashmap 的实验我并没有自己手写代码，而是直接引入了 hashbrown 库。但手撕一下代码应该能更加锻炼能力。

此外，hypervisor 给我带来了挺大的困难，参考其他同学的经验我才得以通过。