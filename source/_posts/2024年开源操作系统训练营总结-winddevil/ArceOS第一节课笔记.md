---
title: ArceOS第一节课笔记
date: 2024-12-21 18:19:26
categories:
    - note
tags:
    - author:Winddevil
---

# 解决`rust-analyzer`的问题

创建:`.vscode/settings.json`:

```json
{
    "rust-analyzer.cargo.features": ["axstd"]
}
```

> 这里一定要注意对`rust-analyzer`进行`Restart Server`,这个操作也可以见[我的这篇博客](https://www.cnblogs.com/chenhan-winddevil/p/18402660).

# 直接用vscode打开wsl环境下的工程

直接在`wsl`的`cmd`下输入`code .`.

这里可能会显示在安装`VSCode Server`,不是在安装`VSCode`本身,而是在安装一个服务,安装好自己就帮你打开了.

# 组件化内核

不同的内核要求就有不同的设计.

Linux是宏内核就照着宏内核设计.

那么组件化内核就照着组件化内核设计.

复杂的内核=很多小的内核合起来的

宏内核和Hypervisor与Unikernel没有明显的界限,因为这实际上是一个设计模式.

- 协作性
- 定位容易,维护难度低
- 开发效率高

用组件化内核替代原本的宏内核.但是这个内核是组件化开发的,最终组成一个总的内核.

# UniKernel

有一个非常不同的地方**应用和内核都在内核态并且在同一个地址空间里,互相是可见的**.

> **RTOS**似乎就是一个**UniKernel**.

那么打包完是同一个image.

那么宏内核是内核是一个image应用是另一个image,用syscall来打通.

因为是**同一特权级**,所以安全性不太行.

那么如果UniKernel需要保证安全性,那么就需要Hypervisor来帮你解决这个问题.

不同的组件可以用axruntime来组织.

裸机->逻辑程序

裸机->unikernel->OS程序

用OS去实现RTOS.

> 用裸机+虚拟化实现类似于`docker`的功能.

# 实验支撑的开发

每一节课是一个针对每个需求的内核.

那么新的内核是从旧的内核组建而成的.

宏内核和Unikernel的区别是加了用户特权级和用户的地址空间.看起来是增加了两个组件形成的,实际上到了很远的一条路.

让Unikernel实现Hypervisor,这样就可以实现虚拟化.从Host升级到Guest.

	宏内核的东西比较复杂

# 实验环境的建立

使用WSL2+Ubuntu 22.04.2 LTS环境.

[安装 WSL | Microsoft Learn](https://learn.microsoft.com/zh-cn/windows/wsl/install)

[Windows Terminal - Windows官方下载 | 微软应用商店 | Microsoft Store](https://apps.microsoft.com/detail/9n0dx20hk701?rtc=1&hl=zh-cn&gl=CN)


# 框架

![](00%20inbox/asset/Pasted%20image%2020241113192552.png)

# 引导过程

是通过axhal.

实际上使用的是`_start`这个指针.

通过一系列的asm操作来进行完成页表和函数调用和MMU的启动的支持.

# 日志级别控制与features

使用`Cargo.toml`来控制`features`.

使用环境变量:
1. 具体环境变量
2. 使用通用环境变量

三个部分汇集起来到axfeat

# 课后练习-支持带颜色的打印输出

\[print_with_color\]: 支持带颜色的打印输出。

要求： 
1. 修改一个组件的实现 
2. 执行make run A=exercises/print_with_color  

> 这一点非常重要

预期：字符串输出带颜色。（具体颜色不做要求）    
提示：在不同层次的组件上修改，影响的输出范围不同。
例如，修改axstd可能只影响println!的输出；修改axhal则可能一并影响ArceOS启动信息的颜色。

## 通过修改APP层实现

修改`exercises\print_with_color\src\main.rs`:

```rust
... ...
fn main() {     
	println!("\x1b[31m[WithColor]: Hello, Arceos!\x1b[0m"); 
} 
```

> 分支名称:`print_with_color_app`

## 通过修改`ulib:axstd`来实现

在`ulib\axstd\src\macros.rs`:
```rust
#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => {
        $crate::io::__print_impl(format_args!("\x1b[31m{}\x1b[0m", format_args!($($arg)*)));
    }
}

/// Prints to the standard output, with a newline.
#[macro_export]
macro_rules! println {
    () => { $crate::print!("\n") };
    ($($arg:tt)*) => {
        $crate::io::__print_impl(format_args!("\x1b[31m{}\n\x1b[0m", format_args!($($arg)*)));
    }
}
```

> 分支名称:`print_with_color_axstd`
## 通过修改`axhal:write_bytes`来实现

修改`modules\axhal\src\lib.rs`:
```rust
... ...
pub mod console {
    pub use super::platform::console::*;

    /// Write a slice of bytes to the console.
    pub fn write_bytes(bytes: &[u8]) {
        let color_begin = "\x1b[31m";
        let color_end = "\x1b[0m";
        for c in color_begin.bytes() {
            putchar(c);
        }
        for c in bytes {
            putchar(*c);
        }
        for c in color_end.bytes() {
            putchar(c);
        }
    }
}
... ...
```

> 分支名称:`print_with_color_axhal`

## 通过修改`axlog:ax_println`来实现(不了)

可以看到:`modules\axruntime\src\lib.rs`里调用了这个宏,
```rust
... ...
pub extern "C" fn rust_main(cpu_id: usize, dtb: usize) -> ! {
    ax_println!("{}", LOGO);
    ax_println!(
        "\
        arch = {}\n\
        platform = {}\n\
        target = {}\n\
        smp = {}\n\
        build_mode = {}\n\
        log_level = {}\n\
        ",
        option_env!("AX_ARCH").unwrap_or(""),
        option_env!("AX_PLATFORM").unwrap_or(""),
        option_env!("AX_TARGET").unwrap_or(""),
        option_env!("AX_SMP").unwrap_or(""),
        option_env!("AX_MODE").unwrap_or(""),
        option_env!("AX_LOG").unwrap_or(""),
    );
    #[cfg(feature = "rtc")]
    ax_println!(
        "Boot at {}\n",
        chrono::DateTime::from_timestamp_nanos(axhal::time::wall_time_nanos() as _),
    );
... ...
}
```

并且这个宏的位置在`modules\axlog\src\lib.rs`,我们修改它:
```rust
... ...
macro_rules! ax_println {
    () => { $crate::ax_print!("\n") };
    ($($arg:tt)*) => {
        $crate::__print_impl(format_args!("\x1b[31m{}\x1b[0m\n", format_args!($($arg)*)));
    }
}
... ...
```

**这里只能使得如下部分变成红色**,而不能满足题意:
```shell
       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn
```

> 分支名称:`print_with_color_axlog`

# 问题和疑问

1. `make`是怎么编译的?
2. `axruntime`是怎么加载的编译好的APP并且运行的?
3. `sbi`用的什么?

# 为`axstd`支持`Collections`

具体可以看这里的介绍:[集合类型 - Rust语言圣经(Rust Course)](https://course.rs/basic/collections/intro.html)

最开始我学`Rust`的时候没有内化这个概念.

实际上集合类型就是`Vector`和`HashMap`以及`String`这样的类型.

其实到这里我们自己就可以总结出了:

类型长度可变->指针地址和大小变量存在栈上,具体内容存在堆上->需要堆的支持->需要动态内存分配器.

那么实际上要支持`Collections`就是要支持一个动态内存分配器.

`rCore`中对动态内存分配器的描述:[[rCore学习笔记 028] Rust 中的动态内存分配 - winddevil - 博客园](https://www.cnblogs.com/chenhan-winddevil/p/18442833)

`rCore`中引用的动态内存分配器:[[rCore学习笔记 029] 动态内存分配器实现-以buddy_system_allocator源码为例 - winddevil - 博客园](https://www.cnblogs.com/chenhan-winddevil/p/18447537)

![](00%20inbox/asset/Pasted%20image%2020241117150533.png)

这里注意这张图,在`Unikernel`中,内存管理器也是和APP放在一起的,主要的思想还是**APP和Kernel在同一特权级**.

## `alloc`实现接口

![](00%20inbox/asset/Pasted%20image%2020241117151558.png)

这个是需要实现两个功能:
1. 实现`byteAllocator`和`pageAllocatir`.
2. `byteAllocator`只需要实现`rust`自带的一个`Trait`即`#[global_alloctor]`即可
3. `pageAllocator`的实现方式是用了一个全局变量来实现相应的功能的

这里的源代码在`modules/axalloc/src/lib.rs`这里看.

> 这里是实现了一个`GlobalAllocator`类,然后实例化一个
> 1. 实现`GlobalAlloc`的`Trait`给它,有`alloc`和`dealloc`这两个方法,即可实现内存分配.用`#[global_alloctor]`标注这个实例即可.
> 2. 为`GlobalAllocator`实现了`alloc_pages`和`dealloc_pages`,通过直接获取这个实例

这里实现的时候`trait`的`fn`和`struct`本身的`fn`重合,这是允许的.

> 调用时,`MyTrait::do_something(&struct)`和`struct.do_something`两种调用形式是调用的不同的方法.


实现方法:

![](00%20inbox/asset/Pasted%20image%2020241117154427.png)


1. 最开始的时候页分配器是先分配一部分内存给字节分配器的
2. 先找字节分配器分配,任何如果不够了找页分配器追加

在当前为了给`HashMap`提供分配器的是`core`库里`allocator`里自带的`TlsfByteAllocator`作为**字节分配器**,`BitmapPageAllocator`作为**页分配器**.

那么为了实现自己的字节分配器就需要要给它实现两个`Trait`,即`BaseAllocator`和`ByteAllocator`.

这个下一节可能会讲到.

# 课后练习-支持HashMap类型

![](00%20inbox/asset/Pasted%20image%2020241114214732.png)

这里要搞懂关于库的文件夹的互相依赖关系.

## 为什么`core`里没`HashMap`?

因为`HashMap`需要的随机数生成器涉及到**体系结构**.

那么这里的`random()`是来自于`axhal`就非常的合理了.

## 有关于`Cargo.toml`

两个`Cargo.toml`:
1. `.\Cargo.toml`
2. `ulib\axstd\Cargo.toml`

使用`cargo tree -p axstd -e features`可以很好地看到`features`结构.

# 有关于结构问题

这里注意一点,在`ulib/axstd/src/lib.rs`里已经引用了`collections`,
```rust
pub use alloc::{boxed, collections, format, string, vec};
```

而在`exercises/support_hashmap/src/main.rs`里引用的是:
```rust
use std::collections::HashMap;
```

在`rust`[这个项目](https://github.com/rust-lang/rust)里发现,`library\alloc`的`collection`里并没有`HashMap`,`HashMap`是在`library\std`的`collection`里.

所以其实我们是要把这两个`collection`的内容合并.

## 直接使用`hashbrown`

创建`ulib/axstd/src/collections/mod.rs`:
```rust
// 合并alloc::collections里的内容
pub use alloc::collections::*;
// 引用hashbrown
pub use hashbrown::HashMap;
```

在`ulib/axstd/Cargo.toml`加入`hashbrown`:
```toml
... ...
[dependencies]
... ...
hashbrown = "0.15.1"
... ...
```

## 完全仿写`std`库

自己实现以`hashbrown::HashMap`为`base`的`HashMap`.

通过题中给出的`random`实现`RandomState`.

想在`axstd`中调用`axhal/random`,需要在`ulib/axstd/Cargo.toml`里加入:
```toml
[dependencies]
axhal = { workspace = true }
```

`#TODO`
## 拉链法实现

`#TODO`





