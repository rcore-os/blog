---
title: 自动测试系统 与 EEVDF 调度器实习三个月技术总结
date: 2026-04-25 11:52:57
categories:
    - 实习总结报告
tags:
  - author:yoinspiration
  - 自动测试系统
  - EEVDF
---

# 自动测试系统 与 EEVDF 调度器实习三个月技术总结

## 摘要

本报告汇总实习三个月在测试系统和 EEVDF 调度算法的技术产出。测试工程方面：在 AxVisor 中推进 QEMU CI 稳定性，统一 ArceOS/Linux/NimbOS 环境准备脚本、补充中英文快速上手文档，并以 PTY 驱动 NimbOS 自动化与 `fail_regex` 等增强失败可观测性；在 `github-runners` 中基于 `flock` 建立多组织共享开发板的 per-board 硬件锁，迭代修复取消路径竞态与僵尸锁问题；在 `axci` 中设计规则驱动、依赖感知的自动测试目标选择，结合 `git diff`、反向依赖图与可配置规则缩小无关全量测试范围。内核方面：在 StarryOS 分支上实现 EEVDF 调度器（双索引、deadline 抢占、统计与文档/单测/演示脚本闭环），并完成 per-CPU 异构调度与 QEMU 下代表性延时与切换行为验证。

## 自动测试系统

### 1. AxVisor QEMU CI 稳定性改进

- 链接：[PR #363](https://github.com/arceos-hypervisor/axvisor/pull/363)
- 合并状态：已合并（Merged）
- 贡献规模：26 commits，18 个文件变更，`+678 / -19`

#### 背景问题

在 AxVisor 的 QEMU 自动化测试中，存在以下痛点：

- 不同 Guest（ArceOS / Linux / NimbOS）环境准备流程分散，维护成本高；
- NimbOS 场景依赖交互式输入，CI 中容易出现“测试通过但任务失败”的误报；
- 失败信号不够明确，panic 等异常无法被尽早识别。

#### 关键工作

1. 统一环境准备入口

- 新增 [scripts/setup_qemu.sh](https://github.com/arceos-hypervisor/axvisor/blob/master/scripts/setup_qemu.sh)，统一支持 `arceos` / `linux` / `nimbos` 三类 Guest；
- 自动执行镜像下载、配置 patch、rootfs 准备，减少手工步骤和路径错误。

1. 补齐文档与上手路径

- 新增中英文 QEMU 快速上手文档：[doc/qemu-quickstart.md](https://github.com/arceos-hypervisor/axvisor/blob/master/doc/qemu-quickstart.md)、[doc/qemu-quickstart_cn.md](https://github.com/arceos-hypervisor/axvisor/blob/master/doc/qemu-quickstart_cn.md)，沉淀从依赖安装到三类 Guest 运行的完整流程；
- 在 README 中增加快速入口：[README.md](https://github.com/arceos-hypervisor/axvisor/blob/master/README.md)、[README_CN.md](https://github.com/arceos-hypervisor/axvisor/blob/master/README_CN.md)，降低新成员接入成本。

1. 增强 NimbOS 测试可自动化能力

- 新增 [scripts/ci_run_qemu_nimbos.py](https://github.com/arceos-hypervisor/axvisor/blob/master/scripts/ci_run_qemu_nimbos.py)，通过 PTY 方式启动子进程，保障 CI 环境下输入可正确透传；
- 识别 shell 提示后自动触发 `usertests`，并在命中 `usertests passed!` 时返回正确退出码。

2. 提升 CI 失败可观测性与可诊断性

- 在 QEMU 配置中补充 `fail_regex`（如 `panicked at`），尽早暴露 guest panic；
- 对 NimbOS 启动依赖（`axvm-bios.bin`）进行前置校验，避免隐式失败。

#### 结果与价值

- 测试稳定性：修复了 NimbOS 在 CI 中的交互与退出码问题，显著降低误报失败；
- 工程效率：统一 setup 脚本后，减少重复脚本与人工排障成本；
- 可维护性：流程与文档标准化后，跨场景测试可复用性更高；
- 团队协作：将经验固化为脚本与文档，便于后续同学复用与扩展。

### 2. 多组织 GitHub Runner 硬件锁机制建设（github-runners）

- PR 汇总入口：[GitHub PR 列表](https://github.com/arceos-hypervisor/github-runners/pulls?q=is%3Apr+author%3Ayoinspiration+is%3Aclosed)
- 合并成果：5 个 PR 已合并（[#2](https://github.com/arceos-hypervisor/github-runners/pull/2)、[#3](https://github.com/arceos-hypervisor/github-runners/pull/3)、[#4](https://github.com/arceos-hypervisor/github-runners/pull/4)、[#11](https://github.com/arceos-hypervisor/github-runners/pull/11)、[#13](https://github.com/arceos-hypervisor/github-runners/pull/13)）

#### 背景问题

在多组织共享开发板资源时，Runner 缺乏统一锁机制，容易出现并发抢占、取消后资源未释放、锁粒度不一致等问题，导致 CI 任务互相干扰、排队时间增加、故障定位困难。

#### 实现原理（文件锁）

- 方案基于 Linux 文件锁（`flock`）实现互斥：将每块开发板抽象为一个 lock file，同一时刻仅允许一个 Runner 持有该文件的独占锁；
- 锁粒度为 per-board：同一块板上的任务互斥，不同开发板对应不同锁文件，可被不同 Runner 并行使用；
- 任务启动时先尝试获取独占锁，获取成功后进入执行阶段，失败则等待或退出，避免多任务并发抢占同一硬件；
- 在正常结束、失败或 Cancel 路径统一执行解锁与清理，降低异常中断后残留“僵尸锁”的概率。

#### 关键工作（按迭代演进）

1. 建立锁包装能力（PR [#2](https://github.com/arceos-hypervisor/github-runners/pull/2)、[#3](https://github.com/arceos-hypervisor/github-runners/pull/3)）

- 为多组织共享硬件引入 runner-wrapper 锁包装能力（实现见 [runner-wrapper.sh](https://github.com/yoinspiration/github-runners/blob/feat/board-lock-watcher/runner-wrapper/runner-wrapper.sh)）；
- 将锁能力集成进 [runner.sh](https://github.com/yoinspiration/github-runners/blob/feat/board-lock-watcher/runner.sh) 工作流，并补齐使用文档，形成可落地的基础方案。

2. 标准化锁标识与隔离策略（PR [#4](https://github.com/arceos-hypervisor/github-runners/pull/4)）

- 将板子锁 ID 收敛到 per-board 默认策略；
- 将容器命名自动拼入 org/repo 维度，降低跨组织任务冲突概率。

3. 修复并发竞态与取消场景（PR [#11](https://github.com/arceos-hypervisor/github-runners/pull/11)、[#13](https://github.com/arceos-hypervisor/github-runners/pull/13)）

- 加固多组织 Runner 锁机制，修复 cancel 场景下的并行竞态问题；
- 将 cancel watcher 与 `docker compose` 生命周期集成，随 Runner 一起启动/回收，对使用者基本无感；
- 支持在 Cancel 路径自动释放开发板锁，减少“僵尸锁”导致的资源阻塞；
- 持续补充文档，降低维护门槛并提升团队可复用性。

#### 结果与价值

- 资源利用率：降低开发板被异常占用的概率，提升共享硬件可用性；
- 流程鲁棒性：在取消、失败等非理想路径下也能保证锁释放；
- 并发安全性：减少跨组织并行任务互相抢占与串扰；
- 可运维性：锁策略、命名规范和文档沉淀后，问题定位更快、迁移成本更低。

### 3. axci 规则驱动自动目标选择与测试链路重构

- 链接：[PR #9](https://github.com/arceos-hypervisor/axci/pull/9)
- 当前状态：Open（待合并）
- 变更规模：39 commits，21 个文件变更，`+4071 / -397`

#### 背景问题

在 CI 全量测试模式下，存在“变更范围小但测试范围大”的问题，导致执行耗时长、资源利用率偏低；同时，测试脚本长期演进后出现结构耦合，扩展与维护成本上升。

#### 实现原理（依赖感知自动选目标）

- 基于 `git diff` 获取变更文件，并结合 `cargo metadata` 将变更路径映射到对应 workspace crate；
- 从直接变更 crate 出发，在反向依赖图上做 BFS 扩散，得到受影响 crate 集合（`affected_crates`）；
- 按规则文件（路径规则、crate 规则、全量触发规则）求值得到逻辑目标 key 列表（`targets`）；
- 在 CI detect 阶段按 `target_key` 过滤预置候选矩阵，生成最终并行 job，避免无关目标全量执行。

#### 接入方式（落地步骤）

- 引用方式：在组件仓库 workflow 中显式拉取 `arceos-hypervisor/axci`（固定分支或 commit），复用其 `axci-affected` 与规则处理逻辑；
- 在仓库测试入口（如 [tests.sh](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/tests.sh)）接入 `--auto-target` 与 `--base-ref` 参数，支持按基线分支自动选择目标；
- 在 workflow（如 `.github/workflows/test.yml`）增加 detect 阶段：先计算 `targets`，再按 `target_key` 过滤预置矩阵并输出 JSON；
- 在执行阶段使用 `{% raw %}matrix.include: ${{ fromJson(...) }}{% endraw %}` 并行运行目标任务，`skip_all` 时直接跳过无关 job；
- 保留回退路径：`axci-affected` 不可用时回退到 shell 规则匹配，保证 CI 可用性与渐进迁移。

#### 规则自定义（可配置能力）

- 规则文件默认位于 `configs/test-target-rules.json`；组件仓库可在 `.github/axci-test-target-rules.json` 放置自定义规则，无需改动 axci 主仓代码；
- 组件侧规则可按仓库测试拓扑覆盖目标映射（如新增/删除 target key、调整 `target_order`、补充路径或 crate 触发条件）；
- 可按目录/文件模式定义 `selection_rules`，将路径变更映射到测试目标；
- 可按 crate 维度定义 `crate_rules`（含 `direct_only`），区分仅直接变更还是包含依赖扩散影响；
- 可通过 `run_all_patterns`、`run_all_crates` 定义“全量触发条件”，并用 `non_code` 规则跳过纯文档类变更；
- 通过 `target_order` 统一目标输出顺序，保证选择结果稳定、可预期、便于回归对比。

#### 关键工作

1. 合并模块化重构并统一测试入口

- 保持 [tests.sh](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/tests.sh) 作为统一入口，兼容已有流程并提升后续可维护性。

2. 引入规则驱动自动目标选择

- 在 [tests.sh](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/tests.sh) 增加 `--auto-target`、`--base-ref` 能力；
- 新增 `configs/test-target-rules.json`，将路径匹配与依赖规则配置化；
- 优先使用 `axci-affected` 引擎做影响范围分析，失败时回退到 shell 规则匹配，保证可用性。

3. 增强 CI 可观测性与稳定性

- 在 `test.yml` 增加 `test_targets=auto` 相关输入与 `detect-targets` 检测链路；
- 输出自动选择决策摘要（selection mode、auto reason、target list）到 `GITHUB_STEP_SUMMARY`；
- 补充 git 网络抗抖动参数、checkout 超时与关键依赖检查，降低网络和环境抖动带来的不确定失败。

4. 加固 Starry 测试链路

- 在运行前增加 `disk.img` 检查与软链兜底逻辑，减少镜像路径问题导致的无效失败。

#### 阶段性价值

- 效率收益：为“按影响范围执行测试”打通主链路，预期可显著减少无关测试开销；
- 工程收益：测试能力从脚本硬编码向“规则配置 + 引擎分析”演进；
- 质量收益：自动选择过程具备可解释输出，便于排障与规则迭代；
- 扩展收益：模块化后更便于后续新增 target、suite 与规则。

#### 相关代码（速查）

- 依赖感知引擎：[axci-affected/src/engine.rs](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/axci-affected/src/engine.rs)
- 回退脚本：[scripts/affected_crates.sh](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/scripts/affected_crates.sh)
- 规则配置：[configs/test-target-rules.json](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/configs/test-target-rules.json)
- CI 检测与矩阵编排：[.github/workflows/test.yml](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/.github/workflows/test.yml)
- 测试入口与自动目标选择：[tests.sh](https://github.com/yoinspiration/axci/blob/test/auto-target-regression/tests.sh)

原理细节与端到端数据流可参考：[docs/axci-工作原理.md](docs/axci-工作原理.md)。

## EEVDF

### 代表性成果：StarryOS 中 EEVDF 调度器实现与验证

- 仓库链接：[StarryOS feat/eevdf-scheduler](https://github.com/yoinspiration/StarryOS/tree/feat/eevdf-scheduler)
- 当前状态：功能完成并形成文档、单测与演示脚本闭环

#### 背景问题

在操作系统调度中，需要同时满足两类目标：

- 公平性：不同优先级任务应按权重获得合理 CPU 份额；
- 响应性：交互任务应尽快获得服务，避免高负载下长尾延迟。

传统仅按时间片轮转或仅按 vruntime 最小选择，难以同时兼顾“公平份额”与“截止期驱动响应”。因此在 StarryOS 上实现 EEVDF（Earliest Eligible Virtual Deadline First）调度器，验证其在可解释性、公平性和可观测性上的工程价值。

#### 关键工作

1. 完成 per-task EEVDF 核心调度逻辑

- 在 `crates/axsched/src/eevdf.rs` 中实现 `EevdfScheduler` 与 `EevdfEntity`；
- 任务实体维护 `vruntime`、`deadline`、`nice`、`slice` 等关键元数据；
- 采用 Linux 兼容 nice->weight 映射（-20..19）并据此计算 vruntime 增量与 deadline。

2. 设计双索引结构，兼顾选择效率与资格判断

- `ready_queue`：按 `(deadline, id)` 排序，快速获得最早 deadline 任务；
- `vrt_set`：按 `(vruntime, id)` 排序，用于 `vruntime <= V` 的 eligible 范围查询；
- `id_to_deadline`：连接两套索引，保障在慢路径下仍可高效定位候选任务。

3. 完成 EEVDF 选取与抢占策略

- `pick_next_task`：优先走快路径（最早 deadline 且 eligible），否则走慢路径筛选 eligible 中 deadline 最小任务；
- 当无 eligible 任务时启用 fallback（直接取最早 deadline）保证系统可推进；
- `task_tick` 中实现 deadline 驱动抢占：若队首任务 eligible 且 deadline 更早，则触发抢占。

4. 完成与运行队列集成及可观测性建设

- 在 `crates/axtask/src/run_queue.rs` 接入 tick 调度与抢占路径；
- 增加 EEVDF 统计项（picks、preempt、slice_expired、fallback）及周期日志输出；
- 提供 [scripts/demo-eevdf-stats.sh](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/scripts/demo-eevdf-stats.sh)、[scripts/bench-regression-eevdf.sh](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/scripts/bench-regression-eevdf.sh)、[scripts/parse-eevdf-stats-log.sh](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/scripts/parse-eevdf-stats-log.sh)，形成“采集-解析-回归”自动化链路。

5. 支持多 CPU 指定调度算法（per-CPU 异构调度）

- 设计并实现调度器元数据分离，支持不同 CPU 绑定不同调度算法，避免全局单策略耦合；
- 引入 `CPU_SCHED` 编译期配置，支持按 CPU 维度声明调度策略；
- 补充跨调度器迁移路径的设计与验证要点，保证任务迁移过程的状态一致性与可预期行为。
- 与 Linux 现状相比，当前方案仍以编译期静态指定为主：尚未覆盖运行时动态策略切换、成熟的跨 CPU 负载均衡协同以及更完整的调度域/拓扑感知能力。

6. 补齐文档与验证闭环

- 输出概念与实现文档：[docs/starry-scheduling.md](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/docs/starry-scheduling.md)；
- 沉淀测试与演示报告：[docs/report/eevdf-unit-tests-summary.md](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/docs/report/eevdf-unit-tests-summary.md)、[docs/report/eevdf-nice-demo-summary.md](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/docs/report/eevdf-nice-demo-summary.md)；
- 给出从理论到实测的一体化说明，降低后续同学接手成本。

#### 实验结果

以下 QEMU 延时表与切换间隔估算为**代表性一次测量**；不同主机负载、`SAMPLES`/`LOAD` 与内核版本下数值会变化，结论以「base 与 nice19 的相对关系」及当次 `serial.log`、结果目录为准。

1. 单元测试结果

- 等权重公平性测试：3 个 nice=0 任务长期运行后，CPU 占比误差控制在预期范围内；
- 加权公平性测试：nice -5/0/+5 场景下，CPU 占比与权重比一致性良好；
- 抢占与 deadline 修正测试：覆盖“时间片耗尽”和“提前抢占后剩余时间片重算”路径；
- fallback 场景测试：在强制无 eligible 条件下，兜底逻辑与统计计数行为符合预期。

2. QEMU 实测表现

- QEMU 下调度统计与现场压测结果一致：负载窗口内调度行为稳定且可解释，未观察到 `fallback` 退化，可用于后续回归比较与参数调优。

3. 现场性能与任务切换延时数据（riscv64-qemu-virt，SMP=1）

- 前台延时对比（4 个后台 `yes` 压力任务）：
  - 
  | 场景       | N   | p50    | p95    | p99    | max    |
  | -------- | --- | ------ | ------ | ------ | ------ |
  | `base`   | 50  | 0.630s | 0.640s | 0.640s | 0.850s |
  | `nice19` | 50  | 0.040s | 0.040s | 0.040s | 0.040s |

  - 结论：降低后台优先级后，前台命令 tail latency（`p95/p99`）约改善 `16x`（`0.64s -> 0.04s`），最坏时延从 `0.85s` 降到 `0.04s`。
- 任务切换延时（EEVDF 周期统计日志）：
  - 观测窗口：`interval_ticks=256`，`ticks_per_sec=100`，单窗口时长 `2.56s`
  - 负载阶段多窗口 `delta[picks]` 稳定在 `51` 左右（停压过渡窗口约 `45`）
  - 估算平均任务切换间隔：`2560 / 51 ≈ 50.2ms`（过渡窗口 `2560 / 45 ≈ 56.9ms`）
  - 对应切换频率约 `19.9Hz`（过渡窗口约 `17.6Hz`）
- 调度行为解释：
  - `slice_expired` 在负载窗口持续增长，说明切换主要由时间片驱动；
  - `preempt_by_deadline` 有触发但非主导路径；
  - `fallback_no_eligible=0`，未出现“无 eligible 任务”退化情况。
  - 小结：在持续负载下，EEVDF 调度表现为稳定的时间片主导切换（约 `50ms/次`），偶发 deadline 抢占，且无 fallback 退化，行为与设计预期一致。
- 测量方法（可复现）：
  - 环境：`riscv64-qemu-virt`，`release` 构建，`SMP=1`，`LOG=info`，启用 `eevdf-stats-demo`。
  - 负载与探针：后台启动 `4` 个 `yes >/dev/null`，前台以 `ls` 作为短任务探针，采样次数 `N=50`。
  - 前台延时统计：使用 `/usr/bin/time -f "%e"` 记录每次 `ls` 的 wall time，按升序计算 `p50/p95/p99/max`。
  - 任务切换延时统计：读取 `eevdf stats` 日志中的 `delta[picks]`；窗口配置为 `interval_ticks=256`、`ticks_per_sec=100`（窗口时长 `2.56s`）；平均任务切换间隔按 `2560 / delta_picks (ms)` 估算，切换频率按其倒数换算为 `Hz`。

#### 结果与价值

- 算法落地：将 EEVDF 从概念层落到可运行、可测试、可观测的内核实现；
- 工程可维护性：双索引 + 统计设计使问题定位路径清晰，便于持续迭代；
- 测试体系收益：建立了单测、演示、回归脚本三层验证，减少调度改动引入回归风险；
- 团队协作收益：文档化沉淀完整，便于新成员快速理解调度设计与验证方法。

#### 相关代码（速查）

- EEVDF 核心实现：[crates/axsched/src/eevdf.rs](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/crates/axsched/src/eevdf.rs)
- 调度器抽象与 per-CPU 支持：[crates/axsched/src/per_cpu.rs](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/crates/axsched/src/per_cpu.rs)
- 运行队列与调度接入：[crates/axtask/src/run_queue.rs](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/crates/axtask/src/run_queue.rs)
- 多 CPU 策略注入：[axruntime-patched/build.rs](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/axruntime-patched/build.rs)、[axruntime-patched/src/lib.rs](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/axruntime-patched/src/lib.rs)
- 编译期配置触发：[kernel/build.rs](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/kernel/build.rs)
- 观测与回归脚本：[scripts/demo-eevdf-stats.sh](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/scripts/demo-eevdf-stats.sh)、[scripts/bench-regression-eevdf.sh](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/scripts/bench-regression-eevdf.sh)、[scripts/parse-eevdf-stats-log.sh](https://github.com/yoinspiration/StarryOS/blob/feat/eevdf-scheduler/scripts/parse-eevdf-stats-log.sh)

#### 经验复盘

1. 调度算法实现不仅是“选下一个任务”，更关键是数据结构设计与状态一致性维护；
2. 可观测性应与算法实现同步建设，否则难以在真实负载下解释行为差异；
3. 对“无 eligible”这类边界路径提前设计 fallback 与测试，能显著降低线上不确定性；
4. 通过“文档 + 脚本 + 单测”三位一体沉淀，能让调度改动从个人经验升级为团队资产。

#### 附录：关键复现命令

```sh
# 0) 串口落盘（host，在 StarryOS 仓库根目录；目录需事先存在）
mkdir -p bench-results
make ARCH=riscv64 run LOG=info FEATURES=eevdf-stats-demo 2>&1 | tee bench-results/serial.log

# 1) 单元测试（host，可选）
cargo test -p axsched

# 2) 运行前台延时回归（guest）
# 使用仓库 scripts/bench-regression-eevdf.sh（wget 到 /root/ 或自行拷贝）。
# StarryOS/busybox 下建议先建结果目录，并显式指定 RESULT_DIR，避免 mkdir 行为差异：
mkdir /tmp/bench-results 2>/dev/null || true
export RESULT_DIR=/tmp/bench-results
export SAMPLES='50,200'
export LOAD=4
sh /root/bench-regression-eevdf.sh
# 结束后可检查：ls -la /tmp/bench-results 与 cat .../ls-latest-table.md

# 3) 施加/停止 CPU 负载以观测 eevdf stats（guest）
for i in 1 2 3 4; do yes >/dev/null & done
sleep 10
killall yes 2>/dev/null

# 4) 解析串口日志（host；TICKS_PER_SEC 需与内核 tick 频率一致，否则毫秒类估算仅作相对参考）
TICKS_PER_SEC=100 INTERVAL_TICKS=256 \
  sh scripts/parse-eevdf-stats-log.sh ./bench-results/serial.log
```

说明：上文「实验结果」中的延时表与切换间隔估算来自**代表性一次测量**，不同 QEMU/主机负载下数值会波动；报告引用时建议以当次 `serial.log`、`/tmp/bench-results` 输出及解析脚本结果为准。

## 相关链接

本节汇总与本报告对应的**实习过程记录仓库**、**主要上游/个人源码仓库**，以及周报、月报与部署类文档入口，便于对照 PR 与日常开发轨迹。

### 实习日志与过程文档（本仓库）

- 仓库根与索引：[os-internship-log](https://github.com/yoinspiration/os-internship-log)（开源社区实习日志；`README.md` 中含文档索引、周报与月报列表）
- 按周记录：`logs/week1.md` … `logs/week12.md`（路径相对仓库根，例如 [logs/](https://github.com/yoinspiration/os-internship-log/tree/main/logs)）
- 月报与技术报告：`技术报告2月.md`、`技术报告3月-贾一飞.md`；部署与实施说明见 `自动测试系统部署文档.md`、`多组织共享测试环境实施文档.md`

### 源代码仓库（报告涉及的主要工程）


| 工程                                                                                             | 说明                                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [arceos-hypervisor/axvisor](https://github.com/arceos-hypervisor/axvisor/pull/363)                      |  AxVisor QEMU CI 稳定性改进 |
| [arceos-hypervisor/github-runners](https://github.com/arceos-hypervisor/github-runners/pulls?q=is%3Apr+author%3Ayoinspiration+is%3Aclosed)        | 多组织共享 Runner 与开发板锁           |
| [arceos-hypervisor/axci](https://github.com/arceos-hypervisor/axci/pull/9)                            | 组件 CI 与测试编排，自动目标选择相              |
| [yoinspiration/StarryOS](https://github.com/yoinspiration/StarryOS/tree/feat/eevdf-scheduler) | EEVDF 调度器实现与验证脚本所在个人分支                    |


