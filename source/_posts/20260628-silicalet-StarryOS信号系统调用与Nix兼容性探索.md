---
title: 2026 春季训练营总结：StarryOS 信号系统调用测试与 Nix 兼容性
date: 2026-06-28 22:00:00
categories:
    - OSTraining
tags:
    - author:silicalet
    - repo:tgoskits
    - 2026S
    - StarryOS
    - 信号系统调用
    - Nix
    - ext4
---

<!-- more -->

**作者**: 王浩旸 (silicalet)
**仓库**: [rcore-os/tgoskits](https://github.com/rcore-os/tgoskits) | 个人 fork: [silicalet/tgoskits](https://github.com/silicalet/tgoskits)
**跟踪分支**: `001-starryos-signal-syscalls`、`002-starryos-nix-smoke`、`003-starryos-nixpkgs`

训练营这三条分支走下来，我最大的感受是：内核兼容性工作的难点不在写代码，而在搞清楚"问题到底是什么"。三次都经历了同一个循环——拿到一个模糊的现象，花大量时间排除自己以为是根因的方向，最后发现真正的问题在完全没料到的地方。

001 改测试不改内核，002 顺着 Nix 挂起追到 ext4 位图缓存，003 花了一周才搞明白"QEMU 退出码 0 不代表成功"。三条分支共用一套记录方式：Spec Kit 的 spec/plan/tasks/findings 管结构，本地 `./silicalet/` 目录存实验日志，不进 upstream。本文记的是从头到尾怎么走过来的，以及过程中那些走错的弯路。

---

## 001：只改测试，不改内核

001 的任务边界一开始让我有点不适应。spec 写得很死：本轮只改测试和文档，不动内核实现。对六个信号扩展系统调用做 readiness 评审，补齐源码级回归测试。

刚开始觉得这个约束像在限制产出。但做到一半就理解了。信号子系统的 bug 不会在功能测试里暴露，它藏在特定的时序、掩码组合、siginfo 元数据场景下。StarryOS 这些 syscall 在 dispatch 层都有实现，但用户态覆盖参差不齐——有几个甚至没有独立测试。如果不知道"当前行为是什么"就直接改内核，等于在黑暗里装修。先把"正确行为"用测试固化下来，后续谁动信号子系统，这些测试就是回归防线。

实际写测试时，最难的不是写断言，是确定"参考行为"。比如 rt_sigtimedwait 的 info 参数允许传 NULL，NULL 时 siginfo 不回写但信号仍被消费——这种细节 man page 一句话带过，Linux 内核为什么这么实现、StarryOS 的实现是否符合，得自己想清楚。每个 syscall 写一篇 beginner-oriented 笔记的过程逼着我把语义想透，比单写测试难得多。

六个测试在 Linux 参考环境下断言全过后，我想去 StarryOS 上验证，结果卡在一个完全无关的地方。grouped syscall case 按字母序执行，test-raw-msg-peek 排在我的 signal 测试之前，它的 prebuild 脚本在 staging rootfs 里跑 apk wrapper 时触发了 ELOOP，整个 grouped case 在预构建阶段就断了，根本到不了我的测试。

这个阻塞让我意识到一件事：源码级测试的隔离性在 grouped runner 里并不保证。测试本身写对了、Linux 参考过了，但 grouped case 的 prebuild 依赖链可能让它在 StarryOS 上根本跑不到。001 的交付因此是完整的——六个测试、分析文档、六篇笔记——但 StarryOS 侧的 expected-vs-observed 对照只能推迟到 prebuild 阻塞解除后。这是这一轮最大的遗憾。

---

## 002：从"Nix 挂起"到 ext4 位图缓存

002 的目标很小：让 Nix 在 StarryOS 上完成一个最小 derivation 构建。但从第一天起，现象就模糊得让人抓狂。

第一个阻塞是 Nix 启动直接 abort，报"saving parent mount namespace"。这个好查——Linux 基线显示 Nix 要访问 /proc/self/ns/mnt，Starry 的 procfs 没这个节点。加了之后 Nix 能启动了。

但 nix-build 随后挂在 build 阶段，日志只有一句"waiting for lock on /nix/store/..."。这个锁是 builder 自己创建的，不存在竞争，Linux 上一秒就完成。为什么 Nix 拿不到自己的锁？

面对这种模糊现象，最容易犯的错是直接猜根因改代码。我选了相反的策略：从离现象最近的层开始，每一层先证明它不是问题，再往下走。锁语义、进程创建、PTY、clone、execve——一层层查下来全 PASS。到第六层 flock 操作，终于出现红灯：两个不同的锁文件共享同一个 inode 号，flock 按 (device, inode) 键控，自冲突。再往下查一层，是 ext4 的 inode 分配器把同一个 inode 号分配了两次——第一次分配的位图更新丢了。

这个根因和我最初想象的方向差了十万八千里。如果一开始就猜"ext4 有问题"，我会在 ext4 几百个代码路径里盲目搜索。但七层排除下来，搜索空间被一步步缩小，最后落到 inode 分配器的位图缓存路径上。每一层 PASS 不是浪费时间，它们构成了"已排除清单"，让我在进入下一层时确信"锁语义、进程、PTY、clone、execve 都没问题，问题一定在更底层"。

修完 ext4 位图缓存之后，Nix smoke 还是没通。一个 bug 修完暴露出下一个，我前后修了六七个配套问题：PID namespace 孤儿进程回收、pipe EOF 事件上报、rsext4 删除仍被 fd 引用的 inode 时过早释放、unshare(CLONE_FS) 未支持、stale flock 进程退出后不释放。每一个单独看都不大，但叠在一起才让 Nix smoke 真正跑通。

这个过程中最让我印象深刻的是 rsext4 open-unlink 的设计。Nix 创建 .lock 文件后立刻 unlink，但仍然持有 fd 并通过 fd 写入。Linux 的语义是：unlink 只删除目录项，inode 在所有 fd 关闭后才释放。Starry 原来是删了就释放，导致 Nix 通过 fd 写入到一个已被回收的 inode。修这个需要对齐 Linux 的 i_links_count 和 i_count 双计数语义。这个设计不是我凭空想出来的——是对齐 Linux 已有语义的结果。

最后 nix-nosandbox 终于 PASSED 的那一刻，我盯着日志看了很久。从"waiting for lock"到完整的构建输出，中间隔了将近一周、七层插桩、六七个配套修复。一个最小 derivation 构建能跑通，背后是一整条兼容性链路的打通。

---

## 003：QEMU 退出码 0 是个谎言

003 在 002 基础上激活 nixpkgs 源码构建。这一轮我花时间最多的不是修 bug，是搞清楚"测试到底有没有失败"。

nixpkgs 测试的现象是：no-sandbox 阶段通过，Nix 开始下载解包 nixpkgs，没有 panic，没有失败标志，QEMU 退出码是 0。如果只看 runner，这像一次正常关机。但测试脚本的 EXIT trap 没执行，shell 不是通过正常退出离开的。这个细节一开始没引起我足够重视——我以为就是测试在某个点正常退出了，只是没打 pass 标志。

最先怀疑的是 OOM。但采样显示 nix 进程 RSS 才几十 MB，系统内存还有大半空闲。把 QEMU 内存从 2GB 加到 8GB，失败只是从 80 秒延后到 400 秒，仍然静默退出，退出时还有 3.8GB 空闲。加内存只延后了失败，没消除它。这不是简单的内存耗尽。

接下来一周我陷入了排除法的泥潭。在 StarryOS 已知的三个关机路径加诊断——PID 1 退出、primary panic、recursive panic——都没触发。我当时用排除法猜"是 page cache 回收期间的递归 panic"，在 panic 路径本身加诊断后直接被推翻：panic_shutdown 和 page_cache_reclaim 都没触发。排除法能缩小范围，但确认根因必须找到触发证据，不能靠"其他都不对所以这个对"。这是我这一轮最大的教训。

转折点是追踪 system_off 的调用链。QEMU 退出码 0 来自 someboot 的 x86_64 shutdown 函数往 0x604 端口写 0x2000，触发 QEMU Q35 的 ACPI S5 关机。顺着 system_off 的五个调用点查，前四个都排除了，第五个是 libc_compat 里的 abort()。在 abort 和 shutdown 加直接 COM1 端口写诊断，重新跑，两个标记都触发了。

原来 nix（C++ 二进制）遇到致命错误时，musl libc 调用 abort()。StarryOS 的 libc_compat 把 abort() 映射成 ax_terminate → system_off → QEMU 关机。QEMU 退出码 0 不是测试成功，是整机关机。

这个结论也推翻了"几 GiB free 就排除 OOM"的判断。进程 RSS 只描述用户进程映射，不代表内核 page cache 占用。真正增长的是脏页缓存——Nix 解包源码、构建 Git cache 时创建大量文件，没有周期写回时 dirty page cache 持续增长，挤压 Rust 全局分配器的堆空间，触发 rust_oom → abort。所以"free 还很多"是假象，因为我看的是错误的 free 指标。

修了两处：后台 worker 每五秒同步一次文件缓存，避免脏页无界增长；ax-alloc 的字节分配失败路径改为调用已注册的 page reclaim callback 后重试。修完之后静默关机不再出现。

但完整 nixpkgs 仍然没通过。89,704 个条目的 archive 在 StarryOS 上解压需要 6-7 分钟，远超 180 秒预算。试了加 vCPU、换压缩格式、用 tmpfs 绕过 ext4，都没改变三分钟结果——tar-to-Git-cache 这一步本质上是单线程的。

这里我差点犯一个错。Spec Kit 任务希望有一个 grouped system regression。我测了一堆合成 VFS workload，全通过，无法复现真实 nixpkgs 超时。如果用一个本来就通过的 benchmark 冒充红色回归测试，CI 会变绿但什么也防不住。最后我选择诚实记录"当前没有有效的小型红色复现"，而不是造假。未来合适的回归层级是 axfs-ng 的 bounded page-cache pressure 测试，不是把完整 nixpkgs archive 塞进普通 syscall suite。

---

## 回头看

三条分支走完，几个感受比较深。

**模糊现象是最难的起点。** Nix 挂起、QEMU 退出码 0、测试跑不到——这些现象本身不告诉你任何信息。002 的七层插桩和 003 的 abort 路径追踪都证明了同一件事：现象越模糊，越不能猜根因改代码，必须从离现象最近的层开始逐层排除。每一层 PASS 都是在缩小搜索空间。

**排除法会误导自己。** 003 我曾用排除法猜"recursive panic"，排除了三个已知路径就下结论，结果被下一轮诊断直接推翻。排除法只能排除你想到的路径，确认根因必须找到触发证据。

**观测指标要问覆盖范围。** 003 早期看到"几 GiB free"就排除 OOM，是错的——free 指标不覆盖 page cache。002 一开始想从 Nix 用户态日志找原因，但那里只有"waiting for lock"，看不到 inode 号。观测点选在哪决定了能看到什么。

**不为必须有回归测试造假。** 合成 workload 全通过时，诚实记录"当前没有有效复现"比造一个与根因无关的测试强。CI 变绿但防不住真正的 bug，是更糟糕的状态。

**本地笔记是调查记忆。** 三条分支的 silicalet/ 目录存了几十份实验日志，通过 .git/info/exclude 排除在 upstream 之外。002 从 NIX-SMOKE-001 到 NIX-SMOKE-011 每一步诊断都有记录，003 从 rev9 到 rev13 每一轮排除都有笔记。没有这些笔记，rev12 推翻 rev11 结论时，我可能都不记得 rev11 具体测了什么。切换上下文是常态，结构化笔记让调查可恢复。

---

## 交付状态

| 分支 | 交付 | 状态 |
| --- | --- | --- |
| 001 | 六个 C 回归测试 + 分析文档 + 六篇 per-syscall 笔记 | Linux 参考全过；StarryOS 验证被前置 case prebuild 阻塞 |
| 002 | ext4 位图缓存修复 + PID ns 孤儿回收 + pipe EOF + rsext4 open-unlink + unshare(CLONE_FS) + stale flock | nix-nosandbox PASSED |
| 003 | 周期 writeback + reclaim retry + 本地 store 闭包校准 | no-sandbox 通过；nixpkgs 受 180s 预算约束 |

---

## 致谢

感谢陈渝老师、周睿老师在训练营期间的指导。感谢交流群里的同学们，很多问题的思路是在讨论里逐渐清楚的。感谢开源社区，StarryOS、ArceOS、Linux 这些项目背后无数开发者的工作让后来者能站在巨人肩膀上学习。

---

*报告日期：2026-06-28*
