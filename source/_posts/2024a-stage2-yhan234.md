---
title: 2024a-stage2-blog-yhan234
date: 2024-11-08 00:00:15
tags:
    - author:yHan234
    - repo:https://github.com/LearningOS/2024a-rcore-yHan234
---

## rCore 总结

实验文档的第一句说：*从零开始*写一个内核，但后来发现并不是让学生真的从零开始写，只是在写好的内核上添加功能，有一点点失望，但还是学到了很多。

本次实验让我学到了：

- Rust 的一些编程技巧，如 UPSafeCell。
- RISC-V 的特权级机制
- 使用上下文保存/恢复来进行多道程序调度
- SV39 多级页表机制及在内核中的实现
- shell 的原理：fork + exec
- 文件系统的原理：inode + ...
- 并发同步互斥的原理

虽然没有感觉理解得非常深入，但感谢 rCore 带我在操作系统领域入了门，让我对之后的阶段有更多期待。
