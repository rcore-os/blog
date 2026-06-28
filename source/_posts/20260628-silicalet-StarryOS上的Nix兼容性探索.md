---

title: 从 Nix 启动到 nixpkgs：一次由 Spec Kit 驱动的 StarryOS 兼容性探索
date: 2026-06-28 21:30:00
categories:
    - OSTraining
tags:
    - author:silicalet
    - repo:tgoskits
    - 2026S
    - StarryOS
    - Nix
    - nixpkgs

---

<!-- more -->

**作者**：王浩旸（silicalet）  
**仓库**：[rcore-os/tgoskits](https://github.com/rcore-os/tgoskits)  
**个人 fork**：[silicalet/tgoskits](https://github.com/silicalet/tgoskits)

---

## 摘要

这段工作的目标，是让 Nix 从“能够在 StarryOS 中启动”，逐步走到“能够使用 nixpkgs 的 `stdenv.mkDerivation` 构建真实程序”。

实现过程被拆成三个 Git 分支和两个 Spec Kit feature：

| 分支 | 目标 | 当前结果 |
| --- | --- | --- |
| `dev` | 上游基线 | 提供 StarryOS、axfs-ng、namespace 等基础能力 |
| `002-starryos-nix-smoke` | 跑通最小 Nix smoke | Nix 2.31.5 可启动，no-sandbox 最小 derivation 可完成 |
| `003-starryos-nixpkgs` | 激活 nixpkgs 源码构建 | 已定位并修复静默 OOM 关机；完整 nixpkgs 仍受 180 秒预算和本地缓存闭包一致性约束 |

这不是一次线性的“补几个 syscall 就结束”的移植。真正困难的部分，是不断区分：网络问题、测试环境问题、Nix 自身行为、StarryOS 兼容性缺口，以及单纯的性能预算不匹配。

最终最重要的发现是：看似正常退出的 QEMU，实际路径是 Rust 全局分配器 OOM 后进入 `abort()`，而 StarryOS 的 libc 兼容层把 `abort()` 映射成了整机 `system_off()`。OOM 的主要来源也不是 Nix 进程 RSS，而是未周期回写的脏页缓存。

本文记录这条调查链，以及 Spec Kit 和本地过程日志如何帮助我在大量实验中维持可审计的事实边界。

---

## 一、为什么选择 Nix

StarryOS 的目标之一，是运行未经修改或少修改的 Linux 用户程序。Nix 对这一目标很有代表性：它不仅要求 ELF、动态链接和普通文件操作可用，还会同时压力测试进程、文件系统、namespace、锁、`mmap`、大量小文件和构建工具链。

因此，“`nix --version` 能输出”与“能够用 nixpkgs 构建程序”之间差距很大。前者验证 CLI 能启动，后者会触发完整的源码获取、解包、求值、store 管理、依赖替换和 builder 生命周期。

我把目标分成两步：

1. 先完成一个不依赖 nixpkgs、不走二进制缓存的最小 derivation；
2. 再导入固定版本的 nixpkgs，用 `stdenv.mkDerivation` 构建一个 C 语言 hello。

这个拆分后来证明非常重要。它让每一阶段只有一个主要变量，避免把 namespace、下载、nixpkgs 求值和 VFS 压力混成一个无法分析的失败。

---

## 二、用 Spec Kit 管理兼容性调查

这项工作不是只靠 issue 描述推进，而是为每个阶段维护 `spec.md`、`plan.md` 和 `tasks.md`。

Spec Kit 在这里的价值并非生成代码，而是建立约束：

- 明确成功标志和失败标志，禁止 QEMU 退出码 0 掩盖 guest 内失败；
- 将“环境阻塞”和“StarryOS 行为缺口”分开记录；
- 要求先构造最小复现，再修改内核；
- 对每个实验记录触发条件、诊断、决策、验证、影响和 upstream 状态；
- 不把临时诊断代码直接当成最终修复。

本地的 `silicalet/` 目录保存了几十份实验日志和阶段记录，并被排除在上游提交之外。它相当于调查日志本：失败的假说不会污染最终代码，但也不会在下一次切换上下文时丢失。

这套方法尤其适合内核兼容性工作。很多实验的结论不是“修好了”，而是“排除了一个方向”。如果不记录，几轮之后很容易重复测试，或者把旧结论误当成当前事实。

---

## 三、阶段一：让 Nix 真正启动

### 3.1 第一个错误：保存父 mount namespace 失败

早期 `nix-smoke` 在 guest 中安装 Nix 后，执行 `nix --version` 即失败：

```text
saving parent mount namespace: No such file or directory
```

Linux 基线显示，Nix 会访问 `/proc/self/ns/mnt`。当时 StarryOS 的 procfs 已有 `/proc/self`、`fd`、`mounts` 等节点，但没有 `ns/mnt`。

第一版修复选择了最小兼容面：让 `/proc/[pid]/ns/mnt` 存在并可被 `stat`、`open`、`fstat`。这使 Nix CLI 越过启动检查，但它不等于完整实现 mount namespace，更不等于 sandbox 已经可用。

这个边界很关键。如果只看到 Nix 启动成功就宣称“namespace 已支持”，后续 sandbox builder 的问题就会被错误分类。

### 3.2 PR #981 改变了问题边界

调查期间，上游 namespace 实现 PR #981 合并。同步之后，原来的 `unshare ENOSYS` 不再是首要问题，但 sandbox 模式的 builder 仍会长时间停住。

这里我没有继续扩大 scope 去完善整个 sandbox，而是先把 no-sandbox 路径跑通。原因很直接：默认 nixpkgs + binary cache 的验证路径并不要求 sandbox；先证明 Nix 的基本 builder 生命周期，可以为后续问题建立稳定基线。

### 3.3 最小构建中的 socketpair 缺口

最小 derivation 最初仍会卡在 builder 启动。继续缩减表达式后，发现 `builtins.derivation` 的 builder 子进程路径会触发尚未兼容的 socketpair 行为。

最终 smoke 使用 `builtins.toFile` 构造最小 store 对象，绕过这个无关变量，验证以下能力：

- Nix 2.31.5 在 StarryOS 中启动；
- `/nix/store` 可写；
- derivation/store 基本操作可完成；
- 测试能稳定输出成功或失败标志。

`002-starryos-nix-smoke` 至此形成了后续工作的基线：no-sandbox 可用，sandbox 尚不是本阶段交付物。

---

## 四、阶段二：从最小对象走向 nixpkgs

### 4.1 激活真实的 `stdenv.mkDerivation`

`003-starryos-nixpkgs` 取消了原来被注释掉的 nixpkgs 阶段，并加入一个最小 C 程序：

```nix
pkgs.stdenv.mkDerivation {
  name = "nixpkgs-hello";
  srcs = [];
  dontUnpack = true;
  buildPhase = ''
    cat > hello.c <<'EOF'
    #include <stdio.h>
    int main(void) {
        printf("hello from nixpkgs stdenv\n");
        return 0;
    }
    EOF
    $CC hello.c -o hello
  '';
  installPhase = ''
    mkdir -p $out/bin
    cp hello $out/bin/hello
  '';
}
```

之所以使用 `dontUnpack`，是因为新版 nixpkgs 的 stdenv 不再把 `writeText` 生成的普通文件当作可解包源码。这个问题在宿主机上即可复现，因此被归类为 nixpkgs 表达式兼容问题，而不是 StarryOS bug。

源码选择固定的 26.05 快照，并验证压缩包大小、hash 和宿主机求值结果。最初目标是让 guest 自己通过 `builtins.fetchTarball` 获取源码，保留真实 Nix 使用方式。

### 4.2 aarch64 prebuild 不能写死 x86_64

Nix APK 是在宿主机 staging rootfs 中通过 qemu-user 安装的。原脚本写死了 `qemu-x86_64-static`，因此 aarch64 在进入 guest 之前就失败。

修复后，prebuild 根据 rootfs 架构选择 `qemu-x86_64-static` 或 `qemu-aarch64-static`。这类问题提醒我：跨架构测试的第一步不是“内核是否启动”，而是先确认宿主预构建链路没有偷偷绑定某个架构。

---

## 五、中心故事：QEMU 为什么“正常退出”

### 5.1 一个危险的假象

nixpkgs 测试最初的现象是：

1. no-sandbox smoke 通过；
2. Nix 开始下载或解包 nixpkgs；
3. 没有 panic，没有失败标志；
4. QEMU 退出码是 0。

如果只看 runner，这像一次正常关机。实际上，测试脚本连 `EXIT` trap 都没有执行，说明 shell 不是通过普通信号或正常退出离开的。

我先用 `/proc/<pid>/wchan`、状态、RSS 和系统内存采样观察 Nix。采样显示 Nix 多数时间处于 `R` 状态，是 CPU 活跃，而非卡在内核等待队列。

但一秒一次的诊断循环后来被证明会显著扰动单核 guest。因此它只用于定位阶段，确认方向后立即移除。

### 5.2 从退出路径反推关机原因

为了判断是谁触发了关机，我在几个关键路径加入直接 UART 输出：

- 用户任务 `do_exit()`；
- init task 的 `exit_current()`；
- panic 和 abort 路径；
- 最终的 poweroff 路径。

最终捕获到的调用链是：

```text
std::alloc::rust_oom
  -> std::process::abort
  -> libc abort()
  -> ax_terminate
  -> system_off
  -> QEMU ACPI S5
```

因此，QEMU 的 0 退出码不表示测试成功，而是 StarryOS 把用户态 `abort()` 处理成了整机关闭。真正触发 abort 的，是 Rust 全局分配器 OOM。

这个结论也推翻了早期“还有几 GiB free，所以不是 OOM”的判断。进程 RSS 只描述用户进程映射，不能代表内核中 page cache 的占用。

### 5.3 真正增长的是脏页缓存

Nix 解包源码、构建 Git cache 时会创建大量文件。没有周期写回时，dirty page cache 持续增长，最终把可供内核堆使用的内存挤空。

对照实验非常明确：

- 不主动同步时，内存持续上涨，最终进入 allocator OOM；
- 前台周期执行 sync 时，内存维持在约 170—280 MiB；
- 把 QEMU 内存从 2 GiB 加到 8 GiB 只能延后失败，不能消除增长趋势。

最终修复方向包括两部分：

1. StarryOS 后台 worker 每五秒执行一次文件缓存同步，避免 dirty cache 无界增长；
2. `ax-alloc` 的字节分配失败路径调用已注册的 page reclaim callback 后重试，使它与页分配的恢复模型一致。

修复后，原来的“无标志静默关机”不再出现。测试可以在 180 秒边界输出明确失败原因。

---

## 六、OOM 修复后，为什么仍然没有通过

修复 correctness 问题，并不意味着性能目标自动满足。

### 6.1 下载与本地源码对照

为了判断是不是镜像下载问题，我测试了两条路径：

- guest 使用 `builtins.fetchTarball` 下载；
- 宿主预先注入固定 nixpkgs archive，guest 只做本地解包。

下载路径曾出现一次 `Truncated tar archive`，但独立重跑没有复现，而是在 180 秒后被 watchdog 终止。本地 archive 没有截断错误，却同样无法在三分钟内完成。

因此不能把单次 tar 截断直接归因于镜像。两条路径的共同点，是大量压缩数据处理与文件元数据操作。

### 6.2 排除 ext4：tmpfs 仍然慢

同一个 archive 在 guest 中仅执行 `tar -tzf` 可以完成，说明压缩包可读，纯遍历不是阻塞点。

但将它解压到 tmpfs，180 秒仍然无法完成。这个实验移除了 ext4、virtio-blk、journal 和磁盘 writeback，因此 rsext4 不是主要性能瓶颈。

archive 共有 89,704 个条目，其中 52,657 个文件、37,044 个目录，展开后约 322 MiB。Linux 宿主上遍历约 0.41 秒、解压约 0.81 秒；StarryOS 上 BusyBox tar 约每 30 秒推进一万个条目，线性估算需要 6—7 分钟。

### 6.3 合成 VFS 压测没有复现

为了寻找可放入回归套件的小型复现，我又测试了：

- 单目录创建 10,000 个文件；
- 深目录下对 50,000 个文件执行 chmod、chown、utimensat；
- tmpfs 顺序写入 192 MiB；
- 创建 90,000 个一字节文件并记录阶段进度。

这些基础操作都呈近似线性，无法复现真实 tar 的 180 秒超时。因此没有把一个“本来就通过”的合成 benchmark 冒充红色回归测试。

目前更准确的结论是：

- 静默关机是已定位并修复的内存回收问题；
- 完整 nixpkgs 未在 180 秒内通过，是剩余的真实 workload 性能与缓存供给问题；
- 4 vCPU 和换用 GitHub gzip archive 都没有改变三分钟结果；
- 下一条可行路径是预置精确的 nixpkgs source 与 stdenv store closure，避免 guest 重复构建 tar-to-Git cache 和下载基础工具链。

### 6.4 本地 store 预热也有一致性要求

最新实验将本地 Nix store 作为 ext4 镜像注入 guest。第一次失败并非 Nix，而是外层 rootfs 只有 1 GiB：注入后的 1.3 GiB 稀疏文件只有长度、没有数据块，挂载时自然返回 I/O error。

把每个 app 的 rootfs 扩到 3 GiB 后，内层 store 可以挂载，no-sandbox 测试通过，nixpkgs 也能直接导入本地 source。

随后又发现，预热闭包与 guest 当前 nixpkgs 快照并不一致：旧闭包包含 glibc 2.42-67，而 guest 实际请求 glibc 2.42-61。Nix 因此回退到 `cache.nixos.org`，最终写满内层镜像。

这说明“本地有一份 stdenv”还不够。Nix store 路径包含完整输入哈希，源码快照、平台、配置任何一项不同，闭包就无法复用。当前工作正在重新生成与 guest derivation 完全一致的本地闭包。

---

## 七、测试和诊断原则

### 7.1 成功必须由 guest 标志证明

QEMU 退出码不能单独作为成功依据。测试现在要求：

- no-sandbox 阶段输出独立 pass/fail 标志；
- nixpkgs 阶段输出独立 pass/fail 标志；
- 超时 180 秒后先 TERM，五秒后 KILL；
- 输出 Nix 日志尾部和退出码；
- exit 124 和 137 都明确归类为 timeout。

这避免了 `abort() -> system_off()` 再次伪装成 runner 成功。

### 7.2 诊断代码必须退出最终路径

调查中加入过 UART、wchan、RSS、进程列表、panic、abort 和 poweroff 插桩。它们帮助定位事实，但大部分不应该进入最终实现：

- 高频采样会改变单核系统的时序；
- 大量串口输出本身就是性能瓶颈；
- 诊断输出会掩盖真正的测试协议；
- 一旦调用链已确认，应保留可泛化的修复，而不是永久保留一次性日志。

最终保留的是周期 writeback、allocator reclaim retry 和确定性 timeout；临时调用链打印被移除。

### 7.3 不为“必须有回归测试”制造假复现

Spec Kit 任务原本希望把问题缩减成 grouped system regression。但实验表明，小型 VFS workload 都通过，只有完整的近九万条目 archive 能稳定表现剩余性能问题。

这种情况下，诚实地记录“当前没有有效的小型红色复现”，比提交一个与根因无关的测试更有价值。未来更合适的回归层级，是 axfs-ng 的 bounded page-cache pressure 测试，而不是把完整 nixpkgs archive 塞进普通 syscall suite。

---

## 八、阶段成果与未完成项

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Nix 2.31.5 启动 | 已完成 | x86_64/aarch64 prebuild 路径已区分 |
| no-sandbox 最小构建 | 已完成 | 作为后续稳定基线 |
| mount namespace 基础兼容 | 已完成阶段目标 | PR #981 合并后越过原 `unshare` 阻塞；不等于 sandbox 全能力 |
| nixpkgs 26.05 导入和表达式 | 已完成 | 宿主验证通过，guest 可使用本地 source 求值 |
| 静默 OOM 关机定位 | 已完成 | `rust_oom -> abort -> system_off` |
| dirty page-cache 防失控 | 已实现，待更聚焦回归 | 周期 writeback + allocation reclaim retry |
| 180 秒内完整 nixpkgs hello | 未完成 | 当前在生成精确匹配的本地 store closure |
| sandbox=true 构建 | 非当前默认路径 | namespace 支持已有进展，但仍需独立验证 |

这张表刻意不使用“基本完成”之类模糊措辞。对于系统软件，能启动、能构建最小对象、能跑 stdenv、能在 CI 时间预算内稳定通过，是四个不同的交付层级。

---

## 九、经验与反思

### 9.1 先判断观测范围，再解释数字

早期看到 8 GiB guest 仍有数 GiB free，就排除了 OOM。这个判断的问题是：观测的是用户进程 RSS 和一个不完整的系统视图，而失败发生在内核 Rust allocator。

正确的问题不是“还显示多少 free”，而是“这个指标覆盖哪些内存、遗漏哪些缓存、在哪个分配器失败”。

### 9.2 本地与网络对照必须只改变一个变量

把下载替换成本地 archive 时，如果同时改变压缩格式、source revision、解包工具和目标文件系统，就无法解释结果。

后续实验逐步固定 archive、hash、timeout 和 guest 配置，只替换输入来源，才确认下载和本地路径并非同一个可见错误，但都受真实解包 workload 限制。

### 9.3 性能问题不能靠“多给资源”定义为修复

2 GiB 增到 8 GiB、1 vCPU 增到 4 vCPU，都只改变了失败出现的时间，没有改变单线程 tar-to-Git/cache 路径的本质。

资源扩容适合作为诊断手段：如果阈值移动，说明资源压力参与其中；但它不是根因解释，更不是默认修复。

### 9.4 Spec 的价值是限制结论

这次工作里，Spec Kit 最有价值的地方是不断提醒我：

- 只有日志支持的事实才能写进结论；
- setup blocker 不能冒充 kernel gap；
- host pass 不能替代 guest pass；
- timeout 不能被描述成 hang，除非证明没有进度；
- 当前未通过，就不能因为主体功能已写完而标记完成。

代码会变化，分支会同步上游，诊断假说也会被推翻。结构化记录让这些变化仍然可以追踪。

---

## 十、后续计划

短期目标是完成与固定 nixpkgs 快照完全一致的本地 store closure，并验证：

1. guest 不访问源码镜像和 binary cache；
2. `stdenv.mkDerivation` 在 180 秒内完成；
3. `result/bin/hello` 输出符合预期；
4. x86_64 通过后，再复用同一方法验证 aarch64；
5. 为周期 writeback 和 reclaim 补一个不依赖完整 nixpkgs 的 bounded regression。

更长期的方向，是分别推进 sandbox builder 生命周期和高密度 archive workload 性能。两者都不应该与默认 no-sandbox nixpkgs 路径捆绑，否则每次失败都会重新变成一个无法归因的大问题。

---

## 结语

从 `nix --version` 到 `stdenv.mkDerivation`，中间隔着的不只是更多 syscall，而是一整套真实 Linux 应用对进程、内存、文件系统和构建环境的组合假设。

这次调查中，最容易犯的错误是过早命名问题：看到 tar 错误就叫网络问题，看到 QEMU 退出码 0 就叫正常退出，看到几 GiB free 就排除 OOM，看到 tmpfs 也慢就笼统叫 VFS 性能差。

真正有效的方法，是不断缩小变量、保存证据、推翻不成立的解释，并明确区分“已经修复的 correctness bug”和“仍未满足的性能目标”。

目前 StarryOS 上的 nixpkgs 支持还没有完成最后一步，但问题已经从一次不可见的整机退出，收敛成了可重复、可计时、可继续优化的工程任务。对内核兼容性工作而言，这种收敛本身就是重要进展。

---

## 附录：工作时间线

| 阶段 | 分支 | 关键事件 |
| --- | --- | --- |
| Nix smoke 规格化 | `002-starryos-nix-smoke` | 建立 pass/fail marker、Linux baseline 和本地调查记录 |
| namespace 启动缺口 | `002-starryos-nix-smoke` | `/proc/self/ns/mnt` 最小兼容；随后同步 PR #981 |
| no-sandbox 基线 | `002-starryos-nix-smoke` | Nix 2.31.5 启动，最小 store/build 路径通过 |
| nixpkgs 激活 | `003-starryos-nixpkgs` | 固定 26.05 source，启用 `stdenv.mkDerivation`，修复 aarch64 prebuild |
| 静默退出调查 | `003-starryos-nixpkgs` | wchan/RSS/UART/abort 路径逐层定位 |
| OOM 根因 | `003-starryos-nixpkgs` | 确认 dirty page cache 挤压 Rust allocator，`abort()` 导致整机关闭 |
| correctness 修复 | `003-starryos-nixpkgs` | 周期 writeback、allocation reclaim retry、确定性 180 秒失败协议 |
| 性能隔离 | `003-starryos-nixpkgs` | tar list、tmpfs extract、合成 VFS、4 vCPU、gzip archive 对照 |
| 本地缓存路径 | `003-starryos-nixpkgs` | 扩容 app rootfs，挂载本地 Nix store，校准精确 derivation closure |

*记录日期：2026-06-28*
