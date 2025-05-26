---
title: rcore-study-report-by-mio
date: 2025-05-24 23:48:45
categories:
	- report
tags:
	- author: tommymio
	- rcore-lab
---

## rustling 阶段总结

先来一份 C++ 转 Rust 急救指南（

### / Mutable Borrow & take ownership
rust 中函数传递参数有三种方式，不可变借用，可变借用以及获取所有权。这三种方式贯穿了 rust 的设计思想。
它们的定义对应了 `&T, &mut T, T` 三种类型。与 C++ 不同，rust 中值传递的默认行为是 `move` 而非 `copy`，对于 `copy` 需要实现 `Copy` 的 trait。 且类型一旦实现 `Copy` trait 之后，默认行为就变为 `copy`。
### Borrow & 
rust 中的 `&T` 应等同于 C++ 中的指针，只是 rust 对于 `&T` 实现了隐式 `Deref`，在大部分情况下避免了显式 `* / &`。
迭代器有三种类型：`iter(), iter_mut(), into_iter()`，分别对应了 `&T, &mut T, T` 三种类型。
### Iterator
rust 中迭代器的成员函数被分为两类，**Non-Consuming Adaptors** 返回对应的迭代器，是惰性的，**Consuming Adaptors** 返回结果，会消耗迭代器的所有权，在使用后无法再次使用该迭代器。
### Index
`[]` 应返回 `&T` 或 `&mut T`，不应获取所有权，这是为了避免通过 index 访问而隐式获得所有权的情况。
### Deref
```rust
pub trait Deref {
    type Target: ?Sized;  // 关联类型，表示解引用后的目标类型
    fn deref(&self) -> &Self::Target;
}
```
这是 rust 中关于 Deref 的定义，通过在 impl 的时候指定相关的类型，就可以无需像泛型定义那样显式指定类型。
```rust
impl Deref for String {
    type Target = str; // 指定解引用目标为 `str`
    fn deref(&self) -> &str {
        unsafe { str::from_utf8_unchecked(&self.as_bytes()) }
    }
}
```
由此我们也知道了，对于一个 `Deref` 实现来说，它所返回的类型是 single 的，并不会出现解引用可以返回不同类型的情况。对 `&String` 解引用可以得到 `&str`，是因为 `Target = str`。 
正因如此，编译器可以通过 `T, U` 类型推断这两个类型是否可以通过 `Deref` 转换。
### Drop 
`Drop::drop()` 会在变量离开作用域后由编译器隐式调用，不应显式调用该函数。
`Drop` trait 被实现用于回收资源，若需要显式调用，可使用 `std::mem::drop(x)` 通过消耗 `x` 的所有权来提前触发析构。
### RefCell
在编译时允许同时存在多个可变引用，但运行时仍会检查是否存在多个可变引用，通过 `borrow(), borrow_mut()` 中的引用计数来实现。
```rust
struct RefCell<T> {
    value: T,
    borrow_count: usize,
    is_mut_borrowed: bool,
}

impl<T> RefCell<T> {
    fn borrow(&self) -> Ref<T> {
        if self.is_mut_borrowed {
            panic!("Already mutably borrowed!");
        }
        self.borrow_count += 1;
        Ref { /* ... */ }
    }

    fn borrow_mut(&self) -> RefMut<T> {
        if self.borrow_count > 0 || self.is_mut_borrowed {
            panic!("Already borrowed!");
        }
        self.is_mut_borrowed = true;
        RefMut { /* ... */ }
    }
}
```
`RefCell<T>` 会返回 `Ref<T>` 或者 `RefMut<T>`。`Ref<T>` 的所有权检查发生在运行时，且可以通过 `map` 来拆分借用，更加灵活。
可以通过 `RefCell` 来实现内部可变性。
```rust
use std::cell::RefCell;

struct Cache {
    data: RefCell<Option<String>>,
}

impl Cache {
    fn get_data(&self) -> String {
        // 检查缓存
        let mut cache = self.data.borrow_mut();
        if cache.is_none() {
            *cache = Some("Expensive result".to_string());
        }
        cache.as_ref().unwrap().clone()
    }
}

fn main() {
    let cache = Cache { data: RefCell::new(None) };
    println!("Data: {}", cache.get_data()); // 计算并缓存
    println!("Cached: {}", cache.get_data()); // 直接读取缓存
}
```
使用 `borrow_mut()` 时，由于变量的生命周期与临时值不同，应谨慎与变量进行绑定。
### Lifetime
rust 的临时值会在表达式结束后析构，因此允许存在这样的情况。在 `clone2.borrow_mut()` 语句执行的时候，`clone1.borrow_mut()` 已经被析构，所以 `borrow_mut()` 不会因为引用计数 `> 1` 而崩溃。
```rust
let shared_data = Rc::new(RefCell::new(42)); // 克隆 Rc（共享所有权） 
let clone1 = Rc::clone(&shared_data); 
let clone2 = Rc::clone(&shared_data);
*clone1.borrow_mut() += 10; // 步骤1：获取可变借用，修改后立即释放
*clone2.borrow_mut() *= 2;  // 步骤2：前一个可变借用已释放，安全获取新借用
```
作为对比，如果改成
```rust
let shared_data = Rc::new(RefCell::new(42)); // 克隆 Rc（共享所有权） 
let clone1 = Rc::clone(&shared_data); 
let clone2 = Rc::clone(&shared_data);
let longer_lifetime = clone1.borrow_mut();
*longer_lifetime += 10; 
*clone2.borrow_mut() *= 2;  // 前一个可变借用未释放，程序崩溃
```
就无法正常运行，因为 `longer_lifetime` 作为 `RefCell` 和 `NLL` 的交互，其行为表现为它的生命周期持续到该作用域结束。
### Non-Lexical Lifetime
Non-Lexical Lifetimes (NLL) 是 Rust 编译器的一项核心特性，通过更精细的生命周期分析，允许变量在其**最后一次使用后**立即释放（而非必须等到词法作用域结束），但与某些类型的交互具有其他的表现。
### Copy & Clone
`Copy` trait 是面向编译器实现的，`Clone` trait 是面向程序员实现的。一旦实现 `Copy` trait 默认行为将变为 `copy` 而非 `move`。在语义上，如果实现了 `Copy`，实现的 `Clone` 应当与之相容，可以通过调用 `[#derived(Copy, Clone)]` 获取默认实现。
并没有对于 `Clone` trait 实现的硬性约束。

这些是我觉得印象比较深刻的点，除此之外感觉似乎不太难。rust 唯一能折磨我的数据结构只有 `Box<T>`，但归根到底还是没有完全学会语言底层逻辑，没有完全学会用 rust 的方式写代码。

## rcore 阶段总结

进入到这个阶段之后意识到，之前学的 xv6 还是有些太玩具了，尽管 rcore-os 也是一个教学用途的操作系统，但它的深度似乎是远大于 xv6 的，你可以在这里面接触到链接器是如何编写的，如何用自己的一套交叉编译工具链来编译并且运行 kernel 以及裸机程序。

Chapter1 给我的印象很深刻，上来就告诉我们要写一个裸机程序，要抛弃 std 库，但彼时的我还是连 rustling 都没有写明白的完全的 rust 萌新，看到这些东西未免觉得有些难以下手，好在 rcore-os 提供的简明 Tutorial 十分清晰，静下心来读基本上没有不理解的地方。

整个 rcore 阶段最困扰我也是让我思考了最久的一个问题：

> 为什么一个物理页不会同时被分配为页表和供内存使用？

因为在创建页表的过程中会使用 `PageTable.map()`，该函数会调用 `PageTable().find_pte_create()`，在这一创建多层页表的过程中会使用 `frame_alloc()`。
而在分配内存的部分，`MemorySet` 的 `Framed` 映射会调用 `frame_alloc()` 分配新的物理页供其使用，这是除了创建页表之外我们唯一能使用到 `[ekernel, MEMORY_END)` 这段内存的部分。
而在 `MemorySet` 里，主要是 `KERNEL_SPACE` 会产生一个恒等映射 `[ekernel, MEMORY_END)`。这部分恒等映射被用于寻找页表。
即使开启虚拟内存映射后，我们在 `PhysPageNum.get_pte_array()` 处也可以直接将 `pa` 转为 `*mut PageTableEntry`，就是因为此处的恒等映射会直接将 `pa` 对应的虚拟地址映射为物理地址。

我觉得愿意去弄明白这些，不给自己留有太多的疑惑，这个阶段的收获基本是不小的。

rcore-os 阶段让我印象最深刻的 lab 还是 filesystem 相关的部分，要求我们试着给文件维护一个引用计数。这个引用计数维护起来并不困难，但对于这样持久化的数据来说，在什么抽象层来维护十分重要，如果在视图层维护，那么是无法维护的。具体来说 `OSInode` 和 `Inode` 便是对于 `DiskInode` 的视图，而看明白这一点，需要对整个代码的结构有比较好的了解。

## arceos 阶段总结

这个阶段是我过的比较急的一个阶段。但其实这个阶段的代码质量远高于 rcore-os 阶段，因为是接近工业级别的代码，解耦合等各种设计思想也能学到不少。

lab2 的实现 HashMap 是我耗时最长的一个 lab，因为对于 Box<T> 的特性不太熟悉，而且在不可变引用迭代器中，又很容易涉及到 second borrow 的问题。

感觉这个阶段的 lab 都是很贴近实际工程环境的 lab，但难度相较于 rcore-os 阶段来说其实下降了一些，因为通过 demo 并不要求效率，也不考虑 corner case。
