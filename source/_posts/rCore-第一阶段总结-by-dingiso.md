---
title: rCore 第一阶段总结 by dingiso
date: 2020-07-27 8:14:30
categories:
	- report
tags:
	- author:dingiso
	- summerofcode2020
---

# rCore 第一阶段总结

## 前言

我是 大连理工大学 18级的一名本科生 ， 在老师的宣传下被 这个项目所深深吸引，自愿加入了进来

在学习之前，我只是对 操作系统有所了解，完成了清华的课程 和 实验

对 `RUST`  ，  `RISC-V`  的了解不是很多，但是 rust 的安全性， 和 risc-v 的简洁是我一直十分欣赏的
<!-- more -->


## Rust语言

Rust 的安全性 是我一直觉得rust相较于别的语言突出的地方，我们现在在代码中漫天使用的 `spin::Mutex` ， `alloc::sync::Arc`  , 包括自己实现的 `Lock` 都是安全性的体现，在不断学习rust的过程中，对这门语言的了解不断深入，我觉得他借鉴了很多语言的优势，这也可能是他诞生晚的好处，包括 宏 借鉴了 Lisp 的S表达式等等方面，充分的利用rust 中std库中的函数可以大大减少，代码的数量，甚至在坊间流传 rust 写题可以在一行内完成。

我觉得对`rust`语言 主要涉及lab的部分 大家主要需要理解：

* 所有权（ownership）
* 智能指针
* Option Result 等使得 出现错误时返回值更加严谨，代码的错误率更低，也增加了检错的能力
* macro_rules! 宏的定义，严谨而又花样百出，对抽象语法树有很强的操作能力
* cargo 构建的用法

### 学习过程

* 阅读 《rust编程之道》 ， 看了 [令狐壹冲的视频](https://www.bilibili.com/video/BV1FJ411Y71o?p=2)  

* 完成了 rustlings 的练习， 弄懂了基本的语法

* 开始着手做 leetcode 上有些难度的习题，学习如何用rust写数据结构，写算法

  * 完成了 8 篇leetcode 的题解，每一篇都有不一样的收获

    [64.最小路径和-滚动数组DP](https://leetcode-cn.com/problems/minimum-path-sum/solution/rust-gun-dong-shu-zu-dp-by-dingiso/)

    [167. 两数之和 II - 输入有序数组-BTreeMap优化](https://leetcode-cn.com/problems/two-sum-ii-input-array-is-sorted/solution/btreemap-by-dingiso/)

    [97. 交错字符串-简单dp](https://leetcode-cn.com/problems/interleaving-string/solution/guan-fang-ti-jie-gai-by-dingiso/)

    [120. 三角形最小路径和-一维动态规划](https://leetcode-cn.com/problems/triangle/solution/la-ji-ti-jie-gun-dong-shu-zu-by-dingiso/)

    [350. 两个数组的交集 II- 垃圾版](https://leetcode-cn.com/problems/intersection-of-two-arrays-ii/solution/zui-la-ji-dai-ma-mei-you-zhi-yi-by-dingiso/)

    [96. 不同的二叉搜索树 - 公式推导](https://leetcode-cn.com/problems/unique-binary-search-trees/solution/jie-ti-si-lu-by-dingiso/)

    [174地下城游戏 - 直观解法](https://leetcode-cn.com/problems/dungeon-game/solution/zhi-guan-jie-fa-by-dingiso/)

    [392.判定子序列-盘点坑](https://leetcode-cn.com/problems/is-subsequence/solution/na-xie-ke-neng-yu-dao-de-keng-by-dingiso/)

* 写了一些 issue

  * [声明周期推断 ](https://github.com/rcore-os/rCore-Tutorial/issues/49#issuecomment-656443196)
  * [lazy_static!](https://github.com/rcore-os/rCore-Tutorial/issues/38#issuecomment-654882048)
  * [谬误](https://github.com/rcore-os/rCore-Tutorial/issues/20#issuecomment-654908994)

## Risc -V 

risc-v 在整个学习过程，一直担心是否学不完全会影响 lab的进程，但实际上主要应用在lab中的大部分为

特权架构相关的部分，包括M，S，U三种模式，异常处理，虚拟-物理地址，页表和按页存储等

* 首先我通过阅读 计算机组成原理（risc-v）版，初步了解了`risc-v` 的架构，有了一些底气

构建了一份笔记，提取出了重要的和lab构建息息相关的基本内容，如有需要可以看一下：

[计算机组成原理（risc-v）前两章 - 重点内容]([https://github.com/dingiso/DailySchedule/blob/master/docs/%E8%AE%A1%E7%AE%97%E6%9C%BA%E7%BB%84%E6%88%90%E4%B8%8E%E8%AE%BE%E8%AE%A1RISC-V.md](https://github.com/dingiso/DailySchedule/blob/master/docs/计算机组成与设计RISC-V.md))

* 阅读了RISC-V 手册 特权结构的部分 

这本手册，希望大家能发挥他手册的作用，它不仅能在此处帮助到你，在之后的**lab**中，好的利用他，查找内容都是十分好用的。

## Lab -Tutorial

这是本次第一阶段的主要内容- 主要研究了 **rCore** 教学版本的构建，和相关知识的学习，从以下几个方面逐步构建一个操作系统

* 中断
* 物理 虚拟内存 及其映射
* 线程 与 进程
* 外设
* 用户程序

为了更好的理解 Tutorial 的主要内容，我对实验内容总结为两个图，方便大家的理解

#### 图一 ： rCore 利用了哪些基础设施进行 系统的构建

{% asset_img rcore 基础.png A sample image file %}

#### 图二 ： lab 中重要的结构及其之间的关系

{% asset_img rCore.png A sample image file %}

### 学习内容：

我在实验过程中对所有 lab 形成的总结文档，希望对大家有帮助 -  [lab内容总结文档](https://github.com/dingiso/DailySchedule/blob/master/docs/lab%20%E6%80%BB%E7%BB%93%E6%96%87%E6%A1%A3.md)

我的实验报告： [https://github.com/dingiso/DailySchedule/tree/master/docs](https://github.com/dingiso/DailySchedule/tree/master/docs)

我的代码记录：[https://github.com/dingiso/DailySchedule/tree/master/code](https://github.com/dingiso/DailySchedule/tree/master/code)

## 未来的计划

* 继续 学习 Rust 和 操作系统，争取参与到 `zcore` 的编写和完善当中
* 为 Rust 开源社区做出贡献，或改进rust 功能，或为 rust 提供 crate
* 继续补充自己的操作系统知识，吸收他人的好的写法和经验，比如学习 学堂在线的 《Linux 内核分析与应用》
* 在 tutorial 的基础上，研究我们只是利用却未深入了解的库的功能和写法，更深入的了解这方面的内容。
* 融入进这样的生态，和大家充分交流，形成自己的看法。
