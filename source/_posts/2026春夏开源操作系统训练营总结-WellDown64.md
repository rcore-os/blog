---
title: 2026春夏开源操作系统训练营总结-WellDown64
date: 2026-06-28 04:33:22
tags:
  - author:WellDown64
  - repo:https://github.com/WellDown64/tgoskits
---

### 方案一：以 syscall 为引导的改进

这一阶段主要做的是进程控制与资源相关的 syscall 的测试。

* `prlimit64` https://github.com/rcore-os/tgoskits/pull/801
* `capget` https://github.com/rcore-os/tgoskits/pull/863
* `capset` https://github.com/rcore-os/tgoskits/pull/898
* `getrusage` https://github.com/rcore-os/tgoskits/pull/902
* `arch_prctl` https://github.com/rcore-os/tgoskits/pull/1049

这个方向的整体思路来自 [Issue #650](https://github.com/rcore-os/tgoskits/issues/650)：挑几个 StarryOS 里尚未覆盖或实现有问题的系统调用，补测试、修 bug，一个个啃过去。最终合了 5 个 PR，还有 1 个在 review 中。有两个 syscall（`prctl`、`riscv_flush_icache`）因为工作量和优先级原因搁置了。

**PR #801 — feat(starry): 为 prlimit64 添加用户态测试** 

- 修正了 `sys_prlimit64` 的错误优先级：无效 pid 应该比非法 resource 更早返回 `ESRCH`
- 对提高 `rlim_max` 的路径补上了 `CAP_SYS_RESOURCE` 权限检查

**PR #863 — test(starryos): capget 系统调用测试与 NULL datap 修复** 

- 发现并修复了一个 bug：`datap=NULL` 时应视为版本探测，返回 `EINVAL` 并写回支持的版本号（对齐 Linux 行为）。StarryOS 原来的实现直接漏掉了这个分支

**PR #1049 — fix(starry): arch_prctl 地址校验 + 异常信号映射修正** 

- 看了 Linux 源码才发现，`ARCH_SET_FS`/`ARCH_SET_GS` 是有地址合法性校验的——超过 47-bit 规范边界的非 canonical 地址应该返回 `EPERM`，StarryOS 之前没做这个检查
- 把用户态 `#GP`、`#SS`、`#NP`、`#TS` 等保护异常从 `SIGTRAP` 改成了 `SIGSEGV`（对齐 Linux/POSIX）
- 附带了一份 CPUID faulting 的后续支持方案（`GetCpuid`/`SetCpuid` 的占位实现）
- 这个 PR 改动涉及面比较广，还在完善中。



### 方案二：以 Linux App 为引导的改进

从“跑通真实 Linux 应用”出发来改善 StarryOS 的兼容性。这个方向的工作记录在 [Issue #1153](https://github.com/rcore-os/tgoskits/issues/1153)（procps 支持分析）和 [Issue #1324](https://github.com/rcore-os/tgoskits/issues/1324)（strace 支持）中。

对 procps(ps/top/kill) 的支持分析：目前的 `ps` 和 `kill` 命令均可以正常运行，但是在测试过程中发现运行 `top` 命令会直接退出，没有结果输出。我主要针对这一问题进行了修复。

**PR #1194 — fix(tui): 在 init.sh 中设置 TERM 环境变量** 

- 在 `init.sh` 里加了 `export TERM=xterm`，修复了 TUI 应用因为缺少 `TERM` 环境变量而无法启动的问题
- 改动虽然小，但是发现这个错误费了比较长的时间。我在让 AI 排查原因的时候 AI 产生了幻觉，提供了一些无用的建议，我的想法是让 AI 阅读 `top` 的源码，让它判断在哪一步出现问题了。
- 这件事给我的体会是，使用 AI 的关键是给它提供全面的 context. 而如何给出合适的 context 取决于使用者对问题的理解。

在排查 `top` 的问题时，我尝试使用 `strace` 来查看 `top` 的系统调用，但是发现 StarryOS 上目前还不支持 `strace`, 因此我又做了 `strace` 的支持。

**PR #1323 — feat(starry-kernel): 实现 PTRACE_LISTEN（strace 支持）** 

这个 PR 的目标是让 `strace` 能在 StarryOS 上跑起来。一开始以为“实现 `PTRACE_LISTEN` 就行了”，结果发现远不止如此——`strace` 使用的是 ptrace 的 SEIZE 流程而非传统的 TRACEME，对内核的要求比想象中多得多。这一系列改动涉及 7 个文件，新增约 380 行代码（含 179 行的 C 测试用例），按依赖关系可以分为三个层次：

**第一层：信号与时序（修不好这个，后面都无从谈起）**

`must` — **SIGCONT 不产生虚假 ptrace stop**（`signal.rs`）。这个问题非常隐蔽：shell 启动前台作业时发送的 `SIGCONT` 可能在 strace child 自己发出的 `SIGSTOP` 之前被出队。此时内核会错误地产生一个 `SIGCONT` stop，把 strace 的初始化状态机彻底打乱。不修这个，无论是 TRACEME 还是 SEIZE 路径都起不来。修复方式是在信号处理中对 `SIGCONT` 类信号（以及 `SIGKILL`、`SIGSTOP` 等不可屏蔽信号）做特殊判断，跳过 ptrace stop 的生成。

**第二层：SEIZE 流程核心机制**

这一层是让 strace 能跑起来的“骨架”，缺一个都会导致 strace 直接退出或行为异常：

`must` — **PTRACE_LISTEN 实现**（`ptrace.rs`，opcode `0x4208`）。strace 在 SEIZE 流程中会将 `TE_GROUP_STOP` 转为 job-control stop，而这一步依赖 `PTRACE_LISTEN` 让 tracee 进入 listening 状态。没有它，strace 直接报 `Unsupported` 退出——这也是整个 PR 命名的由来。

`must` — **exec 时跳过 syscall exit stop**（`user.rs`）。这是一个非常微妙的细节：在 execve 的处理中，如果先触发了 syscall exit stop，`TCB_INSYSCALL` 标志会被清除。之后 exec event 到达时，因为标志已清，strace 会报 `Stray PTRACE_EVENT_EXEC`，并进入错误恢复路径——更致命的是，这会导致后续所有 syscall 的 entry/exit 判定永久反转，整个 trace 输出完全错乱。修复方式是在 exec 路径上跳过 exit stop，确保 exec event 到达时 `TCB_INSYSCALL` 仍然置位。

`high` — **PTRACE_EVENT_STOP 编码**（`ptrace.rs`）。`PTRACE_INTERRUPT` 触发的 stop 需要在 wait status 的高 16 位标记 `PTRACE_EVENT_STOP(128)`。strace 正是根据这个标记来区分 group-stop 和普通信号 stop，从而走 `TE_RESTART` 而非 `TE_GROUP_STOP` 路径。没有这个标记，strace 的 ptrace 状态机会做出错误的决策。

`high` — **SEIZE 接收 options**（`ptrace.rs`）。strace 调用 `ptrace(PTRACE_SEIZE, pid, NULL, ptrace_setoptions)` 时，会把 options（如 `0x51`）作为第 4 参数传入。StarryOS 原来的 SEIZE 实现忽略了 data 参数，导致 options（如 `PTRACE_O_TRACESYSGOOD`、`PTRACE_O_TRACEEXEC`）全部丢失。后果是 exec stop 没有 event tag，strace 会把它误判为普通的信号投递。

`high` — **ATTACHED 也触发 exec stop**（`execve.rs`）。这是 SEIZE 和 TRACEME 的一个重要差异：TRACEME 的 tracee 会主动调用 `ptrace(TRACEME)` 标记自己，而 SEIZE 的 tracee 是被动的，从未调用过 `TRACEME`。原来的代码只用 `is_ptrace_traceme()` 判断是否触发 exec stop，对于 SEIZE 的 child 永远为 false。需要额外加上 `is_ptrace_attached()` 的判断，否则 SEIZE 路径的 exec stop 永远不会触发。

**第三层：兼容性打磨**

`medium` — **TRACESECCOMP/EXITKILL 加入 valid_mask**（`ptrace.rs`）。strace 在启用 seccomp 过滤或 `--kill-on-exit` 选项时，会在 `PTRACE_SETOPTIONS` 中传入 `PTRACE_O_TRACESECCOMP` 和 `PTRACE_O_EXITKILL`。这些 bit 不在 valid_mask 中的话，`SETOPTIONS` 返回 `EINVAL`，导致所有 options（包括前面那些关键的 exec/trace 相关选项）全部丢失。虽然不是 SEIZE 流程必需的，但缺了它，strace 的 seccomp 相关功能和 `--kill-on-exit` 就无法正常工作。

`low` — **SEIZE self 恢复 EPERM**（`ptrace.rs`）。之前的 workaround 在 SEIZE 自身时返回 `EIO`，现在 SEIZE 流程完整实现后改回 `EPERM`，对齐 Linux ABI 行为。

**调试过程与测试**

为验证这些修改，我写了一个 179 行的 C 用户态测试用例（`test-ptrace-listen`），覆盖 PTRACE_SEIZE → PTRACE_LISTEN 的基本流程。

在 riscv64 QEMU 上验证了 `strace` 的基本功能可以正常工作，能输出完整的系统调用追踪。不过，运行 `strace -d` 时仍然会看到：

```
strace: do_test_ptrace_get_syscall_info: PTRACE_GET_SYSCALL_INFO: Function not implemented
strace: PTRACE_SET_SYSCALL_INFO does not work
```

这是因为 `PTRACE_GET_SYSCALL_INFO` 还没实现——strace 在调试模式下会探测这个接口的可用性，但这不影响基本的 syscall trace 功能。这是一个后续可以继续完善的点。

另外，其他架构（x86_64、aarch64、loongarch64）的 ptrace 支持已有其他同学贡献（PR #1062, #1247, #1292），但 strace 还未在这些架构上测试过，也是后续可以做的事情。

这次 strace 适配让我对 ptrace 子系统有了比较深入的理解。最大的感受是：像 `strace` 这种看起来“只差一个接口”的工具，实际上对内核的 ptrace 实现要求非常严格——从信号处理到 exec 流程再到 wait status 编码，环环相扣，任何一个环节的遗漏都会导致整个链路断裂。做这类兼容性工作，不能只看单个接口的实现，需要把工具的实际使用流程（特别是像 SEIZE 这种复杂流程）完整走一遍，才能发现那些隐藏在调用序列中的隐含依赖。

## 后续的计划

短期来看，先把手里两个未合并的 PR 收尾(#1049 #1323)，争取尽快合入。strace 这边还有一些可以完善的地方，比如 `PTRACE_GET_SYSCALL_INFO` 的实现、以及在其他架构上的测试验证，都是值得跟进的后续工作。

长远一点来说，这次训练营让我对操作系统内核开发有了比较切实的感受，而不只是停留在看书的层面。如果有机会的话，希望可以参加相关实习，继续往这个方向深入下去。

## 总结

回过头来看这几个月，从 Rust 基础到 rCore 手写内核，再到给 StarryOS 提 PR、修 bug、补系统调用——每一步都在加深我对操作系统的理解。

项目阶段是最有收获的部分。给一个真实的开源内核项目贡献代码，跟在教程框架里写实验是完全不同的体验。最大的区别在于：教程里的问题是有答案的，而真实项目中的问题没有现成的标准答案，需要自己去分析、去摸索。比如 strace 那条链路，一开始只想着”实现 PTRACE_LISTEN 就行了”，结果发现上游的 SIGCONT 时序、exec 的 stop 语义、甚至 wait status 的编码格式，一环扣一环，缺一个整个链路就断。这种 debug 不是”某个地方写错了”，而是”缺少了一整块逻辑”——能定位到问题本身，就已经是能力提升的体现。

比较遗憾的是，由于我几乎比别人晚开始一周，方案二这边其实有不少想法还没来得及展开。像 strace 的 `PTRACE_GET_SYSCALL_INFO` 支持、其他架构上的测试验证，这些都是后续可以继续深入的方向。

关于 AI 的使用，也是这次项目阶段体会比较深的一点。AI 确实很强，合理使用的话效率提升肉眼可见。但用下来的一个感受是：AI 特别容易在一个地方钻牛角尖，死磕某个错误的思路不肯回头。这时候就得靠人去给它指方向、补充相关的 context，帮它跳出那个坑。说到底，复杂的问题永远都是复杂的——AI 可以帮忙搬砖，但想清楚要搬什么、往哪搬，还是得靠自己。

最后感谢训练营中各位老师的指导，感谢 OS 训练营提供这样一个平台供我学习，感谢与我热心交流的各位同学们，祝 OS 训练营越办越好。