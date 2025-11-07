---
title: stage3-arceos-learning
date: 2025-11-07 10:25:57
tags:
    - author:zhangyx827
    - repo:https://github.com/LearningOS/2025a-arceos-zhangyx827
---

## 第三阶段blog

总体上 我对arceos的认识可以概括为接口，框架，算法。
- 接口关心下面的框架是什么，算法是什么，关心功能， 只需要调用框架提供的api。提供给用户程序
- 框架就是为了实现这个组件而需要的各种数据结构和在这些数据结构上面实现的一些`trait`
- 算法是对于框架的不同实现，通过指定不同的`feature`，对同一个`框架`采取不同的实现

### print_with_color

通过在`arceos/exercises/print_with_color/src/main.rs` 中 `use axstd::println`, 并且在print_with_color中没有实现`axstd.rs` 或者是`axstd/mod.rs`于是便到`arceos/print_with_color/Cargo.toml`中寻找
发现这一行
```
axstd = { workspace = true, optional = true }
```
意思是当前目录的配置直接继承了根目录的配置, 于是便到`arceos/Cargo.toml`中去求证

在`members`中，发现了以下这一行
```
"exercises/print_with_color",
```
说明确实继承了根目录的配置

因此直接在`arceos/Cargo.toml`中寻找axstd

发现了
```
axstd = { path = "ulib/axstd" }
```
于是便到`ulib/axstd`中寻找最后在`arceos/ulib/axstd/src/macros.rs`
中找到了
```
macro_rules! println
```
直接修改具体的实现即可


根据提示修改axhal能够修改ArceOS的颜色 到`axruntime`中找到打印符号的逻辑，使用的是`ax_println`那么直接修改该功能的实现，便实现了符号颜色的改变

### support_hashmap
- 在 `ulib/axstd/Cargo.toml`的 `[dependencies]中加入
```
axhal = { workspace = true }
```
实现对axhal模块中的`random`函数的调用


- 哈希函数的选取方面在`axstd/Cargo.toml`中, 我加入了
```
[dependencies.xxhash-rust]
version = "0.8.12"
features = ["xxh3", "const_xxh3"]
```
来导入该哈希函数
哈希表的数据结构包括存储键值对和发生冲突时的步长。对内部存储键值对我直接用了数组来实现，存储的是`Optino<(key, value)>`键值对，全部初始化为`None`，表明下标处没有存储元素
对于每一个插入操作，先通过将输入通过`core::slice::from_raw_parts`将输入的键hash得到一个下标，如果该下标对应的键值对是`None`，
那么就将键值对放入这个下标处，否则就将hash得到值不断加上步长，直到找到`None`为止。

我并没有实现删除和查找的功能，只是通过了测试用例，实现的并不完善。

### alt_alloc

对一段连续的内存左侧用以字节分配，右侧用于页面分配即可实现
通过这个实验的学习,了解到了初始阶段的内存分配器可以通过直接操作物理地址来支持早期的库和函数

### sys_map

通过`find_free_area`找到用户空闲的虚拟地址空间，建立地址映射，将通过`sys_read`得到的文件内容写入物理地址中，最后返回虚拟地址的开头。

### simple_hv

执行
```shell
riscv64-linux-gnu-objdump -d ./target/riscv64gc-unknown-none-elf/release/skernel2
```

```
ffffffc080200000:       f14025f3                csrr    a1,mhartid
ffffffc080200004:       04003503                ld      a0,64(zero) # 40 <_percpu_load_end+0x40>
```
通过这两行可得出指令` csrr    a1,mhartid`长度为4

```
ffffffc080200004:       04003503                ld      a0,64(zero) # 40 <_percpu_load_end+0x40>
ffffffc080200008:       48a1                    li      a7,8
```
这两行可知指令`ld      a0,64(zero)` 长度为4
因此需要在
`vmexit_handler`中对`Exception::IllegalInstruction`和`Exception::LoadGuestPageFault`的处理中，将`sepc`的值加上4。
然后通过观察`Exception::VirtualSupervisorEnvCall`的处理分别设置寄存器`a1`和寄存器`a0`的数值即可。


通过对hypervisor 的初步学习 加深了程序就是状态机的理解，程序的状态有寄存器和内存，对最简单的`Guest OS`的初始化无非就是对寄存器和内存的初始化

### ramfs_rename
折腾了半天发现rename一直不会是当前工作区的实现
于是就在`arceos/exercises/ramfs_rename/Cargo.toml`中将

```
axfs_ramfs = { version = "0.1", optional = true }

```
修改为
```
axfs_ramfs = { workspace = true, optional = true }
```

然后发现还是不行

发现由于`rename`是被`axfs`模块中的`rename`调用的，就将`axfs`的`Cargo.toml`也修改了
```
axfs_ramfs = { workspace = true, optional = true }
```

然后就可以了

实现上来说就是需要通过`split_path`分离出路径，必须在相同的路径下才能修改名字




