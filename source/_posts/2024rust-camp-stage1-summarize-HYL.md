---
title: 2024rust_camp_stage1_summarize_HYL
date: 2024-04-25 17:01:06
categories:
    - report
tags:
    - author:coldGui
    - repo:https://github.com/LearningOS/rust-rustlings-2024-spring-coldGui
---
在第一阶段的学习中，主要对rust的所有权以及指针等方面进行了着重学习,下面对相关知识点进行简要总结

 所有权相关规则
=
> 一个值只能被一个变量所拥有，这个变量被称为所有者
> 
> 一个值同一时刻只能有一个所有者，即不能有两个变量拥有相同的值
> 
> 当所有者离开作用域，其拥有的值被丢弃，内存得到释放。

当出现所有权冲突时，可以通过调用 data.clone() 把 data 复制一份出来给 data1，这样做可以创建 data 的深拷贝，避免出现所有权问题

*Move 语义：当一个值被赋值给另一个变量时，它的所有权会转移，原始变量将不再有效，默认情况下，大部分自定义类型都是具有 Move 语义（优点：可以避免使用拷贝操作，提高性能）*

*Copy 语义：不希望值的所有权被转移，赋值或者传参时，值会自动按位拷贝（浅拷贝），两个变量都拥有独立的内存空间。 Copy 语义通常适用于简单的基本类型，如整数、浮点数、布尔值等*

*Borrow 语义：不希望值的所有权被转移，又无法使用 Copy 语义，可以“借用”数据，其允许在不转移所有权的情况下借用值的引用，包括不可变引用（&T）和可变引用（&mut T），允许同时存在多个不可变引用，但不允许同时存在可变引用和不可变引用（优点：使得代码更加安全，因为它在编译时进行所有权检查，防止了一些常见的错误，如悬垂指针和数据竞争）*

一个值给多个所有者
=
* Rc

对一个 Rc 结构进行 clone()，不会将其内部的数据复制，只会增加引用计数，当引用计数为0时，内存释放

*Arc<T> 与 Rc<T> 类似，但是使用原子操作来保证引用计数的线程安全性,支持线程共享数据。*

*（如果不用跨线程访问，可以用效率非常高的 Rc。如果要跨线程访问，那么必须用 Arc）*

    use std::rc::Rc;

* RefCell
允许在不可变引用的情况下修改数据，采用borrow_mut（可变）、borrow（不可变）

*Mutex 和 RwLock 都用在多线程环境下，当需要多线程时，可直接替换RefCell*

    
    use std::cell::RefCell;

智能指针Box
=
> Rust 中，凡是需要做资源回收的数据结构，且实现了 Deref/DerefMut/Drop，都是智能指针。

允许将数据分配在堆上，当 Box<T> 离开作用域时，它指向的堆内存会被自动清理。常用于： 在编译时大小未知的数据；大型数据结构，以避免栈溢出；拥有数据，确保只有一个所有者。

Box<dyn Trait&gt; 表示一个指向实现了指定 trait 的类型的堆上分配的指针。
Trait 可以是任何 trait，它定义了一组行为或方法，而具体的类型则实现了这些方法。
通过 Box 将其放置在堆上，可以在运行时动态确定对象的具体类型，并通过指针进行访问。
运行时动态派发（动态调用）是通过虚函数表来实现的，这意味着在运行时确定调用的具体方法。
    
    trait Animal {
        fn sound(&self);
    }
    
    struct Dog;
    impl Animal for Dog {
        fn sound(&self) {
            println!("The dog barks!");
        }
    }
    
    struct Cat;
    impl Animal for Cat {
        fn sound(&self) {
            println!("The cat meows!");
        }
    }
    
    fn main() {
        let dog: Box<dyn Animal> = Box::new(Dog);
        let cat: Box<dyn Animal> = Box::new(Cat);
    
        make_sound(&dog);
        make_sound(&cat);
    }
    
    fn make_sound(animal: &Box<dyn Animal>) {
        animal.sound();
    }

unsafe代码块
=
> unsafe绕过了 Rust 的安全检查，错误使用可能导致内存不安全、数据竞态等问题。

* 解引用裸指针


    let mut x = 10;
    let ptr = &mut x as *mut i32;
    unsafe {
        *ptr += 1;
    }

* 访问或修改静态变量：在 Rust 中，修改静态变量是不安全的操作。

    
    static mut COUNT: i32 = 0;
    unsafe {
        COUNT += 1;
    }

* 实现不安全的 trait，如 Send 和 Sync

* 进行内存布局的低级操作：如结构体的字段重叠或内存对齐。

类型之间的相互转换
=

* as 运算符：as 运算符用于类型转换，可以用于将一个值从一种类型转换为另一种类型。例如，将一个 u32 转换为 u64。


* into 和 from 方法：这些方法是 From 和 Into trait 的一部分，用于在不同类型之间进行转换。这些方法通常会涉及类型的所有权转移。


* try_into 和 try_from 方法：这些方法是 TryFrom 和 TryInto trait 的一部分，用于尝试在不同类型之间进行转换。这些方法在转换失败时会返回一个错误（Err）


* cast 方法：在特定场景下，尤其是与裸指针相关的操作中，cast 方法可以用于将一个指针转换为另一种类型的指针。


    let ptr: *const i32 = &10 as *const i32;
    let ptr_void: *const std::ffi::c_void = ptr.cast();

* transmute 方法：transmute 是一个不安全的操作，它可以在不同类型之间进行任意转换。这是一个高级的转换函数，使用时必须非常小心。


    use std::mem::transmute;
    
    let x: u32 = 42;
    let y: f32 = unsafe { transmute(x) };

*as用于显式转换，所有权不变；into/from用于隐式转换，所有权转移；try_into/try_from和into/from不同的地方是，转换失败会返回Err*


以上是一些本阶段学习的知识点总结，通过第一阶段的训练，整体对rust的语法与编写有了初步地认识，不过在代码调试，多线程、链表操作方面还有所欠缺，将在后续空闲时间不断学习。