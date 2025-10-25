---
title: rcore-stage-1-summary
date: 2025-10-18 12:33:31
categories:
    - blog for summary
tags:
    - author:GuoGuo614
    - repo: https://github.com/LearningOS/2025a-rcore-GuoGuo614.git
    - os-kernel
    - rcore
    - summary
    - rust
---

# rCore-2025-autumn 基础阶段-总结
## 学习过程
* 我用的是 rust 语言圣经来学习，书写的蛮不错的。
* 基本上是边对着 rustlings 边看 rust-course，最后看一看笔记有 1w5 多个字，蛮震惊的，虽然许多是直接复制自己认为需要记忆的语法。
* 做完 rustlings 之后，感觉大多题目还是比较保姆的，只是考察小小的一个语法点，甚至对着编译器报错也能做出来。感觉自己还缺乏看稍微大点的 rust 项目的经验，于是去学了 Stanford CS110L。两个 project 都很有意思，学习过程中也补充了很多关于系统的知识，对后续很有帮助。
## 学习感想
* 没有学过cpp，rust 上手有一定难度，实际上这门语言的先进设计让很多之前 Java、Go 的概念变得好上手了，比如特征、类与结构体更容易理解，也摒弃了继承的概念；再加上丰富的语法糖和容器方法，易用性甚至可以和 Python 比肩。
* 但是 rust 最难的生命周期和所有权借用规则，成了两个坎，学习过程中边看书边对着 GPT 问了好久。智能指针我也花了挺多时间，特性就不一一说了，总之是一个非常美妙的设计。
## 难点与踩坑记
* 感觉挺神奇的，用其他语言做题或者项目都是跑起来之后要 debug 一段时间，rust 给我的感觉就是要花好多时间“取悦”编译器，做完这件事之后就不怎么需要 debug 了草。
