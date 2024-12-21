---
title: 2024秋冬季开源操作系统训练营第三阶段总结-hbuxiaofei
date: 2024-12-01 11:02:18
tags:
---


## `[print_with_color]`: 支持带颜色的打印输出。

- 要求：

> 1. 修改一个组件的实现
> 2. 执行`make run A=exercises/print_with_color`

- 预期：字符串输出带颜色。（具体颜色不做要求）

- 提示：在不同层次的组件上修改，影响的输出范围不同。例如，修改`axstd`可能只影响`println!`的输出；修改`axhal`则可能一并影响ArceOS启动信息的颜色。



- 本次修改主要集中在 `println!` 宏中，修改后的代码如下：
```rust
 macro_rules! println {
     () => { $crate::print!("\n") };
     ($($arg:tt)*) => {
-        $crate::io::__print_impl(format_args!("{}\n", format_args!($($arg)*)));
+        // $crate::io::__print_impl(format_args!("{}\n", format_args!($($arg)*)));
+        $crate::io::__print_impl(format_args!("\u{1B}[{}m{}\u{1B}[m\n", 32, format_args!($($arg)*)));
     }
 }
```

## `[support_hashmap]`: 支持HashMap类型。


- 预备：执行`make run A=exercises/support_hashmap`


- 要求：
> 1. 在axstd等组件中，支持`collections::HashMap`
> 2. 再次执行`make run A=exercises/support_hashmap`

- 提示：
> 1. 报错的std其实是axstd，测试用例main.rs中有"extern crate axstd as std;"
> 2. 在axhal中给出了一个随机数产生函数random()，可以基于它为HashMap提高随机数支持。


- 实现思路

HashMap 使用一个 `Vec<Option<(K, V)>>` 来存储键值对，每个桶（即 `Option<(K, V)>`）存储一个键值对，空桶为 None
`custom_hash` 函数用于生成键的哈希值，这里采用简单的字节移位和异或方式，返回一个 u64 类型的哈希值
`iter` 方法返回一个自定义的迭代器 `HashMapIterator`，该迭代器遍历哈希表中的所有已存储的键值对
通过线性探测法处理哈希冲突，即当发生冲突时，依次检查下一个桶直到找到空桶或找到匹配的键。

- 测试结果
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

Running memory tests...
test_hashmap() OK!
Memory tests run OK!
```

其他实验由于忙于项目，暂时未做，后面有时间再补上其他的实验。

之前总结的一个starry的实现流程也记录这里，方便以后实验查阅：
[Starry启动流程](starry-boot.jpeg)



