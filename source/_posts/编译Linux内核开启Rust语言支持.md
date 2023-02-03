---
title: 编译Linux内核开启Rust语言支持
date: 2023-02-01 09:57:25
categories:
    - report
tags:
    - author:shzhxh
    - Rust-for-Linux
---

#### 概述

我是在Debian 11下进行编译的，相信在其它的Linux发行版操作应该也没有问题，但没试过。

<!-- more -->

Rust-for-Linux组织的目标是为linux内核添加Rust支持，选择它提供的linux内核是为了得到更好的Rust支持。

使用Clang作为Linux内核的默认编译器，因为它和Rust一样，都是LLVM的前端，这会让Rust和C之间有更好的互操作性。

在X86_64和Aarch64下编译运行是成功的，但在Riscv64下还不能成功编译。然而这并非是Rust支持不够，而只是一个单纯的内核bug。相关情况可参考[lkml](https://lkml.org/lkml/2022/10/17/584)。

#### 操作记录

##### 安装依赖

```shell
git clone https://github.com/Rust-for-Linux/linux.git -b rust --single-branch
cd linux
# 从https://www.rust-lang.org安装rustup
rustup override set $(scripts/min-tool-version.sh rustc)	# rustc
rustup component add rust-src	# rust-src
sudo apt install clang llvm		# libclang
cargo install --locked --version $(scripts/min-tool-version.sh bindgen) bindgen	# bindgen
rustup component add rustfmt	# rustfmt
rustup component add clippy		# clippy
make LLVM=1 rustavailable		# 验证如上依赖安装无误，输出“Rust is available!”
```

##### 配置与编译

```shell
# for amd64
make LLVM=1 menuconfig
	# Kernel hacking -> Sample kernel code -> Rust samples 选择一些模块
make LLVM=1 -j

# for aarch64
make ARCH=arm64 CLANG_TRIPLE=aarch64_linux_gnu LLVM=1 menuconfig
make ARCH=arm64 CLANG_TRIPLE=aarch64_linux_gnu LLVM=1 -j

# for riscv64
# 注： meuconfig时关闭kvm模块，否则内核有bug不能成功编译
#make ARCH=riscv LLVM=1 menuconfig
#make ARCH=riscv LLVM=1 LLVM_IAS=0 -j
```

##### 运行

```shell
# 从https://people.debian.org/~gio/dqib/下载预编译好的debian，解压
# 把编译出的bzImage(或Image)复制到debian目录
# 参考readme，从qemu启动内核
# 注：对于riscv64,需要安装u-boot-qemu和opensbi
dsesg | grep rust	# 验证rust示例运行起来
```



#### 错误记录

1. 执行`make LLVM=1 rustavailable`出现`./scripts/rust_is_available.sh: 21:  arithmetic expression: expecting primary:`

   原因分析：在`rust_is_available.sh`里加`set -x`可发现是`bindgen_libclang_cversion`为空，因没有安装libclang引起的。

   解决方法：安装clang和llvm

2. menuconfig里没有找到Rust samples

   原因分析：在General setup -> Rust support没有选中，选中它即解决此问题。

3. 执行`make LLVM=1`提示`linker 'ld.lld' not found`

   原因分析：没有安装它，通过`sudo apt install lld`安装

4. 执行`make LLVM=1`提示`'libelf.h' file not found`和`'gelf.h' file not found`

   解决方法：`sudo apt install libelf-dev`

5. 执行`make ARCH=arm64 CROSS_COMPILE=aarch64_linux_gnu LLVM=1 -j`提示`unknown target triple 'aarch64_linux_gnu'`

   解决方法：使用`CLANG_TRIPLE=`

6. 执行`make ARCH=riscv LLVM=1 LLVM_IAS=0 -j`提示`ERROR: modpost: "riscv_cbom_block_size" undefined`

   原因分析：使用gcc也报同样的问题。这是内核bug，待修复。
   解决方法： 该错误出现在编译虚拟化模块kvm时出现，在内核配置中关掉这个模块即可: "Kernel-based Virtual Machine (KVM) support"
