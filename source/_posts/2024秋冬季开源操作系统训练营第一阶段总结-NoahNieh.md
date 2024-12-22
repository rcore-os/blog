---
title: 2024秋冬季开源操作系统训练营一阶段总结-NoahNieh
date: 2024-11-05 08:17:23
categories:
    - 2024秋冬季开源操作系统训练营
tags:
    - author: NoahNieh
    - repo: https://github.com/LearningOS/rust-rustlings-2024-autumn-NoahNieh
mathjax: true
---

# 第一阶段总结


第一阶段主要目标是熟悉`Rust`的语法，对我来说做`rustlings`没有太大的困难，因为`Rust`也是我自己开发小工具的常用语言之一。

比较有趣的是，仓库中加了一部分算法的题目，而且给出的框架是用`unsafe`的方法实现的，这让我对`Rust`在`unsafe`下的使用有了更深的了解。
但是这一部分使用到的`unsafe`大多是如何去获得一个对象的裸指针或者引用，而到了第二阶段正式开始`rCore`之后在项目中用的更多的是如何获取对象的切片引用，或者是硬转成`*mut T`/`*const T`。
似乎在第一阶段学到的`unsafe`相关的东西并没有在第二阶段用到很多。

但无论如何，完成了`rustlings`之后，对平时没有用到的一些`Rust`边角知识更加清晰了，在第二阶段也能更加顺利，不会被语言困住。

