---
title: rCore 到 zCore 功能迁移组报告
date: 2020-08-30 10:52:20
categories: 
    - report
tags:
    - author:yunwei37
    - author:wfly1998
    - summerofcode2020
---

# rCore 到 zCore 功能迁移组报告

郑昱笙、李宇

## 目录

<!-- TOC -->

- [rCore 到 zCore 功能迁移组报告](#rcore-到-zcore-功能迁移组报告)
  - [目录](#目录)
  - [实验目标描述](#实验目标描述)
  - [已有相关工作介绍](#已有相关工作介绍)
  - [小组成员分工](#小组成员分工)
  - [主要成果描述](#主要成果描述)
    - [李宇](#李宇)
      - [在 LibOS 与 QEMU 中实现 stdin](#在-libos-与-qemu-中实现-stdin)
      - [在 LibOS 与 QEMU 中移植 shell](#在-libos-与-qemu-中移植-shell)
      - [在 LibOS 与 QEMU 中移植 GCC](#在-libos-与-qemu-中移植-gcc)
      - [在 LibOS 与 QEMU 中移植 Rust 工具链 (未成功)](#在-libos-与-qemu-中移植-rust-工具链-未成功)
      - [补充系统调用以及修复系统调用相关问题](#补充系统调用以及修复系统调用相关问题)
      - [改进 Makefile](#改进-makefile)
      - [致谢](#致谢)
    - [郑昱笙](#郑昱笙)
      - [补全 zCore 中 Linux 相关的三个模块的文档和单元测试](#补全-zcore-中-linux-相关的三个模块的文档和单元测试)
      - [完善文件系统和IO相关系统调用](#完善文件系统和io相关系统调用)
      - [完善进程间通信机制](#完善进程间通信机制)
      - [致谢](#致谢-1)
  - [对实验的后续开发内容建议或设想](#对实验的后续开发内容建议或设想)
  - [实验总结](#实验总结)
  - [实验过程日志](#实验过程日志)

<!-- /TOC -->
<!-- more -->
## 实验目标描述

rCore 是用 Rust 语言实现的兼容 Linux 内核。它支持四种指令集，能够运行比较丰富的应用程序。但是随着时间的积累，rCore 的代码越堆越多，很多内部实现缺乏推敲，需要优化和重构。后来我们从头开始实现了 zCore 项目，采用了更加清晰的分层结构，同时复用 Zircon 微内核的内核对象实现了 Linux 内核的部分功能（如内存管理和进程管理）。目前 zCore 中的 linux 模块已经能够运行基础的 Busybox 等小程序，但仍有大量原本 rCore 支持的功能没有实现。本项目希望将 rCore 的功能迁移到 zCore 当中，并借此机会进行重构。其中一些代码可以直接搬过来，剩下的可能需要调整适配（例如涉及到 async），还有一些可以直接基于 Zircon 内核对象进行实现（例如 epoll）。

## 已有相关工作介绍

- zCore 中 Linux 相关的三个模块的文档和单元测试集合都相对缺失；
- 文件相关系统调用 zCore 中除了以下部分已经基本完成，但以下功能在rCore中都能找到：
  - stdin 尚未实现；
  - io多路复用（如 select poll epoll）尚未实现
  - touch 不能创建文件，时间相关模块暂时缺失；
- 进程间通信机制暂时缺失，相比 rCore 实现了三种机制：pipe、信号量、共享内存
- 信号机制暂时缺失，相比 rCore 中也有对应的实现
- zCore 中 linux 模块并没有像 zircon 那样的系统调用测试程序集合，rCore 则可用 libc-test 进行测试；
- rCore 中移植相关用户态程序留下了不少文档可供参考；

## 小组成员分工

- 李宇：尝试从 Linux 用户程序入手，在 zCore 上运行 rCore 支持的 GCC，Nginx，Rustc 等，并修复和移植相关的功能；
- 郑昱笙：尝试完善 linux 系统调用的单元测试和 libc-test, 并以测试驱动开发，尝试尽可能多地移植和完善 rCore 的相关功能

## 主要成果描述

### 李宇

#### 在 LibOS 与 QEMU 中实现 stdin

相关 PR：

- [#131 Add some syscalls and add stdin](https://github.com/rcore-os/zCore/pull/131)
- [#143 Update stdin with EventBus](https://github.com/rcore-os/zCore/pull/143)

在活动的一开始，我还不太了解 LibOS 与 QEMU 区别的时候，我以为 LibOS 只是一个更方便的，可以不需要 QEMU 就能运行操作系统的平台，所以我认为把功能在 LibOS 中实现的话 QEMU 里也可以用，但是事实并不是这样，我一开始在实现的 stdin 只能在 LibOS 中使用，到了 QEMU 里完全没有任何反应，后来经过王润基学长的讲解我才知道 LibOS 与在 QEMU 中运行的区别：

- LibOS 是运行在用户态的操作系统，系统调用的实现方式从 `syscall` 指令改成了函数调用，此外需要与硬件打交道的地方也都改为与 rust 的 std crate 进行交互
- QEMU 环境则是与我们理解的裸机一样，操作系统与 QEMU 模拟出的硬件交互，与在真机上跑几乎没有区别

在 QEMU 中实现 stdin 时我还犯了一些低级错误：我以为 zCore 不能从 `trap_handler` 接收中断，结果最后才知道这一函数仅接收内核态中断，用户态中断是在另一个地方接收的，在这上面浪费了几天时间

#### 在 LibOS 与 QEMU 中移植 shell

相关 PR：

- [#131 Add some syscalls and add stdin](https://github.com/rcore-os/zCore/pull/131)
- [#143 Update stdin with EventBus](https://github.com/rcore-os/zCore/pull/143)
- [#150 Fix problem of blocking in sys_wait4](https://github.com/rcore-os/zCore/pull/150)

其实在 LibOS 中把 stdin 和 `sys_poll` 写好后，shell 就可以勉强运行了。之所以说勉强运行，是因为由于 `fork` 的限制，在 LibOS 中仅能使用 `sys_vfork` 而不能使用 `sys_fork`，而 AlpineLinux minirootfs 中的 shell (`busybox`) 启动外部程序必须使用 `sys_fork`，所以 shell 只能执行内置的，如 `cd`, `pwd` 之类的命令

而 LibOS 中的 shell 真正移植成功实际上是王润基学长的功劳，他发现 `busybox` 编译时有一个 Force-NOMMU 参数，使用该参数编译后 shell 启动外部程序则会使用 `sys_vfork`，有了这一版本的 `busybox`，就宣告着 LibOS 中的 shell 移植成功了

在 QEMU 中，其实也是写好改进的 stdin 之后，shell 就可以勉强运行了。这里的勉强运行跟 LibOS 中还不太一样，QEMU 中的 shell 可以执行外部命令，但是执行几次后就会因为 `sys_wait4` 而阻塞，经过一段时间的折腾我解决了这个问题并提交了 PR，但是在解决这一问题后我又偶然发现 LibOS 中的 shell 坏掉了...这个问题到现在还没有解决...

#### 在 LibOS 与 QEMU 中移植 GCC

相关 PR：

- [#131 Add some syscalls and add stdin](https://github.com/rcore-os/zCore/pull/131)
- [#150 Fix problem of blocking in sys_wait4](https://github.com/rcore-os/zCore/pull/150)

我在 GCC 上面花了不少时间，因为其它的程序都可以直接从 Alpine Linux 中直接复制出来就可以运行，但由于编译 GCC 的时候没有开启 PIE-enabled 参数，导致 GCC 是 PIE-disabled 的，这样的程序在 zCore 中不能运行，所以折腾 GCC 也用了好久，没有找到解决方法，最终选择了在 Alpine Linux 中重新编译 `musl-gcc`，并全局添加 `-pie -fpie` 参数，这样最终编译出的 GCC 就可以在 zCore 中正常运行了

GCC 在补充了一些系统调用之后就可以编译出 `*.o` 的中间结果了，但是会跟 QEMU 中的 shell 一样，会因为 `sys_wait4` 而阻塞，区别是，shell 的阻塞是随机发生的，而 GCC 的阻塞是必然的，所以其实我本打算先放着 shell 不管的，但是 GCC 对此也有需求，所以就不得不解决了，也算是一举两得

#### 在 LibOS 与 QEMU 中移植 Rust 工具链 (未成功)

相关 PR：

- [rCore #66 update rboot; fix problem of sys_poll](https://github.com/rcore-os/rCore/pull/66)
- [zCore #158 Fix problem of sys_poll](https://github.com/rcore-os/zCore/pull/158)

我在 Rust 工具链上面花了最多的时间，但是最终还是没有成功。但不能说是没有进展，也是向前推动了一小步的。

`rustc` 在一开始会死循环调用 `sys_poll`，这一问题卡了我们很久，最后在使用 `strace` 跟踪并查文档的时候偶然发现，`sys_poll` 需要写回一个参数，而我从 rCore 中搬过来的代码里面就没有，所以我在 rCore 与 zCore 中均提交了一个 PR 来解决这一问题

这之后在 LibOS 中 `rustc` 与编译无关的功能均可正常使用了，但是编译则会报段错误，而且出现的位置不定，这个一直没有解决

此外，`rustc` 在 QEMU 中运行则会报 OOM (out of memory)，我甚至把 zCore 的内存改成了 2G 都无法运行，王润基学长说需要修改 `sys_mmap`，但是这里的工作量太大，截止到活动结束我都没有完成，有点遗憾

#### 补充系统调用以及修复系统调用相关问题

相关 PR：

- [#131 Add some syscalls and add stdin](https://github.com/rcore-os/zCore/pull/131)
- [#150 Fix problem of blocking in sys_wait4](https://github.com/rcore-os/zCore/pull/150)
- [#155 Add some syscalls of signal](https://github.com/rcore-os/zCore/pull/155)
- [#157 Update sys_pipe to sys_pipe2](https://github.com/rcore-os/zCore/pull/157)
- [#158 Fix problem of sys_poll](https://github.com/rcore-os/zCore/pull/158)

#### 改进 Makefile

相关 PR：

- [#131 Add some syscalls and add stdin](https://github.com/rcore-os/zCore/pull/131)
- [#165 Add image generating](https://github.com/rcore-os/zCore/pull/165)

在 `zCore/Makefile` 中更新了 `make debug` 功能，方便在 QEMU 中使用 `gdb` 调试 zCore

在 `Makefile` 中添加了 `make image` 功能，可以生成供 zCore 使用的 `x86_64.img`

#### 致谢

感谢陈渝老师和向勇老师为我们提供这样一个学习交流的平台，也感谢王润基学长和我的队友们在这一过程中给我的帮助

此外，我还要给王润基学长道个歉，在活动中我提交了不少低质量的 PR，在提问过程中也犯了不少低级错误，我对此感到非常抱歉。但是在这一过程中，王润基学长一直很细心地给我指出 PR 中的缺陷并耐心地回答我提出的问题，再次感谢王润基学长

### 郑昱笙

#### 补全 zCore 中 Linux 相关的三个模块的文档和单元测试

相关PR：

- [#125 Improve docs for linux-syscall and fix "uname" command](https://github.com/rcore-os/zCore/pull/125)
- [#128 Improve doc and add some simple trivial test in linux-loader](https://github.com/rcore-os/zCore/pull/128)
- [#132 Add simple pipe syscall and unit test method for linux syscall](https://github.com/rcore-os/zCore/pull/132)
- [#142 Improve doc in linux-object and migrate some simple syscalls](https://github.com/rcore-os/zCore/pull/142)

在开始之前，相关单元测试仅仅使用了运行 busybox 作为一个简单的测试，并且不检测用户程序执行的返回值；

在这段时间中，我们添加了大量基于用户态程序的单元测试，并完善了相应测试代码，补全了用户态返回值判断和自动编译测试用例的部分，使得现在可以简单地通过这样的方法使用 c 语言对系统调用进行单元测试：

1. 在 linux-syscall/test 文件夹里面编写 c 语言的测试程序，可以使用 assert 函数判断是否正确；
2. 在 linux-loader 的 main.rs 里面可以这样写：

   ```rust
   #[async_std::test]
   async fn test_pipe() {
       assert_eq!(test("/bin/testpipe1").await, 0);
   }
   ```

3. 运行 `make rootfs` 命令
4. run test

三个模块的单元测试覆盖率变化如下：

- linux-loader  74.63 -> 87.88
- linux-syscall 18.68 -> 61.55
- linux-object  41.84 -> 56.17

除此之外，linux 相关三个模块的文档均已补齐，并均能通过 `#[deny(missing_docs)]` 编译，主要参考linux相关文档；另外也参与了一点 libc-test 移植相关的工作。

#### 完善文件系统和IO相关系统调用

具体修改和完善如下

- [#135 Add more time syscalls and fix touch command in busybox](https://github.com/rcore-os/zCore/pull/135)
  - 添加了时间相关模块（timeval timespec）和相关系统调用：
    - `time`( )
    - `gettimeofday`( )
    - `gettusage`( )
    - `times`( )
  - 添加了 utimensat 系统调用，使 touch 命令可以正常创建文件；

- [#142 Improve doc in linux-object and migrate some simple syscalls](https://github.com/rcore-os/zCore/pull/142)
  - 添加了 `sysinfo` 和 `flock` 系统调用；

- [#149 fix dynamic link path for envs in shell and add async poll in pipe](https://github.com/rcore-os/zCore/pull/149)
  - 部分修复了shell环境变量无法正常运行程序的问题；

- [#152 fix regression/rlimit-open-files.exe in libc-test](https://github.com/rcore-os/zCore/pull/152)
  - 添加了 `dup` 系统调用；
  - 添加了进程最大打开文件数量限制，以通过 libc-test 的相关测试；

- [#164 Add async select syscall](https://github.com/rcore-os/zCore/pull/164)
  - 添加了使用 async/await 的 `select` 系统调用；
  - 完善了 poll 和 select 系统调用的超时机制；

目前文件系统相关方面除了符号链接存在的问题和权限控制机制，以及 epoll 系统调用，应该已经基本完善；这部分也只是一些零碎的修补，一部分是根据队友反馈的问题进行bug的修复，一部分是对libc-test的测试结果的修复。

#### 完善进程间通信机制

1. 添加和完善 pipe 系统调用：
   - 添加了 `pipe` `pipe2` 系统调用，以及相关的文档和用户态单元测试；
   - 相关PR：
     - [#132 Add simple pipe syscall and unit test method for linux syscall](https://github.com/rcore-os/zCore/pull/132)
     - [#149 fix dynamic link path for envs in shell and add async poll in pipe](https://github.com/rcore-os/zCore/pull/149)

2. 信号量相关系统调用；
   - 在 linux-object::sync 中添加了信号量同步机制；
   - 添加了 `semget` `semop` `semctl` 系统调用，以及相关的文档和用户态单元测试（基于 libc-test）；
   - 相关PR：
     - [#156 Add semaphores syscalls](https://github.com/rcore-os/zCore/pull/156)

3. 共享内存相关系统调用；
   - 添加了 `shmget` `shmat` `shmdt` `shmctl` 系统调用，以及相关的文档和用户态单元测试（基于 libc-test）；其中 `shmctl` 在 rCore 中并未实现；
   - 相关PR：
     - [#160 Add shared memory ipc syscalls](https://github.com/rcore-os/zCore/pull/160)
  
目前 rCore 中已有的进程间通信机制已经全部完成移植，另外也修复和增添了一些功能；这一部分功能的添加主要是根据 man 手册和部分linux源代码实现的，同时也参考了相关的 libc-test 等等的用户态测试来实现系统调用的行为。

#### 致谢

非常感谢陈渝老师和向勇老师为我们提供这样一个学习交流的平台和机会，也感谢王润基学长细致耐心的指导、code review 和助教们的答疑解惑，以及我的队友们在这一过程中给我的帮助，比如很多用户态程序的编译工作也都依赖于李宇同学在前期的探索；

## 对实验的后续开发内容建议或设想

郑昱笙：

- symlink 系统调用尚未完成，需要硬件抽象层配合进行修复；
- 信号机制实现还不够完善，kill 系统调用还未实现；
- epoll 还未实现，要涉及到部分文件相关概念转换；
- 网络通信部分还未实现，但工作量比较大；
- 可以将 zCore 中部分已经重构或实现更完善的代码整合回 rCore 中；
- poll 和 select 也许可以尝试使用 select! 宏来完成；

李宇：

- 一些学长在 PR 中提出的改进方案还没有实施：
  - 文件的 `cloexec` 成员需移到 `Inner` 中，或改用 `AtomicBool` 类型
- 完整的 `sys_mmap` 还没有实现

## 实验总结

郑昱笙：

- 感觉收获好多
  - 对rust语言的理解更深入了一层
  - 良好的测试和文档能够显著地提高代码的开发效率，代码质量也非常重要；
  - 学到了大量关于linux操作系统机制和系统调用的知识；

李宇：

- 收获好多！
  - 学会了使用 `cargo fmt` 和 `cargo clippy` 控制代码质量
  - 学到了一些 Git 的使用方法
  - 学到了一些 GitHub 的使用方法
  - 学到了很多操作系统的知识

## 实验过程日志

链接：

- 李宇：[https://github.com/wfly1998/DailySchedule/blob/master/README_official.md](https://github.com/wfly1998/DailySchedule/blob/master/README_official.md)
- 郑昱笙：[https://github.com/yunwei37/os-summer-of-code-daily](https://github.com/yunwei37/os-summer-of-code-daily)
