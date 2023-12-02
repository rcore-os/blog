---
title: 2023开源操作系统训练营第三阶段项目一基本任务总结报告-xiuzz
date: 2023-11-27 19:29:25
tags:
---

# 总结报告

## 练习1：为 image 设计一个头结构，包含应用的长度信息，loader 在加载应用时获取它的实际大小

这个实验刚开始的时候一头误水，以为是生成镜像后，让loader自己判断应用长度和个数，发现很难实现，后面才发现练习1的要求是在image开头加入应用长度信息，这样loader只需要获取相应的信息就可以获取实际大小和个数，实现非常轻松，后面才了解到例如elf等文件，都会有相应的头部信息给loader进行判断。

应用头
```rust
struct AppHeader {
    start: usize,
    size: usize,
    content: &'static [u8],
}
```
后面感谢邝劲强同学提供了一个生成镜像的脚本思路，以及dd中seek选着字节跳过的用法。

## 练习 2：在练习 1 的基础上，扩展 image 头结构，让 image 可以包含两个应用

在完成练习1后，练习2就变得很轻松了，顺着练习1的思路只需要在镜像开头加入应用个数的信息，然后loader获取后，循环调用每一个app即可。

镜像头：
```rust
struct ImageHeader{
    ptr_len: usize
}
```

循环调用：
``` rust
let mut app_start = PLASH_START + ptr_len;
for _ in 0..app_nums {
    let app_header = image_header.load_app(app_start);
    println!("start:{:#}",app_header.start);
    println!("size:{}", app_header.size);
    println!("context:{:?}",app_header.content);
    println!("......................................");
    app_start += app_header.size + ptr_len;
}
```


## 练习3：批处理方式执行两个单行代码应用，第一个应用的单行代码是 nop ，第二个的是 wfi 

刚开始没注意到改文档了，写的noop，然后直接报错了，调试了一下，最后看群里面才发现是nop。然后好像就没什么了，把实验2的实现放在练习3就行了。

## 练习4 请实现 3 号调用 -SYS_TERMINATE 功能调用，作用是让 ArceOS 退出，相当于 OS关机

这个在前面的学习中已经发现axstd中已经实现了`axstd::process::exit`，只需要封装下调用即可，还是比较简单的。

## 练习5: 按照要求改造应用 hello_app

这个应该是6个练习中最难的一个，刚开始按照实验4的思路把汇编指令全部移动到了外部的镜像中，但是和实验4不同的是，这里会执行3个系统调用（应该是大于三个的，因为打印字符串，吊调用了多次putchar），然后我执行完第一个后就发生panic，然后为对riscv汇编指令不熟，也不知道如何查看寄存器状态，这里感谢刘逸珑同学大半夜了教我如何使用gdb，最后发现是a7寄存器的值发生了改变，即原本传入的`abi_table`，在调用第一个函数后a7的值发生了改变，后面发现是在执行后axhal调用了a7,存了一下值，于是问题就简单了，用一个t2寄存器存一下a7的值即可。
实现的代码如下：
```rust 
fn hello() {
    unsafe {
        core::arch::asm!("
            li t0, {abi_num}
            slli t0, t0, 3
            add t1, a7, t0
            mv t2,a7
            ld t1, (t1)
            jalr t1
            mv a7,t2",
            abi_num = const SYS_HELLO,
            clobber_abi("C")
        )
    }
}

fn putchar(c: u8) {
    unsafe {
        core::arch::asm!("
            li t0, {abi_num}
            slli t0, t0, 3
            add t1, a7, t0
            mv t2,a7
            ld t1, (t1)
            jalr t1
            mv a7,t2",
            clobber_abi("C"),
            abi_num = const SYS_PUTCHAR,
            in("a0") c,
            
    )}
}

fn terminate(exit_code: i32) {
    unsafe {
        core::arch::asm!("
            li t0, {abi_num}
            slli t0, t0, 3
            add t1, a7, t0
            mv t2,a7
            ld t1, (t1)
            jalr t1
            mv a7,t2",
            abi_num = const SYS_TERMINATE,
            in("a0") exit_code as u8,
            clobber_abi("C")
        )
    }
 
}
```

## 练习6：
1. 仿照 hello_app 再实现一个应用，唯一功能是打印字符 'D'。
2. 现在有两个应用，让它们分别有自己的地址空间。
3. 让 loader 顺序加载、执行这两个应用。这里有个问题，第一个应用打印后，不能进行无限循环
之类的阻塞，想办法让控制权回到 loader，再由 loader 执行下一个应用。

这个比较简单只需要在练习5的基础上使用`putchar`函数,并且删除`wfi`,让程序不要等待中断即可。

## 个人总结

刚开始我每个项目都进去听了一下，最后被arceos的组件化思想给吸引了，加上老师上课任务都很用心，因为平时还有课，就专注于项目1了，收获不小，rust和unikernel，甚至如何编写makefile 都是在从这次开源活动中学习到的，尤其是项目1。最让我深刻的就是自己编写makefile然后成功让镜像加入到了loader里面并运行，和练习5调试那个汇编代码和寄存器，这两个地方，解决困难后的兴奋感。