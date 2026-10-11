---
title: 'Leo Cheng: 26.07-10 实习总结报告'
date: 2026-10-04 14:00:00
categories:
    - Leo Cheng
tags:
    - author:heke1228
    - repo:https://github.com/rcore-os/tgoskits
    - wiki:https://github.com/Lfan-ke/tgoskits/wiki
    - StarryOS
    - Firefox
    - Linux 对照
    - 系统调用
    - 溯源
---

实习期自 2026-07 起。期间与 Agent 集群协作提交 88 个 PR，合入 36 个；其余多为计算与渲染用例，不验证内核语义，按收录范围撤下。本页只讲实习开始后提交的工作，分三段：用真实应用补/测内核，把浏览器跑起来并对照 Linux 提速，把系统调用拆成可替换的包。末尾是对全部内核补丁的溯源。

<!-- more -->

## 应用测试与子系统补全

把真实软件装进镜像跑，跑不通就对照 Linux 源码补内核，补完留回归用例。

应用：dropbear、dnsmasq、监控栈、科学计算与机器学习（SciPy、Numba、scikit-learn）、多媒体与流媒体栈、单核并发，以及 StarryWRT（OpenWrt 用户态，[#1580](https://github.com/rcore-os/tgoskits/pull/1580)）。

| 负载 | 补上的内核功能 |
|:--:|:--:|
| 监控栈 | `/proc/vmstat`（[#1525](https://github.com/rcore-os/tgoskits/pull/1525)） |
| Envoy | `/proc/pid/comm` 的填充；非阻塞 TCP 部分发送（[#1558](https://github.com/rcore-os/tgoskits/pull/1558)） |
| dnsmasq | `IP_MTU_DISCOVER`、UDP 关闭前冲刷（[#1568](https://github.com/rcore-os/tgoskits/pull/1568)）；`SIOCGIFNAME`（[#1707](https://github.com/rcore-os/tgoskits/pull/1707)） |
| 浏览器依赖的系统调用 | 一批系统调用按 Linux 的语义补齐（[#1569](https://github.com/rcore-os/tgoskits/pull/1569)）；同步故障信号优先投递（[#1700](https://github.com/rcore-os/tgoskits/pull/1700)） |
| 每次关机 | 卸载根文件系统必然失败，改为尽力而为（[#1711](https://github.com/rcore-os/tgoskits/pull/1711)） |

新实现：POSIX 消息队列及一致性套件（[#1564](https://github.com/rcore-os/tgoskits/pull/1564)、[#1565](https://github.com/rcore-os/tgoskits/pull/1565)）、TUN/TAP（[#1566](https://github.com/rcore-os/tgoskits/pull/1566)、[#1567](https://github.com/rcore-os/tgoskits/pull/1567)）。

对照 Linux 源码改正：`times`、`select`、`arch_prctl`（[#2263](https://github.com/rcore-os/tgoskits/pull/2263)、[#2260](https://github.com/rcore-os/tgoskits/pull/2260)、[#2259](https://github.com/rcore-os/tgoskits/pull/2259)）；`setns` 与 id 映射的特权只认初始 user namespace（[#2266](https://github.com/rcore-os/tgoskits/pull/2266)）。

## 浏览器启动与优化

NetSurf 四架构出图 → Firefox 经 Weston 显示 → 经 HTTPS 打开 4399 → 软件渲染与 virgl 两路（[#2323](https://github.com/rcore-os/tgoskits/pull/2323)）→ 与 Linux 6.12 对照。

对照只换内核：同一套 QEMU、同一份根盘、同一个二进制。证据三层：Firefox 端到端、18 个环节的压力基准、内核栈采样。

| 对照用例 | 问题 | 修复 | 修复前 | 修复后 | Linux |
|:--:|:--:|:--:|:--:|:--:|:--:|
| 回环 TCP 往返 | 每次发 IPI 都重建 APIC 句柄 | [#2432](https://github.com/rcore-os/tgoskits/pull/2432) | 415.7 µs | 129.9 µs | 34.3 µs |
| epoll 等待（1020 个 fd） | 每次等待都把所有 fd 重新注册一遍 | [#2302](https://github.com/rcore-os/tgoskits/pull/2302)、[#2433](https://github.com/rcore-os/tgoskits/pull/2433) | 499.9 µs | 37.0 µs | 0.56 µs |
| fork（64 MiB） | 逐页查重是平方级 | [#2577](https://github.com/rcore-os/tgoskits/pull/2577) | 84.5 ms | 14.0 ms | 0.17 ms |
| open 加 close（持有 512 个 fd） | close 扫全系统 fd 表 | [#2576](https://github.com/rcore-os/tgoskits/pull/2576) | 19.8 µs | 3.2 µs | 2.3 µs |
| mmap 加 munmap（1024 个映射） | 每次操作展开整棵 VMA 树 | [#2302](https://github.com/rcore-os/tgoskits/pull/2302)、[#2578](https://github.com/rcore-os/tgoskits/pull/2578) | 277.1 µs | 96.8 µs | 4.4 µs |
| 内核栈采样 | 分配对象时遍历整条 full slab 链表 | [#2301](https://github.com/rcore-os/tgoskits/pull/2301) | 512 次分配遍历 2701 个节点 | 0 个 | -- |
| `nc` 发 CONNECT | TCP 半关闭后，状态变了却没通知出去 | [#2575](https://github.com/rcore-os/tgoskits/pull/2575) | 16 秒后失败 | 0 秒 | 0 秒 |
| Firefox 冷启动 12 次 | netlink 回复没补到 4 的倍数，读的一方越界 | [#2574](https://github.com/rcore-os/tgoskits/pull/2574) | 段错误 5 次 | 0 次 | 0 次 |
| 远程桌面里起 xterm | 打开 tty 不设控制终端等五处 | [#2426](https://github.com/rcore-os/tgoskits/pull/2426) | 起不来 | 正常 | 正常 |
| 鼠标放久了不跟手 | epoll 套 epoll 时，唤醒被已失效的等待项拿走 | dev 已换实现，补用例 [#2378](https://github.com/rcore-os/tgoskits/pull/2378) | 不跟手 | 正常 | 正常 |
| 事件循环单核空转 | unix stream 两端共用一个等待队列 | [#2194](https://github.com/rcore-os/tgoskits/pull/2194) | 21 过 3 挂 | 24 项全部通过 | 24 项全部通过 |
| Firefox 启动到导航 | 以上各项之和 | 全部合到一处 | 59.2 秒 | 42.4 秒 | 22.5 秒 |

已追平：空系统调用、管道、`stat`、unix socket、写文件。未追平（10.04 在最新 dev 上重测）：解除映射 84 倍、epoll 等待 78 倍、fork 67 倍、mmap 64 倍、信号投递 30 倍、缺页 8.7 倍；页面资源只取到 Linux 的一半。

## 系统调用包抽象线

设计见 [#2202](https://github.com/rcore-os/tgoskits/issues/2202)。硬件与应用不变，操作系统只是用不同规范组织同一批能力。把系统调用从内核拆出来做成包，每套规范是一个系统调用参考实现，内核只留能力端口与分发。

| 包 | 作用 |
|:--:|:--:|
| `ax-dispatch` | 注册参考实现，按进程所属的 ABI 分发陷入 |
| `ax-binfmt` | 识别并加载 ELF、PE、Mach-O |
| `ax-abi-port` | 能力端口：文件、内存、进程、信号、时钟等，内核只实现一遍 |
| `ax-abi-linux`、`ax-abi-windows`、`ax-abi-darwin` | 三套参考实现 |
| `ax-abi` | 分发包：按 feature 选哪几套进链接，给出默认分发策略 |

内核侧三处改动：进程控制块加 `abi_slot`，加载镜像时记下所属 ABI，陷入时按它直接取实现；加载器不再解析 ELF，读文件头后交给认领它的包；一个适配器让端口直接使用内核已有的 fd 表、地址空间、线程与时钟上。

| 参考实现 | 验证用的二进制 | CPython 3.14 套件（23 个模块） |
|:--:|:--:|:--:|
| Linux | Alpine 的 CPython 3.14.7 | 23 个全部通过 |
| Windows | python.org 的 Windows 版 | 19 个通过 |
| Darwin | python.org 的 macOS 版 CPython 3.14.7 | 交互解释器可用，`platform.platform()` 得 `Darwin-20.6.0-x86_64-64bit`，扩展模块在导入时加载 |

代码在 fork 的 [`feat-personality-win`](https://github.com/Lfan-ke/tgoskits/tree/feat-personality-win)（Linux 与 Windows）与 [`feat-personality-mac`](https://github.com/Lfan-ke/tgoskits/tree/feat-personality-mac)（Darwin）；设计与跑法见 [`docs/design/syscall-abi-packages.md`](https://github.com/Lfan-ke/tgoskits/blob/feat-personality-win/docs/design/syscall-abi-packages.md)。

## 代码溯源

对全部 68 个内核补丁逐个溯源，已全部完成；其中 24 个是实习期间提交的。每个补丁一份文件，写明问题与原因、改动与影响范围、Linux 源码的具体行、man 原文与验证结果，这部分属于是一开始没有考虑周到，如果一开始的工作流就协调输出这些溯源对照文件，那么也就不需要直到最后才统一处理专门花费时间做此项工作。

| 项 | 数量 |
|:--:|:--:|
| 溯源文件 | 68 |
| Linux 源码链接，固定到同一提交的具体行 | 746 |
| man 手册引文，与 6.19 版原文逐字相同 | 207 |
| 记了问题的文件 | 51 |

引用由脚本逐条核对，零错误。发现分四类：

| 类别 | 例 |
|:--:|:--:|
| 补丁的行为与 Linux 仍有出入 | [#720](https://github.com/rcore-os/blog/blob/master/source/_posts/Leo%20Cheng%EF%BC%9A26.07-10%20%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A/_trace/pr-720.md)：路径末尾带斜杠加 `O_CREAT`，Linux 返回 `EISDIR`，补丁返回 `ENOENT` 或 `ENOTDIR` |
| 正文与合入的 diff 不符 | [#1164](https://github.com/rcore-os/blog/blob/master/source/_posts/Leo%20Cheng%EF%BC%9A26.07-10%20%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A/_trace/pr-1164.md)：正文写越界得 `SIGBUS`，合入时是 `SIGSEGV` |
| 回归用例拦不住回归 | [#1124](https://github.com/rcore-os/blog/blob/master/source/_posts/Leo%20Cheng%EF%BC%9A26.07-10%20%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A/_trace/pr-1124.md)：按修复前的代码推演，用例在修复前也会通过 |
| 改动已被后续提交取代 | [#2302](https://github.com/rcore-os/blog/blob/master/source/_posts/Leo%20Cheng%EF%BC%9A26.07-10%20%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A/_trace/pr-2302.md) 的 epoll 部分被 [#2456](https://github.com/rcore-os/tgoskits/pull/2456) 取代 |

## 之后

- 个人：闭关消化现有知识存量。
- 项目：完成深度学习库的测试；继续修缮系统调用的抽象包。

## 相关链接

- wiki 原页：[总结报告](https://github.com/Lfan-ke/tgoskits/wiki/总结报告)，周报见 [wiki 首页](https://github.com/Lfan-ke/tgoskits/wiki)
- 系统调用参考实现：[`feat-personality-win`](https://github.com/Lfan-ke/tgoskits/tree/feat-personality-win)、[`feat-personality-mac`](https://github.com/Lfan-ke/tgoskits/tree/feat-personality-mac)
- 总结 PPT：[Lfan-ke/tgoskits 的 ppt 分支](https://github.com/Lfan-ke/tgoskits/tree/ppt)
- 演示视频：[Lfan-ke/hw4os-s5d1t2 的 video 分支](https://github.com/Lfan-ke/hw4os-s5d1t2/tree/video)
- 75 份溯源文件：[README](https://github.com/rcore-os/blog/blob/master/source/_posts/Leo%20Cheng%EF%BC%9A26.07-10%20%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A/_trace/README.md)
