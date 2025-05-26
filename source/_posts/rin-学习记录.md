---
title: rin-学习记录
date: 2025-05-09 21:22:36
tags:
---

# oscamp2025-blog

这是一个记录 2025 Spring Camp 的 repo

本仓库将存储相关实验报告与每日blog

## 第一阶段：rustlings

### 4.1

部署了rustlings练习环境，找到了资料并完成了第一节课的练习

### 4.2

参考官方的 rust book 学习了所有权、struct，并完成相关练习

### 4.3

学习了mod

### 4.4-4.6

无进度

### 4.7

学习了HashMap，Vec，String等容器

### 4.8

狂补进度，学泛型，trait，有cpp基础就挺好理解的了

### 4.9

做算法，完成最后10题（其实好像不是算法只是data structure实现）

## 第二阶段：rcore-tutorial

### 4.10

配置实验环境，阅读了教程第一章，初步了解了kernel启动需要的过程

### 4.11

无进度

### 4.12

阅读教程第二章，了解了用户特权级与内核特权级的切换过程

### 4.13

阅读第三章，完成lab1和作业1（作业1让我复习了第二章并更深入理解了trap的上下文切换，~~所以建议保持有分析代码的作业~~）

### 4.14

无进度

### 4.15

阅读第四章，完成了lab2的trace部分，

mmap,unmap思路：tcb中保存了每个task的memory set，使用memory set进行alloc即可，预计为接下来的工作
~~用frame_alloc调了一下午+一晚上...~~

### 4.16

预感到数模没时间看os，所以今天赶完了lab2 感觉差不多 以后多用gpt吧

### 4.17-4.19

无进度

### 4.20

阅读第五章，了解了进程调度的大致流程

### 4.21

完成lab3和ch5作业，了解了stride调度的大致的具体实现流程

### 5.1

要准备期末了，预计要鸽


### 5.2

完成ch6,7,8

## 第三阶段 5.3-5.9

### 练习

1.在axhal中加入ANSI控制字符（后来好像会莫名其妙导致其他测例的评测问题所以更改到user app 了）
2.在axstd中加入hashbrown的hashmap。

### 练习
alt alloc 模拟实现即可
shell 加了rename和mv 目前是分开写的实现 也就是说mv是独立写的

### 练习
添加mmap的syscall
先获取fd,然后alloc内存，然后写内容

### 练习
ramfs_rename ramfs默认不支持rename,在这里要实现的话创建新文件写入然后删除原文件即可
simple_hv 跟cpu设计差不多，回到Guest之后PC+4

5.9 第三阶段完成
