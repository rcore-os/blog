---
title: '对照 Linux 评估 StarryOS 子系统与浏览器启动'
date: 2026-10-07 21:32:00
categories:
    - Leo Cheng
tags:
    - repo:https://github.com/rcore-os/tgoskits
    - wiki:https://github.com/Lfan-ke/tgoskits/wiki
    - StarryOS
    - Linux
    - difftest
    - 性能
    - Firefox
    - epoll
    - mm
---

StarryOS 当前内核未解耦系统调用时期的默认系统调用实现是 GNU Linux 的系统调用，所以 Linux 本身就是最好的参照：同一个程序在两边跑，结果该一样，耗时该接近。做法是把两边放进同一个环境，把差距落到具体子系统，再对着 Linux 的源码改；浏览器启动这条长路径则拆成段，逐段比。

<!-- more -->

## 流程

```mermaid
flowchart LR
    A[选负载] --> B[两侧同环境运行] --> C[量出差距] --> D[定位到子系统] --> E[对照 Linux 源码修改] --> F[先红后绿] --> G[合入前检查] --> H[溯源]
%% 选负载 -> 两侧同环境运行 -> 量出差距 -> 定位到子系统
%%   -> 对照 Linux 源码修改 -> 先红后绿 -> 合入前检查 -> 溯源
```

| 步骤 | 做什么 | 产出 |
|:--:|:--:|:--:|
| 选负载 | 真实应用（Firefox、dnsmasq、CPython 套件）与专门的压力基准 | 能暴露问题的场景 |
| 同环境运行 | 两侧同一套 QEMU 参数、同一份根盘、同一个二进制，只换内核 | 可直接相除的数字 |
| 量出差距 | 语义看通过数是否一致，性能看比值与放大倍数 | 差距清单 |
| 定位 | 内核栈采样、分段计时、两侧同开应用日志 | 具体到函数的热点 |
| 修改 | 打开 Linux 对应源码（固定到同一提交），照它的语义与数据结构改 | 补丁，正文引到行 |
| 先红后绿 | 先只加用例，在旧实现上确认失败；再加修复确认通过 | 回归用例 |
| 合入前检查 | `fmt`、`clippy`、宿主单测、内核单测、分组系统套件 | 可合入的提交 |
| 溯源 | 每个补丁一份文件，写明对应的 Linux 源码行与 man 原文 | 能逐条核对的记录 |

### 同环境

- QEMU：两侧都是 `q35,accel=kvm:tcg -cpu max -m 6G -smp 4`，NVMe 根盘、virtio-gpu、virtio-net、SLIRP。
- 根盘：Linux 侧直接复制 StarryOS 应用构建出的镜像，只换 init。浏览器脚本、Firefox、基准程序因此必然是同一份，作业里用 `cmp` 校验。
- 内核：Linux 6.12（Alpine 的 `virt` 版）。
- 控制项：纯用户态循环 `cpu` 两侧比值是 1.00，`memcpy` 在 0.94 到 1.48。环境本身不偏向任何一边，其余比值可以直接读。
- 语义类用例另有一个更省事的参照：x86_64 上直接在宿主 Linux（WSL2 的内核）跑同一个用例，两边的通过数应当相同。

### 压力基准

`perfbench` 是一个静态链接的小程序，18 个环节，每个环节三档压力：

| 类别 | 环节 |
|:--:|:--:|
| 控制项 | `cpu`、`memcpy` |
| 系统调用与文件 | `syscall`、`open`、`stat`、`tmpwrite`、`diskwrite` |
| 内存 | `fault`、`mmap`、`unmap` |
| 事件与通信 | `epoll`、`pipe`、`unixsock`、`tcp` |
| 调度与进程 | `yield`、`futex`、`thread`、`fork`、`signal` |

判断标准是放大倍数：同一环节最高压力与最低压力的耗时比。接近 1 说明代价与规模无关，是固定开销；明显大于 1 说明内部有随规模增长的遍历或拷贝。只有 StarryOS 放大而 Linux 平坦，才是缺陷线索；两边都放大（比如 fork 随已写过的内存变慢）是正常代价。

09.16 的结果：

| 结论 | 环节（StarryOS ÷ Linux） |
|:--:|:--:|
| 随压力放大 | `epoll_wait` 13.8 至 891、`fork` 6.3 至 494、`mmap` 4.3 至 58、`munmap` 47 至 126、`open` 1.8 至 8.7 |
| 固定倍数 | 信号 30、缺页 15、线程创建 15、回环 TCP 12 |
| 已追平 | 空系统调用 0.58、`stat` 0.8、管道 0.44、unix socket 1.16、写文件 0.3 至 1.7 |

### 定位

- 内核栈采样：QEMU 的 gdb stub 每隔一段时间停一次虚拟机，对所有 CPU 取一次调用栈，汇总栈顶函数。要在负载真正在跑的时段采，页面稳定后一半以上的样本落在空闲上。
- 分段计时：浏览器脚本在每个阶段打一行标记，串口每行带宿主的单调时间戳，两侧按标记对照。
- 两侧同开应用日志：比如 Firefox 的 `MOZ_LOG` 网络日志，逐个事务对照，看差在发请求之前还是之后。

## 子系统与参考实现

Linux 源码固定在提交 `8cd9520d35a6`，PR 正文里每处改动都引到具体行。

| 子系统 | 对照得到的问题 | Linux 的做法 | 修复 | 修复前 → 修复后（Linux） |
|:--:|:--:|:--:|:--:|:--:|
| epoll | 每次等待都把所有描述符重新注册一遍 | 只看就绪链表，代价与注册数无关（`fs/eventpoll.c`） | [#2302](https://github.com/rcore-os/tgoskits/pull/2302)、[#2433](https://github.com/rcore-os/tgoskits/pull/2433) | 1020 个描述符 499.9 → 37.0 µs（0.56 µs） |
| 跨核唤醒 | 每发一次 IPI 都重建 APIC 句柄，读 CPUID 引发虚拟机退出 | 写 ICR 前只加一道串行化屏障（`arch/x86/kernel/apic/x2apic_phys.c`） | [#2432](https://github.com/rcore-os/tgoskits/pull/2432) | 回环 TCP 往返 415.7 → 129.9 µs（34.3 µs） |
| 地址空间 | 每次改映射都把整棵 VMA 树展开 | 只取与区间相交的 VMA，映射数随增删维护（`mm/mmap.c`、`mm/vma.c`） | [#2302](https://github.com/rcore-os/tgoskits/pull/2302)、[#2578](https://github.com/rcore-os/tgoskits/pull/2578) | 1024 个映射 277.1 → 96.8 µs（4.4 µs） |
| fork | 登记页归属时两两比较查重 | 游标只增不减，地址不重复由遍历方式保证（`mm/memory.c` 的 `copy_pte_range()`） | [#2577](https://github.com/rcore-os/tgoskits/pull/2577) | 64 MiB 84.5 → 14.0 ms（0.17 ms） |
| 文件锁 | 关闭描述符时扫全系统的 fd 表 | 打开文件描述的最后一个引用消失时释放（`fs/locks.c` 的 `locks_remove_file()`） | [#2576](https://github.com/rcore-os/tgoskits/pull/2576) | 持 512 个 fd 时 `open` 加 `close` 19.8 → 3.2 µs（2.3 µs） |
| slab 分配 | 分配对象时遍历整条满 slab 链表 | SLUB 默认不把满的 slab 挂在链表上 | [#2301](https://github.com/rcore-os/tgoskits/pull/2301) | 512 次分配遍历 2701 个节点 → 0 个 |
| TCP | 半关闭后状态不再更新，`poll` 不报事件 | `tcp_poll()` 按两个方向的关闭状态报 `POLLHUP`、`POLLRDHUP`（`net/ipv4/tcp.c`） | [#2575](https://github.com/rcore-os/tgoskits/pull/2575) | `nc` 等回复 16 秒后失败 → 立即返回 |
| netlink | 回复没补到 4 的倍数，读的一方越界 | 写消息时补齐（`net/netlink/af_netlink.c` 的 `__nlmsg_put()`） | [#2574](https://github.com/rcore-os/tgoskits/pull/2574) | Firefox 冷启动 12 次段错误 5 次 → 0 次 |
| unix stream | 两端共用一个等待队列，发送方把自己也唤醒 | 每端一个等待队列（`net/unix/af_unix.c`） | [#2194](https://github.com/rcore-os/tgoskits/pull/2194) | 用例 21 过 3 挂 → 24 项全部通过 |
| tty | 打开 tty 不设控制终端等五处 | `tty_open()` 的会话与前台进程组规则（`drivers/tty/tty_io.c`） | [#2426](https://github.com/rcore-os/tgoskits/pull/2426) | 远程桌面里 xterm 起不来 → 正常 |

## 浏览器启动实验

### 把启动拆成段

Firefox 从脚本开始到页面出完，中间有十几个环节。脚本在每个环节打一行标记，两侧按标记切段：

| 段 | StarryOS（秒） | Linux（秒） | 判断 |
|:--:|:--:|:--:|:--:|
| 进入脚本到清点图片加载器 | 3.8 | 2.4 | 文件系统与进程启动偏慢 |
| Weston 启动到套接字就绪 | 1.1 | 1.0 | 持平 |
| 经代理探测中继 | 1.7 | 0.9 | 偏慢 |
| `nc` 探测中继 | 16.0（失败） | 0.6 | 功能缺陷 |
| 直连取 1 MB | 0.1 | 0.0 | 持平，吞吐不是瓶颈 |
| 经中继取首页 | 1.6 | 0.6 | 偏慢 |
| 启动 Firefox 到导航完成 | 52.2 至 73.4 | 22.1 至 22.6 | 2.7 倍 |

16.0 秒正好是 SYN 重传 1+2+4+8 秒的退避之和，同一目标 `wget` 立刻成功，于是这一段从「慢」改判为「连接建立有缺陷」，后来查到是 TCP 半关闭（#2575）。

### 指标

| 指标 | 怎么取 |
|:--:|:--:|
| 启动到导航 | 标记行的时间差 |
| 导航尝试次数 | 脚本内重试计数，一次启动最多三次 |
| 已取资源数 | Firefox 缓存条目数，每 15 秒一次 |
| 内核态占比 | `/proc/<pid>/stat` 的 `utime` 与 `stime`（按实际在核时间拆分，不含阻塞） |
| 画面 | 每 10 秒取一帧 QEMU 的显示输出，统计非背景像素占比与颜色数 |

### 结果

| 指标 | 09.16 | 09.28 | Linux 6.12 |
|:--:|:--:|:--:|:--:|
| 启动到导航 | 59.2 秒 | 42.4 秒 | 22.5 秒 |
| 导航尝试次数 | 1.7 | 1 | 1 |
| `nc` 发 CONNECT | 16 秒后失败 | 0 秒 | 0 秒 |
| Firefox 内核态 CPU 占比 | 92.3% | 83.3% | 39% |

两侧同开网络日志后看到：主文档到手后，StarryOS 隔了 3.255 秒才发出第一个子资源请求，Linux 是 0.013 秒；请求的 URL 列表两边一致，没有一个失败。少取的资源是没来得及发，不是取失败。这与内核态占九成是同一件事：时间都花在了内核里。

### 对比的前提

- 两侧轮次相等：各预热一轮，再交替跑三轮取均值。曾经修复后跑一轮、修复前跑两轮取最小值，`mmap` 被量成「变慢 1.9 倍」，补齐轮次后回到 1.00。
- 同一个中继缓存：宿主上起一个带缓存的代理，两侧取的是同一份网页资源。
- 探测工具不能替被测对象下结论：busybox `nc` 在 SLIRP 上本身有问题，一度让人以为公网 4399 打不开，换 `wget` 后取到 108 个资源并完整渲染。
- Linux 侧要把输入设备配好：这版 Weston 的 DRM 后端找不到输入设备会直接退出，需要 `modprobe evdev` 并补上 udev 记录。
- 计数方法要核对：StarryOS 的 `/proc/stat` 按存活任务求和，任务退出后总数会回落，不能拿差值。
- 画面以 QEMU 的显示输出为准，不读客户机里的 `/dev/fb0`。

## 相关链接

- 周报：[09.14-09.20](https://github.com/Lfan-ke/tgoskits/wiki/周报-2026-09-14)、[09.21-09.27](https://github.com/Lfan-ke/tgoskits/wiki/周报-2026-09-21)、[09.28-10.08](https://github.com/Lfan-ke/tgoskits/wiki/周报-2026-09-28)
- 总结报告：[wiki](https://github.com/Lfan-ke/tgoskits/wiki/总结报告)
- Firefox 应用：[#2323](https://github.com/rcore-os/tgoskits/pull/2323)
