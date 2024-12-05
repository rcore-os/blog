---
title: 2024秋冬季开源操作系统训练营一二阶段总结报告-Nowherechan
date: 2024-11-10 17:11:01
categories: 2024秋冬季开源操作系统训练营
tags:
    - author: Nowherechan
    - repo: https://github.com/LearningOS/2024a-rcore-Nowherechan
---

## 第一阶段

是我第四次学习 Rust 编程语言，第一次看 course.rs，第二次用 rust 刷 leetcode，第三次刷 rustlings，第四次再刷了这里的 rustlings。每一次学完后总是不知道学到了什么，脑袋空空，但实际上写的时候，体验在逐渐变好。可能还是留下了些什么东西，只是没有察觉到。

不知道这次留下的东西能持续多久。

Rust 很有特点，枚举变量和模式匹配相得益彰，所有权机制比 std::move 舒服了不少，生命周期让我似懂非懂，trait 很有意思，宏看不明白，并发和异步根本没看。

Rustlings 比官网多了很多东西，例如后面的算法题。数据结构那一块，实在找不到什么优雅的方式来实现移动，应该是学的东西太少了；前几个题目对 copy trait 进行了滥用。后面的倒是简单，不涉及什么 Rust 独有的特性，如果会用其他语言写，那么这里就会写。

相关资料：course.rs，the book，rust by practice

## 第二阶段

rCore 是一个的小内核，长得像 xv6，基于 riscv ISA 和 RustSBI。

前面几章的内容大同小异，主要是熟悉操作系统的基本概念，例如内存分页管理。文件系统章节需要对 easyfs 有基本了解，这一点通过阅读 guide book 可以达到。 

死锁检测算法很新颖，是 xv6 里面没有的内容，一直以来，只学过算法，没考虑过要怎么把这个东西切实地加进内核里面，现在又多知道了一点点，还是有不少收获。

测试用例很弱，可以轻度 hack。