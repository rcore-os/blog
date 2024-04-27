---
title: 2024春季开源操作系统训练营第一阶段总结报告-TrisuyaN
date: 2024-04-24 22:38:04
tags:
    - author:<TrisuyaN>
---


学习Rust有一段时间了，做rustlings中途没有写blog，正好总结一下作为初学者对Rust的一些关注点和总结。

没写完，就先这样吧（逃）

todo!();

# Rust基本语法

## 变量

Rust变量声明使用`let`，类型放在变量名后面。例如：

```rust
let x: i32 = 114514;
```

Rust也能自动推断类型：

```Rust
let i = 114514;
let s = "string".to_string();
```

`i`被自动推断为`i32`，`s`被自动推断为`String`

有些情况Rust也不能自动推断类型，比如：

```Rust
let v = vec![];
```

报错信息如下：

```
error[E0282]: type annotations needed for `Vec<_>`
  --> exercises/variables/variables1.rs:10:9
   |
10 |     let v = vec![];
   |         ^   ------ type must be known at this point
   |
help: consider giving `v` an explicit type, where the placeholders `_` are specified
   |
10 |     let v: Vec<_> = vec![];
   |          ++++++++
```

这是因为Rust是一门**静态类型语言**在编译期必须得知变量类型的大小。

## 函数声明

声明方式大致如下。

```Rust
fn func(a: i32, b: i32) -> i32 {
	a + b
}
```

...很多内容在其他语言都有类似的概念，只是语法稍有不同，~~因为懒惰~~不再赘述

# Rust的特色

作为一门年轻的语言，Rust整合了许多其他语言的优势，比如C/C++的底层系统编程能力、Ruby 的包管理器Bundler （cargo）等等。而除了严格的编译期检查、所有权和生命周期机制实现的内存安全，Rust也有许多其他大大小小的特色和亮点，比如：

## 组合优于继承

## 表达式

## 模式匹配

## 闭包

## 使用Option来表达可能为空的值

## 使用Result来处理异常

## 各种智能指针

## 使用RefCell实现内部可变性



# Rust与数据结构和算法

~~学Rust当然要从链表写起！~~
==学Rust千万不要从链表写起！==

## Rust如何实现链表？

按照C/C++的一贯做法，我们可能会写出：

```Rust
struct node {
	val: i32,
	next: Box<node>,
}
```

然而实际用起来，会发现你**用不起来**：

```Rust
let n = node {
	val: 114514,
	next: Box::new(node {

	})
}
```

问题就在于Box里必须要有东西，即它**任何时候**必须指向一个有效的元素！别说链表末尾节点如何实现，我们甚至无法完成头节点（任何节点）这样一个递归定义的形式。


于是我们想到使用Option来表示可能为空的值，从而能够定义单个节点。

```Rust
struct node {
	val: i32,
	next: Option<Box<node>>,
}
```

# 面向rCore的Rust

为了完成rCore，还需要深入了解Rust的哪些？

## unsafe

## 外部接口

## Rust编译和链接

## Rust项目结构

## 另外推荐：《Rust死灵书》
