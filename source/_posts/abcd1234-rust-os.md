---
title: abcd1234-rust-os
date: 2024-04-23 00:35:51
categories:
    - rust-stage-1
tags:
    - author:17999824wyj
    - repo:https://github.com/LearningOS/rust-rustlings-2024-spring-17999824wyj.git
    - noob
    - nickname:abcd1234
    - email:abcd1234dbren@yeah.net

---

# Rust OS 一阶段学习总结
## 个人背景概述
我是一名软件工程专业的大二本科生，曾参与过2023年秋冬季训练营。  
在去年的训练营中，我学习了rust，但因为第一次学习，且当时需要准备期中考试和各科作业，没有按时通过第一阶段。  
虽然我后续进入了二阶段群，但没有完成第二阶段的实验部分，今年重新参与，打算认真跟进下去。

## 今年一阶段学习时间表
- 2024-03-27 重新报名参与活动，并邀请了一名本校大三学长共同进步
- 2024-04-07 正式开始参与活动，又邀请了两位同校同学，我开始重新复习rust
- 2024-04-12 通过rust圣经复习至基础部分完成，开始进行做题
- 2024-04-13 累计做题3小时，做至43题
- 2024-04-19 进行到cow指针部分
- 2024-04-20 完成前100题
- 2024-04-21 完成110题，开始提交

## 一阶段学习内容概述
我按照[“rust语言圣经”](https://course.rs/about-book.html)上的讲解顺序进行学习，分别学习了：
- 变量的绑定与解构
- 基本类型
- 所有权和借用
- 复合类型
- 流程控制
- 模式匹配
- 方法
- 泛型和特征
- 集合类型
- 生命周期
- 返回值、错误处理
- 包和模块
- 注释和文档
- 格式化输出
- 智能指针
- 多线程
- 闭包与迭代器
- 宏编程
- unsafe rust

## 问题概述
在一阶段过程中，我遇到了一定的问题，并尝试进行解决。以下内容是我认为，不是那么“较为基础”的问题。
### 2024-04-12 问题：unicode展示
#### 问题描述
在primitive_types2.rs中，注释要求尝试传入unicode字符，来理解rust中的char。  
但是，我通过`https://emojidb.org/rust-emojis`这个[emojis网址](https://emojidb.org/rust-emojis)，拿到了一个emoji：☢️，进行测试，却直接编译出错：  
{% asset_img unicode错误1.png unicode编译出错 %}
#### 出错代码
```rust
// primitive_types2.rs
//
// Fill in the rest of the line that has code missing! No hints, there's no
// tricks, just get used to typing these :)
//
// Execute `rustlings hint primitive_types2` or use the `hint` watch subcommand
// for a hint.


fn main() {
    // Characters (`char`)

    // Note the _single_ quotes, these are different from the double quotes
    // you've been seeing around.
    let my_first_initial = 'C';
    if my_first_initial.is_alphabetic() {
        println!("Alphabetical!");
    } else if my_first_initial.is_numeric() {
        println!("Numerical!");
    } else {
        println!("Neither alphabetic nor numeric!");
    }

    let your_character = '☢️'; // Finish this line like the example! What's your favorite character?
    // Try a letter, try a number, try a special character, try a character
    // from a different language than your own, try an emoji!
    if your_character.is_alphabetic() {
        println!("Alphabetical!");
    } else if your_character.is_numeric() {
        println!("Numerical!");
    } else {
        println!("Neither alphabetic nor numeric!");
    }
}
```
#### 问题分析
我与队伍里的成员们进行了初步的实验和讨论，确定报错的原因是：“☢️”无法被解析成字符，必须被解析成字符串。那么，问题来了，为什么它无法被解析成字符，而其它的unicode码可以被解析成字符？

#### 解决方法
首先，我们进行了实验，从[emojis网站](https://emojidb.org/rust-emojis)中寻找了其他的emoji字符，发现大部分的emoji竟然都能被解析成字符。那问题就是出在“☢️”这个emoji上。

我们队内通过查找rust官方的文档，发现，文档中说，unicode码被分为了两大类，一类是UTF-16，一类是UTF-8。  
那么，这两大类的unicode字符有什么区别？  
我们通过搜集资料、询问ai等方式，得到：
> UTF-16码点在0xD800到0xDFFF的范围内  
> UTF-8码点在0x80到0x10FFFF的范围内  
> 如图{% asset_img unicode错误2.png 询问chat-1 %}  
> 如图{% asset_img unicode错误3.png 询问chat-2 %}

我们的总结是：UTF-8是8位的，其由一个字节进行表示，而UTF-16是16位的，其由两个字节进行表示，很可能是因为“☢️”是UTF-16编码，导致其无法被解析成rust里的“字符`char`”。

### 2024-04-12 问题：if内部返回异常
#### 问题描述
在编程的过程中，我意外发现，在if语句内，通过不写分号的方式进行返回，会产生问题，程序无法编译，见下图：  
{% asset_img if错误1.png if条件编译出错 %}

#### 出错代码
```rust
// structs3.rs
//
// Structs contain data, but can also have logic. In this exercise we have
// defined the Package struct and we want to test some logic attached to it.
// Make the code compile and the tests pass!
//
// Execute `rustlings hint structs3` or use the `hint` watch subcommand for a
// hint.

#[derive(Debug)]
struct Package {
    sender_country: String,
    recipient_country: String,
    weight_in_grams: i32,
}

impl Package {
    fn new(sender_country: String, recipient_country: String, weight_in_grams: i32) -> Package {
        if weight_in_grams <= 0 {
            panic!("Can not ship a weightless package.")
        } else {
            Package {
                sender_country,
                recipient_country,
                weight_in_grams,
            }
        }
    }

    fn is_international(&self) -> bool {
        // if self.sender_country != self.recipient_country {
        //     return true;
        //     // true // error, 'true' return to the func is_international, not outside
        // }
        // // return false;
        // false // it can pass the compile

        // if self.sender_country == self.recipient_country {
        //     false
        // } else {
        //     true
        // }

        self.sender_country != self.recipient_country // most elegent way
    }

    fn get_fees(&self, cents_per_gram: i32) -> i32 {
        cents_per_gram * self.weight_in_grams
        // Something goes here...
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic]
    fn fail_creating_weightless_package() {
        let sender_country = String::from("Spain");
        let recipient_country = String::from("Austria");

        Package::new(sender_country, recipient_country, -2210);
    }

    #[test]
    fn create_international_package() {
        let sender_country = String::from("Spain");
        let recipient_country = String::from("Russia");

        let package = Package::new(sender_country, recipient_country, 1200);

        assert!(package.is_international());
    }

    #[test]
    fn create_local_package() {
        let sender_country = String::from("Canada");
        let recipient_country = sender_country.clone();

        let package = Package::new(sender_country, recipient_country, 1200);

        assert!(!package.is_international());
    }

    #[test]
    fn calculate_transport_fees() {
        let sender_country = String::from("Spain");
        let recipient_country = String::from("Spain");

        let cents_per_gram = 3;

        let package = Package::new(sender_country, recipient_country, 1500);

        assert_eq!(package.get_fees(cents_per_gram), 4500);
        assert_eq!(package.get_fees(cents_per_gram * 2), 9000);
    }
}
```

#### 问题分析
在遇到这个问题之后，我自己分析不出来为什么会出现这样的错误。于是，我去找队伍里的学长进行咨询。学长在他的教程书里找到了答案。出现这个问题的原因是，rust的但if语句的返回值必然是返回单元`()`，因此，我不使用return返回true时，破坏了if语句的语法规则，导致出错。具体教程如下：  
{% asset_img if错误2.jpg if条件编译出错-解决 %}

## 额外练习
在第一阶段中，我在我们专业的操作系统实验课程中，使用rust编程，完成了实验内容，具体完成了：
- 生产者与消费者问题
- 时间片轮转和优先级队列的调度算法
- 文件系统的实现

## 总结
在第一阶段的学习中，我巩固了我们所掌握的rust基础，并开始学习操作系统相关的知识。在这一部分，我还培养了我的思考能力，深入思考了rust的安全与不安全的地方。同时，通过和群友的交流，我也展开了对更多其它知识点的思考，比如“Copy”、“Clone”特征和“Drop”的冲突之处。  
最重要的是，我深深意识到：`Talk is cheap, show me the code!`

## 展望
目前，我已经开始了第二阶段部分内容的学习，希望可以顺利的完成第二阶段的所有内容。之后参与到第三阶段的项目中，继续提高自己的能力。