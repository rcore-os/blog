---
title: 2023开源操作系统训练营第三阶段项目一基本任务总结报告-Cptraser
date: 2023-11-19 14:05:55
categories:
    - oscamp 2023fall arceos unikernel
tags:
    - author: Cptraser
    - 2023秋冬季开源操作系统训练营
    - 第三阶段总结报告
---

## ArceOS & Unikernel

为了解决目前已有的 OS 存在的一些问题，比如内存安全问题、组件耦合问题、开发门槛高等，ArceOS 应运而生。其设计目标与理念是能够设计出面向智能物联网设备，安全、高性能、应用兼容性高的操作系统。

其中存在一个 ArceOS 的实现 —— Unikernel，其核心思想就是将应用和OS设计为一体，OS 以库的形式存在。

对于每个应用，选择一系列以实现的组件构成的 OS 来适配（组件化），也就是对于不同的应用而言可能会存在不同形态的 OS。

Unikernel 是单应用、单地址空间、单特权级的形态。

下面简单总结一下第三阶段基本任务的附加题部分的思路。

## 实验一

本实验实现了一个 app 名为 loader 的外部应用加载器，然后实现了两个外部应用，熟悉了编译生成和封装二进制文件的流程。

本实验的难点在于头结构的设计以及封装命令的设计。

头结构我设计成如下模式：

> app_num : u8

> app_size : u16 , app_content

读取部分：

```rust
    let start = PLASH_START as *const u8;
    let apps_num = unsafe {
        let num = core::slice::from_raw_parts(start, 1);
        num[0]
    };
    ...
    let mut start_now = PLASH_START + 1;
    ...
    let size: &[u8] = unsafe { core::slice::from_raw_parts(start_now as *const u8, 2) };

    let apps_size = (((size[0] as usize) << 8) + size[1] as usize) as usize; 
    let apps_start = (start_now + 2) as *const u8;
    let code = unsafe { core::slice::from_raw_parts(apps_start, apps_size) };
```

封装命令一开始我只是简单的固定二进制文件大小后修改其中的参数，后面由于实验经常会修改外部应用导致大小极易变化，我就修改为自动计算封装，如下：

```bash
# 编译外部应用1
cd hello_app
cargo build --target riscv64gc-unknown-none-elf --release
rust-objcopy --binary-architecture=riscv64 --strip-all -O binary target/riscv64gc-unknown-none-elf/release/hello_app ./hello_app.bin
cd ..
# 编译外部应用2
cd hello_app2
cargo build --target riscv64gc-unknown-none-elf --release
rust-objcopy --binary-architecture=riscv64 --strip-all -O binary target/riscv64gc-unknown-none-elf/release/hello_app2 ./hello_app2.bin
cd ..
# 拷贝全0 32M 到 apps.bin
dd if=/dev/zero of=./apps.bin bs=1M count=32
# 封装 app_num
app_num=2
printf "$(printf '%02x' $app_num)" | xxd -r -p | dd of=apps.bin conv=notrunc bs=1 seek=0
# 当前的该封装的位置
start=1
# 封装第一个外部应用
app_size=$(stat -c %s ./hello_app/hello_app.bin)
printf "$(printf '%04x' $app_size)" | xxd -r -p | dd of=./apps.bin conv=notrunc bs=1 seek=$start
start=$(($start+2))
dd if=./hello_app/hello_app.bin of=./apps.bin conv=notrunc bs=1 seek=$start
start=$(($start+$app_size))
# 继续封装第二个外部应用
app_size2=$(stat -c %s ./hello_app2/hello_app2.bin)
printf "$(printf '%04x' $app_size2)" | xxd -r -p | dd of=./apps.bin conv=notrunc bs=1 seek=$start
start=$(($start+2))
dd if=./hello_app2/hello_app2.bin of=./apps.bin conv=notrunc bs=1 seek=$start
start=$(($start+$app_size))
# 移动封装完成的二进制文件到 ./arceos/payload 下
mkdir -p ./arceos/payload
mv ./apps.bin ./arceos/payload/apps.bin
```

## 实验二

本实验较为简单，在原来的基础上修改外部应用的汇编指令以及 loader 改用批处理的方式加载外部应用即可。

## 实验三

本实验设计了一个可供外部应用调用的 ABI 接口，SYS_TERMINATE 直接调用 axstd::process::exit 即可，ArceOS 已经完成好了相应的接口。

## 实验四

本实验实现了对 ABI 接口函数的调用。

但是本实验极容易出现奇怪的问题。

因为本身需要使用到传入的 ABI 接口地址，还需要在外部应用内实现相应的调用，所以需要熟悉一些汇编指令。

就拿我本身写的时候而言，当时在写 puts 函数的时候，调用了字符串切片的 chars 函数，但是由于这个函数用到迭代器的原因，出现了奇怪的寄存器问题，导致调用 ABI 函数返回时 RA 寄存器失效。后来改换为 as_bytes 才成功。

然后是我帮同学解决的问题，他存在地址未映射的问题。后来我发现，是他是冒用 in(reg) 和 out(reg) 导致的，传入了 ABI 接口的地址导致调用函数的时候接口地址丢失，在第二次调用的时候就会访问未映射的地址。

## 实验五

本实验较为容易，只需要初始化地址空间以后，对于每一个外部应用调用 RUN_START 前切换地址空间即可。

外部应用不能进行阻塞，我们需要修改 _start 函数的返回值为 ()，如下：

```rust
unsafe extern "C" fn _start(abi_entry: usize) -> ()
```

## 总结

第三阶段项目一的基础部分让我们熟悉了 Unikernel 的框架结构，并熟悉了调用一个函数的具体封装步骤。

实现了彩色输出，移植了 HashMap，实现了一个基础的内存分配器，完成了 dtb 文件的解析和输出，修改原有的协作式调度算法fifo为抢占式调度算。

还基本实现和理解了外部多应用、ABI接口函数和多地址空间的 Unikernel模式。