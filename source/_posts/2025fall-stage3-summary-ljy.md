---
title: 2025fall-stage3-summary-ljy
date: 2025-11-16 17:54:25
tags:
    - author: liulog
    - repo: https://github.com/LearningOS/2025a-arceos-liulog
---

> 对 rcore 早有耳闻，曾报名了 23 年秋冬的训练营，但是当前初学 rust、初学 riscv 等缺少了一种毅力，25 年秋冬重新报名参加，有所学、有所获。
>
> 虽然我是虚拟化方向的研究生，但是对于操作系统中的很多概念等停留在理论阶段，尤其在接触到了 rcore 之后，发现本科学的操作系统只是浮在表面的那一层，如今接触 rcore，做了一些实验，进一步加深了对操作系统的敬仰。
>
> 虽然走到了这里，但是对于 rcore 的很多非实验的部分的理解还不够，还需要好好地梳理，这里对 stage-3 arceos 实验进行总结。

#### 前言

实验涉及 unikernel、宏内核、hypervisor，但是明显感觉到 stage3 实验更多得是对组件化操作系统的上手。

其中很多实验并不像 rcore 中的那样复杂，比如 print_color、simple_hv，可能一点点代码就能通过测例，更重要的是理解其组件化的思想，可以快速构建异构内核的能力，unikernel、宏内核、hypervisor，把他们的共同点抽离出来，封装成一个个组件，可以实现快速的内核定制。

下面说一下遇到的一些问题：

#### hashmap

起初，我通过 hashbrown 引入第三方的实现，发现并未涉及视频中提到的随机数，通过查找资料以及翻阅 std 下的 hash_map 实现。最终决定使用 hashbrown 下的 HashMap::with_hasher，并选择 foldhash 下的 FixedState::with_seed 提供一个哈希计算，其中 seed 通过 axhal 下的 random 生成。

#### ramfs_rename

最开始，发现怎么改动都不生效，arceos 的实验使用了 workspace，这个在之前我从未接触，最终发现是 ramfs_rename 对应的这个内核的 Cargo.toml 文件依赖的不是 workspace 中的 axfs_ramfs 导致。
除此之外，还有修改 axfs 下的 Cargo.toml。

#### sys_mmap

从文件中映射到内存中，分三步走，在虚拟地址空间找一个空闲虚拟页，借助 uspace.find_free_area，借助 uspace.map_alloc 进行预填充的分配，即完成虚实映射，然后将文件读到改页。
如果使用刚刚分配的虚拟地址可以读，但是会出现异常，比如权限不足，需要转到内核虚拟地址进行读写，这里通过 phys_to_virt 将物理地址转到内核到虚拟地址，随后通过 sys_read 这个 api 完成文件的读取。

#### 其他

自我感觉对于 rcore 的掌握还不到家，目前仅仅是通过了测例而已。

rcore 的文档和代码常读常新，能加深操作系统的理解。