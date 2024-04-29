---
title: 2024春夏季开源操作系统训练营第一阶段总结报告-idrey
date: 2024-04-28 21:51:03
categories:
    - 2024春夏季开源操作系统训练营
tags:
    - author: idrey
---

感想：rust还是得多上手实践才行
一些笔记如下：
### Variables
- Rust中变量有严格的初始化要求
- 在 Rust 中，变量的类型是静态类型的
- 可以使用隐藏，重新声明一个变量来更改其类型
- const声明常量，且必须包括类型
### Primitive Types

- 数组切片，切片是引用，&a[1..5]
- 元组按索引寻址，x.0
### Vectors

- 初始化vec的宏为vec![]
- vec2.rs，遍历vec
### Move Semantics

- 使用vec.clone()可以创造一个新的对象
- 在任何给定时间点，你只能拥有一个可变引用（不转移所有权的情况下修改数据）
- String类型的所有权
### Structs

- 三种结构体初始化方法
- 从另一个结构体更新{..user}
### Enums

- 定义枚举时可以将数据附加到枚举成员中，类似于结构体
- match匹配时要加入结构体成员数据类型
### Strings

- 可以用+号连接字符串
- 区分&str和String
### Modules

- 默认为private
- 借用与结构体中的声明
### Options

- if let语句
### Errors

- 传播错误使用?, 出现错误直接抛出，需要与返回值兼容
- Box<dyn>智能指针与Trait
- unwrap和expect可以解开Ok中的值或者报错
### Generics

- 泛型，在方法处也是impl<T>
### Traits

- 类似于Java中的接口和C++中的抽象类
- Trait可以用作参数来标识实现了Trait的类型 impl Trait和&dyn Trait，前者接受拥有所有权的实现类型，后者接受对实现该类型的不可变引用，可以用+号指定多个Trait，impl Trait1 + Trait2
### Lifetime

- 确保引用有效，不出现悬垂引用
- 需要在函数名处先定义，然后再引用，结构体中也是如此
### Tests

- 使用#[should_panic]来检查panic
### Iterators

- iterators3.rs  函数式
- collect::Type 显式确定要收集的类型
- (1..=num).fold(1, |acc, x| acc * x)
- map, filter, sum
### Smart Pointers

- ref with some metadata and capabilities
- 普通引用是借用，在大部分情况下，智能指针 **拥有** 它们指向的数据
- 实现了deref和drop的trait
- Box<T>，解决循环类型定义，因为编译时需要确定数据空间占用
- Rc<T>，Solar System: Planet and the Sun
- Cow，灵活地确定借用还是拥有
### Threads

- thread::spawn(move || {})
### Macros

- 使用macro_rules!声明宏
- #[macro_export]导出宏