---
title: 2024春夏季开源操作系统训练营第一阶段总结-leejamin
date: 2024-04-28 17:45:00
categories:
    - 2024春夏季开源操作系统训练营
tags:
    - author:leejamin
    - repo:https://github.com/LearningOS/rust-rustlings-2024-spring-leejamin
---

## Rust学习笔记

**1、** Rust允许在同一个代码块中声明一个与之前已声明变量同名的新变量，新变量会遮蔽之前的变量，即无法再去访问前一个同名的变量，这样就实现了变量遮蔽。  
**常量不能遮蔽，不能重复定义。**
```
fn main() {
    let x = 3;
    let x = x + 2;
    let x = x * 2;
    println!("x: {}", x);
    let x = "Hello, Rust!";
    println!("x: {}", x);
}
```
**2、** 复制
* 对于元组类型，如果每个元素的类型都实现了Copy trait，那么该元组类型数据支持浅复制。
* 结构体和枚举有些特殊，即使所有字段的类型都实现了Copy trait，也不支持浅复制。

**3、** 高效处理Result<T, E>
* 如果Result的值是Ok，unwrap方法会返回Ok中的值。如果Result的值是Err，unwrap方法会自动做Panic处理并输出默认的错误消息。
* expect方法不仅具备unwrap方法的功能，还允许自定义错误信息，这样更易于追踪导致程序错误的原因。
```
use std::fs::File;

fn main() {
    let f = File::open("hello.txt").expect("Failed to open hello.txt");
}
```
* 如果Result的值是Ok，unwrap_or_else会返回Ok中的值。如果Result的值是Err，unwrap_or_else可以执行一个闭包。
* “?”操作符可以用于返回值类型为Result的函数中，如果出现错误，“?”操作符会提前返回整个函数并将Err值传播给调用者。
```
fn read_from_file() -> Result<String, io::Error> {
    let mut s = String::new();
    File::open("hello.txt")?.read_to_string(&mut s)?;
    Ok(s)
}
```


**4、** 迭代器类型
|  迭代器  |  所有权借用  |  创建方法  | 迭代器元素类型 |
| :----: | :----: | :----: | ------ |
| IntoIter | 转移所有权 | into_iter | T |
| Iter | 不可变借用 | iter | &T |
| IterMut | 可变借用 | iter_mut |  &mut T |
