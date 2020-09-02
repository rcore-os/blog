---
title: zCore Summer of Code 2020 报告 by 车春池
date: 2020-09-02 23:00:00
categories: 
    - report
tags:
    - author:SKTT1Ryze
    - summerofcode2020
---

# zCore Summer of Code 2020 报告

华中科技大学  
计算机科学与技术  
车春池  
<!-- more -->
## 前言
本次实习的宗旨是：探索把现代系统语言Rust和灵活开放的系统结构RISC-V带入到操作系统的架构与设计的创新中来，思考未来的操作系统应该是什么样。  
rCore 是清华大学王润基学长用 Rust 写的第一个 OS，目前支持 x86_64，riscv，mips32 等架构，其中 x86_64 可以在真机上跑。rCore 上可以运行 linux 下的用户程序，支持 Nginx，GCC 等实际应用。  
zCore 是王润基学长起头开发的第二个 OS 项目，这也是一种尝试。Google 公司目前正在开发一个新的操作系统 Fuchsia，而 Fuchsia 的内核 zircon 是一个微内核。微内核区别于传统操作系统内核比如像 linux 内核这样的宏内核，它是一种新的操作系统内核设计方式。Google 公司打算用这个 Fuchsia 操作系统取代 Android 系统。而 zCore 是用 Rust 语言实现了 zircon 微内核的一个项目，因此 zCore 也是一个微内核。  
具体请看：[下一代 Rust OS： zCore 正式发布](https://zhuanlan.zhihu.com/p/137733625)   
**zCore 目前只支持 x86 架构（mips ？）**  

## 实验目标
移植 zCore 到 riscv。  
具体来讲就是在 riscv 架构下的虚拟机 qemu 中跑 zCore。  
实验代码仓库：[zCore-riscv](https://github.com/SKTT1Ryze/zCore-riscv)  

## 相关工作介绍
+ 在 zCore 的开发过程中，开发者已经考虑到将来可能要支持 riscv，架构相关的代码都做了标注，因此移植的工作很大一部分就是对这部分架构相关的代码添加 riscv 支持
+ 在 kernel-hal-bare 模块中，有一部分代码在 riscv 上已经实现了，这部分代码在 kernel-hal-bare/arch/riscv.rs 文件中
+ 最大的对移植工作的帮助来自于 rCore，上面讲到它支持 riscv 架构，它里面的各种实现都会给 zCore 到 riscv 的移植工作有很大帮助
+ 刘丰源学长曾将 zCore 移植到了 mips 架构上，虽然不清楚进展到了何种程度，但相信可以给移植工作带来助力

## 实现方案
+ 我们需要一个基于 OpenSBI 搭建运行环境 zCore-riscv
+ 一步步将原 zCore 中的模块移植到 riscv 的运行环境中
+ 为 zCore-riscv 添加测试模块
+ 在底层的模块中为架构相关的代码添加 riscv 支持（unimplemented!宏）
+ 在裸机环境下调用 loader 层（遇到了障碍）

## 具体实现方法
+ 参照 rCore-Toturial 来搭建基于 OpenSBI 的运行环境
+ 原 zCore 中 kernel-hal 等模块是作为一个个 crate，被 zCore 调用，而在新搭建的运行环境中是作为一个个 mod 来处理
+ 在 no_std 环境下的 Rust 项目想要使用单元测试的话，十分麻烦。因此添加了一个模块 fake_test 用于测试
+ 添加 #[cfg(any(target_arch = "riscv32", target_arch = "riscv64"))] 标注
+ 在 rust_main 函数中调用 loader 层封装的函数

## 当前遇到的障碍和解决思路
障碍：  
+ Fuchsia 官方目前不支持 riscv，而且将来可能也不打算支持 riscv
+ 当前运行环境的缺陷

解决思路： 
+ 放弃对接 Fuchsia && 转战 Linux 路线
+ 阅读 zCore 和 rCore 的 Makefile，理解它俩是怎么运行起来的，然后再考虑怎么改善这个简陋的运行环境

## 主要成果
在这个月的实习过程中，我做的成果就是搭建了一个基于 OpenSBI 的 zCore 运行环境，为后续的移植工作奠定了基础。  
目前这个运行环境的完成度：  
- [x] 运行环境
- [x] kernel-hal
- [x] kernel-hal-bare
- [x] zircon-object
- [x] zircon-syscall
- [x] zircon-loader
- [x] Memory (maybe)
- [x] Frame Allocator
- [x] linux-object
- [x] linux-syscall
- [x] linux-loader
- [x] fake_test
- [ ] ......  

## 后续工作的方向思路
+ 为底层代码添加 riscv 支持（阅读 riscv 官方文档和 rCore 中的实现）
+ 完善运行环境（阅读 rCore 和 zCore 的源码和 Makefile）（RustSBI？）
+ 加深对 Rust 语言本身的认识
+ 同步完善记录文档

## 实习感受
通过参加清华大学举办的这个 zCore 实习，我感觉收获到的东西远远超过了我的想象。首先是 Rust 语言，通过两个月的学习，我深深感受到了这个语言的潜力和优点，特别是在写操作系统和嵌入式上。然后是 riscv，这是一个我之前没有听说过的名词，现在我对它充满了兴趣，并会一直持续关注它的发展。还有就是 rCore 和 zCore，让我见识到了清华大学的老师和同学们是怎么对待操作系统这门学科的，不是局限于课本和理论知识，而是真正落实到代码上，去写一个 OS，并且在写的过程中不断探索新的东西。我十分佩服。最后就是认识到了两位清华大学的老师和一群热爱 Rust 和 OS 的同学们，在深圳的一周时间内和老师同学们相处得十分愉快，这是一段十分珍贵的回忆。  

