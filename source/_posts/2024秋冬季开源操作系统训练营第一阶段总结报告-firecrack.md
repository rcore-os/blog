---
title: 2024秋冬季开源操作系统训练营第一阶段总结报告-firecrack
date: 2024-11-10 21:19:59
tags:
---
# 语言基础

## 编译
rustc **.rs
## 项目构建cargo
cargo build默认根据代码创建一个可执行文件
cargo run 运行程序
cargo check检查语法和类型错误

## 模块
crate
一个crate相当于C++中的翻译单元
+ binary crate 可以被编译成可执行程序，其必须有一个main函数作为程序入口
+ library crate 常说的库文件，用于供其他程序调用

## package
包是crate的集合，由一个Cargo.toml文件定义，可以有多个binary crate 但最多有一个库
在使用cargo new创建一个包后，默认包含一个以src/main.rs为入口的同名binary crate；
如果还有一个src/lib.rs文件，则包还包含了一个同名的library crate

## modules
module 是关于在一个crate内如何组织代码  
编译期在编译时，首先从src/main.rs开始查找要编译的代码


## 模块声明
可以通过mod xxx {} 来直接在文件内定义一个模块。
+ 一个module内的成员默认是模块私有的，如果想要在模块外使用，必须声明为pub

## 子模块
模块允许嵌套，子模块的成员要想被最外层的访问，其每一层都需要pub关键字

## 字符串
字面量的类型是&str
```
let s = "hello, world";
```
带所有权的String，分配在堆上，底层是一个Vec<u8>，注意结尾没有null
```
let s = String::with_capacity(32);
s.push_str("Hello world");
```
这里会在堆上申请32字节的内存，在栈上创建指针s(p, 11, 32)

## String 和 &str
### &str to String
+ to_owned：从借用类型创建拥有所有权的副本，适用于任何实现了 ToOwned 特性的类型。
+ to_string：将实现了 Display 特性的类型转换为 String。
+ String::from 和 .into()：将 &str 转换为 String，分别适用于显式和隐式转换。

## 字符串拼接
使用+号进行拼接时，左侧必须是一个String类型，而右操作数则必须是&str，其中&String可以自动转成&str

## Unwrap 和 ？
1. unwrap 是一个方法，通常用于在你确定一个 Result 或 Option 包含值时获取该值。如果 Result 或 Option 包含 Err 或 None，调用 unwrap 会导致程序崩溃，并显示一个错误信息。因此，使用 unwrap 时，你应该确保被操作的 Result 或 Option 不会为 Err 或 None。
2. ? 是一个在函数中处理错误的语法糖，它可以帮助你编写更简洁的代码。当你在一个返回 Result 或 Option 的函数中使用 ? 时，如果结果为 Err 或 None，? 会立即返回该错误，否则它会解包 Ok 或 Some 中的值。这种方式允许你在遇到错误时将错误传播给调用者，而不需要显式地处理每一个可能的错误情况。

## traits
在 Rust 中，实现 trait 时，不能直接在 trait 的函数签名中给参数添加 mut、&mut、& 等符号。这些符号只能出现在具体实现（impl）中，
而不是在 trait 定义本身。  

## lifetime
生命周期与引用是紧密相关的。
+ 为编译期在编译期提供一种验证指针有效性的的方式
+ 生命周期是指定的代码区域，引用必须在这些区域内有效
### 'xxx
+ 生命周期的标记只是描述多个引用之间的生命周期关系，不影响实际对象的真实生命周期  
### 标记消除  
为了减少编码量，当引用满足如下规则时，不需要标记引用的生命周期
+ 针对输入参数，编译器会给每个参数不同的生命周期标记
+ 对于返回值，如果函数只有一个输入参数，那么引用类型的返回值的生命周期标记与输入相同
+ 如果第一个参数是&self或者&mut self那么输出的生命周期与其一致

## 迭代器
map的闭包参数时迭代器元素本身，而filter的闭包参数则是迭代器元素的引用，所以filter的引用符号比map多一个