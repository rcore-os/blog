---
title: 2023开源操作系统训练营第三阶段ArceOS总结报告-Tunglies
date: 2023-12-01 22:35:30
categories:
    - oscamp 2023fall arceos unikernel
tags:
    - author:Tunglies
    - 2023秋冬季开源操作系统训练营
    - 第三阶段总结报告
---

# 练习一&练习二

在我的 build script 中，用 dd 链接多个应用到 apps.bin。偏移 1MB。

```bash
dd if=hello_app.bin of=apps.bin bs=1M conv=notrunc
dd if=another_app.bin of=apps.bin bs=1M seek=1 conv=notrunc
```

从 `PLASH_START` 开始搜索，每次新的搜索偏移 1024 * 1024，搜索长度 1024。

设计缺陷，32M bin 最多存放 32 个应用，因为假设了每个应用都是 1MB 。

# 练习三

实现 `AppManager`，主要记录应用数、应用虚假长度（尾部无效0）和应用真实长度（去除尾部0）。虚假长度用来计算偏移，真实长度用来框定加载程序范围。载入过多无效 0 会导致执行错误。

循环 load_code copy `RUN_START+2*(app_num-1)`，`li t2 RUN_START+2*(app_num-1)` 执行。

# 练习四

修复练习三中的 `AppManager`，使其具备完整、正确的程序搜索、载入、循环执行。

根据本地文件搜索，发现存在 `axstd::process::exit` 实现 OS 退出。模仿实验再次封装成 `fn abi` 接口即可。

# 练习五

感谢unikernel实习交流群小伙伴 dram🎀 提供思路以及小伙伴 一个短篇 转发TA的思路。hello_app 执行多次样例程序会重复操作地址引发 panic。看 LOG 发现 a7 会一直变化，结合两位小伙伴提供的思路，`clobber_abi("C")` 并额外用临时寄存器存放和加载 abi_table。

# 练习六

查手册 `git@github.com:riscv-non-isa/riscv-asm-manual.git` 存在指令能够返回调用地址。所有 app 不再调用 `wfi` 阻塞， 且 `_start()` 最后执行 `asm!("jalr ra")` 返回到 loader 。

# ?

DDL是第一生产力。—— Tunglies 2023.12.02
