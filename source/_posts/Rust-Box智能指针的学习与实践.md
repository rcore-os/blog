---
title: Rust Box智能指针的学习与实践
date: 2024-04-24 19:46:46
tags:
  - author:T4t4KAU
  - repo:https://github.com/T4t4KAU
---
# Rust Box智能指针的学习与实践

如果一个变量，存的是另一个变量在内存的地址值，那么就被称为指针。普通指针是对值的借用，而智能指针通常拥有对数据的所有权，可以做一些额外操作，比如管理引用计数和资源自动回收。

标准库中常见的智能指针：

- `Box<T>`：在堆内存上分配值
- `Rc<T>`：启用多重所有权的引用计数类型
- `Ref<T>`&`RefMut<T>`，通过`RefCell<T>`访问：在运行时而不是编译时强制借用规则的类型

本文着重介绍Box，即指向堆内存的智能指针，允许在堆上存储数据而非栈，没有其他性能开销。

常用场景：在编译时，某类型的大小无法确定。但使用该类型时，上下文却要知道它的确切大小。

```rust
fn main() {
    let b = Box::new(5); // 存储在堆上
    println!("b = {}",b);
}
```

在变量 `b` 在离开作用域时，同样会被释放。

同样可以作用于结构体：

```rust
struct Point {
    x: u32,
    y: u32
}

fn foo() -> Box<Point> {
    let p = Point {x:10, y:20};
    Box::new(p)
}

fn main() {
    // ....
}
```

在创建Point结构体时，其尺寸是固定的，所以它的实例会被创建在栈上。而在创建 `Box<Point>` 实例的时候会发生所有权转移：资源从栈上移动到了堆，原来栈的那片资源被置为无效。

可以对Box进行解引用，由于u8具有copy语义，所以解引用后，原来的boxed还能使用

```rust
fn main() {
    let boxed:  Box<u8> = Box::new(5);
    let val: u8 = *boxed;

    println!("{:?}",val);
    println!("{:?}",boxed);
}
```

但是对于move语义的类型来说，就不适用了
Box同样可以作为函数参数:

```rust
#[derive(Debug)]
struct Point {
    x: u32,
    y: u32
}

fn foo(p: Box<Point>) {
    println!("{:?}",p);
}

fn main() {
    let b: Box<Point> = Box::new(Point{x:10, y:20});

    foo(b)
}
```