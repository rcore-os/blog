---
title: 24秋冬训练营四阶段总结-yukariyuko 
date: 2024-12-22 12:00:00
categories:
    - report
tags:
    - author:yukariyuko
    - repo:https://github.com/yukariyuko/naive
    - async
    - io_uring
---

# 总说
在训练营的第四阶段，几乎一直在读东西，一边看一边学asynchronous和Rust，之前几乎没有了解和使用过异步方面的东西。
学习效果不是很好，结营后还得多读多写这一块的代码，继续学习。

# 细说
## 第一周：
- 了解了一些RUST的异步和协程机制
- 读了[绿色线程](https://zjp-cn.github.io/os-notes/green-thread.html)的代码
- 读了philopp那篇用[异步实现协作式任务调度](https://os.phil-opp.com/async-await/)

## 第二周:
- 跟着[这篇博客](https://toetoe55.github.io/async-rt-book/)了解了实现异步运行时的思路
- 看PPT给上的[tokio相关](https://tokio-zh.github.io/document/)

## 第三周:
- 读了io_uring的手册，顺带了解了一下使用环形队列和内存映射，无锁环提高性能的原理
- 读了一下smol源码，主要是futures-lite和async-executor部分
- 尝试使用iou封装的接口实现[简单的异步文件读写](https://github.com/yukariyuko/naive)，但是实现的waker有问题，没有成功
