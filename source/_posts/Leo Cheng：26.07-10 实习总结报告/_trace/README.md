# 内核补丁溯源

## 范围

账号 `Lfan-ke` 在 `rcore-os/tgoskits` 共提交 154 个拉取请求：已合入 105 个，审查中 3 个，已关闭 46 个。其中改动内核侧代码（`os/StarryOS/kernel/`、`components/`、`drivers/`、`memory/`、`net/`、`fs/`、`os/arceos/`、`platforms/`）的有 76 个。只改测试用例、应用、构建脚本或持续集成的拉取请求不在其内。

溯源的对象是这 76 个里已合入与审查中的 68 个：已合入 65 个，审查中 3 个。68 个全部写完。已关闭未合入的 8 个不计入，其中 7 个此前已有文件，列在文末。统计截至 2026-10-04。

## 对照基准

| 来源 | 版本 | 用法 |
|:--:|:--:|:--:|
| Linux 源码 | `torvalds/linux` 提交 `8cd9520d35a6c38db6567e97dd93b1f11f185dc6`（7.1.0） | 链接指向该提交下的具体行 |
| man 手册 | `man-pages-6.19`（提交 `adb436b2e4471218021d86f188fb58dec3946eb8`） | 原文摘自该版本源文件 |
| 当前 dev | 上游 `dev` 的 `72a5528bf`（2026-10-02） | 核对每处改动现在还在不在、在哪 |
| 本地记录 | 两套 WSL 的 `~/rcore/notes/`、`~/rcore/tasks/` 与记忆目录 | 列出提到该编号的文件 |

每个拉取请求一份文件，结构相同：问题与原因、改动与影响范围、溯源复核（有发现时才有）、Linux 依据、man 原文、验证、本地记录。14 份另有「代码对照」，并列给出合入前的 StarryOS 代码、Linux 的对应代码与合入后的 StarryOS 代码；其余文件的代码对照后补。

## 校验

68 份文件里的引用由脚本逐条核对，结果是零错误。

| 项 | 数量 | 核对内容 |
|:--:|:--:|:--:|
| Linux 链接 | 746 | 提交是固定版本，文件存在，行号不越界，显示文字与链接一致 |
| man 链接 | 179 | 页存在，行号不越界 |
| man 引文 | 207 | 与去掉排版宏之后的原文逐字相同 |
| Linux 代码块 | 34 | 与链接的那几行逐字相同 |
| StarryOS 代码块 | 56 | 每一行出自该拉取请求的 diff，或在当前 dev 的对应文件里 |

## 发现

68 份里有 51 份带「溯源复核」。发现分四类，各举几例，细节在对应文件里。

| 类别 | 例子 |
|:--:|:--:|
| 补丁的行为与 Linux 仍有出入 | [#720](pr-720.md)：路径末尾带斜杠加 `O_CREAT` 时 Linux 返回 `EISDIR`，补丁返回 `ENOENT` 或 `ENOTDIR`；对 `O_PATH` 描述符经 `/proc/self/fd` 做 `chmod`，Linux 成功，补丁返回 `EBADF`。[#1119](pr-1119.md)：地址族错误返回 `EAFNOSUPPORT`，Linux 是 `EINVAL`。[#1700](pr-1700.md)：`sigtimedwait` 与 signalfd 的出队次序仍与 Linux 不同 |
| 正文与合入的 diff 不符 | [#1114](pr-1114.md)：标题写六处，合入的是五处。[#1164](pr-1164.md)：正文写越界得 `SIGBUS`，合入时是 `SIGSEGV`。[#720](pr-720.md)：正文的文件数与用例数是变基之前的数 |
| 回归用例拦不住回归 | [#1124](pr-1124.md)：按修复前的代码推演，用例在修复前也会通过。[#1366](pr-1366.md)：在 CI 用的 CPU 型号上，用例修复前后都通过。[#1558](pr-1558.md)：有一个子用例没有走到被修的读路径 |
| 已被后续提交取代 | [#2302](pr-2302.md) 的 epoll 部分被 #2456 取代。[#1214](pr-1214.md) 改的平台两周后被整个删除。[#1500](pr-1500.md) 的改动在调度器重写时改回 |

## 摘录总表

按编号升序。「内核侧改动」只计内核侧文件的增删行数，测试与应用不计入。

| PR | 标题 | 状态 | 日期 | 涉及模块 | 内核侧改动 | 溯源 |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| [#717](https://github.com/rcore-os/tgoskits/pull/717) | fix(starry-kernel): uid/gid local fixes — uid_valid + setfsuid/setfsgid | 已合入 | 2026-05-19 | `kernel/syscall` | +93/-0 | [pr-717](pr-717.md) |
| [#718](https://github.com/rcore-os/tgoskits/pull/718) | fix(starry-kernel): uid/gid cross-subsystem — PR_SET/GET_DUMPABLE + setuid auto-clear | 已合入 | 2026-05-19 | `kernel/syscall`、`kernel/syscall/task`、`kernel/task` | +71/-0 | [pr-718](pr-718.md) |
| [#719](https://github.com/rcore-os/tgoskits/pull/719) | fix(starry-kernel): open/openat — 15-class local POSIX compatibility fixes | 已合入 | 2026-05-21 | `arceos/modules/axfs-ng`、`kernel/syscall/fs`、`kernel/file` | +117/-24 | [pr-719](pr-719.md) |
| [#720](https://github.com/rcore-os/tgoskits/pull/720) | fix(starry-kernel): open/openat deep — 6-class cross-subsystem rework | 已合入 | 2026-05-22 | `arceos/modules/axfs-ng`、`kernel/syscall/fs`、`kernel/file` 等 5 处 | +186/-11 | [pr-720](pr-720.md) |
| [#873](https://github.com/rcore-os/tgoskits/pull/873) | fix(axplat-loongarch64-qemu-virt): send runtime IPIs non-blocking to fix SMP IPI-burst deadlock | 已合入 | 2026-05-22 | `components/axplat_crates` | +11/-3 | [pr-873](pr-873.md) |
| [#914](https://github.com/rcore-os/tgoskits/pull/914) | fix(starry-kernel): copy under-aligned epoll_event byte-wise (fixes Go netpoll EFAULT) | 已合入 | 2026-05-25 | `kernel/syscall/io_mpx` | +57/-7 | [pr-914](pr-914.md) |
| [#915](https://github.com/rcore-os/tgoskits/pull/915) | fix(starry-kernel): add Threads: line to /proc/[pid]/status and implement /proc/[pid]/statm | 已合入 | 2026-05-25 | `kernel/pseudofs` | +97/-2 | [pr-915](pr-915.md) |
| [#916](https://github.com/rcore-os/tgoskits/pull/916) | fix(starry-signal): keep x86-64 uc_mcontext at Linux ABI offset 40 | 已合入 | 2026-05-25 | `components/starry-signal` | +27/-2 | [pr-916](pr-916.md) |
| [#917](https://github.com/rcore-os/tgoskits/pull/917) | fix(loongarch64): make userspace LSX usable (preserve FP/LSX state + fix uc_mcontext offset + advertise AT_HWCAP) | 已合入 | 2026-05-26 | `components/axcpu`、`kernel/mm`、`components/starry-signal` | +190/-5 | [pr-917](pr-917.md) |
| [#918](https://github.com/rcore-os/tgoskits/pull/918) | fix(starry-mm): mprotect returns ENOMEM on unmapped holes within the range | 已合入 | 2026-06-05 | `kernel/syscall/mm` | +10/-2 | [pr-918](pr-918.md) |
| [#919](https://github.com/rcore-os/tgoskits/pull/919) | fix(axruntime): park secondary harts beyond MAX_CPU_NUM instead of panicking | 已合入 | 2026-05-25 | `arceos/modules/axruntime` | +12/-0 | [pr-919](pr-919.md) |
| [#920](https://github.com/rcore-os/tgoskits/pull/920) | fix(starry-mm): fix use-after-free evicting a page-cache page shared across split file mappings | 已合入 | 2026-05-25 | `kernel/mm/aspace`、`kernel/syscall/mm` | +70/-11 | [pr-920](pr-920.md) |
| [#921](https://github.com/rcore-os/tgoskits/pull/921) | fix(starry-net): epoll_pwait user-buffer alignment + netlink MSG_PEEK/TRUNC/DONTWAIT (Go network servers) | 已合入 | 2026-06-07 | `kernel/file`、`components/starry-vm`、`kernel/syscall/net` | +78/-15 | [pr-921](pr-921.md) |
| [#922](https://github.com/rcore-os/tgoskits/pull/922) | fix(axruntime): initialize the page allocator from the largest free RAM region | 已合入 | 2026-05-25 | `arceos/modules/axruntime` | +18/-11 | [pr-922](pr-922.md) |
| [#923](https://github.com/rcore-os/tgoskits/pull/923) | fix(starry-net): SIOCGIFINDEX + non-zero SIOCGIFCONF sizing for OpenJDK NetworkInterface | 已合入 | 2026-05-26 | `kernel/file` | +20/-3 | [pr-923](pr-923.md) |
| [#924](https://github.com/rcore-os/tgoskits/pull/924) | feat(starry-task): implement sys_getcpu | 已合入 | 2026-05-25 | `kernel/syscall/task`、`kernel/syscall` | +19/-0 | [pr-924](pr-924.md) |
| [#925](https://github.com/rcore-os/tgoskits/pull/925) | fix(starry-task): suspend on SIGSTOP instead of killing (job control) | 已合入 | 2026-05-25 | `kernel/task`、`kernel/syscall/task` | +278/-8 | [pr-925](pr-925.md) |
| [#1112](https://github.com/rcore-os/tgoskits/pull/1112) | fix(ax-plat-x86-pc): enable XCR0 AVX/SSE state for userspace AVX | 已合入 | 2026-06-11 | `components/someboot` | +29/-0 | [pr-1112](pr-1112.md) |
| [#1114](https://github.com/rcore-os/tgoskits/pull/1114) | fix(starry): Linux-compat foundational fixes (pseudofs/mm/axfs-ng/syscall) | 已合入 | 2026-06-11 | `kernel/syscall/mm`、`kernel/mm/aspace`、`kernel/pseudofs` 等 5 处 | +175/-23 | [pr-1114](pr-1114.md) |
| [#1118](https://github.com/rcore-os/tgoskits/pull/1118) | fix(starry-ipc): correct ShmidDs layout to match Linux shmid64_ds | 已合入 | 2026-06-05 | `kernel/syscall/ipc` | +20/-2 | [pr-1118](pr-1118.md) |
| [#1119](https://github.com/rcore-os/tgoskits/pull/1119) | fix(starry-net): accept oversized addrlen in netlink bind/connect | 已合入 | 2026-06-05 | `kernel/syscall/net` | +5/-1 | [pr-1119](pr-1119.md) |
| [#1120](https://github.com/rcore-os/tgoskits/pull/1120) | fix(starry-mm): reject overflowing addr+length in mmap instead of wrapping | 已合入 | 2026-06-06 | `kernel/syscall/mm` | +13/-1 | [pr-1120](pr-1120.md) |
| [#1121](https://github.com/rcore-os/tgoskits/pull/1121) | feat(starry-proc): add common /proc/sys and /proc/filesystems stub files | 已合入 | 2026-06-08 | `kernel/pseudofs` | +53/-0 | [pr-1121](pr-1121.md) |
| [#1122](https://github.com/rcore-os/tgoskits/pull/1122) | fix(starry-mm): make mlock fault the range in and report ENOMEM on holes | 已合入 | 2026-06-06 | `kernel/syscall/mm` | +41/-1 | [pr-1122](pr-1122.md) |
| [#1124](https://github.com/rcore-os/tgoskits/pull/1124) | fix(axfs-ng): zero the partial last page when truncating a file shorter | 已合入 | 2026-06-06 | `arceos/modules/axfs-ng` | +26/-4 | [pr-1124](pr-1124.md) |
| [#1128](https://github.com/rcore-os/tgoskits/pull/1128) | fix(axcpu-aarch64): emulate EL0 MRS reads of ID_AA64* feature registers | 已合入 | 2026-06-05 | `components/axcpu`、`kernel/task` | +83/-1 | [pr-1128](pr-1128.md) |
| [#1164](https://github.com/rcore-os/tgoskits/pull/1164) | fix(starry-mm): bound file-backed mmap populate at EOF (no frames for beyond-EOF pages) | 已合入 | 2026-06-10 | `kernel/mm/aspace`、`arceos/modules/axfs-ng` | +37/-1 | [pr-1164](pr-1164.md) |
| [#1168](https://github.com/rcore-os/tgoskits/pull/1168) | fix(starry): FIOCLEX ioctl + /proc status ctxt_switches + quiet non-tty ioctl probes (TUI) | 已合入 | 2026-06-10 | `kernel/syscall/fs`、`kernel/pseudofs` | +28/-12 | [pr-1168](pr-1168.md) |
| [#1210](https://github.com/rcore-os/tgoskits/pull/1210) | fix(starry-kernel): route legacy getrlimit/setrlimit through prlimit64 | 已合入 | 2026-06-10 | `kernel/syscall` | +14/-0 | [pr-1210](pr-1210.md) |
| [#1213](https://github.com/rcore-os/tgoskits/pull/1213) | feat(starry): expose root block device /dev/vda + strengthen busybox applet tests | 已合入 | 2026-06-11 | `kernel/pseudofs/dev` | +40/-0 | [pr-1213](pr-1213.md) |
| [#1214](https://github.com/rcore-os/tgoskits/pull/1214) | feat(ax-plat-loongarch64-qemu-virt): detect RAM size from the FDT | 已合入 | 2026-06-16 | `platforms/ax-plat-loongarch64-qemu-virt` | +154/-14 | [pr-1214](pr-1214.md) |
| [#1217](https://github.com/rcore-os/tgoskits/pull/1217) | feat(starry-mm): file-backed mmap readahead (batched page-fault fill) | 已合入 | 2026-06-11 | `kernel/mm/aspace` | +94/-4 | [pr-1217](pr-1217.md) |
| [#1280](https://github.com/rcore-os/tgoskits/pull/1280) | fix(starry): widen loongarch64 user VA window to 128 TiB (match aarch64/x86_64) | 已合入 | 2026-06-17 | `kernel/config` | +17/-2 | [pr-1280](pr-1280.md) |
| [#1329](https://github.com/rcore-os/tgoskits/pull/1329) | fix(axcpu): preserve AVX state across x86_64 context switch (XSAVE) | 已合入 | 2026-06-21 | `components/axcpu` | +94/-10 | [pr-1329](pr-1329.md) |
| [#1331](https://github.com/rcore-os/tgoskits/pull/1331) | fix(starry-signal): populate siginfo.si_addr for synchronous SIGSEGV | 已合入 | 2026-06-22 | `kernel/task`、`components/starry-signal` | +54/-5 | [pr-1331](pr-1331.md) |
| [#1366](https://github.com/rcore-os/tgoskits/pull/1366) | fix(axcpu): seed a fresh x86_64 task's x87 stack as empty (FXSAVE tag) | 已合入 | 2026-06-25 | `components/axcpu` | +17/-1 | [pr-1366](pr-1366.md) |
| [#1367](https://github.com/rcore-os/tgoskits/pull/1367) | fix(axcpu): deliver x86_64 #DE (divide error) as SIGFPE/FPE_INTDIV | 已合入 | 2026-06-25 | `kernel/task`、`components/axcpu`、`components/starry-signal` | +37/-8 | [pr-1367](pr-1367.md) |
| [#1499](https://github.com/rcore-os/tgoskits/pull/1499) | fix(starry-mm): bound per-file page-cache pre-allocation to avoid OOM | 已合入 | 2026-07-06 | `arceos/modules/axfs-ng` | +1/-1 | [pr-1499](pr-1499.md) |
| [#1500](https://github.com/rcore-os/tgoskits/pull/1500) | fix(starry-process): wake blocked sibling on group-exit for prompt aspace reclaim | 已合入 | 2026-07-06 | `kernel/task` | +6/-1 | [pr-1500](pr-1500.md) |
| [#1502](https://github.com/rcore-os/tgoskits/pull/1502) | test(starry): add gateway and higress reverse-proxy carpets | 已合入 | 2026-07-07 | `net/ax-net`、`kernel/syscall/net` | +339/-103 | [pr-1502](pr-1502.md) |
| [#1504](https://github.com/rcore-os/tgoskits/pull/1504) | feat(starry): back /proc/diskstats, /proc/net/dev and /proc/mounts with real data | 已合入 | 2026-07-06 | `net/ax-net`、`kernel/pseudofs`、`arceos/modules/axfs-ng` | +166/-18 | [pr-1504](pr-1504.md) |
| [#1505](https://github.com/rcore-os/tgoskits/pull/1505) | fix(starry): accept read-only mmap fdatasync and IP_PKTINFO/IPV6 pktinfo sockopts | 已合入 | 2026-07-06 | `kernel/syscall/net`、`kernel/mm/aspace` | +57/-10 | [pr-1505](pr-1505.md) |
| [#1508](https://github.com/rcore-os/tgoskits/pull/1508) | feat(starry): report EOPNOTSUPP for SIOCETHTOOL and expose /proc/pid/mountinfo | 已合入 | 2026-07-08 | `kernel/pseudofs`、`kernel/file` | +41/-0 | [pr-1508](pr-1508.md) |
| [#1518](https://github.com/rcore-os/tgoskits/pull/1518) | feat(starry): implement SO_REUSEPORT socket option | 已合入 | 2026-07-07 | `net/ax-net`、`kernel/syscall/net` | +339/-103 | [pr-1518](pr-1518.md) |
| [#1525](https://github.com/rcore-os/tgoskits/pull/1525) | feat(starry): add /proc/vmstat with pgfault and nr_free_pages | 已合入 | 2026-07-07 | `kernel/pseudofs`、`kernel/mm`、`kernel/task` | +41/-1 | [pr-1525](pr-1525.md) |
| [#1558](https://github.com/rcore-os/tgoskits/pull/1558) | fix(starry): correct /proc/pid/comm padding and non-blocking partial TCP send | 已合入 | 2026-07-22 | `kernel/pseudofs`、`net/ax-net` | +17/-4 | [pr-1558](pr-1558.md) |
| [#1564](https://github.com/rcore-os/tgoskits/pull/1564) | feat(starry-kernel): implement POSIX message queues (mq_*) | 已合入 | 2026-07-22 | `kernel/ipc`、`kernel/syscall/ipc`、`kernel/pseudofs` 等 9 处 | +1859/-9 | [pr-1564](pr-1564.md) |
| [#1566](https://github.com/rcore-os/tgoskits/pull/1566) | feat(net): implement TUN/TAP virtual network devices | 已合入 | 2026-09-28 | `net/ax-net`、`kernel/pseudofs/dev`、`kernel/file` 等 5 处 | +1600/-82 | [pr-1566](pr-1566.md) |
| [#1567](https://github.com/rcore-os/tgoskits/pull/1567) | test(tun-tap): TUN L3 datapath + TAP L2 framing + lifecycle carpet | 已合入 | 2026-09-28 | `net/ax-net`、`kernel/pseudofs/dev`、`kernel/file` 等 5 处 | +1600/-82 | [pr-1567](pr-1567.md) |
| [#1568](https://github.com/rcore-os/tgoskits/pull/1568) | net: support IP_MTU_DISCOVER and flush UDP egress before close | 已合入 | 2026-07-23 | `net/ax-net`、`kernel/syscall/net` | +54/-0 | [pr-1568](pr-1568.md) |
| [#1569](https://github.com/rcore-os/tgoskits/pull/1569) | feat(kernel): browser-prerequisite syscall support and tests, aligned to Linux | 已合入 | 2026-07-31 | `net/ax-net`、`kernel/syscall/net`、`kernel/file` 等 6 处 | +565/-127 | [pr-1569](pr-1569.md) |
| [#1573](https://github.com/rcore-os/tgoskits/pull/1573) | feat(starry-kernel): expose per-CPU cache, topology and NUMA node sysfs | 审查中 | 2026-07-11 | `kernel/pseudofs/sysfs`、`kernel/pseudofs` | +1259/-23 | [pr-1573](pr-1573.md) |
| [#1700](https://github.com/rcore-os/tgoskits/pull/1700) | feat(signal): deliver synchronous fault signals before other pending signals | 已合入 | 2026-07-27 | `components/starry-signal` | +139/-9 | [pr-1700](pr-1700.md) |
| [#1707](https://github.com/rcore-os/tgoskits/pull/1707) | feat(net): add SIOCGIFNAME and share device ioctls across socket families | 已合入 | 2026-07-31 | `kernel/file` | +169/-159 | [pr-1707](pr-1707.md) |
| [#1711](https://github.com/rcore-os/tgoskits/pull/1711) | fix(starry): make shutdown filesystem teardown best-effort | 已合入 | 2026-07-30 | `components/axfs-ng-vfs`、`kernel/entry` | +24/-3 | [pr-1711](pr-1711.md) |
| [#1797](https://github.com/rcore-os/tgoskits/pull/1797) | fix(starry-kernel): charge RLIMIT_AS on mmap, mremap, brk, shmat and execve. | 审查中 | 2026-07-31 | `kernel/syscall/mm`、`kernel/syscall/task`、`kernel/task`、`kernel/syscall/ipc` | +199/-33 | [pr-1797](pr-1797.md) |
| [#1985](https://github.com/rcore-os/tgoskits/pull/1985) | fix(starry-kernel): seed the kernel CRNG from trusted entropy and fill AT_RANDOM | 审查中 | 2026-08-12 | `kernel/random`、`kernel/pseudofs/dev`、`kernel/syscall` 等 10 处 | +1112/-233 | [pr-1985](pr-1985.md) |
| [#2194](https://github.com/rcore-os/tgoskits/pull/2194) | fix(ax-net): wake only the peer on unix stream I/O | 已合入 | 2026-09-12 | `net/ax-net` | +113/-9 | [pr-2194](pr-2194.md) |
| [#2259](https://github.com/rcore-os/tgoskits/pull/2259) | fix(starry-kernel): report an enabled CPUID from arch_prctl(ARCH_GET_CPUID) | 已合入 | 2026-09-02 | `kernel/syscall/task` | +6/-1 | [pr-2259](pr-2259.md) |
| [#2260](https://github.com/rcore-os/tgoskits/pull/2260) | fix(starry-kernel): stop select() reporting a hung-up fd as writable | 已合入 | 2026-09-02 | `kernel/syscall/io_mpx` | +5/-1 | [pr-2260](pr-2260.md) |
| [#2263](https://github.com/rcore-os/tgoskits/pull/2263) | fix(starry-kernel): report times(2) in USER_HZ clock ticks | 已合入 | 2026-09-02 | `kernel/syscall` | +10/-6 | [pr-2263](pr-2263.md) |
| [#2266](https://github.com/rcore-os/tgoskits/pull/2266) | fix(starry-kernel): scope setns and id-map privileges to the initial user namespace | 已合入 | 2026-09-11 | `kernel/pseudofs`、`kernel/syscall/task`、`kernel/namespace` | +43/-4 | [pr-2266](pr-2266.md) |
| [#2301](https://github.com/rcore-os/tgoskits/pull/2301) | perf(buddy-slab-allocator): skip the full-list walk when no cross-CPU free is pending | 已合入 | 2026-09-11 | `memory/buddy-slab-allocator`、`memory/ax-alloc` | +450/-22 | [pr-2301](pr-2301.md) |
| [#2302](https://github.com/rcore-os/tgoskits/pull/2302) | perf(starry-kernel): scope VMA and epoll scans to what each caller needs | 已合入 | 2026-09-08 | `kernel/mm/aspace`、`kernel/file` | +330/-63 | [pr-2302](pr-2302.md) |
| [#2328](https://github.com/rcore-os/tgoskits/pull/2328) | fix(some-serial): preserve PL011 RX interrupts and add a real QEMU regression | 已合入 | 2026-09-10 | `drivers/serial` | +15/-4 | [pr-2328](pr-2328.md) |
| [#2426](https://github.com/rcore-os/tgoskits/pull/2426) | fix(starry-kernel): align tty sessions and pty lifecycles with Linux. | 已合入 | 2026-09-28 | `kernel/pseudofs/dev`、`kernel/syscall/fs`、`kernel/syscall/task` | +457/-31 | [pr-2426](pr-2426.md) |
| [#2432](https://github.com/rcore-os/tgoskits/pull/2432) | perf(x86-apic-driver): send IPIs without rebuilding the APIC handle. | 已合入 | 2026-09-25 | `drivers/intc` | +57/-11 | [pr-2432](pr-2432.md) |
| [#2433](https://github.com/rcore-os/tgoskits/pull/2433) | perf(starry-kernel): keep an epoll interest registered while its lease is armed. | 已合入 | 2026-09-28 | `kernel/file`、`components/axpoll` | +249/-0 | [pr-2433](pr-2433.md) |

## 已关闭未合入（不计入）

这 7 个拉取请求在范围调整之前已写有文件，保留备查。另有 #2383 同样已关闭，没有写。

| PR | 标题 | 状态 | 日期 | 涉及模块 | 内核侧改动 | 溯源 |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| [#1588](https://github.com/rcore-os/tgoskits/pull/1588) | fix(arceos): boot rv64 helloworld past the device probe | 已关闭 | 2026-07-12 | `arceos/modules/axruntime` | +11/-6 | [pr-1588](pr-1588.md) |
| [#2267](https://github.com/rcore-os/tgoskits/pull/2267) | fix(starry-kernel): enforce DAC permission when opening existing files | 已关闭 | 2026-09-21 | `fs/ax-fs-ng`、`kernel/syscall/fs`、`fs/axfs-ng-vfs` | +113/-35 | [pr-2267](pr-2267.md) |
| [#2416](https://github.com/rcore-os/tgoskits/pull/2416) | fix(starry-kernel): set the controlling terminal when a session leader opens a tty. | 已关闭 | 2026-09-25 | `kernel/pseudofs/dev`、`kernel/syscall/fs` | +43/-2 | [pr-2416](pr-2416.md) |
| [#2417](https://github.com/rcore-os/tgoskits/pull/2417) | fix(starry-kernel): clear the pty hangup when a closed side is opened again. | 已关闭 | 2026-09-25 | `kernel/pseudofs/dev` | +7/-0 | [pr-2417](pr-2417.md) |
| [#2418](https://github.com/rcore-os/tgoskits/pull/2418) | fix(starry-kernel): return a devpts index once both ends of its pty are closed. | 已关闭 | 2026-09-25 | `kernel/pseudofs/dev` | +321/-9 | [pr-2418](pr-2418.md) |
| [#2425](https://github.com/rcore-os/tgoskits/pull/2425) | fix(starry-kernel): translate tty job control ids per pid namespace. | 已关闭 | 2026-09-25 | `kernel/pseudofs/dev` | +14/-6 | [pr-2425](pr-2425.md) |
| [#2430](https://github.com/rcore-os/tgoskits/pull/2430) | fix(ax-net): resolve unix socket paths outside address spinlocks. | 已关闭 | 2026-09-23 | `net/ax-net` | +200/-15 | [pr-2430](pr-2430.md) |
