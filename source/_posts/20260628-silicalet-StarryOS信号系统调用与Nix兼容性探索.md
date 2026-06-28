---
title: StarryOS 内核开发实践：信号系统调用测试、Nix 兼容性与 ext4 调试——2026 春季训练营总结报告
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
**训练营时间**: 2026-05 — 2026-06

---

## 摘要

本次训练营在 StarryOS（基于 ArceOS 的 Linux 兼容内核）上完成三个 feature 分支的工作，按时间线依次为：信号扩展系统调用的测试覆盖（001）、Nix smoke 兼容性验证（002）、nixpkgs 源码构建支持（003）。

三个分支的技术性质差异很大：001 是纯测试与文档工作——不改内核一行代码，为 6 个信号系统调用补齐源码级回归测试；002 是应用驱动的内核调试——从 Nix 启动失败追到 ext4 inode bitmap cache 的位图更新丢失；003 是性能与内存回收——定位"QEMU 正常退出"实为 Rust 全局分配器 OOM 后 `abort()` 触发整机关机。

本文的核心技术故事来自 002 分支：Nix smoke 在 store lock 阶段挂起，经过 7 层逐级插桩（锁语义→进程创建→PTY→clone→execve→flock→inode 分配器），最终定位到 ext4 inode bitmap cache 在连续 `alloc_inode()` 之间丢失了位图更新，导致两个不同文件共享同一个 inode 号，flock 自冲突，Nix 永远拿不到 output lock。这个调试过程的方法论——"每一层都先 PASS 再排除，不跳层"——是训练营期间最有价值的收获之一。

**核心发现**：在 OS 内核调试中，"观测手段自身污染观测值"是比"内核 bug"更常见的根因类别。001 教会我"测试先行"如何在不动内核的情况下建立行为基线；002 教会我"七层插桩"如何把一个模糊的"Nix 挂起"收敛到具体代码行；003 教会我"QEMU 退出码 0 不等于成功"——`abort()` 在 StarryOS 中被映射成整机 `system_off()`。

| 分支 | 目标 | 核心成果 |
| --- | --- | --- |
| `001-starryos-signal-syscalls` | 6 个信号扩展 syscall 的测试覆盖 | 6 个 C 回归测试，Linux 参考环境 96 条断言全通过；StarryOS 验证被前置 case 的 prebuild 阻塞 |
| `002-starryos-nix-smoke` | Nix smoke 跑通 | 定位 ext4 inode bitmap cache bug；修复 `/proc/self/ns/mnt`、pipe EOF、pidfd readiness、PTY peer-close、rsext4 open-unlink、`unshare(CLONE_FS)` |
| `003-starryos-nixpkgs` | nixpkgs `stdenv.mkDerivation` 源码构建 | 定位静默 OOM 关机根因（dirty page cache 挤压 Rust allocator）；修复周期 writeback + reclaim retry；完整 nixpkgs 仍受 180 秒预算约束 |

---

## 一、背景：三个分支的定位与分工

StarryOS 是构建在 ArceOS 模块化内核之上的 Linux 兼容内核，目标是让未经修改的 Linux 用户程序直接运行。训练营的工作在 [#580](https://github.com/rcore-os/tgoskits/issues/580) 及后续 issue 中拆为多条线，我承担了其中三条：

1. **001 信号扩展系统调用** — 对 sigaltstack、rt_sigtimedwait、rt_sigsuspend、rt_sigqueueinfo、rt_tgsigqueueinfo、rt_sigreturn 6 个 syscall 做 readiness 评审，补齐源码级回归测试。约束：本轮只改测试和文档，不动内核实现。
2. **002 Nix smoke** — 让 Nix 在 StarryOS 上完成最小 derivation 构建。每个被 Nix 暴露的 StarryOS 行为缺口，能隔离成源码级回归测试的就必须隔离，不能隔离的文档化根因。
3. **003 nixpkgs** — 在 002 基础上激活 stdenv.mkDerivation 源码构建路径，暴露更深层的兼容性问题。

三个分支共享同一套方法论：Spec Kit 驱动的 spec.md / plan.md / tasks.md / findings.md 结构化记录，本地 ./silicalet/ 目录保存实验日志和过程笔记（不入 upstream），每一步调查都记录触发条件、诊断、决策、验证、影响和 upstream 同步状态。

---

## 二、中心故事：ext4 inode bitmap cache 与 Nix store lock 的七层追踪

这是训练营期间技术深度最高、方法论收获最大的调试经历。Nix smoke 在 store lock 阶段挂起，表面现象极其模糊——"Nix 跑到一半不动了"。最终的根因是 ext4 文件系统的一个 bitmap cache 一致性 bug。

### 2.1 现象：Nix smoke 挂在 store output lock

002-starryos-nix-smoke 的核心目标是让 nix-build 完成一个最小 derivation。在修复了 /proc/self/ns/mnt 缺失（NIX-SMOKE-001）后，Nix CLI 能正常启动，但 nix-build 卡在 build 阶段：

```text
NIX_SMOKE_PHASE_INSTALL_DONE
NIX_SMOKE_PHASE_NIX_BEGIN
nix (Nix) 2.31.5
NIX_SMOKE_PHASE_NIX_DONE
NIX_SMOKE_PHASE_BUILD_BEGIN
waiting for lock on /nix/store/d9rsfj28...-nix-smoke
（120 秒后 timeout 中断）
NIX_SMOKE_BUILD_EXIT=1
```

nix-build 在等待自己的 output lock——这在 Linux 上不应该发生，因为 output lock 是 builder 自己创建的，不存在竞争。

### 2.2 调查策略：逐层排除，不跳层

面对"Nix 挂起"这种模糊现象，最容易犯的错误是直接猜测一个"看起来合理"的根因然后改代码。我选择了相反的策略：**从离现象最近的层开始，每一层都先证明它不是问题，再进入下一层。** 一共设计了 7 层插桩：

| # | 层 | 方法 | 结果 |
| --- | --- | --- | --- |
| 1 | 锁语义 | test-fcntl-lock-lifecycle（4 场景） | ALL PASS，锁语义本身正确，排除 |
| 2 | 进程创建 | test-nix-builder-lifecycle（3 场景） | ALL PASS，fork+exec 基本路径正常 |
| 3 | PTY 操作 | test-pty-openpt（7 检查） | ALL PASS，/dev/ptmx 工作正常 |
| 4 | clone 系统调用 | clone.rs 加 warn | vfork 发生，clone(NEWPID) 从未被调用 |
| 5 | execve 系统调用 | execve.rs 加 warn | nix-build exec 成功，之后 120 秒静默 |
| 6 | flock 操作 | lock.rs 加 warn | **同一 inode (1,4782) for two files, EWOULDBLOCK** |
| 7 | inode 分配器 | bmalloc/inode.rs 加 warn | **4782 to 4783 to 4782, bitmap update lost** |

### 2.3 第 6 层的突破：flock 自冲突

前 5 层全部 PASS，到第 6 层终于出现红灯。lock.rs 的 warn 日志显示：

```text
fd=10 flock_op LOCK_EX|LOCK_NB to DONE inode=(1,4782)      <- drv.lock
fd=11 flock_op LOCK_EX|LOCK_NB to EWOULDBLOCK inode=(1,4782) <- output.lock (SAME inode!)
```

两个不同文件（cw512gic...-nix-smoke.drv.lock 和 d9rsfj28...-nix-smoke.lock）共享同一个 inode (1, 4782)。flock(2) 按 (device, inode) 键控，Starry 把两个文件的锁当作同一把锁，于是自冲突。

### 2.4 第 7 层：inode 分配器的 bitmap 丢失

继续向下追，在 bmalloc/inode.rs 的 alloc_inode 加 warn 后捕获到：

```text
72.437: alloc_inode, group=0 idx=4781 global=4782  <- drv.lock (correct)
72.438: alloc_inode, group=0 idx=4782 global=4783  <- drv file (correct, sequential)
72.478: alloc_inode, group=0 idx=4781 global=4782  <- output.lock (REUSE!)
```

分配器正确地按 4782 到 4783 顺序分配，但第三次分配重新使用了 4782——第一次分配的 bitmap 更新被丢失了。

**根因**：components/rsext4 的 ext4 inode bitmap cache 在连续 alloc_inode() 调用之间丢失了位图更新。第一次 alloc_inode() 设置了 bit 4782 并标记 dirty，但在 cache eviction 或 journal commit 之前，第二次 alloc_inode() 读到的 bitmap 缺少第一次的更新，于是把 4782 再次分配出去。

### 2.5 方法论收获

这个调试过程的方法论价值远高于 bug 本身：

1. **不跳层**：如果直接跳到"ext4 有问题"，就会在 ext4 的几百个代码路径里盲目搜索。7 层插桩把搜索空间从"整个文件系统"缩小到"inode 分配器的 bitmap cache 路径"。
2. **每一层先 PASS 再排除**：前 5 层全部 PASS 不是浪费时间——它们构成了"已排除清单"，让我在进入第 6 层时确信"锁语义、进程、PTY、clone、execve 都没问题，问题一定在更底层"。
3. **观测要精准**：warn 加在 flock_op 上直接暴露了 inode 复用；如果加在更高层（如 Nix 用户态日志），永远看不到 inode 号。**观测点要选在语义边界上，而非调用链的任意位置。**

### 2.6 修复与配套工作

修复方向是 components/rsext4/src/ext4/alloc.rs 的 alloc_inodes() bitmap cache 更新路径，以及 components/rsext4/src/cache/bitmap.rs 的 modify() / evict_lru() 交互。验证回归测试：在同一目录下连续创建两个文件，通过 fstat() 验证 inode 号唯一。

在 ext4 inode bitmap 修复之外，Nix smoke 完整跑通还需要几个配套修复（见 silicalet/002-nix-smoke.md 的 NIX-SMOKE-011 记录）：

- **pipe EOF** 必须以 EPOLLIN 可读事件上报，否则只监听 EPOLLIN 的 epoll 循环会漏掉 EOF
- **pidfd readiness** 必须与进程退出 readiness 一致
- **PTY peer-close** 和 line-discipline 缓冲不能丢 builder setup sentinel
- **rsext4 open-unlink**：删除 .lock inode 时不能立即释放——Nix 仍持有 fd 并通过 fd 写入；pending_unlink 需要配合 live_refs 引用计数，匹配 Linux 的 i_links_count / i_count 双计数语义
- **unshare(CLONE_FS)**：Nix 下载线程调用的是 unshare(CLONE_FS) (0x200) 而非 CLONE_NEWNS (0x20000)，原 SUPPORTED_NS_FLAGS 未包含 CLONE_FS，添加后 nixpkgs stdenv bootstrap 解除阻塞

pending_unlink 的设计值得单独记录，因为它涉及 ext4 与 Linux 语义的对齐——live_refs 对应 Linux 的 i_count（内核引用），zero_link 对应 i_links_count（目录项计数）。unlink() 标记 zero_link，若无 live refs 则立即 free_inode，否则延迟到 Inode::drop。被否决的替代方案：全局 inode cache + Weak<Inode>（正确但 PR scope 过大）；Arc::strong_count 启发式（脆弱，cache/临时查找会误判）。**这个设计不是凭空想出来的——它是对齐 Linux 已有语义的结果。**

---

## 三、信号系统调用：测试驱动的语义对齐（001）

001 分支的工作性质与 002 完全不同：不动内核一行代码，只为 6 个信号扩展 syscall 补齐源码级回归测试。这在训练营中看起来"最不出活"，但它建立了一套行为基线，让后续的内核改动有据可依。

### 3.1 为什么"只改测试"

信号子系统的 bug 有一个共同特征：它们不会在功能测试中暴露，只在特定的时序、掩码组合、或 siginfo 元数据场景下才出现。StarryOS 的信号 syscall 在 dispatch 层都有实现，但用户态覆盖参差不齐——rt_sigsuspend、rt_sigqueueinfo、rt_tgsigqueueinfo 甚至没有独立测试。

在不知道"当前行为是什么"的情况下改内核，等于在黑暗中装修。所以 001 的 spec 明确规定：**本轮只改测试和文档，内核改动等用户逐个 syscall 选择后再做。**

### 3.2 六个 syscall 的测试设计

每个 syscall 的测试都参照 Linux kselftest 风格，先用正常参数验证功能，再用非法参数验证 errno：

| syscall | 测试重点 | Linux 参考断言数 |
| --- | --- | --- |
| sigaltstack | 查询、设置、禁用、禁用时 old_ss 回填、非法参数、SA_ONSTACK 备用栈行为 | 42 |
| rt_sigsuspend | 临时 mask 替换、handler 唤醒、返回 -1/EINTR、旧 mask 完整恢复、唤醒信号不残留 pending | 13 |
| rt_sigqueueinfo | 进程定向排队、siginfo_t 的 si_code/si_pid/si_uid/value 保真、非法 signo、已退出 pid | 8 |
| rt_tgsigqueueinfo | 线程定向投递、tgid/tid 校验、非法 signo、目标线程收到完整 siginfo_t | 14 |
| rt_sigtimedwait | timeout、非法 timeout、pending signal 消费、info == NULL、siginfo_t 回写、消费后不重复返回 | 10 |
| rt_sigreturn | handler 返回用户态后恢复当前信号和 action mask 对应的 signal mask | 9 |

所有 6 个测试在 Linux 参考环境（Linux nixos 7.0.7-zen2 x86_64）下全部通过，共 96 条断言。

### 3.3 时序敏感测试的确定性约束

rt_sigtimedwait 和 rt_sigsuspend 天然涉及时序——如果依赖外部 CI timeout，失败会是"ambiguous hang"，无法定位。所以每个时序敏感场景都必须**在测试内部设置不超过 30 秒的 timeout，并断言 timeout 行为本身**（如 rt_sigtimedwait 超时必须返回 EAGAIN，而非被外部 KILL）。

这个约束来自 spec 的 clarification session：外部 timeout 产生的是"不知道为什么失败"的日志；内部 timeout 产生的是"知道它按预期超时了"的断言。两者在调试价值上天差地别。

### 3.4 StarryOS 验证的阻塞

6 个测试在 Linux 参考环境全通过后，在 StarryOS 上的验证却被一个**无关的前置 case** 阻塞：

```text
test-suit/starryos/qemu-smp1/system/syscall-test-raw-msg-peek/c/prebuild.sh: line 4: apk: Symbolic link loop
```

grouped syscall case 按字母序执行，test-raw-msg-peek 排在 signal 测试之前，它的 prebuild.sh 在 staging rootfs 中通过 qemu-user 执行 apk wrapper 时触发 ELOOP，导致整个 grouped case 在预构建阶段就中断，根本执行不到 signal 测试。

这个阻塞揭示了一个工程现实：**源码级测试的隔离性在 grouped runner 中并不保证。** 单个测试写好了、Linux 参考通过了，但 grouped case 的 prebuild 依赖链可能让它在 StarryOS 上根本跑不到。001 的交付因此完整——6 个测试 + 分析文档 + per-syscall 学习笔记——但 StarryOS 侧的 expected-vs-observed 对照被推迟到 prebuild 阻塞解除后。

### 3.5 per-syscall 学习笔记

spec 要求为每个改进的 syscall 写一篇 beginner-oriented 的 Markdown 笔记，解释：目的、预期行为、测试场景、观察到的失败或保护的风险、调查路径、修复或仅测试的推理、验证结果。6 篇笔记放在 docs/docs/development/starryos-signal-extension-syscalls/ 下。

写笔记的过程让我意识到：**"写清楚一件事情比做清楚一件事情更难"。** rt_sigtimedwait 的 info == NULL 参数路径——什么时候允许 NULL、NULL 时 siginfo 不回写但信号仍然被消费——这种细节在写测试时是"按 man page 实现就行"，但写笔记时必须解释"为什么 man page 这么规定、Linux 内核为什么这样实现、StarryOS 的实现是否符合"。回答这些问题的过程，本身就是对语义理解的强制检验。

---

## 四、nixpkgs 源码构建：静默 OOM 与内存回收（003）

003 分支在 002 基础上激活 stdenv.mkDerivation 源码构建。这个分支的核心故事不是"又修了几个 bug"，而是"一个看似正常退出的 QEMU 实际上是 OOM 关机"。

### 4.1 危险的假象：QEMU 退出码 0

nixpkgs 测试最初的现象是：

1. no-sandbox smoke 通过
2. Nix 开始下载或解包 nixpkgs
3. 没有 panic，没有失败标志
4. QEMU 退出码是 0

如果只看 runner，这像一次正常关机。实际上，测试脚本连 EXIT trap 都没有执行，说明 shell 不是通过普通信号或正常退出离开的。

### 4.2 从退出路径反推关机原因

为了判断是谁触发了关机，我在几个关键路径加入直接 UART 输出：用户任务 do_exit()、init task 的 exit_current()、panic 和 abort 路径、最终的 poweroff 路径。最终捕获到的调用链是：

```text
std::alloc::rust_oom
  -> std::process::abort
  -> libc abort()
  -> ax_terminate
  -> system_off
  -> QEMU ACPI S5
```

因此，QEMU 的 0 退出码不表示测试成功，而是 StarryOS 把用户态 abort() 处理成了整机关闭。真正触发 abort 的，是 Rust 全局分配器 OOM。

这个结论也推翻了早期"还有几 GiB free，所以不是 OOM"的判断。进程 RSS 只描述用户进程映射，不能代表内核中 page cache 的占用。

### 4.3 真正增长的是脏页缓存

Nix 解包源码、构建 Git cache 时会创建大量文件。没有周期写回时，dirty page cache 持续增长，最终把可供内核堆使用的内存挤空。

对照实验非常明确：

- 不主动同步时，内存持续上涨，最终进入 allocator OOM
- 前台周期执行 sync 时，内存维持在约 170—280 MiB
- 把 QEMU 内存从 2 GiB 加到 8 GiB 只能延后失败，不能消除增长趋势

最终修复方向包括两部分：

1. StarryOS 后台 worker 每五秒执行一次文件缓存同步，避免 dirty cache 无界增长
2. ax-alloc 的字节分配失败路径调用已注册的 page reclaim callback 后重试，使它与页分配的恢复模型一致

修复后，原来的"无标志静默关机"不再出现。测试可以在 180 秒边界输出明确失败原因。

### 4.4 OOM 修复后仍未通过：性能预算

修复 correctness 问题，并不意味着性能目标自动满足。完整 nixpkgs archive 共 89,704 个条目（52,657 文件 + 37,044 目录，展开约 322 MiB）。Linux 宿主上遍历约 0.41 秒、解压约 0.81 秒；StarryOS 上 BusyBox tar 约每 30 秒推进一万个条目，线性估算需要 6—7 分钟，远超 180 秒预算。

为了寻找可放入回归套件的小型复现，我测试了：

- 单目录创建 10,000 个文件
- 深目录下对 50,000 个文件执行 chmod、chown、utimensat
- tmpfs 顺序写入 192 MiB
- 创建 90,000 个一字节文件并记录阶段进度

这些基础操作都呈近似线性，无法复现真实 tar 的 180 秒超时。因此**没有把一个"本来就通过"的合成 benchmark 冒充红色回归测试**——诚实记录"当前没有有效的小型红色复现"比提交一个与根因无关的测试更有价值。

### 4.5 本地 store 预热的一致性要求

最新实验将本地 Nix store 作为 ext4 镜像注入 guest。第一次失败并非 Nix，而是外层 rootfs 只有 1 GiB：注入后的 1.3 GiB 稀疏文件只有长度、没有数据块，挂载时返回 I/O error。把每个 app 的 rootfs 扩到 3 GiB 后，内层 store 可以挂载。

随后又发现，预热闭包与 guest 当前 nixpkgs 快照并不一致：旧闭包包含 glibc 2.42-67，而 guest 实际请求 glibc 2.42-61。Nix 因此回退到 cache.nixos.org，最终写满内层镜像。

这说明"本地有一份 stdenv"还不够——Nix store 路径包含完整输入哈希，源码快照、平台、配置任何一项不同，闭包就无法复用。当前工作正在重新生成与 guest derivation 完全一致的本地闭包。

---

## 五、量化成果

### 5.1 三个分支的交付状态

| 分支 | 交付物 | 状态 |
| --- | --- | --- |
| 001 | 6 个 C 回归测试 + 分析文档 + 6 篇 per-syscall 笔记 | Linux 参考 96/96 PASS；StarryOS 验证被前置 case prebuild 阻塞 |
| 002 | ext4 inode bitmap cache 定位 + NIX-SMOKE-001/008/009/011 修复 + 7 层插桩证据链 | nix-nosandbox PASSED；nix-nixpkgs 解除 CLONE_FS 阻塞 |
| 003 | 静默 OOM 根因定位 + 周期 writeback + reclaim retry + 本地 store 闭包校准 | no-sandbox 阶段通过；nixpkgs 阶段受 180s 预算约束 |

### 5.2 Nix smoke finding 编年

| Finding | 现象 | 根因 | 状态 |
| --- | --- | --- | --- |
| NIX-SMOKE-001 | nix --version abort | saving parent mount namespace | /proc/self/ns/mnt 缺失 | fixed |
| NIX-SMOKE-002 | tiny nix-build hangs after NIX_DONE | unshare ENOSYS（PR #981 合并前） | superseded |
| NIX-SMOKE-003 | apk update DNS transient | guest 网络/package flake | not-kernel |
| NIX-SMOKE-004 | post-merge sandboxed nix-build 300s timeout | namespace 状态/任务继承 | classified |
| NIX-SMOKE-005 | Scheme A mount ns 仍 hang | 进程生命周期/child-reap | superseded |
| NIX-SMOKE-006 | wait4 signal interruptibility | 不是当前 blocker | not-reproduced |
| NIX-SMOKE-007 | unsandboxed tiny build waits on store lock | store lock 归属/builder 完成 | classified |
| NIX-SMOKE-008 | PID namespace orphan reaping gap | subreaper chain + zap_pid_ns_processes | fix-implemented |
| NIX-SMOKE-009 | pipe EOF readiness gap | pipe poll readiness | implemented |
| NIX-SMOKE-010 | post-pipe nix-build still in poll_wait | builder-lifecycle/fd-cleanup | classified |
| NIX-SMOKE-011 | Nix smoke passes after pipe/pidfd/PTY/rsext4 fixes | 4 个配套修复 | resolved |

### 5.3 测试基础设施统计

- 001：6 个 C 测试文件，96 条断言，Linux 参考 100% 通过
- 002：7 个聚焦回归测试（test-fcntl-lock-lifecycle、test-nix-builder-lifecycle、test-pty-openpt、test-open-unlink-write、test-pipe-poll-close、test-pidfd-poll-exit、test-unshare-fs）
- 003：4 类合成 VFS workload（单目录万文件、深目录 chmod/chown/utimensat、tmpfs 顺序写、9 万一字节文件）+ nix-smoke-nosandbox/nixpkgs app-level case

---

## 六、经验与教训

### 6.1 先验证观测手段，再怀疑内核

002 的七层插桩和 003 的 abort 路径追踪都证明了同一件事：**在 OS 内核调试中，观测手段自身往往是 bug 的一部分。**

- 002 中，flock 的 warn 日志暴露了 inode 复用——如果观测点选在 Nix 用户态，永远看不到 inode 号
- 003 中，QEMU 退出码 0 不是成功——abort() 被 StarryOS 映射成 system_off()，观测手段（退出码）本身在说谎
- 003 中，"几 GiB free"的 free 指标不覆盖 page cache——观测指标的范围决定了它能发现什么

正确的方法是：在解释数字之前，先问"这个指标覆盖哪些内存、遗漏哪些缓存、在哪个分配器失败"。

### 6.2 测试先行：不动内核也能建立行为基线

001 的 spec 规定"只改测试和文档，不动内核实现"。初看这个约束像是在限制产出，但它实际上建立了一套行为基线：6 个测试在 Linux 参考环境 96 条断言全通过，这就是"正确行为"的具象化。后续如果有人改 StarryOS 信号子系统的实现，这 96 条断言就是回归防线。

如果一开始就改内核，就永远不知道"改之前的行为是什么"——而不知道改之前的行为，就无法判断改动是否引入了 regression。**测试先行的价值不在于"测试本身能发现 bug"，而在于"测试定义了什么算 bug"。**

### 6.3 不为"必须有回归测试"制造假复现

003 中，Spec Kit 任务原本希望把 nixpkgs 的 OOM 问题缩减成 grouped system regression。但实验表明，小型 VFS workload 都通过，只有完整的近九万条目 archive 能稳定表现剩余性能问题。

这种情况下，诚实地记录"当前没有有效的小型红色复现"，比提交一个与根因无关的测试更有价值。未来更合适的回归层级，是 axfs-ng 的 bounded page-cache pressure 测试，而不是把完整 nixpkgs archive 塞进普通 syscall suite。**一个"本来就通过"的合成 benchmark 不能冒充红色回归测试——它只会给假阳性安全感。**

### 6.4 Spec Kit 的价值是限制结论，不是生成代码

三个分支共享的 Spec Kit 方法论，最有价值的地方不是生成代码，而是不断提醒我：

- 只有日志支持的事实才能写进结论
- setup blocker 不能冒充 kernel gap
- host pass 不能替代 guest pass
- timeout 不能被描述成 hang，除非证明没有进度
- 当前未通过，就不能因为主体功能已写完而标记完成

代码会变化，分支会同步上游，诊断假说也会被推翻。结构化记录让这些变化仍然可以追踪。本地 silicalet/ 目录保存了几十份实验日志和阶段记录，被 .git/info/exclude 排除在上游提交之外——它相当于调查日志本：失败的假说不会污染最终代码，但也不会在下一次切换上下文时丢失。

### 6.5 每个阶段写 blog，不要拖

训练营第一周我完成了 001 的信号系统调用测试，当时的细节还很清晰——rt_sigtimedwait 的 info == NULL 语义、rt_sigsuspend 的 mask 恢复时序、sigaltstack 的 SA_ONSTACK 交互。如果能在那时趁热写一篇 blog，不仅是给社区留下参考资料，更是对自己理解的一次强制检验。

但我没有。我把 blog 拖到了训练营最后。结果是：6 月中下旬期末考试和各种实验同时压上来，001 的设计细节已经模糊了，只能靠着 spec.md 和 findings.md 来反推当时的决策。**每个阶段结束时写 blog，把 blog 当成阶段交付物的一部分，而不是事后补的作业。**

---

## 七、AI 协作：放大器，不是替代品

本次训练营的主要生产工具是 AI（Cursor + Claude CLI + ChatGPT Web）。真实情况是三者在不同阶段犯错、也在不同阶段起到了不可替代的作用：

- **Cursor autocomplete**：在 C 测试用例编写时提供了大量骨架代码，但也随手写了不符合 kselftest 风格的断言——它不知道"errno 必须逐条对照 man page"
- **Claude CLI**：在内核代码搜索、tracepoint 插桩、日志 pattern 识别上远超人工速度——但它会在 7 层插桩的第 2 层就跳到"ext4 有问题"
- **ChatGPT Web**：擅长规划结构化调查框架（如 7 层排除清单），但不擅长从具体 warn 日志中推断 inode 复用

人的不可替代部分：

- **物理世界验证**：在 QEMU 上跑测试、读串口输出、对照 Linux 基线——AI 只能生成命令，不能确认结果
- **判断什么是不可能的**：知道 smp=1 意味着不存在跨 CPU 并发；知道 flock 按 (device, inode) 键控——这些是领域知识，不是 prompt 技巧
- **决定观测点选在哪里**：flock 层而非 Nix 用户态；alloc_inode 层而非 VFS 层——这需要对调用栈的语义理解

AI 在此次训练营中的本质角色是**认知放大器**——放大生产力（快速生成测试骨架、批量搜索日志 pattern），也放大认知偏差（在错误前提下快速递推几十轮）。与 AI 协作最核心的技能不是"写好 prompt"，而是**能在 AI 的输出中识别哪些结论违反了已知约束——然后删掉，不追**。

---

## 致谢

感谢陈渝老师、周睿老师（ZR233）在训练营期间的组织和指导。感谢 Mr Graveyard、Ajax 老师以及所有参与训练营的老师们提供的帮助。

感谢一起参与训练营的同学们。许多问题的思路并不是在敲代码时产生的，而是在讨论、争论和交流中逐渐清晰的。交流群中大家分享的经验、踩过的坑和提出的问题，都让我受益匪浅。

更要感谢开源社区。无论是 StarryOS、ArceOS，还是 Linux、Nix，这些项目背后无数开发者长期积累的工作，让后来者能够站在巨人的肩膀上学习。对于一个学生而言，能够参与真实项目、阅读真实代码、接受真实 review，本身就是一种幸运。

训练营期间最深刻的体会来自 ext4 inode bitmap 的调试。一个看似"Nix 挂起"的模糊现象，最终追查到了文件系统缓存的一致性 bug；一个最初看起来"QEMU 正常退出"的测试，实际上是 OOM 触发的整机关机。相比于"找到答案"，这些经历让我学会了如何接近答案——逐层排除、不跳层、先验证观测手段、再怀疑内核。

计算机的世界里没有魔法。所谓操作系统，不过是把这些"魔法"拆开来看；而所谓成长，大概就是逐渐学会理解它们为何如此运作。

---

## 附录 A：技术地图

```text
Application Layer
  Nix smoke / nixpkgs stdenv.mkDerivation
    -> /proc/self/ns/mnt (namespace handle)
    -> pipe EOF / pidfd readiness / PTY peer-close
    -> flock on store lock files
    -> ext4 inode bitmap cache (rsext4 alloc_inodes)

Kernel Layer
  Signal syscalls: sigaltstack / rt_sigtimedwait / rt_sigsuspend
                   rt_sigqueueinfo / rt_tgsigqueueinfo / rt_sigreturn
  Memory: dirty page cache -> Rust global allocator OOM -> abort -> system_off
  Reclaim: periodic writeback worker + ax-alloc byte-alloc retry callback

Test Layer
  001: 6 C regression tests under test-suit/starryos/qemu-smp1/syscall/
  002: 7 focused regression tests (fcntl-lock / nix-builder / pty / open-unlink
       / pipe-poll / pidfd-poll / unshare-fs)
  003: nix-smoke-nosandbox + nix-nixpkgs app-level cases + VFS workloads
```

## 附录 B：工作时间线

| 时间段 | 分支 | 关键事件 |
| --- | --- | --- |
| 05-20 | 001 | 6 个信号 syscall 测试设计 + Linux 参考 96/96 PASS |
| 05-26 | 002 | Nix smoke 环境搭建 + NIX-SMOKE-001 定位 /proc/self/ns/mnt |
| 05-27 | 002 | /proc/self/ns/mnt 修复；NIX-SMOKE-002 分类 |
| 06-01 | 002 | PR #981 namespace 合并；NIX-SMOKE-004 重新分类 |
| 06-02 | 002 | Scheme A mount namespace 实现；NIX-SMOKE-005 |
| 06-03 | 002 | PID ns orphan reaping 修复（NIX-SMOKE-008）；ext4 inode bitmap 7 层定位 |
| 06-04 | 002 | NIX-SMOKE-009/010/011 逐项修复；nix-smoke PASSED |
| 06-06 | 002 | pending_unlink + live_refs 设计；upstream merge |
| 06-08 | 002 | unshare(CLONE_FS) 修复；nix-nixpkgs 解除阻塞 |
| 06-27 | 003 | nixpkgs 激活；静默 OOM 定位（rust_oom -> abort -> system_off） |
| 06-28 | 003 | 周期 writeback + reclaim retry 修复；本地 store 闭包校准中 |

---

*报告日期：2026-06-28*
