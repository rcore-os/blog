---
title: 2023开源操作系统训练营第二阶段总结报告-Piako
date: 2023-11-05 17:01:44
tags:
    - author:PiakoCode
    - repo:https://github.com/LearningOS/2023a-rcore-PiakoCode

---

# rCore学习记录

## 在Lab开始之前

**配置环境**

本来想直接用物理机直接进行配置实验环境的

但是ArchLinux默认的qemu版本是8.1，和仓库中rustsbi要求的版本有冲突。

所以最后还是改用了docker来搭建环境......😢

```shell
make build_docker

# 用同一个docker容器进行全部实验，不想实验一次创建一次
docker run -it -v ${PWD}:/mnt -w /mnt rCore bash
```


修改ci-user中的makefile

```
env:
    rustup uninstall nightly && rustup install nightly
	(rustup target list | grep "riscv64gc-unknown-none-elf (installed)") || rustup target add riscv64gc-unknown-none-elf
    cargo install cargo-binutils
	rustup component add rust-src
	rustup component add llvm-tools-preview
```

将`rustup uninstall nightly && rustup install nightly` 注释掉，避免每次本地测试的时候都下载一遍


## Lab 1

lab1 本身难度其实并不大。感觉主要还是结合之前的章节熟悉一下 rCore 项目代码的整体结构，

但是由于我对系统结构还不是很熟悉，所以还是花了比较多的时间。

- 实现 `sys_task_info`  系统调用：

在 TCB 中添加记录系统调用次数的信息，每次系统调用时，根据 syscall id 更新相应数据。

我这里就直接粗暴地用桶方法记录了这些信息。

后面写到 lab3 的时候，发现我之前 sys_task_info 中的获取时间的方式有些问题。正确的应该需要记录进程第一次**运行**的时间，然后记录时间差。

## Lab 2

感觉在前三个 lab 中，lab2 算是相对比较难的一个了。主要的时间都花在了这里。

因为有了虚拟内存的机制，所以要重写 lab1 中系统调用



- 实现 mmap 和 munmap 系统调用

  - mmap

  需要注意，port参数不能直接转成MapPermission，两者有区别，并非仅仅是类型不同。
  在进行map前，需要检查对应的虚拟内存地址是不是已经被使用过了，这里可以检查 vpn_range的 start 和 end 看看是否被使用
  下面的munmap同理

  - munmap

  基本上就是map的逆操作

可以根据代码画个结构图，方便理解虚拟内存的结构。

## Lab 3


- 实现 `sys_spawn` 系统调用：

感觉还是比较简单，使用 `translated_str` 把 path 指针转成 程序名称，然后就可以创建进程，加入进程队列。要记得把新建的进程push到父进程的child中。

- 实现 stride 调度：

TCB 上再添加上 priority, stride 的信息，然后每次进程切换的时候更新一下。

进程插入进程队列时比较下 stride 的大小就行。

## 总结

回顾学习的过程，我觉得完成lab重要的是要有一个清晰的思路，明白自己要做什么，明白要怎么做，要对lab有一个整体上的认识。自己阅读代码的能力还是差了一些，以后要加强。

通过学习rCore，我感觉我对于操作系统的理解更深了，不像以前只是浮于表面，只记得一些概念，而对于操作系统的实现没有真切地感知。


最后要感谢老师、助教们辛苦的付出，让我们能够学习到这样好的开源课程，让我们有机会更加深入了解操作系统。
