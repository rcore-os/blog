---
title: wtblog
date: 2021-07-28 18:38:48
categories:
	- report
tags:
	- author:wangtao-creator
	- summerofcode2021
	- rcore-lab
---

## 前言

​	我觉得OS让人着迷，对我来说是这样的。我以前在想，电脑启动，它为什么能启动，内部又干了什么，它为什么能如此高效的处理事件，它能实现各种各样的功能。借着这次机会，我也在不断学习OS、RISC-V、rcore方面的知识。加油。

<!-- more -->

## Rust

​	Rust我是跟着[Rust编程语言入门教程](https://www.bilibili.com/video/BV1hp4y1k7SV?from=search&seid=5869012604221649960)学习的，此视频配套教材是**《Rust权威指南》**，期间也将rustlings与15道编程题完成。Rust给我的感觉是它融合了诸多语言的长处，因为我之前也接触过几门编程语言，比如c,c++,py,java。Rust的安全性设计的很精妙。



## RISC-V系统结构

​	看了 **RISC-V手册：一本开源指令集的指南**的第10章，阅读了[PPT for RISC-V特权指令级架构](https://content.riscv.org/wp-content/uploads/2018/05/riscv-privileged-BCN.v7-2.pdf)，[计算机组成与设计：RISC-V](https://www.icourse163.org/course/ZJU-1452997167)网课第一，二章看了一下。哈工大的OS课也在不断学习。

对RISC-V系统结构还是有一个大概认识。



## 开发操作系统--based on qemu

​	我实验环境使用的是ubuntu16.04还有qemu模拟器。

​	阅读[rCore Tutorial v3的实验指导内容](https://gitee.com/rcore-os/rCore-Tutorial-Book-v3)，根据lab1-8的各个小节和代码，自己一步一步手写代码重现整个实现过程，并提交各个阶段的code成果。

​	跟着指导内容一步步的做出自己的操作系统，感觉还是不错的，虽然中途困难很多，有时候，几天都没啥进展，被困在原地，不过还是尽全力了。对操作系统的理解也更上一层楼。从一开始的去掉标准库依赖到地址空间，进程管理，文件系统等等都很不错。

