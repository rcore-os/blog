---
title: 2026春季OS训练营总结报告——StarryOS网络应用适配与测试体系构建
date: 2026-06-27 20:00:00
categories:
    - OSTraining
tags:
    - author:Antareske
    - repo:https://github.com/Antareske/2026s-OSCamp
    - 2026S
    - StarryOS
    - 网络栈
    - Linux兼容性
    - 测试框架
---

# 摘要

本次训练营我的工作主线是：围绕 StarryOS 的 Linux 网络应用兼容性，持续做「应用驱动测试 -> 问题定位修复 -> 测试框架固化」。

阶段性成果可概括为三点：

1. 完成 Nginx 和 Apache 测试框架从零到一的构建，建立 smoke/phase/debug 三层测试体系。
2. 构建网络性能测试基础设施（net-bench），集成 eBPF 观测工具，为网络栈持续优化提供工具支撑。
3. 完成 OS 功能赛 proj57（ACT 推理）QEMU 和 RK3588 两阶段交付，NPU 执行性能已优于 Linux。

---

# 一、训练营阶段工作

## 1.1 第一阶段：系统调用测试基础

在第一阶段以单一系统调用为目标，完成了事件复用和文件同步两个方向的测试与修复。

### 具体工作

1. **事件复用系统调用**
   - 实现 `epoll_create1`、`epoll_ctl`、`epoll_pwait`、`epoll_pwait2` 测试
   - 修复 `sigsetsize` 检查与 Linux ABI 不一致问题

2. **文件同步系统调用**
   - 对齐 `fsync`、`fdatasync`、`sync_file_range`、`sync`、`syncfs` 的 Linux 语义
   - 修复返回值和错误码偏差

### 对应 PR

- https://github.com/rcore-os/tgoskits/pull/658 (Merged)
- https://github.com/rcore-os/tgoskits/pull/900 (Merged)
- https://github.com/rcore-os/tgoskits/pull/903 (Merged)

---

## 1.2 第二阶段：Nginx 测试框架与多架构适配

这一阶段从龙同学（LetsWalkInLine）手中接过初步的 Nginx 支持，将其发展为完整的测试框架。

### 1.2.1 统一测试入口与分层架构

**问题背景**：
- 初始版本测试脚本分散，QEMU 配置冗余
- 缺少统一的测试模式切换机制
- 难以在 smoke/phase/debug 间快速切换

**解决方案**：
- 实现 `nginx-runner.sh` 统一 guest 入口，支持：
  - `smoke`：CI 快速验证（APK 安装 + 基础启动）
  - `phase`：阶段性功能测试（phase20-70）
  - `debug`：问题定位（单步调试、日志增强）
  - `stress`：性能压力测试
- 建立三层 QEMU 配置结构：
  - `qemu/all/`：完整功能测试配置
  - `qemu/phase/`：单个 phase 快速验证
  - `qemu/debug/`：调试专用配置（更多内存、日志输出）

**代码组织**：
```
test-suit/starryos/normal/nginx/
├── scripts/
│   ├── nginx-runner.sh          # 统一入口
│   ├── smoke/                    # CI 验证脚本
│   ├── phase/                    # 功能测试脚本
│   └── debug/                    # 调试脚本
├── qemu/
│   ├── {arch}-nginx-all.toml    # CI 默认入口
│   ├── all/*.toml               # 完整测试
│   ├── phase/*.toml             # 单阶段测试
│   └── debug/*.toml             # 调试配置
└── build-*.toml                  # 构建配置
```

### 1.2.2 关键问题定位与修复

**问题一：多 worker 卡死**
- 现象：`worker_processes 4` 时概率性卡死
- 根因：信号中断处理和 `EPOLLEXCLUSIVE` 语义不完整
- 修复：
  - 补齐 `EPOLLEXCLUSIVE` 在 `epoll_ctl` 中的正确处理
  - 修正 `accept()` 被信号中断时的返回值和重试逻辑
- PR：https://github.com/rcore-os/tgoskits/pull/1018 (Merged)

**问题二：x86_64 短连接超时**
- 现象：phase31（短连接压测）在 x86_64 上偶发 HTTP 超时
- 初步怀疑：网络栈性能问题
- 深入定位：
  - 通过分段计时发现瓶颈在 guest 侧 `curl` 进程启动
  - x86 QEMU 下外部命令启动开销高达 1-3 秒
  - Nginx 响应时间实际在毫秒级，非瓶颈
- 解决：将 `curl` 超时从 5 秒放宽到 15 秒，匹配 x86 实际开销
- 教训：性能问题需要分段计时，避免误判根因

**问题三：loongarch64 内存不足**
- 现象：loongarch64 启动后 OOM
- 根因：默认内存配置 1GB 不足以运行完整测试
- 修复：提升到 2GB，并规范化各架构内存配置

### 1.2.3 稳定性改进

1. **固定 APK 镜像版本**
   - 问题：使用 `edge` 仓库导致 glibc ABI 漂移，测试不稳定
   - 修复：固定到与 rootfs 一致的 Alpine 版本（3.19）

2. **动态启动路径修复**
   - 问题：Starry app qemu 未走动态平台启动，导致部分架构失败
   - 修复：统一通过 `axbuild` 动态启动路径
   - PR：https://github.com/rcore-os/tgoskits/pull/1267 (Merged)

### 对应 PR

- https://github.com/rcore-os/tgoskits/pull/1014 (Merged) - 初始 CI 实现
- https://github.com/rcore-os/tgoskits/pull/1018 (Merged) - 多 worker 修复
- https://github.com/rcore-os/tgoskits/pull/1038 (Merged) - 完整测试框架

---

## 1.3 第二阶段：Apache 测试实现

在 Nginx 测试框架稳定后，我参照同样的架构从零实现了 Apache MPM prefork 测试。

### 1.3.1 测试覆盖设计

Apache 测试分为 7 个 phase，覆盖从基础到高级的完整生命周期：

| Phase | 覆盖内容 | 关键验证点 |
|-------|----------|-----------|
| phase20 | 多进程管理 | prefork MPM、graceful 重启、worker 数量控制 |
| phase30 | HTTP 静态文件 | GET 请求、Content-Type、Last-Modified |
| phase40 | 目录访问 | DirectoryIndex、FancyIndexing、.htaccess |
| phase50 | 日志生命周期 | access_log/error_log、graceful 后日志追加 |
| phase55 | sendfile 与 range | 大文件传输、HTTP Range、mmap/sendfile 路径 |
| phase70 | CGI | 脚本执行、环境变量、管道通信 |
| phase80 | 模块特性 | mod_rewrite、mod_alias、mod_headers |

### 1.3.2 关键问题定位：TCP_DEFER_ACCEPT

**问题背景**：
- reviewer 环境下 Apache 启动失败，日志显示 `AH00076` 警告
- 警告内容：`setsockopt(TCP_DEFER_ACCEPT) failed: errno 92`

**深度调查**：
1. 编写 C 语言探针 `tcp-defer-accept-probe.c`（172 行）
2. 验证三个关键问题：
   - `setsockopt()` 返回值：-1
   - `errno`：92（协议不支持）
   - 监听 socket 是否可用：**可用**，能正常 `accept()`

**结论**：
- `TCP_DEFER_ACCEPT` 失败是警告而非错误
- Apache 能正常回退到标准 `accept()` 路径
- 监听 socket 完全可用，不影响功能

**smoke 范围调整**：
- 基于此结论，将 smoke 收敛到前 4 步：
  - package（APK 安装）
  - files（配置文件就位）
  - environment（环境变量）
  - config test（`apachectl configtest`）
- 移除 HTTP 测试到 `debug/apache-smoke-full.sh`

### 1.3.3 调试工具集

为问题定位实现了 9 个 debug 脚本：

1. `mpm-prefork-wait.sh`：观测 prefork worker 启动和等待
2. `accept-mutex.sh`：验证 accept mutex 行为
3. `graceful-signal.sh`：测试 graceful 重启的信号传递
4. `htaccess-path-walk.sh`：追踪 `.htaccess` 路径遍历
5. `sendfile-mmap-range.sh`：对比 sendfile/mmap 性能
6. `cgi-pipe-exec.sh`：验证 CGI 管道和脚本执行
7. `log-append-reopen.sh`：测试日志追加和重开
8. `phase20-restart.sh`：单步调试 phase20 重启逻辑
9. `tcp-defer-accept-probe.c`：setsockopt 系统调用探针

### 当前状态

- PR：https://github.com/rcore-os/tgoskits/pull/1311 (Open)
- 代码量：2367+ 行（测试脚本 + C 探针 + 配置）
- 状态：等待 review，尚未合并

---

## 1.4 网络性能测试基础设施（net-bench）

在方案二与方案三之间，我构建了网络性能测试框架，为网络栈持续优化提供工具支撑。

### 1.4.1 设计目标

- 环境自适应：自动检测 WSL2/裸 Linux、x86_64/aarch64、KVM 可用性
- 多拓扑支持：vhost（主力）、tap（降级）、slirp（功能冒烟）
- 自动化：配置、测试、清理全流程自动化
- 稳定性：状态跟踪、资源清理、回退保护

### 1.4.2 实现架构

**环境检测与配置**：
```bash
# env/detect-env.sh
- 检测平台：WSL2 vs 裸 Linux
- 检测架构：x86_64 vs aarch64
- 检测 KVM：/dev/kvm 可用性
- 检测 vhost-net：/dev/vhost-net 可用性

# env/setup-common.sh
- 创建 br0 桥接
- 创建 tap0 设备
- 启动 iperf3 server
- 启动 dnsmasq DHCP
- 状态写入 .bench-state.json
```

**测试拓扑**：
| 拓扑 | 说明 | 适用场景 |
|------|------|----------|
| vhost | TAP + vhost-net | 主力性能测试（需 sudo + KVM）|
| tap | TAP without vhost | 降级方案（需 sudo）|
| slirp | QEMU usermode | 功能冒烟（无需 sudo）|

**测试覆盖**：
| Test ID | 说明 | iperf3 参数 |
|---------|------|-------------|
| tcp1 | TCP 单流上行 | `-c $HOST` |
| tcp4 | TCP 4 并发流 | `-P 4` |
| tcp1r | TCP 单流下行 | `-R` (reverse) |
| udp1g | UDP 大包 1Gbps | `-u -b 1G` |
| udp64 | UDP 64B 小包 | `-u -l 64` |

每个测试：1 次 warmup + 5 次正式测量

**清理与回退**：
```bash
# env/teardown.sh
- 读取 .bench-state.json
- 清理 tap0、br0
- 终止 iperf3、dnsmasq
- 清理状态文件
```

### 1.4.3 eBPF 网络观测工具

依托 CN-TangLin 同学的 eBPF 内核运行时（#848、#850、#886），实现了 `net_stats` 观测工具。

**实现原理**：
- kprobe 入口：统计调用次数（`*_pkts`）
- kretprobe 出口：统计字节数（`*_bytes`）
- 探测符号：
  - `ax_net::tcp::TcpSocket::send`
  - `ax_net::tcp::TcpSocket::recv`
  - `ax_net::udp::UdpSocket::send`
  - `ax_net::udp::UdpSocket::recv`

**技术特点**：
- Rust v0 mangled 符号解析
- Multi-symbol attach（同一探针 attach 到多个 monomorphized 符号）
- 内置 loopback 自测（`--test` 模式）

**已知限制**：
- `*_pkts` 实际是调用次数，非真实包数
- 统计层级是 socket 层，不含 TCP/IP header
- SMP 并发计数非原子，高并发可能丢失增量

**当前状态**：
- x86_64 self-test 通过
- 与 net-bench 的自动集成尚在完善（before/after 采样位置需调整）

### 对应分支

- `feat/net-enhance` (未合并)
- 提交：`394bb6414`, `7e11d94e4`, `78fd92817`

---

## 1.5 OS 功能赛 proj57：ACT 推理

### 1.5.1 赛题背景

在 rk3588/sg2002 开发板上实现 ACT（Action Chunking Transformer）模型推理，为移动机器人提供感知-决策能力。

**推理规格**：
- 输入：RGB 图像 224x224 + 机器人状态 `[left_vel, right_vel]`
- 输出：8 步动作序列 `[left_vel, right_vel, gripper_target]`
- 预处理：ImageNet 归一化 + QUANTILES 归一化
- 后处理：动作反归一化 + 方向判断

### 1.5.2 QEMU 阶段（5月28日）

**快速原型**：
- 第一天即在 QEMU StarryOS 中跑通 ACT 推理
- 推理引擎：`tract`（纯 Rust ONNX runtime）
- 平台：QEMU riscv64 + musl

**关键指标**：
- 模型：193.25 MiB ONNX
- 二进制：~17.26 MiB (riscv64)
- 推理耗时：~25,233 ms
- 验证：golden 对照通过

### 1.5.3 RK3588 阶段（6月2日-6月13日）

**6月2日**：rk3588 到货

**6月3日-6月7日**：镜像构建探索
- 研究香橙派官方镜像结构
- 分析 FIT image、U-Boot、DTB 布局
- 手动构建 StarryOS 启动链

**6月8日-6月9日**：RKNN 推理实现
- 集成 RKNPU2 runtime SDK
- 实现 ONNX → RKNN 转换
- 完成用户态推理程序

**6月10日**：多核与局部更新
- 更新 StarryOS 镜像支持多核
- 实现镜像局部更新脚本（避免完整重刷）

**6月11日**：突破与验证
- 关键决策：更换为官方香橙派 DTB 以支持 NPU 驱动
- 在板上跑通 ACT 推理，输出正确
- 验证：golden 对照通过，左转/右转样例通过

**6月13日-6月15日**：性能对比与文档
- 实现分阶段计时（模型加载/预处理/NPU 执行/后处理）
- StarryOS vs Linux 对比测试
- 固化镜像构建工作流（rootfs overlay + FIT repack）
- 撰写交付报告和复现文档

### 1.5.4 关键技术突破

**镜像构建固化**：
```bash
# 工作流
1. build-overlay-rootfs.sh  # 构建 ACT 程序 overlay
2. make-dtb.sh              # 提取官方 DTB
3. repack-fit.sh            # 重新打包 FIT image
4. build-image.sh           # 生成最终镜像
```

**性能优化**：
| 阶段 | Linux | StarryOS | 倍数 |
|------|-------|----------|------|
| NPU 执行 | 32.4ms | 28.6ms | 0.88x |
| 端到端 | 22.3ms | 29.9ms | 1.34x |
| 模型加载 | 37ms | 228ms | 6.17x |

**结论**：
- NPU 执行阶段 StarryOS 已优于 Linux
- 瓶颈在模型加载和预处理，非推理核心

### 1.5.5 SG2002 计划

- 当前状态：尚未开始
- 后续：申请 sg2002 开发板
- 技术路径：ONNX → CVITEK TPU，参考 rk3588 流程

### 对应分支

- `proj57` (未合并)
- 位置：`wt-proj57/proj57/{qemu,rk3588}/`

---

# 二、方法与经验

## 2.1 测试框架设计模式

在 Nginx 和 Apache 测试中形成的可复用模式：

1. **三层测试体系**
   - smoke：CI 快速验证，覆盖基础功能
   - phase：阶段性递进测试，覆盖完整生命周期
   - debug：自由度高的问题定位脚本

2. **统一 runner 架构**
   - 单一入口脚本
   - 模式切换通过参数控制
   - 超时和清理统一处理

3. **分层 QEMU 配置**
   - `qemu/all/`：完整测试（CI 默认）
   - `qemu/phase/`：单阶段快速验证
   - `qemu/debug/`：调试配置（更多资源）

## 2.2 典型教训

1. **性能问题需分段计时**
   - x86 短连接超时案例：误判为网络栈问题，实际是进程启动开销
   - 教训：先做分段计时，再下结论

2. **smoke 测试范围要保守**
   - Apache `TCP_DEFER_ACCEPT` 案例：在 reviewer 环境失败
   - 策略：smoke 只覆盖确定可用的功能，可选特性放到 debug

3. **小步快跑的重要性**
   - 反面案例：方案三很多想法（网络命名空间、流水线推理）未落地
   - 原因：步子太大，未及时拆分和提交

## 2.3 工具建设的价值

net-bench 和 eBPF 工具虽然尚未完全成熟，但建立了方法论：
- 自动化环境配置和清理
- 状态跟踪和回退保护
- 内核态观测能力（eBPF）

这些为后续网络栈持续优化提供了基础。

---

# 三、产出索引

## 3.1 已合并 PR（共 9 个）

- #658: epoll 测试
- #900: epoll/sigmask sigsetsize 修复
- #903: 文件同步系统调用对齐
- #1014: Nginx CI 初始实现
- #1018: 多 worker 信号中断修复
- #1038: Nginx 完整测试框架
- #1267: 动态启动路径修复
- #1297: x86 IPI 修复
- #1316: VmPeak & VmHWM 增强

## 3.2 开放 PR（共 1 个）

- #1311: Apache 测试框架 (Open)

## 3.3 独立分支（未合并）

- `test/alpine-nginx`：Nginx 测试最新版本
- `test/alpine-apache`：Apache 测试
- `feat/net-enhance`：网络性能测试框架
- `proj57`：ACT 推理 QEMU + RK3588

## 3.4 工作仓库

- Fork 仓库：https://github.com/Antareske/tgoskits
- 上游仓库：https://github.com/rcore-os/tgoskits

---

# 四、致谢与总结

感谢助教 Mr Graveyard（方案一）、Ajax（rk3588）、周睿老师（rk3588 NPU 优化和 PR review）的帮助。感谢同组学员 aptacc2421、WellDown64 的讨论交流，感谢龙同学（LetsWalkInLine）交接的初步 Nginx 支持。特别感谢 CN-TangLin 同学的 eBPF 内核运行时工作，为网络观测工具提供了基础。

这次训练营让我从"写测试"进阶到"建框架"，从"跑通功能"深入到"定位根因"。最大的收获不是代码量，而是工程方法上的变化：更重视测试覆盖、问题跟踪和工具建设，也更能把复杂问题拆成可验证的小问题逐步推进。

后续计划：完善 net-bench 集成、推动 Apache 测试合并、完成 sg2002 ACT 推理、参与网络栈持续优化。

<!-- more -->
