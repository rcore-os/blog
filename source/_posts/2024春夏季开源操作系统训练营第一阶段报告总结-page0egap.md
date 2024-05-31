---
title: 2024春夏季开源操作系统训练营第一阶段报告总结--page0egap
date: 2024-05-15 16:21:12
categories:
    - reports
tags:
    - author:page0egap
    - repo:https://github.com/LearningOS/rust-rustlings-2024-spring-page0egap
---

# 第一阶段总结

很早听闻Rust是一个“内存安全”的语言，出于好奇，我从去年就开始接触Rust，Rustlings也是我最开始学习Rust使用过的教程之一。因为之前写过一遍，这次重新再写速度快很多。然而完成的过程中，还是发现有些语法不常用到，很容易遗忘。比如结构体初始化可以使用已有变量的内容，这个地方我写Rust的时候几乎没有用到。

相比于之前的rustlings，新的rustlings增加了算法这一个章节。通过完成基本的数据结构，我们可以比较好的了解rust在写底层的数据结构的时候会遇到的困难，特别是rust在操作链表时的“不自由”。由于所有权的问题，链表等在C和C++常用的指针修改操作会非常的痛苦。小的技巧是我们可以用Option来类似于进行指针的操作，使用Option实现方法take和insert来进行内部修改。

Rust的包管理器Cargo相比于C++的Cmake对用户很友好，虽然Rust现阶段的工具库并没有像Java一样丰富，但一般Rust的库都会有比较好的文档说明，所以一般库的质量还是有保障的。

总之，我觉得Rust是一个非常有前景的语言。