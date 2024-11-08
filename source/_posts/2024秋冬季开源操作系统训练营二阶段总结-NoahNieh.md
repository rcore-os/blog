---
title: 2024秋冬季开源操作系统训练营二阶段总结-NoahNieh
date: 2024-11-07 16:26:56
categories:
    - 2024秋冬季开源操作系统训练营
tags:
    - author: NoahNieh
    - repo: https://github.com/LearningOS/2024a-rcore-NoahNieh
mathjax: true
---

# 第二阶段总结

这个阶段主要是要完成几个实验，借助几个实验理解一个具有进程/线程管理、内存管理、文件系统、进程间通信和提供了一定同步机制的内核是如何构成并运作起来的。

比较深刻的有这么几个知识点：

- 链接脚本与全局符号的使用
- `Rust`的汇编嵌入
- 第四章中，在使用分离内核空间的时候。通过设计跳板页来解决切换页表后指令执行的问题。[跳板页](#跳板)
- 第六章了解了文件系统，了解了块设备的概念，对文件系统的各个抽象层有了一定的了解。
- 第七、八章了解了操作系统是如何为应用提供同步原语的


## 跳板

由于我们的内核使用了分离内核空间的设置，所以在`Trap`的时候需要切换页表。但在切换页表之后，`pc`寄存器还是忠实的在其原来的位置自加到下一条指令，如果`内核内存空间`和`程序内存空间`对这段代码的映射不是在同一个位置的话，则会表现出来程序跳转到了别的地方执行的效果。因此我们设计了一个跳板页，在虚存中映射到所有内存空间的最高页，确保在切换之后，也能正确运行下一条指令。

```
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

可以看到，这里用的是pc相对寻址，也就是基于当前指令的偏移找到`trap_handler`所在的位置。但是现在`__alltraps`已经被我们映射到内存的最高页去了，也就是说我们实际运行代码的时候是在下面这一段内存中。

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


