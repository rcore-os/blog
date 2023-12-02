---
title: 2023开源操作系统训练营第三阶段项目一总结报告-weedien
date: 2023-12-01 16:20:31
categories:
    - oscamp 2023fall arceos unikernel
tags:
    - author:weedien
    - 2023秋冬季开源操作系统训练营
    - 第三阶段总结报告
---

#### [练习 1](https://oslearning365.github.io/oscamp_2023fall_unikernel/ch01.html#练习-1)

main 函数中，固定设置 app_size = 32，这个显然是不合理甚至危险的。

请为 image 设计一个头结构，包含应用的长度信息，loader 在加载应用时获取它的实际大小。执行通过。

思路：

- 在制作bin文件的时候，先将应用的长度信息存入，在存入应用数据；从bin文件中读取的过程中，也按照同样的约定即可。

```sh
app_size=$(stat -c %s ./hello_app.bin)

printf "$(printf '%04x' $app_size)" | xxd -r -p | dd of=./apps.bin conv=notrunc bs
=1 seek=0

dd if=./hello_app.bin of=./apps.bin conv=notrunc bs=1 seek=2

mv apps.bin ../arceos-unikernel/payload/
```



#### [练习 2](https://oslearning365.github.io/oscamp_2023fall_unikernel/ch01.html#练习-2)

在练习 1 的基础上，扩展 image 头结构，让 image 可以包含两个应用。

第二个应用包含唯一的汇编代码是 `ebreak`。

如实验 1 的方式，打印出每一个应用的二进制代码。

思路：

- 使用1个字节记录应用数量，2个字节记录应用大小
- app_num和app_size在烧录进bin文件时，先转换为十六进制，再转换为二进制写入bin文件，1个字节使用2个十六进制位表示

```sh
# 创建二进制bin文件
dd if=/dev/zero of=./apps.bin bs=1M count=32

# 通用编译命令
cargo build --target riscv64gc-unknown-none-elf --release
rust-objcopy --binary-architecture=riscv64 --strip-all -O binary target/riscv64gc-unknown-none-elf/release/hello_app ./hello_app.bin

# 应用数量
app_num=2
printf "$(printf '%02x' $app_num)" | xxd -r -p | dd of=apps.bin conv=notrunc bs=1 seek=0

# 第一个应用
app_size=$(stat -c %s ./hello_app/hello_app.bin)
printf "$(printf '%04x' $app_size)" | xxd -r -p | dd of=./apps.bin conv=notrunc bs=1 seek=1
dd if=./hello_app/hello_app.bin of=./apps.bin conv=notrunc bs=1 seek=3

# 第二个应用
app_size2=$(stat -c %s ./hello_app2/hello_app2.bin)
printf "$(printf '%04x' $app_size2)" | xxd -r -p | dd of=./apps.bin conv=notrunc bs=1 seek=9
dd if=./hello_app/hello_app.bin of=./apps.bin conv=notrunc bs=1 seek=11

mv ./apps.bin ./arceos-unikernel/payload/apps.bin
```



#### [练习 3](https://oslearning365.github.io/oscamp_2023fall_unikernel/ch02.html#练习-3)

批处理方式执行两个单行代码应用，第一个应用的单行代码是 `nop`，第二个的是 `wfi`。

思路

- 制作bin文件的过程同练习二
- 在代码中通过for来遍历二进制文件中的应用程序即可



#### [练习 4](https://oslearning365.github.io/oscamp_2023fall_unikernel/ch03.html#练习-4)

本实验已经实现了1 号调用 - SYS_HELLO，2 号调用 - SYS_PUTCHAR，请实现 3 号调用 - SYS_TERMINATE 功能调用，作用是让 ArceOS 退出，相当于 OS 关机。

思路：

- 仿造已实现的两个系统调用，通过调用`std::process:exit`方法来退出ArceOS



#### [练习 5](https://oslearning365.github.io/oscamp_2023fall_unikernel/ch04.html#练习-5)

按照如下要求改造应用 hello_app：

1. 把三个功能调用的汇编实现封装为函数，以普通函数方式调用。例如，SYS_PUTCHAR 封装为 `fn putchar(c: char)`。
2. 基于打印字符函数 putchar 实现一个高级函数 `fn puts(s: &str)`，可以支持输出字符串。
3. 应用 hello_app 的执行顺序是：Hello 功能、打印字符串功能、退出功能。

思路：

- 需要通过`linker.ld`定义hello_app的内存布局，ABI_TABLE的地址由操作系统通过a0寄存器传递给应用，之后再存入a7寄存器
- 其中的一个系统调用如下，`clobber_abi("C")`表示按照C调用约定来修改寄存器，用于保持Rust代码与内联汇编之间的一致性。

```rust
fn putchar(c: u8) {
    unsafe {
        core::arch::asm!("
            li      t0, {abi_num}
            slli    t0, t0, 3
            mv      a7, {abi_table}
            add     t1, a7, t0
            ld      t1, (t1)
            jalr    t1",
            abi_num = const SYS_PUTCHAR,
            abi_table = in(reg) ABI_ADDR,
            in("a0") c,
            clobber_abi("C"),
        )
    }
}
```



#### [练习 6](https://oslearning365.github.io/oscamp_2023fall_unikernel/ch05.html#练习-6)

1. 仿照 hello_app 再实现一个应用，唯一功能是打印字符 'D'。
2. 现在有两个应用，让它们分别有自己的地址空间。
3. 让 loader 顺序加载、执行这两个应用。这里有个问题，第一个应用打印后，不能进行无限循环之类的阻塞，想办法让控制权回到 loader，再由 loader 执行下一个应用。

思路：

- 参考练习5的思路，新增一个应用，通过for循环来执行两个应用程序
