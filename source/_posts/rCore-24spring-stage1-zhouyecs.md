---
title: rCore-24spring-stage1-zhouyecs
date: 2024-04-27 21:26:40
categories:
    - report
tags:
    - author:zhouyecs
    - rCore-24spring
    - oscamp2024
---

# 第一阶段总结

感谢活动主办方提供的宝贵平台和资源！

希望自己至少能坚持做完二阶段。

## RUST

学习资料：

rustlings 110题 https://github.com/LearningOS/rust-rustlings-2024-spring-zhouyecs（已完成）

rust语言圣经 https://course.rs

rust练习实践 https://practice-zh.course.rs/

rust by example https://doc.rust-lang.org/rust-by-example/

半小时学习rust https://fasterthanli.me/articles/a-half-hour-to-learn-rust（已完成）

rust algorithm club https://rust-algo.club/（已完成）

《rust实战》https://www.amazon.com/Rust-Action-TS-McNamara/dp/1617294551

（rust资料太多，慢慢学......）

## RISC-V

之前学习过《计算机组成与设计（RISC-V版）》，所以这次只是简单地看了一下[PPT for RISC-V特权指令级架构](https://content.riscv.org/wp-content/uploads/2018/05/riscv-privileged-BCN.v7-2.pdf)，打算后面有时间学习[RISC-V手册：一本开源指令集的指南](http://riscvbook.com/chinese/RISC-V-Reader-Chinese-v2p1.pdf)和[Berkeley CS61C: Great Ideas in Computer Architecture (Machine Structures)](http://www-inst.eecs.berkeley.edu/~cs61c/sp18/)。

## rustlings 难点记录

rustlings 110题 https://github.com/LearningOS/rust-rustlings-2024-spring-zhouyecs

参考资料 

\- [The Book](https://doc.rust-lang.org/book/index.html) - The most comprehensive resource for learning Rust, but a bit theoretical sometimes. You will be using this along with Rustlings!

\- [Rust By Example](https://doc.rust-lang.org/rust-by-example/index.html) - Learn Rust by solving little exercises! It's almost like `rustlings`, but online

做题的时候忘记边做边记录了，所以选了些难点记下来。

### 引用

这里和C/C++类似，引用使用 `&` ，解引用使用 `*` 。

```rust
fn main() {
  let needle = 42;
  let haystack = [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862]; 
    
  for reference in haystack.iter() {
    let item = *reference;
    if item == needle {
      println!("{}", item); // 42
    }
  }
}
```

### 字符串

Rust中，`str`和`String`是两种不同的数据类型，特别容易搞混，`str`是字符串切片类型，是一个不可变引用，而`String`是字符串类型，是一个可变的字符串。

```rust
fn main() {
  // 使用字符串字面量创建一个str类型的字符串切片
  let str_slice = "Hello, World!";
  println!("str_slice: {}", str_slice);
  // 尝试修改str_slice会发生报错

  // 使用String结构体创建一个可变的字符串
  let mut string = String::from("Hello");
  println!("string: {}", string);

  // 修改String类型的字符串
  string.push_str(", World!");
  println!("string: {}", string);
    
  // String -> &str
  let s1 = String::from("PKU");
    
  let s2 = &s1[..];
  let s3 = s1.as_str();
  
  // &str -> String
  let s4 = "THU";
  
  let s5 = s4.to_string();
  let s6 = String::from(s4);
  let s7 = s4.to_owned();
}
```

还有更多就没写了，还是得多练练。
