---
title: mtul-rcore-第一二阶段总结
date: 2024-11-11 22:22:14
tags:
---
## 第一阶段 - rust基础与算法

由于我有rust基础，没有遇到什么困难，但还是第一次完整地做一次rustlings，有一定收获

## 第二阶段 - 专业阶段

### 实验环境配置

rcore开发的环境配置比较繁琐，而我恰好比较熟悉nix，因此我用nix定义的一个完美兼容rcore的开发环境。由于不需要 `rustup` ， 必须在 `os/Makefile` 中禁用 rust 环境的检测. `flake.nix` 如下：

```nix
{
  description = "rCore dev flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    oldnixpkgs.url = "github:NixOS/nixpkgs/7cf5ccf1cdb2ba5f08f0ac29fc3d04b0b59a07e4";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    nixpkgs,
    oldnixpkgs,
    flake-utils,
    rust-overlay,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [(import rust-overlay)];
      };
      oldpkgs = import oldnixpkgs {
        inherit system;
      };
    in {
      devShells.default = pkgs.mkShell {
        packages = with pkgs;
          [
            (rust-bin.nightly."2024-05-02".minimal.override {
              extensions = [
                "rust-src"
                "llvm-tools"
                "rustfmt"
                "rust-analyzer"
                "rust-docs"
                "clippy"
              ];
              targets = ["riscv64gc-unknown-none-elf"];
            })
            cargo-binutils
            python3
            gdb
            tmux
          ]
          ++ [oldpkgs.qemu];

        # 进入环境后显示rust和qemu版本
        shellHook = ''
          rustc --version
          cargo --version
          qemu-system-riscv64 --version
          qemu-riscv64 --version
        '';
      };
    });
}
```

这份 `flake.nix` 也已经分享到[官方问答论坛](https://opencamp.cn/os2edu/bbs/1391)

### 第一/二章

阅读这两章需要先了解riscv，特别是特权级相关设计。

主要参考:

- [RISC-V开放架构设计之道][1]
- [The RISC-V Reader: An Open Architecture Atlas][2] 前一个的英文原著，而且有能下载到单独的RISC-V Green Card，方便查阅
- [RISC-V Instruction Set Manual][3] 完整详细

### 第三章：多道程序与分时多任务

学习了系统调用，陷入等知识，上下文切换过程中通用寄存器和CSR的使用加深了我对riscv特权级设计的理解。

本章练习较为简单。

### 第四章：地址空间

SV39的设计又引入了若干相关的寄存器，如satp, pmp csr。查阅[riscv manul][3]以加深理解。

本章练习中，为了处理*请求映射已经被映射的页*的错误，我使用了`Result`错误传递，无法想象如果不使用`Result`和`?`语法糖我的代码会多么丑陋。然而很奇怪，整个rcore中极少使用`Result`。

### 第五章：进程及进程管理

本章内容比较轻松，完善了TCB的设计并实现`fork()`和`exec()`系统调用。

本章练习也比较简单。

### 第六章：文件系统

easy-fs is **NOT** easy！层层抽象几乎让我晕头转向！

尽管如此，easy-fs囊括了superblock、索引节点、blockcache等现代文件系统中的基础概念，似乎不能再精简了。

link和unlink操作主要是查找inode并创建/删除目录项。在inode_block里创建与删除目录项无非是一些线性序列的操作，但由于没有封装成`&[DirEntry]`，需要手动操作，比较费劲。将来有空我会尝试改进一下。

### 第七章：进程间通信

本章内容较少，但进程间通信是个大话题，还需拓展学习。

### 第八章：并发

学习了多线程的同步与互斥。

练习：学习了死锁检测算法

[1]: https://ysyx.oscc.cc/books/riscv-reader.html
[2]: http://www.riscvbook.com/
[3]: https://github.com/riscv/riscv-isa-manual

