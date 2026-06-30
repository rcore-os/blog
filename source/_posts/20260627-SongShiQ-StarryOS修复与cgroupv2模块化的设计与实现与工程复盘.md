---
title: StarryOS 修复与cgroup v2 模块化的设计、实现与工程复盘
date: 2026-06-27
categories:
    - summary
tags:
    - author:SongShiQ
    - repo:tgoskits
    - 2026S
    - StarryOS
    - cgroup
    - syscall
---
# StarryOS 修复与 cgroup v2 模块化的设计、实现与工程复盘

> 作者:宋红 | 上游:rcore-os/tgoskits | fork:SongShiQ/tgoskits
> 训练营:2026 春季开源操作系统训练营(项目阶段八周:2026-05-13 ~ 2026-06-28)

---

## 一、摘要 / 项目背景与目标

我在 2026 春季 OS 训练营的**项目阶段**里,在 **StarryOS**上做了一些真实的开源贡献，也谨以此文记录我在本次训练营中的工作与感悟。

**项目主体**沿导师"项目总览"给出的三方向递进:

- **方案一(打基础)**:选 syscall,走"读 man 手册 → 写用户态测例 → 在 StarryOS 跑、定位 assert 失败 → 修内核"的全流程;
- **方案二(主线)**:通过添加配置让真实 Linux 应用(sqlite3 / busybox / llama.cpp / 动态链接程序)在 StarryOS 上跑起来,用真实应用反推 OS 缺陷;
- **方案三(扩展)**:cgroup v2 资源控制子系统——这是压轴,计划设计一个**可扩展的控制器框架**,让 pids/cpu/memory/cpuset/io 五个控制器各自独立、可配置、可插拔。

---

## 二、分阶段工作脉络

本次训练营的工作任务分八周逐级展开,每一阶段都为下一阶段打地基:

```
基础阶段(前置铺垫,简述)
  rCore 闯关 / ArceOS 先导 / Rust / Docker —— 建立"什么是 syscall/进程/文件系统"的基本认知
        │
        ▼
方案一:syscall 兼容(第一~二周)
  #656 dup/fcntl/flock 修 5 个内核 bug —— "读 man→写测例→定位→修内核"全流程跑通
  #778 dup2/close_range/ioctl 测例重构 —— 测例本身是最经济的回归保护
        │
        ▼
方案二:真实应用兼容(第三~四周)
  #895 sqlite3 多架构压力测试 / #993 busybox 高副作用 applet
  #1006 llama.cpp Alpine/musl / #1041 musl 动态链接 / #1048 glibc 动态链接
  #1033 riscv64 static-pie ELF loader 段错误修复(从 llama.cpp 暴露的深层 bug)
        │
        ▼
方案三:cgroup v2 模块化(第四~八周,压轴)
  #1107 写死 match → #1156 迭代仍耦合 →(读 Asterinas SysTree)→
  #1234 工厂注册表独立 crate → #1379 L4 资源管控 + manager 接口
```

递进关系也展现了我能力成长的路径:syscall的修复教会了我读内核调用链,测例体系让我组建了"先 Linux 基线再 StarryOS"的工作流,处理sqlite这类真实应用让我理解了ELF loader 这样的深层 bug,而 cgroup 使我完成了从"会改代码"到"会设计架构"的跃迁。

---

## 三、主要工作的详细展开

每个 PR 按闭环结构展开:**任务目标 → 实现描述 → 测试方法与环境 → 测试结果与数据 → 结论与链接**。

### 3.1 方案一:syscall 兼容性

#### PR #656 — dup/fcntl/flock 兼容性修复(首个 merged)

- **任务目标**:`test_dup_v2.c` 的 78 个断言里有 5 个 FAIL,修掉这组内核 bug。
- **实现描述**:
  - fcntl 未识别 cmd 原本返 `Ok(0)` 兜底 → 改返 `EINVAL`(错误码即契约);
  - `F_DUPFD` 忽略 arg → 新增 `dup_fd_min(arg)`,从 arg 起在 fd 表线性搜空位;
  - `O_APPEND` 不生效 → 在 ax-fs `File` 加 `append: AtomicBool`,write 路径检查并主动 seek-EOF;
  - flock/F_SETLK 空存根 → 接上 dev 已合入的 `lock.rs` dispatch。
- **测试方法与环境**:aarch64 QEMU,先在 glibc Docker 跑 Linux 基线确认规范理解正确,再上 StarryOS。
- **结果与数据**:dup-fcntl **106 个断言**,Linux 基线 100% PASS,StarryOS aarch64 75/78(3 个为 ax-fs 设计层限制,诚实标注不在本 PR 范围)。修复 syscall 5 个。
- **结论与链接**:+671/-49,12 文件,7 commits,4 reviews,CI 19✓。https://github.com/rcore-os/tgoskits/pull/656
- **代码锚点**:`kernel/src/syscall/fs/fd_ops.rs`、`kernel/src/file/fs.rs`。

#### PR #778 — dup2/close_range/ioctl 测例重构(纯测试 PR)

- **任务目标**:把 #656 的 800 行单文件 `test_dup_v2.c` 拆成可维护的 parts 化骨架,并为新 syscall 补测例。
- **实现描述**:`test_framework.h` 加 `CHECK_RET`/`CHECK_ERR_SAVED` 宏;800 行拆成 Part 01–26;新写 test-dup2(7 parts×36 断言)、test-close-range(5 parts×49 断言)、test-ioctl(4 parts×11 断言)。
- **测试结果**:Linux 基线 **202 PASS / 0 FAIL / 8 observe / 1 skip**(observe = 规范允许的合理变体,不当 FAIL)。StarryOS QEMU 因 `tokio pipe` 已知问题阻塞,诚实标注非测试逻辑问题、不伪造通过率。
- **结论**:+2347/-419,31 文件,6 commits,4 reviews,CI 20✓,1 天合并。**4 套测例 / 42 parts / 202 断言**。https://github.com/rcore-os/tgoskits/pull/778

### 3.2 方案二:真实应用兼容与测试体系

#### PR #895 — sqlite3 CLI 多架构压力测试

- **任务目标**:让 Alpine 发行版的 `sqlite3` CLI(musl 完整栈)在 StarryOS 四架构跑通。
- **实现描述**:smoke 组 S0–S4(进程能起、IO 通路在)+ deep 组 S5–S8(DELETE journal/COMMIT/ROLLBACK、WAL 持久化、500 行 + integrity_check、64KiB BLOB 重开);`apk add --no-cache sqlite` 触发 Alpine 包安装。
- **测试结果**:aarch64/x86_64/riscv64/loongarch64 smoke+deep 全 PASS;SQLite 3.51.2,QEMU 10.2.1。**2 组 / 9 测试点 / 4 架构 ×2 = 8 toml**。
- **关键调试故事**:loongarch64 我一开始把内存提到 2G,reviewer 质疑"其他架构 512M 你为啥 2G",定位后发现是 apk-curl 既有问题,不是 sqlite3 需要——改回 512M、timeout 提到 600s 解决。**这是被 review 教会"先定位问题再调参"的典型。**
- **结论**:+592/-0,16 文件,11 commits(4 个 Merge dev),10 reviews,CI 23✓。https://github.com/rcore-os/tgoskits/pull/895

#### PR #993 — busybox 7 高副作用 applet 安全失败测试

- **任务目标**:测 insmod/fdflush/raidautorun/killall5/rdev/setlogcons/resize 这类"真做会破坏环境"的 applet。
- **实现描述**:不测真实行为,测**错误处理路径**——给不存在的设备/模块,验返回非零 + 合理错误信息(`rc≠124` 非 timeout,进一步 `rc≠0` 且输出含 "No such"/"not found" 等)。resize 输出终端转义序列污染 EXIT 解析 → 重定向 `/dev/null` 只取 RC;为防 util-linux CI timeout 误判,单独提 commit 调高 timeout + 加 completion marker(先观测再调参)。
- **结论**:+103/-2,4 文件,3 commits,3 reviews 全批准,CI 23✓,1 天合并。新增 7 applet 测试。crontab/crond 因 daemon hang 诚实留 follow-up。https://github.com/rcore-os/tgoskits/pull/993

#### PR #1006 — llama.cpp Alpine/musl 兼容性迁移

- **任务目标**:让大模型推理运行时 llama.cpp 在三架构跑通(mmap/浮点/内存压力更大)。
- **实现描述**:`CMAKE_CROSSCOMPILING=ON`+`CMAKE_C_COMPILER_WORKS=ON` 跳过交叉编译 `try_run`;QEMU TCG 不支持 RVV → `-DGGML_RVV=OFF`;x86_64 加 `-cpu max`;riscv64 static-pie 段错误 → 当时用非 PIE 静态链接规避(这正是 #1033 的根因首次暴露)。
- **测试结果**:三架构 tok/s 基线(aarch64 1.39 / x86_64 0.60 / riscv64 0.72),SmolLM2-135M Q4_0。loongarch64 工具链 404、mmap 未验证、aarch64 L5 kretprobe panic 全部诚实写入 PR body。
- **结论**:+240/-2,12 文件,9 commits,2 reviews,CI 23✓。https://github.com/rcore-os/tgoskits/pull/1006

#### PR #1041 — musl 动态链接 smoke test(3 架构)

- **任务目标**:验证 ELF loader 的 INTERP 段加载(`ld-musl-*.so.1`)与 NEED 依赖解析——动态链接是"像 Linux 一样"的关键。
- **实现描述**:最小程序 `dynamic-test.c`(跑不起来就说明 INTERP 加载本身有问题);`readelf -l` 提取 INTERP 按 basename 安装 ld-musl;riscv64 加 `-Wl,--strip-debug`(lld 不支持 RISC-V debug relocation),x86_64 加 `-cpu max`。
- **结论**:+309/-0,10 文件,7 commits(最多 review 的 PR 之一,7 轮,主要命名规范),CI 24✓。https://github.com/rcore-os/tgoskits/pull/1041

#### PR #1048 — glibc 动态链接测试(3 架构)

- **任务目标**:glibc 比 musl 严苛得多(ld-linux 复杂、pthread 依赖 NPTL、regex 依赖 locale),跑通说明 ELF loader 与 syscall 兼容已相当成熟。
- **实现描述**:4 子测试逐步深入——glibc-smoke(基础)/proc-self-exe(readlink `/proc/self/exe`)/pthread(clone/tls/futex)/regex(POSIX 正则);额外加 Debian rootfs 变体(glibc INTERP 与 Alpine musl 不同,toml 分开)。
- **结论**:+437/-1,16 文件,9 commits,4 reviews,CI 24✓。https://github.com/rcore-os/tgoskits/pull/1048

### 3.3 方案二深层:OS bug 根因修复

#### PR #1033 — riscv64 static-pie ELF loader 段错误修复

- **任务目标**:#1006 暴露的 riscv64 static-pie(Type=DYN)二进制直接段错误,这是 ELF loader 根因 bug——修好它意味着 StarryOS 能正确加载现代 Linux 发行版默认的 PIE 二进制。
- **调试与实现**(7 commits 逐层递进):
  1. QEMU 捕获 segfault 地址 → 反查 ELF 程序头 → 发现 relocation 目标在未映射区;
  2. 新增 `vaddr_to_file_offset()`(搜 PT_LOAD 段算 `segment_offset+(vaddr-segment_vaddr)`)替代错误的 `checked_sub(base)`;
  3. 加 `populate_area()` 确保 relocation 写入前页面已映射;
  4. 修 `R_RISCV_64`/`R_RISCV_JUMP_SLOT`,`st_value==0` 未定义符号跳过不覆写 GOT,`R_RISCV_COPY` 计数跳过;
  5. 加 `static-pie-test` 回归测试 + busybox 回归确认不影响非 PIE 路径。
- **结论**:+402/-0,6 文件,7 commits,4 reviews,CI 25✓。**修复 1 个 OS bug,影响 riscv64 所有 PIE 二进制加载**。https://github.com/rcore-os/tgoskits/pull/1033

### 3.4 方案三:cgroup v2 模块化

cgroup 是技术深度最高、最能体现"学习→构建→反思→重做"的工作,在第五章与第六章详写:

- **#1107**:cgroup v2 核心框架 + pids/cpu 控制器,但**写死在 CgroupNode 的 match 分支**——加控制器要改核心结构。
- **#1156**:在用户已有基础上迭代(try_fork CAS、bandwidth throttling 框架),10 轮 review、7 次 CHANGES_REQUESTED,**仍非模块化**,主动关闭。
- **#1234**:读 Asterinas SysTree 后重构为 **ax-cgroup 独立 crate**(工厂注册表 + CgroupController trait),5 控制器、~18 属性、6 设计巧思。当前 OPEN,CHANGES_REQUESTED。
- **#1379**:在 #1234 框架上把控制器从"状态正确"推进到"逻辑闭环 + 可测 + systemd/docker 可探测",10 commits,Draft,base=dev 独立(与 #1234 平行,非 stack)。

---

## 四、量化成果与效果

### 4.1 总览量化表

| 维度                       | 数据                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| PR 总数                    | 12(8 merged + 2 主动关闭 +#1234 OPEN + #1379 Draft)                   |
| 代码贡献(merged 合计)      | +5101 / -473,107 文件,59 commits                                      |
| review 往返(merged 合计)   | 38 reviews                                                            |
| CI(merged 合计)            | 181 ✓ + 193 跳过(架构无关)                                           |
| 测试断言(syscall/测试类)   | 202 个(Linux 基线全 PASS)                                             |
| 架构覆盖                   | aarch64 / riscv64 / x86_64 / loongarch64                              |
| 修复 syscall               | 7(dup/dup2/dup3/fcntl/flock/close_range/ioctl)                        |
| OS bug 根因修复            | 1(riscv64 static-pie ELF relocation)                                  |
| Linux app 适配             | 5(sqlite3/busybox/llama.cpp/musl-dynamic/glibc-dynamic)               |
| cgroup 控制器              | 5(pids/cpu/memory/cpuset/io)                                          |
| cgroup 属性                | ~18 个                                                                |
| cgroup 设计巧思            | 6 个                                                                  |
| cgroup host 单测           | **8 模块 / 41 测试函数**(全部 `cargo test -p ax-cgroup` 通过) |
| cgroup 新增代码(goal 分支) | +1401 行,22 文件,10 commits(vs feat/cgroup-unified-rebased)           |

### 4.2 cgroup 三次尝试的架构演进

| 维度        | #1107           | #1156          | #1234                        |
| ----------- | --------------- | -------------- | ---------------------------- |
| 架构        | 内嵌 match 分支 | 内嵌,迭代改进  | 独立 crate + 工厂注册表      |
| 控制器数    | 2(pids/cpu)     | 2(pids/cpu)    | 5(pids/cpu/memory/cpuset/io) |
| 可扩展性    | 加控制器改核心  | 加控制器改核心 | 实现 trait + 注册 1 行       |
| 与内核耦合  | 强耦合          | 强耦合         | 依赖倒置(CgroupProvider)     |
| Review 轮次 | 1               | 10(7 改)       | 38(20 改)                    |
| 状态        | 主动关闭        | 主动关闭       | OPEN(进行中)                 |

### 4.3 数据的可信边界

- **可信指标**:断言数、PASS/FAIL 数、CI ✓ 数、代码行数/文件数/commit 数——均可溯源到 PR 或 `git`/`gh` 实测。
- **不完全可信**:llama.cpp 的 tok/s 在 QEMU TCG 上是数量级参考,不代表真实硬件性能。
- **未验证项**:cgroup 端到端 QEMU 四架构未全绿;L4 真实资源管控(cpu.max 调度跳过、memory 页分配器 charge、io 块层限流)未端到端验证——详见第六章诚实缺口。

---

## 五、cgroup构建详述

### 5.1 工厂注册表统一框架(整个项目的技术核心)

**解决的耦合**:#1107/#1156 把每个控制器的逻辑写死在 `CgroupNode` 的 `match controller_name` 分支里,加一个控制器就要改核心数据结构,违反开闭原则，我参考了Linux和星绽os的实现，对starryos的cgroup部分做了框内核风格的设计，以追求cgroup与内核的解耦，也能更符合starryos的模块化设计理念。

**框架设计**:

```
ax-cgroup(#![no_std],OS 无关独立 crate)
├── controller.rs:  CgroupController trait + CgroupControllerFactory trait + FACTORY_REGISTRY
├── core.rs:        CgroupNode 层次树
├── pids/cpu/memory/cpuset/io.rs:  5 控制器各实现同一 trait
├── provider.rs:    CgroupProvider trait(依赖倒置)
└── lib.rs:         membership + fork/exit/migrate 事务 + 属性统一分发
```

**扩展成本**:全局 `FACTORY_REGISTRY` 存 `Arc<dyn CgroupControllerFactory>`,启动时 5 行注册;新增一个控制器 = 实现 `CgroupController` trait + 加 **1 行**注册。VFS 层不认识任何具体控制器,只按 `"控制器.属性"` 命名约定统一分发。

### 5.2 六个设计巧思

1. **依赖倒置(CgroupProvider trait)**:ax-cgroup 是 no_std OS 无关组件,但 migrate/exit 需要查"进程是不是僵尸"。定义 `CgroupProvider` trait(is_zombie/get_cgroup/set_cgroup/current_uid),内核实现 `KernelCgroupProvider`,组件反过来调内核。意义:组件可独立发布、可单测、可跨 OS 复用、对于多人并行开发友好。
2. **RAII 两阶段提交**:fork 时先扣 pids 配额,但子进程 spawn 可能失败 → `begin_fork()` 返回 `CgroupForkGuard`,spawn 成功才 `commit()`,否则 `Drop` 自动 `uncharge_path` 回滚。编译器保证任何提前退出路径都不泄漏。
3. **最近公共祖先(LCA)扣费**:migrate 时只对两条 path-to-root 各自独有的前缀段扣/退费,公共段不动。避免"迁移到兄弟 cgroup 时父节点配额瞬时翻倍"的假超限。
4. **CAS 无锁计数**:`try_charge_local` 用 `compare_exchange` 循环——先读 current,`>=max` 则拒,否则 CAS+1。消除 TOCTOU 窗口,多核同时 fork 不会突破上限。
5. **属性名一次解析**:`parse_attr_name("pids.max") → ("pids","max")`,只切第一个 `.`,一处定义三处复用;`cpuset.cpus.effective` 也正确(suffix 保留 `cpus.effective`)。
6. **domain 控制器与"无内部进程"规则**:cgroup v2 约束"内部节点不能既有子 cgroup 又有进程"(针对 domain 控制器)。用 `is_domain()` 布尔位 + `write_subtree_control` 启用前检查实现。

### 5.3 host 侧测试体系(测试驱动架构验证)

8 个测试模块 / 41 个测试函数,全部在开发机经 `cargo test -p ax-cgroup` 运行,不依赖 QEMU。MockProvider 替代内核 provider:

| 模块              | 覆盖                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| roundtrip(297 行) | 5 控制器全部属性 write→read-back,含 EINVAL/EPERM 错误码语义            |
| cpu_logic         | weight→nice 映射单调性、BandwidthState 状态机(quota/consume/reset)     |
| cpuset_logic      | effective_intersect 纯函数 + 层次 recompute                             |
| memory_charge     | charge/uncharge 对称、超限拒绝+events++、migrate 搬运、层次扣费         |
| delegation        | 权限规则(root/uid/delegation)、subtree_control 门控、pids.events 计数   |
| manager_iface     | cgroup.events populated 跟踪子树、cgroup.stat 后代计数、memory.stat key |
| parse             | 属性名解析、内存值解析("1K"/"512M")                                     |
| mock              | MockProvider(per-pid 分配/zombie/UID 模拟)                              |

### 5.4 ELF loader 修复

见 3.3。`vaddr_to_file_offset()` 正确处理 PIE 虚拟地址到文件偏移转换,`populate_area()` 确保 relocation 写入前页面已映射,影响 riscv64 所有 PIE 二进制。

---

## 六、出错调试与根因复盘

### 6.1 cgroup 三次尝试:最有价值的试错

**#1107/#1156 为何关闭**:把控制器写死在 match 分支里,加一个控制器就要改核心结构。#1156 经 10 轮 review、7 次 CHANGES_REQUESTED,reviewer 的反馈越来越集中在"架构不对"。同时我也意识到**老师更想要的是组件化/可配置的 cgroup**,而不是"能跑就行"，再回看这两个实现都停留在深耦合的简单cgroup，这种架构非常不利于后续controller开发和优化。

**转折点——读 Asterinas(星绽)SysTree**:#1156 关闭后我借助ai的帮助花两天快速学习 Asterinas 的 SysTree 框架以及框内核的设计思想，学到:SysTree 是 Model(数据)、VFS 是 View、Controller 是逻辑的 MVC 模式;每个控制器实现同一 SubControl trait,通过工厂注册;全局 registry 存工厂(而不是实例)。**这是整个训练营最大的"学习→构建"转折**——从"写代码能跑"到"设计架构可扩展"。

**教训**:这次的开发经历也让我感慨良多，系统设计，架构先行。在系统开发中应该先想清楚"加一个新控制器要改几处代码",再动手写。代码能跑不等于架构对，同时也开阔了我的眼界，以前操作系统书上只学过宏内核与微内核，这次领略到了框内核的魅力。

### 6.2 典型并发 bug 的根因

| bug            | 现象                                                                   | 根因             | 修复                                        |
| -------------- | ---------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| TOCTOU 竞态    | `can_fork()`+`fork()` 两步,多核同时通过检查后都递增,current 超 max | 检查与递增非原子 | `try_fork()` CAS 单原子操作               |
| exit 下溢      | `current` 为 0 时 `fetch_sub(1)` 下溢成负                          | 无下界保护       | `fetch_update` 处理 `current==0` 不再减 |
| procs 写入污染 | PID 不存在时仍 push 进 procs 列表                                      | 缺存在性检查     | 返回`ESRCH`                               |
| config 破 CI   | `.cargo/config.toml` include 从可选改必选,缺文件 CI 失败             | include 写法错误 | 恢复`optional=true`                       |

### 6.3 host 段错误根因

cgroup host 单测一启动就 SIGSEGV。我没有盲目加 `#[allow]` 绕过,而是定位到 `SpinNoIrq` 依赖 `kernel_guard` 的特权 IRQ 指令(`cli`/`sti`)在 host 上非法。按仓库已有范式(仿 starry-process)在 dev-dependency 启用 `ax-kspin/host-test` feature 解决。**根因定位优于绕过。**

### 6.4 CI 慢 → 多分支开发

CI 特别慢(每次 push 等很久),因而我学会了同时维护 `feat/cgroup-unified`(cpuset+registry)和 `pr/cgroup-modularize`(PR 提交)两个分支,用 `git stash` 在分支间切换。**确实提高了效率。**

### 6.5 被判定为反优化的方向

- **不上半成品 L4 强制逻辑**:cpu.max 若让调度器跳过 throttled 任务但没处理 busy-spin,会引入忙等;memory 若 charge 失败直接杀进程,会误杀。所以宁可停在"扣费 + 置标志",把"调度器消费标志"留作清晰接入点。
- **不为测试改可见性**:parse/format 是模块私有函数,我没有为了测试改成 `pub`(污染公共 API),而是通过 factory `new_instance()→write_attr/read_attr` 的真实公共路径做端到端 round-trip。

---

## 七、可复用设计模式与后续方向

### 7.1 可复用经验

- **跨实现测例纪律**:先 Linux 基线 100% PASS 再上 StarryOS,才能区分"规范理解错"还是"内核没实现";`observe` 标合理变体不当 FAIL。
- **先观测再调参**:#895 loongarch 内存、#993 util-linux timeout 都是"先加 timing/completion marker 观测,再定位根因,最后才调参"。
- **工厂注册表 + trait 解耦**:加扩展项 = 实现 trait + 注册 1 行,VFS/调用方不认识具体实现。
- **依赖倒置守 no_std 边界**:OS 无关组件经 provider trait 回调内核,而非直接依赖内核。

### 7.2 L1–L4 分层诚实评估

| 层               | 含义                         | 状态                                                      |
| ---------------- | ---------------------------- | --------------------------------------------------------- |
| L1 属性 I/O 闭环 | 每属性能读/写/校验           | ✅ 5/5 控制器                                             |
| L2 统一注册框架  | trait + factory + registry   | ✅ 完全达成                                               |
| L3 内核集成接线  | mount/fork/exit/migrate 事务 | ✅ 框架达成,pids 真正生效                                 |
| L4 真实资源管控  | 限制作用于调度/内存/IO       | pids 全闭环;cpu**半闭环**;memory/cpuset/io 留接入点 |

**cpu.max 半闭环的准确状态**(不夸大):goal 分支自建 `ax_task::set_tick_hook`/`throttled` API,tick hook 已注册(`cgroup/mod.rs::init`),每 tick 按 `cpu.max` 配额扣费、耗尽即置 `throttled` 标志、跨周期复位——**扣费与标志已生效**;仅差调度器 `pick_next_task` 读 `is_throttled()` 跳过任务这一环。所以是"准闭环",不是 pids 那种完全闭环。

### 7.3 后续方向(开放式)

- 接通 cpu L4 最后一环:调度器消费节流标志;
- memory charge 接页分配器 `alloc_frame`;
- io 接块层 QoS(等 rdif-block queue layer);
- cgroup 端到端 QEMU 四架构跑出控制台 PASS;
- goal 分支 10 个 commit 经 #1379 择机转正式 PR;ax-cgroup 合入 dev。

---

## 八、仓库与文档链接清单

| 项                                 | 链接/位置                            | 状态             |
| ---------------------------------- | ------------------------------------ | ---------------- |
| 上游主仓库                         | https://github.com/rcore-os/tgoskits | —               |
| 我的 fork                          | https://github.com/SongShiQ/tgoskits | —               |
| PR#656 syscall dup/fcntl/flock     | /pull/656                            | merged           |
| PR#778 dup2/close_range/ioctl 测例 | /pull/778                            | merged           |
| PR#895 sqlite3 多架构              | /pull/895                            | merged           |
| PR#993 busybox applet              | /pull/993                            | merged           |
| PR#1006 llama.cpp                  | /pull/1006                           | merged           |
| PR#1033 riscv64 static-pie 修复    | /pull/1033                           | merged           |
| PR#1041 musl 动态链接              | /pull/1041                           | merged           |
| PR#1048 glibc 动态链接             | /pull/1048                           | merged           |
| PR#1107 cgroup 首次尝试            | /pull/1107                           | CLOSED(主动关闭) |
| PR#1156 cgroup 迭代                | /pull/1156                           | CLOSED(主动关闭) |
| PR#1234 ax-cgroup 独立 crate       | /pull/1234                           | OPEN             |
| PR#1379 cgroup L4 + manager 接口   | /pull/1379                           | Draft            |
| ax-cgroup 组件源码                 | `components/ax-cgroup/`            | —               |

---

## 九、个人心得体会

### 9.1 VibeCoding拙见

时至今日，大语言模型已经深度进入代码生成、问题求解、系统搭建和交互设计的各个环节。我认为，用codex、claude code cli 等  **coding agent 进行软件开发的本质是多人接力协作开发** 。实际上与LLM的每轮对话就是与一个全新的"人"在对话，而与coding agent的每轮对话就是与一个 能看到历史接力情况的 "人"对话。

**一、概念完整性，新增的代码能不能与代码库中已有代码相洽。**

"概念的完整性要求设计必须由一个人,或者非常少数互有默契的人员来实现。"——《人月神话》。

在我看来，coding agent本质上可以看成多人接力协作，而如何让人们劲往一处使用，历史早就已经给出答案：纲领。在开发初始可以首先与agent协同探讨出整体的开发"纲领"，简洁，凝练的阐述设计思路，同时最重要的是开发过程中这个纲领性文档的维护一定不能放任Agent自由修改，如果交给agent去做，与它不曾存在过别无二致。

 **实际践行** ：对于阶段性目标规划、实现方案等文档在产出时一定要对文档通读并内化，即便是由ai执笔，也应该要看明白整个文档思路。利用xhigh或更高思考等级的coding agent review 出建议修改点之后，利用轻量模型快速应答的特性厘清每一个建议点和设计思路，避免跑偏和过度设计，这样在以后自然而然就能培养起Technical Taste。纲领性文档确定后，在开发过程中尽可能避免二次修改了，仅允许人工增补。

**二、vibe coding 时项目随着开发进行复杂度不断上升，逐渐失控的问题。**

在大型项目开发过程中，随着人手的增加，项目的开发效率并非一直提高，甚至过多的人手投入会导致项目进度滞后。我认为这也正是大家都深有体会的vibe coding的痛点，本质上还是因为coding agent是多人接力协作，这导致vibe coding时，当前窗口发了几轮提示词，约等于让几个"人"投入了当前项目，所以项目的复杂度会越来越大逐渐不可控。

****实际践行**：** 重视提示词工程。比如说现在要让ai帮我做一件事，这件事又涉及a、b、c三个步骤，不要先让ai做a，做完了跟ai说继续做b。而是，一段提示词里交代明白。前者相当于三个人协作完成了一件事。重视任务拆解。有了上述直觉，任务拆解显得尤为重要，让ai完成的这一件事的粒度大小要把控好，当粒度过大时，就需要具体的施行文档对agent做进一步约束。

**三、coding agent能不能代码写好，核心在于"单一职责"。**

在实际开发中，面对任务给的一份初始需求，通常的做法就是先转成研发可用、ai可读的prd。接着，将prd转成trd。最后，按照trd实现。那么将prd转trd的环节是有多种做法的：1. 一份prd直接转一份trd，这一份trd中拆多个task。2. 一份prd转多个trd切片，每个切片是按照"单一职责"从prd中拆解出来的，单个切片内的task数恰到好处。

****实际践行**：** 我在开发中多次采用了第二种做法，尤其是在构建cgroup时，不仅隔绝上下文，同时也能提高开发效果，prd按照单一职责去拆成多个trd切片，开发时一个session完成一个切片的实现，下一个切片开新的session实现。

**四、方向可以让coding agent定，但掌舵的一定是人。**

coding agent本质上是多人接力协作开发，项目主线一旦交给了coding agent，等于说交给了一群"人"，走偏是必然的。 随着coding agent与LLM越来越强大，代码能力相对来说变得不那么重要了，软件工程直觉才是做好vibe coing的关键。如何培养软件工程直觉、工程思维？这里也向大家抛出一个问题。

**五、ai写的代码人一定要看。**

这点大家都清楚，但痛点在于人怎么去review coding agent写的代码？

****实际践行**：** 从系统视角和用户视角去入手解释新增代码做了什么？让agent基于新增代码说一说具体给系统带来了什么新的能力？对系统有什么增益？如果从双视角看都没有太大问题，就可以进入代码走读。代码走读一定要基于起始基点出发，基点的数据流串起了代码的生命线，看看数据最初从哪入？长什么样？顺着数据流去走读代码。

**六、很多时候会发现coding agent给的方案是脱离代码库实际实现风格的、甚至是脱离架构风格的、是不符合概念完整性的。**

我认为根本原因在于coding agent在写方案时没有彻底领悟已有代码风格，这一步要在构建之初就要严格约束，不然后期构建会逐渐放大实现代码时的问题，实现时轻易就写出了破坏系统概念完整性的代码。

****实际践行**	：** 开发者应该总结出一套通用的skill用于构建codegraph，开发风格的构建是因人而异且自我迭代的，核心点就是利用prompt约束ai，让它首先利用codegraph充分获取代码库已有代码事实，确定已经熟悉并立下不得破坏的约束后再进行后续的trd详细撰写。

### 9.2 致谢

寒来暑往，三个月的时光转瞬即逝，还记得初入训练营时的兴奋和忐忑，彼时我还没想到我能学习并实践出这么多的知识与能力。深深感谢陈老师在项目阶段对我的指导，陈老师对我的鼓励给了我莫大的动力，让我继续钻研os组件化的构建。也感谢操作系统训练营，让我从只懂原理纸上谈兵的学生，变成了真正能够驾驭ai去解决实际问题的学生，这段历程将会是我求学生涯上最宝贵的经历之一。

长风破浪会有时，我的求学之路还在继续，这段经历带给我的远不止是工程上的实践，与ai协作的能力、开发思维的培养更是我在本次训练营收获到的硕果，真心祝愿操作系统训练营越办越好，再次感谢陈渝老师的引路与教诲。桃李不言，下自成蹊。祝陈老师科研顺遂，岁岁常安，在操作系统与开源教育的探索中再谱华章。
