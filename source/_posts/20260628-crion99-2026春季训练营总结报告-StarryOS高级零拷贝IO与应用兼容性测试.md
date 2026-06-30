---
title: 2026春季训练营总结报告-StarryOS高级零拷贝IO与应用兼容性测试-陆刘祯
date: 2026-06-28 20:00:00
categories:
  - OSTraining
tags:
  - author:crion99
  - repo:tgoskits
  - 2026S
  - StarryOS
  - 系统调用
  - 零拷贝IO
  - 文件系统
  - 应用兼容性
  - 测试框架
---

<!-- more -->
<!-- more -->

## 一、项目背景

本次训练营中，我参与的工作主要围绕 StarryOS 的系统调用完善、系统回归测试和应用兼容性验证展开。StarryOS 是一个面向 Linux 应用兼容的操作系统项目，想要让更多真实 Linux 程序在 StarryOS 上运行，就需要不断补充系统调用语义、完善文件系统和管道等基础能力，同时也需要通过真实应用和测试框架验证系统行为是否符合预期。

我的工作可以分为两个阶段。

第一阶段主要围绕高级零拷贝 IO 相关系统调用展开，完成了 `sendfile`、`copy_file_range` 和 `splice` 三个系统调用相关的实现与测试。这部分工作主要涉及文件描述符、VFS、pipe、文件偏移以及不同 fd 类型之间的数据传输。

第二阶段主要围绕 StarryOS 的应用兼容性和系统测试展开。一方面完成了 `apk-cmake` system regression 测试，用于验证 StarryOS guest 环境中 CMake 和 C/C++ 构建链是否能够真实工作；另一方面调研并推进了 memcached 服务端应用 stress 测试，希望通过真实服务端程序验证 StarryOS 在 socket、epoll、多线程、内存分配和基础读写等方面的兼容性。

这次训练营对我来说，不只是完成几个具体任务，更重要的是比较完整地经历了真实开源操作系统项目中的开发流程：阅读已有代码、理解接口语义、实现功能、补充测试、提交 PR、根据 review 修改、排查 CI 问题，并在反馈中不断收敛修改范围。

## 二、第一阶段：高级零拷贝 IO 系统调用

第一阶段的主要工作是实现和测试 `sendfile`、`copy_file_range` 和 `splice` 三个高级零拷贝 IO 相关系统调用。

在刚开始接触这些系统调用时，我对“零拷贝”的理解还比较抽象，只知道它的目标是减少用户态和内核态之间的数据拷贝，提高 IO 效率。但实际实现后我发现，零拷贝 IO 并不是一个孤立功能，而是和文件描述符表、VFS 接口、pipe buffer、文件偏移以及不同文件对象之间的数据流动紧密相关。

这三个系统调用表面上都和数据传输有关，但它们面向的场景并不完全相同。`sendfile` 更偏向文件到另一个输出 fd 的传输，`copy_file_range` 更偏向文件到文件之间的复制，而 `splice` 则强调 pipe 参与的数据搬运。通过对比实现它们，我对 StarryOS 内部文件系统和系统调用层的理解比之前具体了很多。

### 2.1 sendfile 系统调用

`sendfile` 的主要作用是在两个文件描述符之间传输数据，典型场景是将普通文件中的内容直接发送到 socket 或其他输出文件描述符中。

普通的数据传输方式通常是用户程序先调用 `read`，把数据从输入文件读到用户态 buffer 中，再调用 `write`，把用户态 buffer 中的数据写到输出文件描述符。这样会经过用户态中转。`sendfile` 的目标则是让内核在输入文件和输出文件之间完成数据搬运，减少用户态参与。

在实现过程中，我主要处理了以下几个问题。

首先，需要根据传入的 `in_fd` 和 `out_fd` 从当前进程的文件描述符表中获取对应文件对象，并检查文件描述符是否合法。如果输入 fd 或输出 fd 不存在，需要返回对应错误。

其次，需要处理 `offset` 参数。`sendfile` 中的 offset 语义比较重要：当用户传入 offset 指针时，读取位置应当从指定 offset 开始，并在传输完成后更新该 offset；如果 offset 为空，则使用并更新输入文件自身的当前偏移。这部分让我进一步理解了“显式 offset”和“文件对象内部 offset”之间的区别。

然后，需要根据 `count` 参数控制最大传输长度。实现时不能简单假设一次就能传完所有数据，而是需要按照指定长度循环读取和写入，同时累计实际传输的字节数。如果中途读到 EOF，或者写入失败，就要根据已经传输的字节数和错误情况决定最终返回值。

通过实现 `sendfile`，我对 StarryOS 中系统调用参数处理、fd 表查找、文件对象读写接口和文件偏移维护有了更具体的认识。

### 2.2 copy_file_range 系统调用

`copy_file_range` 主要用于在两个文件之间复制数据，可以看作是更偏向文件系统内部的数据复制接口。

和 `sendfile` 相比，`copy_file_range` 的一个特点是输入文件和输出文件都可能带有显式 offset，因此实现时需要同时关注输入端和输出端的偏移管理。

在实现中，我主要关注了四个方面。

第一，根据 `fd_in` 和 `fd_out` 获取输入、输出文件对象，并检查文件描述符是否合法。如果任意一端文件描述符无效，需要及时返回错误。

第二，处理 `off_in` 和 `off_out`。如果用户传入了 offset 指针，就需要从用户指定的位置开始读写，并在复制完成后更新对应 offset；如果没有传入 offset，则使用文件对象自身的当前偏移。这里需要分别处理输入文件和输出文件两个方向的偏移，不能混淆。

第三，按照 `len` 指定的长度进行复制。实际可读数据可能少于用户请求的长度，因此最终返回值应当是实际复制的字节数，而不是直接返回用户传入的 `len`。

第四，处理边界情况。例如输入文件到达 EOF 时应当停止复制；如果复制过程中已经成功复制了一部分数据，再遇到错误，也需要根据系统调用语义返回已经完成的字节数或错误。

通过实现 `copy_file_range`，我对 VFS 层读写接口、文件偏移维护和系统调用参数检查有了更清楚的认识。

### 2.3 splice 系统调用

`splice` 相比 `sendfile` 和 `copy_file_range` 更强调 pipe 在数据传输中的作用。它可以在文件描述符和管道之间移动数据，是 Linux 零拷贝 IO 机制中比较重要的一部分。

在实现 `splice` 时，首先需要根据传入的输入 fd 和输出 fd 判断两端文件对象的类型。`splice` 的典型使用方式要求至少一端是 pipe，因此实现时需要区分普通文件、pipe 以及其他可能的文件对象，并对不支持的组合返回错误。

之后，需要处理输入端和输出端的数据传输逻辑。如果是普通文件到 pipe，需要从文件中读取数据并写入 pipe buffer；如果是 pipe 到普通文件或其他输出对象，则需要从 pipe 中取出数据并写入目标 fd。这个过程让我进一步理解了 StarryOS 中 pipe 的读写逻辑，以及 pipe buffer 在进程间通信中的作用。

此外，`splice` 同样需要处理 `len`、offset、EOF、部分传输和错误返回等问题。由于它涉及的文件对象类型更多，实现时比前两个系统调用更容易出现边界情况，因此测试也需要覆盖不同 fd 组合下的行为。

通过这一部分工作，我对零拷贝 IO 的理解不再停留在“减少内存复制”这个概念上，而是更具体地理解了系统调用如何通过文件描述符、VFS 接口和 pipe 机制把不同数据通路连接起来。

### 2.4 第一阶段小结

第一阶段的工作让我对 StarryOS 的文件系统和系统调用层有了更具体的理解。之前我对文件描述符、VFS、pipe、offset 这些概念的理解比较分散，但在实现 `sendfile`、`copy_file_range` 和 `splice` 的过程中，这些概念被串联到了一起。

这三个系统调用的侧重点可以简单概括为：

| 系统调用 | 主要场景 | 实现关注点 |
| --- | --- | --- |
| `sendfile` | 文件到输出 fd 的数据传输 | 输入 offset、输出写入、返回实际传输长度 |
| `copy_file_range` | 文件到文件复制 | 输入/输出双 offset、EOF、部分复制 |
| `splice` | pipe 参与的数据移动 | fd 类型判断、pipe buffer、不同方向的数据搬运 |

对我来说，这部分工作最大的收获是开始真正理解系统调用不是单独存在的接口，而是和内核中的多个抽象层联系在一起。一个看似简单的数据复制系统调用，背后往往需要考虑 fd 管理、文件对象、偏移语义、pipe 行为和错误返回等细节。

## 三、第二阶段：apk-cmake 系统回归测试

第二阶段中，我首先完成的是 StarryOS `apk-cmake` 系统回归测试，对应 PR #1017。这个测试的目标是验证 StarryOS guest 环境中 CMake 以及 C/C++ 构建链是否能够真实工作。

最初我认为只要在 guest 中能够安装 `cmake` 和 `build-base`，就可以说明 CMake 环境可用。但实际推进后发现，系统兼容性测试不能只停留在“工具存在”或“安装成功”这一层，而应该验证完整使用链路。

因此最终测试设计为：在 StarryOS guest 中创建一个最小 C/C++ CMake 工程，执行 `cmake --version`、`ctest --version`、`cmake -E`、`cmake -S -B`、`cmake --build`、`ctest --test-dir`，并最终运行生成的 C 和 C++ 程序。只有完整流程全部成功，才输出 `APK_CMAKE_STABLE_TEST_PASSED`。

### 3.1 主要修改内容

本次 PR 最终主要涉及以下文件：

```text
test-suit/starryos/qemu-smp1/system/apk-cmake/CMakeLists.txt
test-suit/starryos/qemu-smp1/system/apk-cmake/src/apk-cmake.sh
test-suit/starryos/qemu-smp1/system/prebuild.sh
其中，`prebuild.sh` 负责在 staging rootfs 阶段安装依赖：

```sh
apk add curl build-base cmake
```

这里保留 `curl` 是因为已有的 `apk-curl-equivalence` 用例仍然需要使用它，而 `build-base` 和 `cmake` 则用于新增的 `apk-cmake` 测试。

`apk-cmake.sh` 是最终在 StarryOS guest 中执行的测试脚本。它不再执行 runtime `apk add`，而是直接检查 guest 中是否已经具备所需工具，并创建最小 C/C++ 工程进行 configure、build、ctest 和运行测试。

`CMakeLists.txt` 则负责把 staging rootfs 中的 CMake、CTest、GCC/G++、make、binutils、头文件、库文件和 CMake runtime files 显式安装到 guest overlay 中，保证 QEMU guest 运行测试时能够找到完整构建链。

### 3.2 测试流程设计

最终的 `apk-cmake` 测试不是只检查 `cmake --version`，而是完整覆盖了 C/C++ 工程的构建流程。

测试脚本会先检查基本工具是否存在，包括：

```text
cmake
ctest
make
cc
c++
```

随后脚本会在 guest 的临时目录中创建一个最小 C/C++ CMake 工程，其中包含一个 C 程序和一个 C++ 程序。接着执行 CMake configure，生成构建目录，然后执行 build，最后通过 CTest 运行测试，并直接运行生成的二进制程序。

整个流程大致包括：

```text
cmake --version
ctest --version
cmake -E
cmake -S ... -B ...
cmake --build ...
ctest --test-dir ...
运行生成的 C 程序
运行生成的 C++ 程序
```

只有这些步骤全部成功后，才输出：

```text
APK_CMAKE_STABLE_TEST_PASSED
```

如果缺少工具、configure 失败、build 失败、ctest 失败或运行生成程序失败，都会输出失败 marker 并返回非零状态。这样可以避免测试“假通过”。

### 3.3 遇到的问题与解决过程

在实现 `apk-cmake` 测试时，我遇到了几个比较典型的问题。

#### 3.3.1 测试路径错误

最初我把测试文件放到了：

```text
test-suit/starryos/normal/qemu-smp1/system/...
```

但 reviewer 指出，StarryOS system grouped test 的发现路径是：

```text
test-suit/starryos/qemu-smp1/system
```

并不包含中间的 `normal` 目录。因此后续我将测试文件移动到正确路径，并删除了错误路径下的内容。

#### 3.3.2 PR 范围过大

早期 PR 中包含了 xattr、stress、curl、memcached、ptrace、io_uring、COW 等无关改动，导致 review 难以进行。根据 reviewer 意见，我后续重新整理分支，只保留 `apk-cmake` system regression 相关内容，避免无关修改影响合入。

这个问题让我认识到，真实开源项目中的 PR 不只是“代码能跑就行”，还需要保证修改范围清晰、主题单一、便于 reviewer 审查。

#### 3.3.3 runtime `apk add` 导致 OOM

最开始我尝试在 `apk-cmake.sh` 中直接运行：

```sh
apk add --no-cache build-base cmake
```

但在 CI 中，x86_64 和 loongarch64 job 都出现了安装阶段内存分配失败的问题。

更重要的是，早期脚本曾经把安装失败当作 skip，导致测试可能显示为 green，但实际上并没有真正执行 CMake 构建流程。reviewer 指出这种做法不能证明测试真实通过。于是我移除了 runtime `apk add`，改为在 `prebuild.sh` 中提前安装依赖。

#### 3.3.4 staging rootfs 依赖不会自动进入 guest

只在 `prebuild.sh` 中安装 `build-base` 和 `cmake` 后，guest 中仍然可能找不到：

```text
cmake
ctest
c++
make
```

原因是 `prebuild.sh` 只影响 staging rootfs，不会自动把工具复制到最终 QEMU guest overlay 中。后来我参考已有的 `apk-curl-equivalence` 用例，在 `apk-cmake/CMakeLists.txt` 中显式把所需工具和目录从 `STARRY_STAGING_ROOT` 安装到 guest overlay。

#### 3.3.5 GCC 内部程序 `cc1` 缺失

最开始我只复制了 `/usr/bin/cc`、`/usr/bin/c++`、`cmake`、`ctest`、`make` 等前端命令，但 CMake configure 阶段仍然失败，错误信息类似：

```text
cc: fatal error: cannot execute 'cc1': posix_spawnp: No such file or directory
```

这说明只复制编译器前端是不够的，还需要复制 GCC/G++ 内部目录、binutils、头文件、库文件等完整工具链依赖。因此我继续补充了 `usr/lib`、`usr/lib/gcc`、`usr/libexec/gcc`、`usr/include`、`lib`、`usr/share/cmake` 等目录，最终使 C/C++ configure、build、ctest 和运行流程完整通过。

### 3.4 验证结果

最终 CI 日志中，`apk-cmake` 在 `qemu-smp1/system` 中真实执行并通过。关键日志包括：

```text
APK_CMAKE_CTEST_BEGIN_prebuilt
Test project /tmp/cmake-build
Start 1: hello_c_runs
1/2 Test #1: hello_c_runs ................. Passed
Start 2: hello_cpp_runs
2/2 Test #2: hello_cpp_runs ............... Passed

100% tests passed, 0 tests failed out of 2

APK_CMAKE_RUN_BEGIN_prebuilt
hello from CMake C build
hello from CMake C++ build
APK_CMAKE_REPO_TEST_DONE_prebuilt
APK_CMAKE_STABLE_TEST_PASSED
STARRY_SYSTEM_TEST_PASSED: /usr/bin/starry-test-suit/apk-cmake
```

这说明新增用例已经完成以下完整路径：

```text
CMake configure
C build
C++ build
CTest
运行 C 二进制
运行 C++ 二进制
```

这部分工作让我认识到，系统测试不应只检查命令是否存在，而应尽可能验证真实使用场景。只有完整应用链路跑通，才能说明系统兼容性有了实际提升。

## 四、第二阶段：memcached 服务端应用测试

第二阶段的另一部分工作是服务端应用兼容性测试调研与 memcached stress 测试推进。

### 4.1 从 PostgreSQL 到 memcached

最开始我调研的是 PostgreSQL。PostgreSQL 是一个比较复杂的数据库服务端应用，它依赖 mmap、thread、socket、pipe、semaphore、shared memory 等系统能力，能够较全面地验证 StarryOS 的系统调用、进程通信、网络栈和文件系统稳定性。

但在提交 PostgreSQL 测试用例后，经过社区 review 发现，当前 dev 分支中已经存在较完整的 PostgreSQL 测试用例，并且我最初提交的目录结构与现有测试框架不完全匹配。因此我没有继续重复实现 PostgreSQL，而是重新选择新的服务端应用测试目标。

之后我选择了 memcached。memcached 是一个典型的轻量级 key-value cache server，主要依赖 socket、epoll、多线程、内存分配以及基础 read/write 等系统能力。相比 PostgreSQL、MySQL 等数据库类应用，memcached 的启动链路更简单，测试目标更清晰，但仍然能有效验证 StarryOS 对网络服务、后台进程、客户端连接和数据读写的支持情况。

### 4.2 memcached 测试设计

我设计的 memcached 测试流程主要包括：

1. 通过 apk 安装 memcached 和 busybox-extras；
2. 启动 memcached 服务并确认进程存在；
3. 使用 `nc` 连接本地 11211 端口；
4. 执行 `set` 命令写入键值对；
5. 执行 `get` 命令读取键值对；
6. 检查返回结果中是否包含 `STORED`、`VALUE starry_key` 和 `hello_starry`；
7. 执行 `stats` 命令，检查输出中是否包含 `STAT pid`；
8. 关闭 memcached 进程；
9. 成功时输出 `MEMCACHED_TEST_DONE=<timestamp>`，失败时输出 `MEMCACHED_TEST_FAILED`。

通过这样的测试，可以验证 memcached 在 StarryOS guest 中不仅能够启动，而且能够接受客户端连接、处理基本 key-value 读写请求，并返回服务状态信息。

计划中的测试目录为：

```text
test-suit/starryos/stress/memcached/
```

并参考已有的：

```text
test-suit/starryos/stress/postgresql/
```

为 aarch64、riscv64、x86_64、loongarch64 四个架构分别添加 QEMU TOML 测试配置，使其能够作为 StarryOS 服务端应用压力测试的一部分。

### 4.3 PR review 中发现的问题

在 memcached PR review 阶段，也发现了当前提交中仍然需要继续修复的问题。

第一个问题是 PR 中误包含了与 memcached 无关的 xattr 修改。这部分修改导致 dev 分支中已有的完整 xattr 实现被回退为 stub，属于合并冲突处理错误。后续需要恢复 origin/dev 中的 xattr 相关实现，保证本 PR 只保留 memcached 测试相关改动。

第二个问题是 `syscall/mod.rs` 中重复添加了 xattr syscall 调度，导致出现重复 match arm。这部分也需要删除，只保留 dev 分支中原有的正确实现。

第三个问题是四个架构的 memcached TOML 配置文件中出现了重复字段，例如 `args`、`uefi`、`to_bin`、`shell_prefix` 等，并且部分文件中混入了 riscv64 的 QEMU 参数。后续需要分别清理 aarch64、riscv64、x86_64、loongarch64 四个架构的配置文件，保证每个文件只保留对应架构的 QEMU 参数和统一的 memcached 测试逻辑。

因此，memcached 这部分目前更准确地说是完成了测试目标调研、测试流程设计和 PR 推进，但仍需要继续根据 review 意见修复无关改动和配置问题。后续修复完成后，需要重新运行格式检查、差异检查，并优先在 riscv64 架构上验证通过，再扩展到其他架构。

### 4.4 memcached 工作的意义

虽然 memcached 测试还需要继续根据 review 意见修复，但这个方向对 StarryOS 的应用兼容性验证是有价值的。

和简单命令行工具相比，服务端应用通常会涉及更多系统能力，例如进程启动和后台运行、socket 监听和客户端连接、epoll 或类似事件机制、多线程、内存分配、文件和网络 IO、服务状态查询与退出清理等。

因此，memcached 可以作为一个相对轻量但有代表性的服务端测试目标，为后续 Redis、nginx、数据库类应用等更复杂测试场景提供参考。

## 五、遇到的问题和收获

这次训练营中，除了具体代码实现，我也遇到了很多工程上的问题。这些问题一开始看起来比较琐碎，但实际上对我理解真实项目开发帮助很大。

### 5.1 PR 范围需要足够清晰

在 `apk-cmake` 和 memcached 两个方向上，我都遇到了 PR 范围过大的问题。早期 PR 中混入了与当前主题无关的修改，导致 review 变得困难，也增加了出错概率。

这让我认识到，开源协作中一个 PR 最好只解决一个明确问题。即使本地调试过程中临时修改了很多文件，最终提交前也需要重新整理 commit 和 diff，确保 review 范围清晰。

### 5.2 测试不能只追求 green

在 `apk-cmake` 早期版本中，runtime `apk add` 失败曾被当作 skip 处理，这会让 CI 看起来通过，但实际上没有证明 CMake 构建链真实可用。

这个问题让我意识到，测试的目标不是让 CI 显示 green，而是提供可信的验证结果。对于系统回归测试来说，必须有明确的 pass marker，也必须在失败时返回非零状态。

### 5.3 staging rootfs 和 guest overlay 需要区分

`apk-cmake` 中一个重要问题是：在 `prebuild.sh` 中安装依赖，并不意味着这些依赖会自动出现在最终 guest overlay 中。只有显式将相关工具和依赖目录安装到 overlay，guest 运行测试时才能真正使用它们。

这个问题让我对 StarryOS 测试框架中 staging rootfs、guest overlay 和 system regression 之间的关系有了更清楚的理解。

### 5.4 真实应用测试比单点功能测试更复杂

memcached 测试让我认识到，真实应用往往不是只依赖一个系统调用，而是同时依赖进程、网络、内存、文件、事件机制等多个模块。一个系统调用能跑通，不代表应用一定能跑通；一个命令能启动，也不代表服务能够正常处理请求。

因此，应用兼容性测试的价值在于覆盖更完整的真实使用链路。

## 六、后续计划

后续我希望继续沿着 StarryOS 应用兼容性和系统回归测试方向推进。

短期内，我希望继续完善 memcached 测试，修复 review 中指出的无关改动和多架构配置问题，尽量推动其合入。

之后，我也希望在已有工作的基础上，继续尝试 Redis、nginx、数据库类应用等更复杂的服务端测试场景，逐步构建更完整的 StarryOS 应用兼容性测试体系。

同时，我还需要继续补充操作系统、Rust、文件系统、网络栈和 CI 调试方面的基础。通过这次训练营，我已经对开源操作系统项目的开发流程有了更具体的认识，之后希望能够在更复杂的任务中继续提升自己的能力。

## 七、总结

作为一名大一的学生，这次训练营对我来说，更像是第一次真正参与一个开源操作系统项目的完整开发过程。以前我对操作系统的理解更多来自课程、书本和一些零散实验，而这次是在 StarryOS 这样的真实项目里，围绕具体问题去读代码、改代码、补测试、提交 PR，再根据 review 和 CI 结果不断调整。

我的工作主要分成两部分。第一部分是高级零拷贝 IO 相关系统调用，实现和测试了 `sendfile`、`copy_file_range` 和 `splice`。这部分让我对文件描述符、VFS、pipe、文件偏移和系统调用语义有了更实际的理解。第二部分是应用兼容性和系统测试，主要包括 `apk-cmake` 系统回归测试，以及 memcached 服务端应用测试的调研和推进。`apk-cmake` 让我认识到，系统测试不能只看命令是否存在，而是要验证 configure、build、test、run 这样的完整链路；memcached 则让我开始理解真实服务端应用会同时牵涉网络、进程、线程、内存和基础 IO 等多个系统能力。

我也能明显感觉到自己现在还处在打基础阶段。很多问题刚开始并不能马上看懂，需要一边查资料，一边读已有代码，再一点点把任务拆开处理。所以这次完成的工作可能还不是特别复杂，但对我来说已经很有意义：我第一次比较完整地经历了从理解需求、实现功能、补充测试，到处理 review、排查 CI、收敛 PR 范围的过程。

这次训练营让我收获最大的地方，不只是学会了某几个系统调用或某个测试怎么写，而是开始理解真实项目里的工程开发方式。代码能跑只是第一步，后面还要考虑测试是否可信、PR 是否足够聚焦、修改是否影响已有功能、CI 失败该如何判断原因。这些经验在平时课程作业里很难完整接触到。
