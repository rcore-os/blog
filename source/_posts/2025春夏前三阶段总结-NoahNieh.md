---
title: 2025春夏前三阶段总结-NoahNieh
date: 2025-04-24 11:23:32
tags:
    - author:NoahNieh
    - repo:https://github.com/LearningOS/2025s-arceos-NoahNieh
mathjax: true
---

## 阶段一

在原版的`rustlings`基础上加入了一些针对训练营需要的`unsafe`相关的知识和构建过程中`build.rs`的应用。属于比较基础的内容，跟着评测机一道道做过去就可以了。

## 阶段二

这个阶段主要是通过基于`rust`编写操作系统内核`rcore`完成几个实验，借助实验理解一个具有进程/线程管理、内存管理、文件系统、进程间通信和提供了一定同步机制的内核是如何构成并运作起来的。

比较印象深刻的有这么几个知识点：

- 链接脚本与全局符号的使用
- `Rust`的汇编嵌入
- 第四章中，在使用分离内核空间的时候。通过设计跳板页来解决切换页表后指令执行的问题。[跳板页](#跳板)
- 第六章了解了文件系统，了解了块设备的概念，对文件系统的各个抽象层有了一定的了解。
- 第七、八章了解了操作系统是如何为应用提供同步原语的


### 跳板

由于`rcore`使用了分离内核空间的设计，所以在`Trap`的时候需要切换页表。但在切换页表之后，`pc`寄存器还是忠实的在其原来的位置自加到下一条指令，如果`内核内存空间`和`程序内存空间`对这段代码的映射不是在同一个位置的话，则会表现出来程序跳转到了别的地方执行的效果。因此需要设计一个跳板页，在虚存中将其映射到所有内存空间的最高页，确保在切换之后，也能正确运行下一条指令。

```asm
# trap.S
...
    .section .text.trampoline
    .globl __alltraps
    .globl __restore
    .align 2
__alltraps:
    csrrw sp, sscratch, sp
...

# linker.ld
...
    stext = .;
    .text : {
        *(.text.entry)
        . = ALIGN(4K);
        strampoline = .;
        *(.text.trampoline);
        . = ALIGN(4K);
        *(.text .text.*)
    }
...

```

在上面的汇编可以看到，我们给`trap.S`分配到了`.text.trampoline`段，并在链接脚本中定义了一个`strampline`符号来标记他的位置，这样我们可以在`Rust`中找到这个跳板页，映射到我们期望的位置。

但将跳板也映射到别的地方带来了新的问题，原来`__alltraps`中最后跳转到`trap_handler`使用的是`call trap_handler`。我们可以通过`obj-dump`看看编译得到的指令。

```
# obj-dump -Dx ...

...
80201056: 73 90 02 18   csrw    satp, t0
8020105a: 73 00 00 12   sfence.vma
8020105e: 97 80 00 00   auipc   ra, 0x8
80201062: e7 80 e0 0b   jalr    0xbe(ra) <trap_handler> # pc+0x80be
...
000000008020911c g     F .text  00000000000003b2 trap_handler
...

```

可以看到，这里用的是pc相对寻址，也就是基于当前指令的偏移找到`trap_handler`所在的位置。但是现在`__alltraps`已经在虚拟内存中被我们映射到最高页去了，也就是说我们实际运行代码的时候是在下面这一段内存中。

```
# gdb
>>> x /20i $pc-10
   0xfffffffffffff054:  ld      sp,280(sp)
   0xfffffffffffff056:  csrw    satp,t0
   0xfffffffffffff05a:  sfence.vma
=> 0xfffffffffffff05e:  jr      t1 

>>> p /x $t1
$9 = 0x8020911c
```

很明显如果这里跳转到$pc+offset$的话，并不是跳到位于正常代码段的`trap_handler`。所以我们要将这里换成寄存器跳转，将`trap_handler`的地址放到寄存器`t1`中，这样才能顺利地调用到`trap_handler`。

也就是[指导书](https://learningos.cn/rCore-Tutorial-Guide-2025S/chapter4/6multitasking-based-on-as.html?#term-trampoline)中所说的

> 跳转指令实际被执行时的虚拟地址和在编译器/汇编器/链接器进行后端代码生成和链接形成最终机器码时设置此指令的地址是不同的。


## 阶段三

这个阶段正式接触到组件化操作系统`arceos`。

### print_with_color

在调用路径上任意一个地方加入颜色代码就可以了，本身并不复杂，主要是了解arceos的结构。

### support_hashmap

考虑实现一个hashmap比较麻烦，直接引入`hashbrown`，将里面HashMap包到`collections`里面也可以通过。

> 但是hashbrown默认依赖的hashfold库在no_std下所提供的RandomState是基于内存布局的，而非每次都随机
> 可能会带来一些安全性问题

### alt_alloc

实验要求实现一个`bump alloctor`，是一个比较简单的分配器，在给定的接口下实现就可以了

### ramfs_rename

要求在给定的文件系统中实现rename的功能。看了测例中的注释仅要求在同级下重命名，不涉及移动。

搞清楚了`VfsOps`和`VfsNodeOps`两个trait之后，在路径上把目录项的名字改掉就好了。

### sys_map

要求实现继续系统调用`mmap`。

利用`task_ext`的`aspace`提供的接口就可以完成。通过`find_free_area`找到空闲的区域并通过`map_alloc`分配，然后将给定fd的数据读进来就可以通过了。需要注意一些接口有检查传入参数是否有对齐。

### simple_hv

按照提示将`a0``a1`寄存器设置好，并将pc寄存器偏移以跳过当前指令即可。

### 总结

阶段三的任务总体来说比阶段二的时候来得要更简单，感觉主要还是了解`arceos`的架构以及`Unikernel`、`Monolithic Kernel`、`Hypervisor`的不同。并体会在不同的内核需求中，`arceos`是如何将不同的组件组合起来以达成需求的。


