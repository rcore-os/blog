---
title: ArceOS_test_report_blog-Shl1015CS
date: 2025-11-15 17:23:23
tags:
---

## 引言

这篇博文记录了我在 LearningOS ArceOS 训练仓库中的调试历程：从基础的 `ramfs_rename`、`alt_alloc` 练习，到让 CI 里的 `simple_hv` 能稳定加载 `skernel2`，再到阶段性验收脚本 `verify_lab1.sh`。过程中频繁与 GitHub Actions 环境差异、虚拟机退出机制等问题斗智斗勇，现总结如下。

## 实验环境

- **仓库与分支**：LearningOS/2025a-arceos-Shl1015CS 的 `main`（练习）与 `lab1`（挑战）
- **宿主机**：Ubuntu 22.04，rustup stable toolchain
- **QEMU**：`qemu-system-riscv64`

## 任务拆解与进展

### 1. `print_with_color`：确认基础输出能力

- 目标：让 `print_with_color` 示例在串口中输出带 ANSI 颜色的 "Hello, Arceos!"。
- 方法：直接在 `main.rs` 中使用 `println!("\x1b[1;31m...")`，并确保 `axstd` 打印宏可用。
- 测试：运行 `./scripts/test-print.sh`，脚本通过检测转义序列与纯文本，判断是否既有颜色又有正确文案。

### 2. `support_hashmap`：验证 alloc+集合

- 目标：在内核环境下跑 `support_hashmap` 练习，完成 `Memory tests run OK!`。
- 关键点：提供稳定的堆内存来源，让 `alloc::collections::HashMap` 能频繁插入/删除。
- 测试：`./scripts/test-support_hashmap.sh` 构建磁盘镜像、运行练习并抓取最后一行输出，确保内存测试通过。

### 3. `sys_map`：实现用户态 `mmap`

- 目标：补全 `exercises/sys_map` 的系统调用接口，使用户态程序能够通过 `mmap` 映射文件，并读回 "hello, arceos!"。
- 难点：
  - 在内核侧为匿名/文件映射分配虚拟地址，维护 `VmArea` 元数据；
  - 当 `fd` 指向磁盘文件时，需将 payload（`payload/mapfile_c/mapfile`）写入 `disk.img` 并供客体访问；
  - 处理 `munmap` 与页对齐要求。
- 测试：`./scripts/test-sys_map.sh` 会先执行 `make payload && ./update_disk.sh ...`，再以 `BLK=y` 运行练习并搜索 "Read back content: hello, arceos!"。

### 4. `ramfs_rename`：递归重命名与特殊路径

- `axfs_ramfs` 的 `DirNode::rename` 仅支持同级结点，需要实现跨层级、处理 `.` `..` 的逻辑。
- 解决方案：在 `modules/axfs/src/root.rs` 中实现“复制 + 删除”策略，保证旧结点被正确删除并保留内容。
- 同时排查 `impl_vfs_dir_default!` 宏覆盖自定义实现的问题，最后确认修改入口正确。

### 5. `alt_alloc`：早期堆分配器

- 要求实现 `modules/alt_axalloc/src/bump_allocator.rs` 中的 `EarlyAllocator`。
- 重点在于字节对齐、页分配接口实现与统计函数（`total_bytes/used_bytes/available_bytes`）。
- 通过 `cargo test -p alt_axalloc` 与 `./scripts/test-alt_alloc.sh` 验证，确保早期分配器可用于内核初始化阶段。

### 6. `simple_hv`：CI 环境无法加载 `skernel2`

这是整个阶段最耗时的部分，核心需求：让 GitHub Actions 中的 `./scripts/test-simple_hv.sh` 通过。

### 7. `verify_lab1.sh`：阶段验收

- 命令：`cd arceos && ./verify_lab1.sh | tee tmpa.txt`
- 该脚本会重新生成镜像、构建 `labs/lab1`，并在 QEMU 中运行效验。
- 当前阻塞点：`lab_allocator` 中的 `LabByteAllocator` 尚未实现，导致 `panicked at labs/lab_allocator/src/lib.rs:20:9`。后续计划完善 bump allocator 以便完成 lab1。
