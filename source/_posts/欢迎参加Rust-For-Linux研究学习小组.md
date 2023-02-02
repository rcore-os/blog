---
title: 欢迎参加Rust_For_Linux研究学习小组
date: 2023-01-09 16:10:10
categories:
    - announcements
tags:
    - author:shzhxh
    - Rust-for-Linux
---

**不同操作系统内核可重用的Rust Crate设计与实现**

Rust 是一种“多范式安全系统编程语言”，在开源领域呈现出滚雪球般的势头不断壮大。当前已经出现了多种基于Rust的实验型操作系统项目，而且也已经出现在主流的操作系统中。2022年12月12日，Linux 6.1 正式发布。Linux 6.1 的一个主要升级是把已经开发近一年多的Rust for Linux子系统加入主线，这是对 Rust 在Linux内核上的重要突破。今后将可以使用Rust开发操作系统内核模块，并用于不同操作系统中，而Rust化的实时优化Linux内核和Rust RTOS将成为重要新技术方向。

本课程计划定期讨论和研究 **“不同操作系统内核可重用的Rust Crate设计与实现”** ，并基于Linux内核和Rust RTOS，着重开展以下三个研究子方向的技术工作：

<!-- more -->

**内核特性研究：**

1. 如何快速启用Linux Rust Feature并运行测试
2. 分析Rust在Linux 6.x内核里的用法
3. 内核中Rust 与 C 的 ABI 兼容性与互操作系统性的研究
4. 为linux其他子模块封装rust api,用rust重写子模块
5. 完善Rust-for-Linux并提交补丁
6. 实时操作系统（Linux RT-Preempt， RTOS等）关键技术研究

**硬件驱动研究：**

1. 分析并设计实现面向virtio设备，可独立运行的基础Rust Device Driver Crate
2. 用Rust重写Linux Device Drivers书中的例子，并可在Linux内核中运行
3. 设计 OS kernel 设备驱动抽象库，让 基于Rust 开发各种OS的驱动更加方便易用
4. 使用Rust编写各种嵌入式驱动模块，如串口、网络、GPU等
5. 在基础Rust Device Driver Crate上，快速实现不同OS kernel上的设备驱动


**异步内核编程研究：**

1. 研究 Rust for Linux 对异步内核编程的 “异步”支持
2. 探索Linux 驱动模块的异步编程方式
3. 分析异步网络 TCP/IP协议栈的设计与实现
4. 分析异步文件系统的设计与实现


**学习小组公约：**


1. 每周一、三、五的晚上8点开始，定为固定时间的学习小组讨论会。每次讨论会不少于1小时，不多于3小时。

2. 第一期从2023.2.6开始，学习周期初步定为3周，学习目标是分工完成上面的研究课题，总结出关于这个课程的知识点大纲和时间进度安排表。

3. 每个小组成员要求每周的学习小组讨论会都要参加，并力争有所输出分享。每次活动安排3人进行分享，每个分享时间以20-30分钟为宜。


参考信息：

- [基础Rust Device Driver Crate: virtio-drviers](https://github.com/rcore-os/virtio-drivers)
- 基于基础Rust Device Driver Crate的操作系统
  - [rCore-Tutorial v3](https://github.com/rcore-os/rCore-Tutorial-v3/tree/ch9)
  - [zCore](https://github.com/rcore-os/zCore)

参加链接：

[Rust For Linux研究学习小组](https://www.wjx.cn/vm/OUlztkX.aspx#)

- 或者扫描图片二维码：

 {% asset_img welcome_join.jpg welcome %}
