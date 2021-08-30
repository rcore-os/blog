---
title: zcore-summary-xuexiaowei
date: 2021-08-30 15:00:16
categories:
	- report
tags:
	- author:SummerVibes
	- summerofcode2021
	- zcore
---

# zCore 实训总结 - 给RVM提供riscv支持

<!-- more -->

### 项目概述
RVM是一个type2虚拟机，具体可移步https://github.com/rcore-os/RVM，
整个RVM体系可以分为两部分，其一是操作系统无关的，这部分是一个单独的crate叫做RVM；其二是操作系统相关的，是os内核中的一个模块，该模块使用RVM crate提供的API实现虚拟化系统调用。有了系统调用，我们就可以开发用户程序在os上跑虚拟机了。

### 情况分析

zCore有两种运行方式

1. 直接运行在裸机上，包括zircon和rCore两个内核，zircon兼容zircon系统调用，rCore兼容linux系统调用，两个内核都是按照google的zircon内核的思想设计的，因此都有object的概念，关于object可以移步fuchsia官方文档。由于rCore兼容linux系统调用，因此直接称作linux内核。linux和zircon并不是独立的，linux直接使用了zircon的进程管理和内存管理的object，并在此基础上实现了文件系统等object。
2. 运行在类unix操作系统上如linux和macos，以libos的形式运行。

libos暂时不管，只考虑第一种

目前zircon内核是没法运行在riscv平台下的，所以只能在linux内核实现虚拟化

最终目标：裸机运行riscv架构的zcore linux内核，并在os中运行用户态vmm程序

### 仓库地址

fork的rvm，已经移植到了riscv，需要进一步完善

[GitHub - SummerVibes/RVM: Rcore Virtual Machine](https://github.com/SummerVibes/RVM)

fork的zcore，要给zcore中的linux内核添加rvm支持，以及完善riscv支持

[GitHub - SummerVibes/zCore: Reimplement Zircon microkernel in Rust.](https://github.com/SummerVibes/zCore)

[日常进度](https://www.notion.so/7b8ecb9d30c64abc99c06adeab1e9a7b)

### 问题

1. makefile里的riscv64.img是什么，在哪弄

    在zCore根目录运行 make rv64-image

2. [https://github.com/rcore-riscv-hypervisor-dev/rust-rvm-vmm](https://github.com/rcore-riscv-hypervisor-dev/rust-rvm-vmm)这个库是干嘛的

    这是rvm的用户态实现

3. PLIC是什么

    platform-level interrupt controller (PLIC)，riscv的平台级中断控制器，接受来自外围设备的中断信号，并仲裁，根据优先级进行处理

4. UART是什么

    Universal asynchronous receiver-transmitter，作为把并行输入信号转成串行输出信号的芯片，UART通常被集成于其他通讯接口的连结上，UART是计算机中串行通信端口的关键部分。类似的还有GPIO，PWM

5. Hart是什么

    hardware thread 硬件线程，是riscv对线程所需的CPU资源的集合的称呼

6. kernel-hal-bare/src/arch/riscv/virtio/device_tree.rs 42行报错

    已解决，有一个main函数的签名忘记改了

7. VMM如何截获指令，具体是怎么实现的
8. rcore-vmm [https://github.com/rcore-os/rcore-vmm](https://github.com/rcore-os/rcore-vmm) 是什么？

    这是一个用C写的运行在用户态的VMM，后来又用rust重写了

9. prebuilt/linux/libc-libos.so是哪来的
10. 在macos m1下能够运行但是运行gdb时报错说找不到符号表

    安装riscv-gnu-toolchain就可以了，然后使用其中的riscv64-elf-unkonw-gdb就可以了

11. Could not load the Python gdb module from `/usr/local/share/gdb/python'.
Limited Python support is available from the _gdb module.
Suggest passing --data-directory=/path/to/gdb/data-directory.

    拷贝python库过去

12. rcore-fs-fuse 是什么

    FUSE wrapper for VFS. Mount any FS to your Linux / macOS. 虚拟文件系统的用户空间文件系统包装器，用来挂载任何文件系统到unix系统

    根文件系统是什么？

    使linux能够运行的文件和程序的集合

13. make run mode=release linux=1没有出现sh

    应该是我的qemu有问题，模拟x86不太行

14. mmio bank 是什么

    像是一个集合，需要内存映射的设备的集合

15. sys_ioctl是干什么的

    ioctl是设备驱动程序中对设备的I/O通道进行管理的函数。所谓对I/O通道进行管理，就是对设备的一些特性进行控制，例如串口的 传输波特率、马达的转速等等

16. 在shell命令前加上arch=riscv64有什么用？能以不同的架构运行命令？好多命令都在前面加这个

    没什么用，就是给arch这个shell变量赋值而已

17. userboot是什么，zcore的启动流程是怎样的
18. 并没有riscv架构的so文件，无法在riscv上运行zircon，这个怎么办

    这些so文件是根据代码编译而成的，据学长说fuchsia的编译系统属于半开源状态，而且编译器也不一定支持riscv，所以这条路怕是走不通了

19. zircon中的VmAddressRegion是什么

    虚拟内存地址区域，也就是以前说的地址空间

20. riscv的中断处理方式是怎样的
21. rvm的接口在哪？是如何调用的

    rvm的接口是给vmm用户程序使用的，rust-rvm-vmm只用到了很少的rvm功能，很多地方直接重写了rvm已有的功能

22. zCore没有对系统调用进行封装提供给用户程序吗
23. futex是什么

    快速用户区互斥锁，是一个用户态系统调用，效率很高，[https://zh.wikipedia.org/wiki/Futex](https://zh.wikipedia.org/wiki/Futex)

24. 如何让clion中的riscv64代码高亮显示

    [https://doc.rust-lang.org/rust-by-example/attribute/cfg/custom.html](https://doc.rust-lang.org/rust-by-example/attribute/cfg/custom.html)

25. 加载用户程序发生了panic

    目前发现是rust-rvm-vmm生成的可执行程序，strip之后，bss段的offset+size>filesize，xmas-elf会对这个进行检查，所以装载失败

    使用readelf可以看到offset检查失败的segment是只放了bss section，bss根本就是一个空section，不管offset是啥都无所谓，只要其物理地址正确就可以了，所以xmas-elf这种做法不太对。

### 学习路径

1. 首先学习的是陈渝老师的高级操作系统课程，重点学习了其中讲虚拟机的章节，之后看了虚拟机黑书，重点看第一章，也就是导论，这样便建立起了对虚拟机的宏观理解。
2. 之后便是看源码，丰富枝叶，结合文档看了zCore和RVM的源码，以及郭敬哲学长的rust-rvm-vmm，这一步花的时间很多。
3. 运行用户程序时遇到ELF装载失败的问题，便看了《程序员的自我修养-链接、装载与库》，这本书写的非常好，解决了我的许多疑惑，这本书从理论到实践，由浅入深，讲解了Windows和Linux用户程序的装载方式，我只重点看了Linux的实现。

### 总结

客观上讲

学的不少，做的不多

主观上讲

本次实训对我来说意义重大，是我从用户层开发走向系统级开发的第一步，但不是最后一步，非常非常感谢这次机会，尽管很遗憾我做出的东西很少，但是学到的真的很多，如果以后另有以虚拟机为主题的活动，我一定参加

### 以后的规划

用rust写的虚拟机其实非常多，而且许多已经商用了，我打算去学习下这些虚拟机的设计思想，并参与源码贡献

以下几个项目是打算学习的

google的crosvm [https://chromium.googlesource.com/chromiumos/platform/crosvm/](https://chromium.googlesource.com/chromiumos/platform/crosvm/)

华为的stratovirt [https://gitee.com/openeuler/stratovirt](https://gitee.com/openeuler/stratovirt)

aws的firecracker [https://github.com/firecracker-microvm/firecracker](https://github.com/firecracker-microvm/firecracker)

intel的cloud-hypervisor [https://github.com/cloud-hypervisor/cloud-hypervisor](https://github.com/cloud-hypervisor/cloud-hypervisor)

以及维护了许多rust虚拟机组件的rust-vmm组织的项目 [https://github.com/orgs/rust-vmm/repositories](https://github.com/orgs/rust-vmm/repositories)

### 参考

1. 操作系统相关

    学长已经实现的加入了rvm on riscv支持的rcore

    [GitHub - rcore-riscv-hypervisor-dev/rcore_plus: Rust port for uCore OS, supporting x86_64 & RISCV32I](https://github.com/rcore-riscv-hypervisor-dev/rcore_plus)

    [GitHub - rcore-os/zCore: Reimplement Zircon microkernel in Rust.](https://github.com/rcore-os/zCore)

    zcore riscv的移植进展

    [zCore/porting-rv64.md at master · rcore-os/zCore](https://github.com/rcore-os/zCore/blob/master/docs/porting-rv64.md)

2. 操作系统无关，学长已经实现的RVM on RISC-V

    [RISC-V 64 Hypervisor: rCore on rCore by gjz010 · Pull Request #80 · rcore-os/rCore](https://github.com/rcore-os/rCore/pull/80)

    [GitHub - rcore-riscv-hypervisor-dev/RVM: Rcore Virtual Machine](https://github.com/rcore-riscv-hypervisor-dev/RVM)

3. RVM WIKI

    [Home · rcore-os/RVM Wiki](https://github.com/rcore-os/RVM/wiki)

4. rcore-user

    [GitHub - rcore-os/rcore-user: User programs for rCore OS](https://github.com/rcore-os/rcore-user)

5. [各组的项目链接](https://shimo.im/sheets/913J2OVmgyClW93E/cDZ9Q)

6. [在线问答](https://shimo.im/docs/YpjT8QGHPxr8Cdw6)
