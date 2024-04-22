---
title: Unikernel学习心得-叶钧喆
date: 2024-01-07 18:56:03
tags:
    - author:ye-junzhe
---

# Unikernel 学习心得

近期学习了一些关于Unikernel的知识，以下是一些心得体会：

- Unikernel是基于组件化的思想设计的，由各种模块构成组件，再由各种组件构成最终的操作系统。
- 而对于各种模块是如何被选择的，则是采用feature机制，指定最终所需要的模块

## ArceOS实验

- 这周进行了ArceOS的三个实验，在练习一中学习了用println!进行彩色打印。练习二主要学会了对ArceOS进行扩展开发，在axstd中加入了Hashmap，在axhal模块中加入rng生成器，初步了解了ArceOS的调用结构。
- 练习三修改了axalloc模块中allocator的算法，改为early算法，同时用lock()和unimplemented!()禁用其他算法
