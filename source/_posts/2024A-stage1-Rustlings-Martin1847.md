---
title: 2024A-stage1-Rustlings-Martin1847
date: 2024-11-09 13:30:14
tags:
    - author:martin1847
    - repo:https://github.com/LearningOS/rust-rustlings-2024-autumn-martin1847
---

## 前言

本人2024年8月份的时候，工作需要一部分图像处理代码，最后选择用Rust实现，并通过[krpc-rust](https://github.com/martin1847/krpc-rust)跟java完成调用。后面发现rust的一些理念尤其是RAII确实挺不错，就关注起来了。

后来在9月份的上海Rust大会上，了解到清华rCore项目训练营，感觉挺有意思的，既能学习os又能学习rust，就种草了

## Rustlings 总结

基础阶段相对简单，却也兴奋，熟悉了各种rust语言的特征。比如下阶段会频繁用到的`extern "C"`和`#[no_mangle]`。
算法阶段，通过`unsafe`处理指针、链表，对`unsafe`有了一些熟悉，尤其是类型转换。还有就是熟悉了堆的实现，加上rust的运算符重载机制，可以灵活的在大小堆之间切换。
另外整个过程中发现`rust`并没有传说中的所谓曲线陡峭，秉着实用主义的原则，先进行一下元学习，也即了解这门语言的层次结构，函数传值、内存模型等大的层面，其余部分，用多少学多少，在出现问题的时候知道去研究哪部分就可以了。
所以我觉得学习也像小马过河，重在实践。
